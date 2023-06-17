import { Body, Controller, Delete, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApikeyService } from './apikey.service';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiKey, ApiKeySummary } from './apikey.dto';
import { AdminGuard, AuthGuard } from '../common/auth';
import { Response } from 'express';

@ApiBearerAuth()
@ApiTags('API key')
@Controller('apikey')
@UseGuards(AuthGuard, AdminGuard)
export class ApikeyController {
  constructor(private service: ApikeyService) {}

  @ApiOperation({ summary: 'List API keys' })
  @ApiResponse({ status: 200, description: 'Success', type: ApiKeySummary, isArray: true })
  @Get('/')
  async list(): Promise<ApiKeySummary[]> {
    return await this.service.list();
  }

  @ApiOperation({ summary: 'Get API key details' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Success', type: ApiKey })
  @Get('/:id')
  async get(@Param('id') id: string): Promise<ApiKey> {
    return await this.service.get(id);
  }

  @ApiOperation({ summary: 'Issue a new API key' })
  @ApiResponse({ status: 201, description: 'Created', type: ApiKey })
  @Post('/')
  async issue(@Body() input: Partial<ApiKey>, @Res() res: Response) {
    const apiKey = await this.service.issue(input);
    res.status(201).json(apiKey);
  }

  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 204, description: 'No Content' })
  @Delete('/:id')
  async revoke(@Param('id') id: string, @Res() res: Response): Promise<void> {
    await this.service.revoke(id);
    res.status(204).send();
  }
}
