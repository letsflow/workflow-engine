import Ajv from 'ajv/dist/2020';
import { Injectable } from '@nestjs/common';
import { ScenarioService } from '../../scenario/scenario.service';
import { StartInstructions } from '../process.dto';
import { ExplicitState, NormalizedScenario } from '@letsflow/core/scenario';
import { Actor, Process } from '@letsflow/core/process';
import { Account } from '../../common/auth';
import { ApiKey } from '../../apikey';

@Injectable()
export class ValidationService {
  constructor(
    private ajv: Ajv,
    private scenarios: ScenarioService,
  ) {}

  public async canInstantiate(instructions: StartInstructions): Promise<string[]> {
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

  isAuthorized(process: Process, action: string, actor: string): boolean {
    const actions = process.current?.actions ?? [];
    const { actor: actors } = actions.find((a) => a.key === action) ?? { actor: [] as string[] };

    return actors.includes(actor);
  }

  canStep(process: Process, action: string): string[] {
    const errors = [];

    if (!process.scenario.actions[action]) {
      errors.push(`Action '${action}' not found in scenario`);
    }

    if (!process.current.actions.find((a) => a.key === action)) {
      errors.push(`Action '${action}' not available in state '${process.current.key}'`);
    }

    return errors;
  }

  validateResponse(process: Process, action: string, response: any) {
    const { responseSchema } = process.current.actions.find((a) => a.key === action) || { responseSchema: {} };

    if (Object.keys(responseSchema).length === 0) {
      return []; // Fast return when there's no schema
    }

    const validate = this.ajv.compile(responseSchema);

    validate(response);
    return validate.errors;
  }

  private matchUser(actor: Pick<Actor, 'id' | 'role'>, user: Pick<Account, 'id' | 'roles'>): boolean {
    return (
      actor.id === user.id ||
      (actor.role &&
        (typeof actor.role === 'string'
          ? user.roles.includes(actor.role)
          : user.roles.some((r) => actor.role.includes(r))))
    );
  }

  isActor(process: Process, user: Pick<Account, 'id' | 'roles'>): boolean {
    return Object.values(process.actors).some((actor) => this.matchUser(actor, user));
  }

  determineActor(process: Process, action: string, user?: Pick<Account, 'id' | 'roles'>): string | undefined {
    const processAction = process.current.actions.find((a) => a.key === action);

    if (!processAction) {
      throw new Error(`Unable to determine actor: Action '${action}' is not available in the current state`);
    }

    const possibleActors = user
      ? Object.entries(process.actors)
          .filter(([, actor]) => this.matchUser(actor, user))
          .map(([key]) => key)
      : Object.keys(process.actors);

    return processAction.actor.find((actor: string) => possibleActors.includes(actor));
  }

  async isAllowedByApiKey(
    apiKey: Pick<ApiKey, 'processes'>,
    scenario: { id: string; name?: string } | string,
    actor?: string,
    action?: string,
  ): Promise<boolean> {
    if (typeof scenario === 'string') {
      scenario = { id: scenario, name: (await this.scenarios.get(scenario)).name };
    }

    return (
      !apiKey.processes ||
      apiKey.processes.some(
        (p) =>
          (!p.scenario || p.scenario === scenario.id || p.scenario === scenario.name) &&
          (!actor || !p.actors || p.actors.includes(actor)) &&
          (!action || !p.actions || p.actions.includes(action)),
      )
    );
  }
}
