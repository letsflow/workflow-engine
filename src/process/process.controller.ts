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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StartInstructions } from './process.dto';
import { Response } from 'express';
import { ValidationService } from './validation/validation.service';
import { Account, ApiKey, ApiPrivilege, AuthApiKey, AuthGuard, AuthUser } from '@/auth';
import { ActionEvent, Process, validateProcess } from '@letsflow/core/process';
import { isEmpty } from '@/common/utils/is-empty';
import { AuthService } from '@/auth/auth.service';

@ApiBearerAuth()
@ApiTags('process')
@Controller('processes')
@UseGuards(AuthGuard)
export class ProcessController {
  public constructor(
    private service: ProcessService,
    private validation: ValidationService,
    private auth: AuthService,
  ) {}

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

    const processes = await this.service.list(options);
    res.status(200).json(processes);
  }

  @ApiOperation({ summary: 'Get a process by ID' })
  @ApiParam({ name: 'id', description: 'Process ID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiProduces('application/json')
  @Get('/:id')
  public async get(
    @Param('id') id: string,
    @AuthUser() user: Account | undefined,
    @AuthApiKey() apiKey: ApiKey | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!(await this.service.has(id))) {
      res.status(404).send('Process not found');
      return;
    }

    const process = await this.service.get(id);

    if (apiKey && !(await this.validation.isAllowedByApiKey(apiKey, process.scenario))) {
      res.status(403).send('Insufficient privileges of API key');
      return;
    }

    if (user && !this.auth.hasPrivilege(user, 'process:super') && !this.validation.isActor(process, user)) {
      res.status(403).send('Not allowed to access process');
      return;
    }

    res.status(200).json(process);
  }

  @ApiOperation({ summary: 'Start a process' })
  @ApiConsumes('application/json')
  @ApiBody({ required: true, type: StartInstructions })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiPrivilege(['process:create', 'process:start'])
  @Post()
  public async start(
    @Headers('As-Actor') actor: string | undefined,
    @AuthUser() user: Account | undefined,
    @AuthApiKey() apiKey: ApiKey | undefined,
    @Body() instructions: StartInstructions,
    @Res() res: Response,
  ): Promise<void> {
    if (apiKey && !(await this.validation.isAllowedByApiKey(apiKey, instructions.scenario))) {
      res.status(403).send('Insufficient privileges of API key');
      return;
    }

    if (!instructions.action && user && !this.auth.hasPrivilege(user, 'process:super')) {
      res.status(403).send('Starting a process without an initial action required super privileges');
      return;
    }

    if (
      (!isEmpty(instructions.actors) || !isEmpty(instructions.vars)) &&
      !this.auth.hasPrivilege(user, 'process:super')
    ) {
      res.status(403).send('Starting a process with actors or vars requires super privileges');
      return;
    }

    const errors = await this.validation.canInstantiate(instructions);
    if (errors.length > 0) {
      res.status(400).json(errors);
      return;
    }

    const process = await this.service.instantiate(instructions);

    const processErrors = validateProcess(process);
    if (processErrors.length > 0) {
      res.status(400).json(processErrors);
      return;
    }

    const { key: action, response } =
      typeof instructions.action === 'object' ? instructions.action : { key: instructions.action, response: {} };

    if (!action) {
      await this.service.save(process);
    } else {
      await this.doStep(process, user, action, actor, response, res);
    }

    if (res.statusCode >= 400) {
      return;
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
  @ApiBody({ required: true })
  @ApiResponse({ status: 204, description: 'No Content' })
  @ApiPrivilege('process:step')
  @Post(':id/:action')
  public async step(
    @Param('id') id: string,
    @Param('action') action: string,
    @Headers('As-Actor') actor: string | undefined,
    @AuthUser() user: Account | undefined,
    @AuthApiKey() apiKey: ApiKey | undefined,
    @Body() body: any,
    @Res() res: Response,
  ): Promise<void> {
    if (!(await this.service.has(id))) {
      res.status(404).send({ error: { message: 'Process not found' } });
      return;
    }

    const process = await this.service.get(id);

    if (!(action in process.scenario.actions)) {
      res.status(404).send({ error: { message: 'Unknown action for this process' } });
      return;
    }

    if (apiKey && !(await this.validation.isAllowedByApiKey(apiKey, process.scenario, actor, action))) {
      res.status(403).send({ error: { message: 'Insufficient privileges of API key' } });
      return;
    }

    await this.doStep(process, user, action, actor, body, res);

    if (res.statusCode >= 400) {
      return;
    }

    res.status(204).send();
  }

  private async doStep(
    process: Process,
    user: Account,
    action: string,
    actor: string,
    response: any,
    res: Response,
  ): Promise<void> {
    const stepActor = this.validation.determineActor(process, action, actor, user);

    if (!actor) {
      res.status(403).json({ error: { message: 'Not allowed to access process' } });
      return;
    }

    if (!this.validation.isAuthorized(process, action, actor)) {
      res.status(403).json({ error: { message: 'Not allowed to execute this action' } });
      return;
    }

    const updated = await this.service.step(process, action, stepActor, response);
    const lastEvent = updated.events[updated.events.length - 1] as ActionEvent;

    if (lastEvent.skipped) {
      res.status(400).json({ error: { message: 'Unable to step', reason: lastEvent.errors } });
      return;
    }
  }
}
