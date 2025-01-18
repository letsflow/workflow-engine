import { Reflector } from '@nestjs/core';
import { Privilege } from '@/auth/privileges';

export const ApiPrivilege = Reflector.createDecorator<Privilege | Privilege[]>();
