import { Controller, ForbiddenException, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';
import { ApiExcludeEndpoint, ApiOperation } from '@nestjs/swagger';
import { AuthService } from '@/auth/auth.service';

@Controller()
export class AppController {
  constructor(
    private readonly app: AppService,
    private readonly auth: AuthService,
  ) {}

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
  } {
    return this.app.info;
  }

  @ApiOperation({ summary: 'Get demo accounts' })
  @Get('/demo-accounts')
  getDemoAccounts(): Array<{ id: string; name?: string; roles?: string[]; token: string }> {
    if (!this.auth.demoAccounts) {
      throw new ForbiddenException('Demo accounts are disabled');
    }

    return this.auth.demoAccounts;
  }
}
