import { Body, Controller, Get, Param, Post, Res, Headers, UseGuards } from '@nestjs/common';
import { ProcessService } from './process.service';
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
import { AuthGuard, AuthUser } from '../common/auth';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@ApiTags('process')
@Controller('processes')
export class ProcessController {
  public constructor(
    private service: ProcessService,
    private validation: ValidationService,
  ) {}

  @ApiOperation({ summary: 'List all processes' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiProduces('application/json')
  @Get()
  public async list(@Res() res: Response): Promise<void> {
    const processes = await this.service.list();
    res.status(200).json(processes);
  }

  @ApiOperation({ summary: 'Start a process' })
  @ApiConsumes('application/json')
  @ApiBody({ required: true, type: StartInstructions })
  @ApiResponse({ status: 201, description: 'Created' })
  @Post()
  public async start(@Body() instructions: StartInstructions, @Res() res: Response): Promise<void> {
    const errors = await this.validation.instantiate(instructions);
    if (errors.length > 0) {
      res.status(400).json(errors);
      return;
    }

    const process = await this.service.start(instructions);

    res.status(201).header('Location', `/processes/${process.id}`).json(process);
  }

  @ApiOperation({ summary: 'Step through a process' })
  @ApiParam({ name: 'id', description: 'Process ID', format: 'uuid' })
  @ApiParam({ name: 'action', description: 'Process action' })
  @ApiHeader({ name: 'X-Actor', description: 'Actor key', required: false })
  @ApiBody({ required: true })
  @ApiResponse({ status: 204, description: 'No Content' })
  @Post(':id/:action')
  public async step(
    @Param('id') id: string,
    @Param('action') action: string,
    @Headers('X-Actor') actor: string | undefined,
    @AuthUser() user: { id: string },
    @Body() body: any,
    @Res() res: Response,
  ): Promise<void> {
    if (!(await this.service.has(id))) {
      res.status(404).send('Process not found');
      return;
    }

    const process = await this.service.get(id);

    if (!(action in process.scenario.actions)) {
      res.status(404).send('Unknown action for this process');
      return;
    }

    actor ||= this.service.determineActor(process, action, user.id);

    if (!actor) {
      res.status(403).json({ error: { message: 'Not allowed to access process' } });
      return;
    }

    const stepErrors = this.validation.canStep(process, action);
    if (stepErrors.length > 0) {
      res.status(400).json({
        error: {
          message: 'Unable to step',
          reason: stepErrors,
        },
      });
      return;
    }

    if (!this.validation.isAuthorized(process, action, actor)) {
      res.status(401).json({ error: { message: 'Not allowed to execute this action' } });
      return;
    }

    const respErrors = this.validation.validateResponse(process, action, body);
    if (respErrors.length > 0) {
      res.status(400).json({
        error: {
          message: 'Invalid response',
          reason: respErrors,
        },
      });
      return;
    }

    await this.service.step(process, action, actor, body);

    res.status(204).send();
  }

  @ApiOperation({ summary: 'Get a process by ID' })
  @ApiParam({ name: 'id', description: 'Process ID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiProduces('application/json')
  @Get('/:id')
  public async get(
    @Param('id') id: string,
    @AuthUser() user: { id: string; roles: string[] },
    @Res() res: Response,
  ): Promise<void> {
    if (!(await this.service.has(id))) {
      res.status(404).send('Process not found');
      return;
    }

    const process = await this.service.get(id);

    if (!user.roles.includes('admin') && !this.service.isActor(process, user.id)) {
      res.status(403).send('Not allowed to access process');
      return;
    }

    res.status(200).json(process);
  }
}
