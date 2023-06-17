import { Body, Controller, Delete, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApikeyService } from './apikey.service';
import { ApiBearerAuth, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiKey, ApiKeySummary } from './apikey.dto';
import { AdminGuard, AuthGuard } from '../common/auth';
import { Response } from 'express';
import { ScenarioSummary } from '../scenario/scenario.dto';

@ApiBearerAuth()
@ApiTags('ApiKey')
@Controller('apikey')
@UseGuards(AuthGuard, AdminGuard)
export class ApikeyController {
  constructor(private service: ApikeyService) {}

  @Get('/')
  @ApiResponse({ status: 200, description: 'Success', type: ApiKeySummary, isArray: true })
  async list(): Promise<ApiKeySummary[]> {
    return await this.service.list();
  }

  @ApiParam({ name: 'id' })
  @Get('/:id')
  @ApiResponse({ status: 200, description: 'Success', type: ApiKey })
  async get(@Param('id') id: string): Promise<ApiKey> {
    return await this.service.get(id);
  }

  @Post('/')
  @ApiResponse({ status: 201, description: 'Created', type: ApiKey })
  async issue(@Body() input: Partial<ApiKey>, @Res() res: Response) {
    const apiKey = await this.service.issue(input);
    res.status(201).json(apiKey);
  }

  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 204, description: 'No Content' })
  @Delete('/:id')
  async revoke(@Param('id') id: string, @Res() res: Response): Promise<void> {
    await this.service.revoke(id);
    res.status(204).send();
  }
}
