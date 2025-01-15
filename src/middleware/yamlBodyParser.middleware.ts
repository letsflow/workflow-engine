import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { yaml } from '@letsflow/core';
import yamlOptions from '@/common/yaml-options';

@Injectable()
export class YamlBodyParserMiddleware implements NestMiddleware {
  use(req: Request, _: Response, next: NextFunction) {
    if (!req.is('application/yaml')) {
      next();
      return;
    }

    let data = '';

    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      data += chunk;
    });

    req.on('end', () => {
      try {
        req.body = yaml.parse(data, yamlOptions);
        next();
      } catch (error) {
        next(error);
      }
    });
  }
}
