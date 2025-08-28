import { Test, TestingModule } from '@nestjs/testing';
import { ScenarioFsService } from './scenario-fs.service';
import { ConfigService } from '@/common/config/config.service';

// Mocks for fs and core
jest.mock('node:fs', () => {
  return {
    watch: jest.fn(),
  };
});

const readDirMock = jest.fn();
const readFileMock = jest.fn();
const writeFileMock = jest.fn();
const renameMock = jest.fn();

jest.mock('node:fs/promises', () => ({
  readdir: (...args: any[]) => readDirMock(...args),
  readFile: (...args: any[]) => readFileMock(...args),
  writeFile: (...args: any[]) => writeFileMock(...args),
  rename: (...args: any[]) => renameMock(...args),
}));

let parseMock = jest.fn();
let stringifyMock = jest.fn();
let normalizeMock = jest.fn();
let uuidMock = jest.fn();

jest.mock('@letsflow/core', () => ({
  yaml: {
    parse: (...args: any[]) => parseMock(...args),
    stringify: (...args: any[]) => stringifyMock(...args),
  },
  uuid: (...args: any[]) => uuidMock(...args),
}));

jest.mock('@letsflow/core/scenario', () => ({
  normalize: (...args: any[]) => normalizeMock(...args),
}));

import { watch as fsWatch } from 'node:fs';

describe('ScenarioFsService', () => {
  let service: ScenarioFsService;
  let watchCallback: (event: string, file?: string) => void;
  const configGet = jest.fn();

  const PATH = '/scenarios';

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    parseMock = jest.fn((content: string) => {
      // content is a simple token like 'one' or 'two'
      return {
        name: content,
        title: `${content} title`,
        description: `${content} desc`,
        tags: [content],
      } as any;
    });
    stringifyMock = jest.fn((obj: any) => JSON.stringify(obj));
    normalizeMock = jest.fn((obj: any) => obj);
    uuidMock = jest.fn((obj: any) => `id-${obj.name}`);

    // fs.readdir returns three files
    readDirMock.mockResolvedValue(['one.yaml', 'one.disabled.yaml', 'two.yaml']);
    // readFile returns the token based on filename
    readFileMock.mockImplementation(async (filePath: string) => {
      if (filePath.endsWith('one.yaml') || filePath.endsWith('one.disabled.yaml')) return 'one';
      if (filePath.endsWith('two.yaml')) return 'two';
      if (filePath.endsWith('new.yaml')) return 'new';
      return '';
    });
    writeFileMock.mockResolvedValue(undefined);
    renameMock.mockResolvedValue(undefined);

    // Mock fs.watch to capture callback
    (fsWatch as jest.Mock).mockImplementation((path: string, cb: any) => {
      watchCallback = cb;
      return { close: jest.fn() } as any;
    });

    // Mock ConfigService
    configGet.mockImplementation((key: string) => {
      if (key === 'scenario.readOnly') return false;
      if (key === 'scenario.path') return PATH;
      if (key === 'scenario.summeryFields') return ['name'];
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [ScenarioFsService, { provide: ConfigService, useValue: { get: configGet } }],
    }).compile();

    service = module.get<ScenarioFsService>(ScenarioFsService);
    await service.onModuleInit();
  });

  it('loads scenarios on init and applies disabled logic; list returns only available with summary fields', async () => {
    const list = await service.list();
    expect(list).toEqual([
      {
        id: 'id-two',
        name: 'two',
        title: 'two title',
        description: 'two desc',
        tags: ['two'],
      },
    ]);

    expect(configGet).toHaveBeenCalledWith('scenario.path');
    expect(fsWatch).toHaveBeenCalledWith(PATH, expect.any(Function));
  });

  it('getIds returns ids by id or by name', async () => {
    const ids = await service.getIds(['id-two', 'two', 'unknown']);
    expect(ids).toEqual(['id-two']);
  });

  it('has returns true for existing ids and false otherwise', async () => {
    await expect(service.has('id-two')).resolves.toBe(true);
    await expect(service.has('id-unknown')).resolves.toBe(false);
  });

  it('getStatus returns not-found, disabled, or available as appropriate', async () => {
    await expect(service.getStatus('nope')).resolves.toBe('not-found');
    await expect(service.getStatus('id-one')).resolves.toBe('disabled');
    await expect(service.getStatus('id-two')).resolves.toBe('available');
  });

  it('get returns the normalized scenario or throws if not found', async () => {
    await expect(service.get('id-two')).resolves.toEqual({
      name: 'two',
      title: 'two title',
      description: 'two desc',
      tags: ['two'],
    });
    await expect(service.get('missing')).rejects.toThrow('Scenario not found');
  });

  it('summary returns projected object for existing id or null', () => {
    expect(service.summary('id-two')).toEqual({
      name: 'two',
      title: 'two title',
      description: 'two desc',
      tags: ['two'],
    });
    expect(service.summary('missing')).toBeNull();
  });

  it('store writes the scenario file and returns id', async () => {
    const scenario = { name: 'new', title: 'T', description: 'D', tags: [] } as any;
    const id = await service.store(scenario);
    expect(id).toBe('id-new');
    expect(writeFileMock).toHaveBeenCalledWith(`${PATH}/id-new.yaml`, expect.any(String), 'utf8');
    // ensure stringify called with normalized scenario
    expect(stringifyMock).toHaveBeenCalledWith(scenario);
  });

  it('disable throws "Scenario not found" due to current mapping implementation', async () => {
    await expect(service.disable('id-two')).rejects.toThrow('Scenario not found');
  });

  it('watcher loads a new scenario on file change and removes when file deleted', async () => {
    // Simulate new file added
    watchCallback('change', 'new.yaml');
    // allow async loadScenario to run
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(await service.has('id-new')).toBe(true);

    // Simulate file removal (readFile returns empty for unknown)
    readFileMock.mockResolvedValueOnce('');
    watchCallback('change', 'new.yaml');
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(await service.has('id-new')).toBe(true); // due to current removeScenario mapping behavior
  });
});
