import { Body, Controller, Delete, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
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
import { ScenarioService } from './scenario.service';
import { ScenarioSummary } from './scenario.dto';
import { Request, Response } from 'express';
import { yaml } from '@letsflow/core';
import { Scenario, validate } from '@letsflow/core/scenario';
import Negotiator from 'negotiator';
import { ApiPrivilege, AuthGuard, Roles } from '../common/auth';

@ApiBearerAuth()
@ApiTags('scenario')
@Controller('scenarios')
@Roles(['admin'])
@UseGuards(AuthGuard)
export class ScenarioController {
  constructor(private service: ScenarioService) {}

  @ApiOperation({ summary: 'List scenarios' })
  @ApiResponse({ status: 200, description: 'Success', type: ScenarioSummary, isArray: true })
  @ApiPrivilege('scenario:list')
  @Get()
  async list(): Promise<ScenarioSummary[]> {
    return await this.service.list();
  }

  private contentNegotiation(req: Request, ext?: string): string | null {
    if (ext === 'json') return 'application/json';
    if (ext === 'yaml') return 'application/yaml';
    if (!ext) return new Negotiator(req).mediaType(['application/json', 'application/yaml']);

    return null;
  }

  @ApiOperation({ summary: 'Get a scenario by ID' })
  @ApiParam({ name: 'id', description: 'Scenario ID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiProduces('application/json', 'application/x-yaml')
  @ApiHeader({ name: 'Accept', enum: ['application/json', 'application/yaml'] })
  @ApiPrivilege('scenario:get')
  @Get('/:id')
  async get(@Param('id') filename: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const [id, ext] = filename.split('.');

    if (!(await this.service.has(id))) {
      res.status(404).send('Scenario not found');
      return;
    }

    const { _disabled: disabled, ...scenario } = await this.service.get(id);

    if (disabled) res.header('X-Disabled', 'true');

    if (this.contentNegotiation(req, ext) === 'application/yaml') {
      res.status(200).header('Content-Type', 'application/yaml').send(yaml.stringify(scenario));
    } else {
      res.status(200).json(scenario);
    }
  }

  @ApiOperation({ summary: 'Store a scenario' })
  @ApiConsumes('application/json', 'application/yaml')
  @ApiBody({ required: true, schema: { type: 'object' } })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Invalid scenario' })
  @ApiResponse({ status: 403, description: 'Read-only mode' })
  @ApiPrivilege('scenario:add')
  @Post()
  async store(@Body() scenario: Scenario, @Req() req: Request, @Res() res: Response): Promise<void> {
    if (this.service.isReadOnly) {
      res.status(403).send('Read-only mode');
      return;
    }

    if (!validate(scenario)) {
      res.status(400).json(validate.errors);
      return;
    }

    const id = await this.service.store(scenario);

    res.status(201).setHeader('Location', `${req.url}/${id}`).send();
  }

  @ApiOperation({ summary: 'Disable a scenario' })
  @ApiParam({ name: 'id', description: 'Scenario ID', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'No Content' })
  @ApiResponse({ status: 403, description: 'Read-only mode' })
  @Delete('/:id')
  async disable(@Param('id') id: string, @Res() res: Response): Promise<void> {
    if (this.service.isReadOnly) {
      res.status(403).send('Read-only mode');
      return;
    }

    if (!(await this.service.has(id))) {
      res.status(404).send('Scenario not found');
      return;
    }

    await this.service.disable(id);
    res.status(204).send();
  }
}
