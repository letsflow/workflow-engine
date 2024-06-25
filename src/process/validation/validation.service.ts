import { Injectable } from '@nestjs/common';
import { ScenarioService } from '../../scenario/scenario.service';
import { StartInstructions } from '../process.dto';
import { ExplicitState, NormalizedScenario } from '@letsflow/core/scenario';
import { Process } from '@letsflow/core/process';

@Injectable()
export class ValidationService {
  constructor(private scenarios: ScenarioService) {}

  public async instantiate(instructions: StartInstructions): Promise<string[]> {
    if (!instructions.scenario) {
      return ['Scenario is required'];
    }

    if (!(await this.scenarios.has(instructions.scenario))) {
      return ['Scenario not found'];
    }

    const { _disabled: disabled, ...scenario } = await this.scenarios.get(instructions.scenario);
    const errors = [];

    if (disabled) {
      errors.push('Scenario is disabled');
    }

    errors.push(...this.validateActors(scenario, instructions));
    errors.push(...this.validateInitialAction(scenario, instructions));

    return errors;
  }

  private validateActors(scenario: NormalizedScenario, instructions: StartInstructions): string[] {
    if (!instructions.actors) {
      return [];
    }

    const errors = [];
    const definedActors = Object.keys(scenario.actors);

    for (const key of Object.keys(instructions.actors)) {
      if (!this.actorIsDefined(definedActors, key)) {
        errors.push(`Actor '${key}' not found in scenario`);
      } else {
        // TODO: Validate actor using schema
      }
    }
  }

  private validateInitialAction(scenario: NormalizedScenario, instructions: StartInstructions): string[] {
    const errors = [];

    const action = typeof instructions.action === 'object' ? instructions.action.key : instructions.action;
    if (action && !(scenario.states.initial as ExplicitState).actions.includes(action)) {
      errors.push(`Action '${action}' is not available in the initial state`);
    }

    return errors;
  }

  private actorIsDefined(definedActors: string[], key: string) {
    return definedActors.includes(key) || definedActors.some((k) => k.endsWith('*') && key.startsWith(k.slice(0, -1)));
  }

  isAuthorized(process: Process, action: string, actor?: string): boolean {
    return actor && process.scenario.actions[action].actor.includes(actor);
  }

  async step(process: Process, action: string, actor: string): Promise<string[]> {
    return [];
  }
}
