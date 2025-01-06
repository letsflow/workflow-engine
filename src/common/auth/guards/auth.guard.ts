import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { Reflector } from '@nestjs/core';
import { ApiPrivilege, Roles } from '@/common/auth';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    return token && token.startsWith('lfl_')
      ? await this.verifyApiKey(context, request, token)
      : this.verifyJwt(context, request, token);
  }

  private async verifyApiKey(context: ExecutionContext, request: Request, token: string): Promise<boolean> {
    const apiKey = await this.auth.verifyApiKey(token);
    if (!apiKey) throw new ForbiddenException('Invalid API key');

    const privilege = this.reflector.get(ApiPrivilege, context.getHandler());

    if (!privilege || !apiKey.privileges.includes(privilege as any)) {
      throw new ForbiddenException('Insufficient privileges');
    }

    request['apikey'] = apiKey;
    return true;
  }

  private async verifyJwt(context: ExecutionContext, request: Request, token: string): Promise<boolean> {
    if (!token && !this.auth.defaultAccount) throw new UnauthorizedException();

    const user = token ? this.auth.verifyJWT(token) : this.auth.defaultAccount;
    if (!user) throw new ForbiddenException();

    const roles = this.reflector.get(Roles, context.getHandler());

    if (roles && !roles.some((role) => user.roles.includes(role))) {
      throw new ForbiddenException();
    }

    request['user'] = user;
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ', 2) ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
