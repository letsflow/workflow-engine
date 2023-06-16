import { Body, Controller, Delete, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiResponse,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiConsumes,
  ApiProduces,
  ApiHeader,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ScenarioService } from './scenario.service';
import { ScenarioSummary } from './scenario.dto';
import { Request, Response } from 'express';
import { yaml } from '@letsflow/api';
import { Scenario, validate } from '@letsflow/api/scenario';
import Negotiator from 'negotiator';
import { AuthGuard, AdminGuard } from '../common/auth/guards';

//const scenarioSchema = 'https://schemas.letsflow.io/v1.0.0/scenario';

@ApiBearerAuth()
@ApiTags('Scenario')
@Controller('scenarios')
@UseGuards(AuthGuard, AdminGuard)
export class ScenarioController {
  constructor(private service: ScenarioService) {}

  @ApiOperation({ summary: 'Get all scenarios' })
  @ApiResponse({ status: 200, description: 'Success', type: ScenarioSummary, isArray: true })
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

  @ApiOperation({ summary: 'Get scenario by ID' })
  @ApiParam({ name: 'id', description: 'Scenario ID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiProduces('application/json', 'application/x-yaml')
  @ApiHeader({ name: 'Accept', enum: ['application/json', 'application/yaml'] })
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
  @Post()
  async store(@Body() scenario: Scenario, @Req() req: Request, @Res() res: Response): Promise<void> {
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
  @Delete('/:id')
  async disable(@Param('id') id: string, @Res() res: Response): Promise<void> {
    if (!(await this.service.has(id))) {
      res.status(404).send('Scenario not found');
      return;
    }

    await this.service.disable(id);
    res.status(204).send();
  }
}
