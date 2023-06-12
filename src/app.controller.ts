import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';
import { ApiExcludeEndpoint, ApiOperation } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/')
  @ApiExcludeEndpoint()
  root(@Res() res: Response): void {
    res.redirect('/api-docs');
  }

  @ApiOperation({ summary: 'Get system information' })
  @Get('/info')
  getInfo(): {
    name: string;
    version: string;
    description: string;
    env: string;
    accounts?: Array<{ id: string; name?: string; roles?: string[]; token: string }>;
  } {
    return this.appService.info;
  }
}
