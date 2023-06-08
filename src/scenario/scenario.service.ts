import { Injectable, OnModuleInit } from '@nestjs/common';
import { normalize, Scenario, uuid } from '@letsflow/api';
import { ConfigService } from '../common/config/config.service';
import * as fs from 'fs/promises';
import { ScenarioSummary } from './scenario.dto';

type NormalizedScenario = Required<Scenario>;

@Injectable()
export class ScenarioService implements OnModuleInit {
  private path: string;
  private readonly scenarios: Map<string, NormalizedScenario> = new Map();
  private readonly disabled = new Set<string>();

  constructor(private config: ConfigService) {}

  private async load(): Promise<void> {
    const files = (await fs.readdir(this.path)).filter((file) => file.endsWith('.json'));

    await Promise.all(
      files.map(async (file) => {
        const json = await fs.readFile(`${this.path}/${file}`, 'utf-8');
        const scenario = JSON.parse(json.toString());

        const id = file.replace(/\.json$/, '');
        this.scenarios.set(id, scenario);
      }),
    );
  }

  private async loadDisabled(): Promise<void> {
    try {
      const disabled = await fs.readFile(`${this.path}/.disabled`, 'utf-8');
      this.disabled.clear();
      disabled.split('\n').forEach((id) => this.disabled.add(id));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      this.disabled.clear();
    }
  }

  async onModuleInit() {
    this.path = this.config.get('paths.scenarios');

    await fs.mkdir(this.path, { recursive: true });
    await this.load();
    await this.loadDisabled();
  }

  list(): ScenarioSummary[] {
    return Array.from(this.scenarios.entries()).map(([filename, { title, description }]) => {
      const id = filename.replace(/\.json$/, '');
      return { id, title, description, disabled: this.isDisabled(id) };
    });
  }

  has(id: string): boolean {
    return this.scenarios.has(id);
  }

  get(id: string): NormalizedScenario {
    return this.scenarios.get(id);
  }

  isDisabled(id: string): boolean {
    return this.disabled.has(id);
  }

  async store(scenario: Scenario): Promise<string> {
    const normalized = normalize(scenario) as Required<Scenario>;
    const id = uuid(normalized);

    if (!this.has(id)) {
      await fs.writeFile(`${this.path}/${id}.json`, JSON.stringify(normalized, null, 2));
      this.scenarios.set(id, normalized);
    }

    return id;
  }

  async disable(id: string): Promise<void> {
    this.disabled.add(id);

    const disabled = Array.from(this.disabled.values()).join('\n');
    await fs.writeFile(`${this.path}/.disabled`, disabled);
  }
}
