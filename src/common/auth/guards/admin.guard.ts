import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    return (user?.roles ?? []).includes(this.auth.adminRole);
  }
}
