import { Body, Controller, Get, Headers, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ListOptions, ProcessService } from './process.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StartInstructions } from './process.dto';
import { Response } from 'express';
import { Account, ApiKey, ApiPrivilege, AuthApiKey, AuthGuard, AuthUser } from '@/auth';
import { ActionEvent, instantiate, Process } from '@letsflow/core/process';
import { AuthService } from '@/auth/auth.service';
import { ScenarioService } from '@/scenario/scenario.service';
import { Scenario } from '@letsflow/core/scenario';

@ApiBearerAuth()
@ApiTags('process')
@Controller('processes')
@UseGuards(AuthGuard)
export class ProcessController {
  public constructor(
    private processes: ProcessService,
    private scenarios: ScenarioService,
    private auth: AuthService,
  ) {}

  isAllowedByApiKey(
    apiKey: Pick<ApiKey, 'privileges' | 'processes'>,
    scenario: Scenario,
    actor?: string,
    action?: string,
  ): boolean {
    if (apiKey.privileges.includes('*') || apiKey.privileges.includes('process:super')) {
      return true;
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

  @ApiOperation({ summary: 'List processes' })
  @ApiParam({ name: 'page', description: 'List page (max 100 processes per page)', type: 'number' })
  @ApiParam({
    name: 'all',
    description: 'Also return processes where user is not an actor in (requires super privileges)',
    type: 'boolean',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiProduces('application/json')
  @Get()
  public async list(
    @Query('page') page: number | undefined,
    @Query('all') all: boolean | undefined,
    @AuthUser() user: Account | undefined,
    @AuthApiKey() apiKey: Pick<ApiKey, 'processes'> | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (all && !this.auth.hasPrivilege(user, 'process:super')) {
      res.status(403).send('Not allowed to list all processes');
      return;
    }

    const options: ListOptions = {
      limit: 100,
      page: page ?? 1,
    };

    if (!all && apiKey) {
      options.scenarios = (apiKey.processes ?? []).map(({ scenario }) => scenario);
    }
    if (!all && user) {
      options.actors = [{ id: user.id }, ...(user.roles ?? []).map((role) => ({ role }))];
    }

    const processes = await this.processes.list(options);
    res.status(200).json(processes);
  }

  @ApiOperation({ summary: 'Get a process by ID' })
  @ApiParam({ name: 'id', description: 'Process ID', format: 'uuid' })
  @ApiQuery({ name: 'predict', description: 'Predict next states', type: 'boolean' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiProduces('application/json')
  @Get('/:id')
  public async get(
    @Param('id') id: string,
    @AuthUser() user: Account | undefined,
    @AuthApiKey() apiKey: ApiKey | undefined,
    @Query('predict') addPrediction: boolean | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!(await this.processes.has(id))) {
      res.status(404).send('Process not found');
      return;
    }

    let process = await this.processes.get(id);

    if (apiKey && !this.isAllowedByApiKey(apiKey, process.scenario)) {
      res.status(403).send('Insufficient privileges of API key');
      return;
    }

    if (user && !this.auth.hasPrivilege(user, 'process:super') && !this.processes.isActor(process, user)) {
      res.status(403).send('Not allowed to access the process');
      return;
    }

    if (addPrediction) {
      process = this.processes.predict(process);
    }

    res.status(200).json(process);
  }

  @ApiOperation({ summary: 'Start a process' })
  @ApiQuery({ name: 'predict', description: 'Predict next states', type: 'boolean' })
  @ApiHeader({
    name: 'As-Actor',
    description:
      'Specify actor when multiple actors could have performed the action and actor cannot be determined based on the user',
    required: false,
  })
  @ApiConsumes('application/json')
  @ApiBody({ required: true, type: StartInstructions })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiPrivilege('process:start')
  @Post()
  public async start(
    @Headers('As-Actor') actor: string | undefined,
    @AuthUser() user: Account | undefined,
    @AuthApiKey() apiKey: ApiKey | undefined,
    @Query('predict') addPrediction: boolean | undefined,
    @Body() instructions: StartInstructions,
    @Res() res: Response,
  ): Promise<void> {
    const scenarioStatus = await this.scenarios.getStatus(instructions.scenario);
    if (scenarioStatus !== 'available') {
      const message = scenarioStatus === 'not-found' ? 'Scenario not found' : 'Scenario is disabled';
      res.status(400).json({ error: { message } });
      return;
    }

    const scenario = await this.scenarios.get(instructions.scenario);

    if (apiKey && !this.isAllowedByApiKey(apiKey, scenario)) {
      res.status(403).send('Insufficient privileges of API key');
      return;
    }

    let process = instantiate(scenario);

    const { key: action, response } =
      typeof instructions.action === 'object' ? instructions.action : { key: instructions.action, response: undefined };

    process = await this.doStep(process, user, action, actor, response, res);
    if (!process) return;

    if (addPrediction) {
      process = this.processes.predict(process);
    }

    res.status(201).header('Location', `/processes/${process.id}`).json(process);
  }

  @ApiOperation({ summary: 'Step through a process' })
  @ApiParam({ name: 'id', description: 'Process ID', format: 'uuid' })
  @ApiParam({ name: 'action', description: 'Process action' })
  @ApiHeader({
    name: 'As-Actor',
    description:
      'Specify actor when multiple actors could have performed the action and actor cannot be determined based on the user',
    required: false,
  })
  @ApiConsumes('application/json')
  @ApiBody({ required: true })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiPrivilege('process:step')
  @Post(':id/:action')
  public async step(
    @Param('id') id: string,
    @Param('action') action: string,
    @Headers('As-Actor') actor: string | undefined,
    @AuthUser() user: Account | undefined,
    @AuthApiKey() apiKey: ApiKey | undefined,
    @Query('predict') addPrediction: boolean | undefined,
    @Body() body: any,
    @Res() res: Response,
  ): Promise<void> {
    if (!(await this.processes.has(id))) {
      res.status(404).send({ error: { message: 'Process not found' } });
      return;
    }

    let process = await this.processes.get(id);

    if (!(action in process.scenario.actions)) {
      res.status(404).send({ error: { message: 'Unknown action for this process' } });
      return;
    }

    if (apiKey && !this.isAllowedByApiKey(apiKey, process.scenario, actor, action)) {
      res.status(403).send({ error: { message: 'Insufficient privileges of API key' } });
      return;
    }

    process = await this.doStep(process, user, action, actor, body, res);
    if (!process) return;

    if (addPrediction) {
      process = this.processes.predict(process);
    }

    res.status(200).json(process);
  }

  private async doStep(
    process: Process,
    user: Account,
    action: string,
    actor: string,
    response: any,
    res: Response,
  ): Promise<Process | null> {
    const stepActor = this.processes.determineActor(process, action, actor, user);

    if (!stepActor) {
      const message = actor ? `Not allowed to perform as actor '${actor}'` : 'Not allowed to access process';
      res.status(403).json({ error: { message } });
      return null;
    }

    const updated = await this.processes.step(process, action, stepActor, response);
    const lastEvent = updated.events[updated.events.length - 1] as ActionEvent;

    if (lastEvent.skipped) {
      res.status(400).json({ error: { message: `Failed to execute action`, reason: lastEvent.errors } });
      return null;
    }

    return updated;
  }
}
