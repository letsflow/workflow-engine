import { Injectable } from '@nestjs/common';
import { NormalizedScenario, Scenario } from '@letsflow/core/scenario';
import { ScenarioSummary } from './scenario.dto';
import { MUUID } from 'uuid-mongodb';

export type ScenarioDocument = NormalizedScenario & { _id: MUUID; _disabled: boolean };

@Injectable()
export abstract class ScenarioService {
  isReadOnly = false;

  abstract list(): Promise<ScenarioSummary[]>;

  abstract has(id: string): Promise<boolean>;

  abstract get(id: string): Promise<NormalizedScenario & { _disabled: boolean }>;

  abstract store(scenario: Scenario): Promise<string>;

  abstract disable(id: string): Promise<void>;
}
