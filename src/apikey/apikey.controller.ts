import { Body, Controller, Delete, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiKeyService } from './apikey.service';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiKey, IssueApiKeyDto } from './apikey.dto';
import { ApiPrivilege, AuthGuard } from '@/auth';
import { Response } from 'express';

@ApiBearerAuth()
@ApiTags('API key')
@Controller('apikey')
@UseGuards(AuthGuard)
export class ApiKeyController {
  constructor(private service: ApiKeyService) {}

  @ApiOperation({ summary: 'List API keys' })
  @ApiResponse({ status: 200, description: 'Success', type: ApiKey, isArray: true })
  @Get('/')
  async list(): Promise<ApiKey[]> {
    return await this.service.list();
  }

  @ApiOperation({ summary: 'Issue a new API key' })
  @ApiResponse({ status: 201, description: 'Created', type: ApiKey })
  @ApiPrivilege('apikey:issue')
  @Post('/')
  async issue(@Body() input: IssueApiKeyDto, @Res() res: Response) {
    const apiKey = await this.service.issue(input);
    res.status(201).json(apiKey);
  }

  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 204, description: 'No Content' })
  @ApiPrivilege('apikey:revoke')
  @Delete('/:id')
  async revoke(@Param('id') id: string, @Res() res: Response): Promise<void> {
    await this.service.revoke(id);
    res.status(204).send();
  }
}
