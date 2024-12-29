import { Reflector } from '@nestjs/core';

export const ApiPrivilege = Reflector.createDecorator<string>();
