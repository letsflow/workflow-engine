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
import { Account, ApiPrivilege, AuthGuard, AuthUser } from '@/common/auth';
import { AuthApiKey } from '@/common/auth/decorators/auth-apikey.decorator';
import { ApiKey } from '@/apikey';
import { Process } from '@letsflow/core/process';

@ApiBearerAuth()
@ApiTags('process')
@Controller('processes')
@UseGuards(AuthGuard)
export class ProcessController {
  public constructor(
    private service: ProcessService,
    private validation: ValidationService,
  ) {}

  @ApiOperation({ summary: 'List processes' })
  @ApiParam({ name: 'page', description: 'List page (max 100 processes per page)', type: 'number' })
  @ApiParam({
    name: 'all',
    description: 'Also return processes where user is not an actor in (admin only)',
    type: 'boolean',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiProduces('application/json')
  @ApiPrivilege('process:read')
  @Get()
  public async list(
    @Query('page') page: number | undefined,
    @Query('all') all: boolean | undefined,
    @AuthUser() user: Account | undefined,
    @AuthApiKey() apiKey: Pick<ApiKey, 'processes'> | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (all && user && !user.roles.includes('admin')) {
      res.status(403).send('Not allowed to list all processes');
      return;
    }

    const options: ListOptions = {
      limit: 100,
      page: page ?? 1,
    };

    if (apiKey?.processes?.length > 0) {
      options.scenarios = apiKey.processes.map(({ scenario }) => scenario);
    }

    if (user && !all) {
      options.actors = [{ id: user.id }, ...(user.roles ?? []).map((role) => ({ role }))];
    }

    const processes = await this.service.list(options);
    res.status(200).json(processes);
  }

  @ApiOperation({ summary: 'Get a process by ID' })
  @ApiParam({ name: 'id', description: 'Process ID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiProduces('application/json')
  @ApiPrivilege('process:read')
  @Get('/:id')
  public async get(
    @Param('id') id: string,
    @AuthUser() user: Account | undefined,
    @AuthApiKey() apiKey: Pick<ApiKey, 'processes'> | undefined,
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

    if (user && !user.roles.includes('admin') && !this.validation.isActor(process, user)) {
      res.status(403).send('Not allowed to access process');
      return;
    }

    res.status(200).json(process);
  }

  @ApiOperation({ summary: 'Start a process' })
  @ApiConsumes('application/json')
  @ApiBody({ required: true, type: StartInstructions })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiPrivilege('process:start')
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

    if (!instructions.action && user && !user.roles.includes('admin')) {
      res.status(403).send('Not allowed to start a process without specifying an action');
      return;
    }

    const errors = await this.validation.canInstantiate(instructions);
    if (errors.length > 0) {
      res.status(400).json(errors);
      return;
    }

    const process = await this.service.instantiate(instructions);

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
    @AuthApiKey() apiKey: Pick<ApiKey, 'processes'> | undefined,
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
    if (user) {
      actor ||= this.validation.determineActor(process, action, user);

      if (!actor) {
        res.status(403).json({ error: { message: 'Not allowed to access process' } });
        return;
      }
    }

    if (!this.validation.isAuthorized(process, action, actor)) {
      res.status(403).json({ error: { message: 'Not allowed to execute this action' } });
      return;
    }

    const stepErrors = this.validation.canStep(process, action);
    if (stepErrors.length > 0) {
      res.status(400).json({ error: { message: 'Unable to step', reason: stepErrors } });
      return;
    }

    const respErrors = this.validation.validateResponse(process, action, response);
    if (respErrors.length > 0) {
      res.status(400).json({
        error: {
          message: 'Invalid response',
          reason: respErrors,
        },
      });
      return;
    }

    await this.service.step(process, action, actor, response);
  }
}
