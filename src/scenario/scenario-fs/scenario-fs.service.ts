import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../common/config/config.service';
import { normalize, NormalizedScenario, Scenario } from '@letsflow/core/scenario';
import { ScenarioSummary } from '../scenario.dto';
import * as fs from 'node:fs/promises';
import { watch } from 'node:fs';
import { uuid, yaml } from '@letsflow/core';
import { ScenarioService } from '../scenario.service';

@Injectable()
export class ScenarioFsService extends ScenarioService {
  private readonly logger = new Logger(ScenarioFsService.name);

  private path: string;
  private readonly scenarios = new Map<string, NormalizedScenario & { _disabled: boolean }>();
  private scenarioList: ScenarioSummary[] = [];
  private scenarioFiles: Record<string, string> = {};
  private summeryKeys: string[] = ['id', 'name', 'title', 'description', 'tags'];

  constructor(private readonly config: ConfigService) {
    super();
  }

  async onModuleInit() {
    this.isReadOnly = this.config.get('scenario.readOnly');
    this.path = this.config.get('scenario.path');
    this.summeryKeys = [...this.summeryKeys, ...this.config.get('scenario.summeryFields')];

    await this.loadScenarios();

    watch(this.path, async (_, file) => {
      if (!file) {
        return;
      }

      const scenarioYaml = await fs.readFile(`${this.path}/${file}`, 'utf8').catch(() => '');

      if (scenarioYaml) {
        this.loadScenario(file).catch(() => this.logger.error(`Failed to load scenario ${file}`));
      } else {
        this.removeScenario(file).catch(() => this.logger.error(`Failed to remove scenario ${file}`));
      }
    });
  }

  async loadScenarios() {
    const files = (await fs.readdir(this.path)).filter((file) => file.endsWith('.yaml'));
    await Promise.all(files.map((file) => this.loadScenario(file)));
  }

  private async loadScenario(file: string, scenarioYaml?: string) {
    scenarioYaml ??= await fs.readFile(`${this.path}/${file}`, 'utf8');

    const scenario = yaml.parse(scenarioYaml);
    const normalized = normalize(scenario);
    const id = uuid(normalized);

    const disabled =
      file.endsWith('.disabled.yaml') ||
      Object.entries(this.scenarioFiles).some(([f, i]) => i === id && f.endsWith('.disabled.yaml'));

    if (disabled) {
      this.scenarioList = this.scenarioList.filter((scenario) => scenario.id !== id);
    } else if (!this.scenarios.has(id)) {
      this.scenarioList.push({ id, ...this.project(normalized) });
    }

    this.scenarios.set(id, { ...normalized, _disabled: disabled });
    this.scenarioFiles[file] = id;
  }

  private async removeScenario(file: string) {
    if (!this.scenarioFiles[file]) return;

    const id = this.scenarioFiles[file];
    delete this.scenarioFiles[id];

    const removed = !Object.values(this.scenarioFiles).includes(id);
    const disabled = Object.entries(this.scenarioFiles).some(([f, i]) => i === id && f.endsWith('.disabled.yaml'));

    if (removed) {
      this.scenarios.delete(id);
    }

    if (removed || disabled) {
      this.scenarioList = this.scenarioList.filter((scenario) => scenario.id !== id);
    }
  }

  private project(scenario: NormalizedScenario): ScenarioSummary {
    const projected: Partial<ScenarioSummary> = {};

    for (const key of this.summeryKeys) {
      if (key in scenario) {
        projected[key] = scenario[key];
      }
    }

    return projected as ScenarioSummary;
  }

  async list(): Promise<ScenarioSummary[]> {
    return this.scenarioList;
  }

  async getIds(references: string[]): Promise<string[]> {
    return this.scenarioList
      .filter((scenario) => references.includes(scenario.id) || (scenario.name && references.includes(scenario.name)))
      .map((scenario) => scenario.id);
  }

  async has(id: string): Promise<boolean> {
    return this.scenarios.has(id);
  }

  async get(id: string): Promise<NormalizedScenario & { _disabled: boolean }> {
    const scenario = this.scenarios.get(id);
    if (!scenario) throw new Error('Scenario not found');

    return scenario;
  }

  async store(scenario: Scenario): Promise<string> {
    const normalized = normalize(scenario);
    const id = uuid(normalized);
    const filename = `${this.path}/${id}.yaml`;

    await fs.writeFile(filename, yaml.stringify(normalized), 'utf8');

    return id;
  }

  async disable(id: string): Promise<void> {
    if (!this.scenarioFiles[id]) throw new Error('Scenario not found');

    const filename = this.scenarioFiles[id];
    const newFilename = filename.replace(/\.yaml$/, '.disabled.yaml');

    await fs.rename(`${this.path}/${filename}`, `${this.path}/${newFilename}`);
  }

  summary(id: string): ScenarioSummary | null {
    const scenario = this.scenarios.get(id);
    return scenario ? this.project(scenario) : null;
  }
}
