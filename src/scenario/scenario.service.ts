import { Injectable } from '@nestjs/common';
import { NormalizedScenario, Scenario } from '@letsflow/core/scenario';
import { ScenarioSummary } from './scenario.dto';

@Injectable()
export abstract class ScenarioService {
  isReadOnly = false;

  abstract list(): Promise<ScenarioSummary[]>;

  abstract getIds(references: string[]): Promise<string[]>;

  abstract has(id: string): Promise<boolean>;

  abstract getStatus(id: string): Promise<'not-found' | 'disabled' | 'available'>;

  abstract get(id: string): Promise<NormalizedScenario>;

  abstract store(scenario: Scenario): Promise<string>;

  abstract disable(id: string): Promise<void>;
}
