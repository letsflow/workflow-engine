import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { Reflector } from '@nestjs/core';
import { ApiPrivilege } from '@/auth';
import { Privilege } from '@/auth/privileges';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    const priv = this.reflector.get(ApiPrivilege, context.getHandler());
    const privileges = priv ? (typeof priv === 'string' ? [priv] : priv) : [];

    return token && token.startsWith('lfl_')
      ? await this.verifyApiKey(privileges, request, token)
      : this.verifyJwt(privileges, request, token);
  }

  private async verifyApiKey(privileges: Privilege[], request: Request, token: string): Promise<boolean> {
    const apiKey = await this.auth.verifyApiKey(token);
    if (!apiKey) throw new ForbiddenException('Invalid API key');

    if (!privileges.some((p: Privilege) => apiKey.privileges.includes(p))) {
      throw new ForbiddenException();
    }

    request['apikey'] = apiKey;
    return true;
  }

  private async verifyJwt(privileges: Privilege[], request: Request, token: string): Promise<boolean> {
    if (!token && !this.auth.defaultAccount) throw new UnauthorizedException();

    const user = token ? this.auth.verifyJWT(token) : this.auth.defaultAccount;
    if (!user) throw new ForbiddenException();

    if (this.auth.hasPrivilege(user, privileges)) {
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
