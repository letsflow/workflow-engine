import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { yaml } from '@letsflow/api';

@Injectable()
export class YamlBodyParserMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
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
        req.body = yaml.parse(data);
        next();
      } catch (error) {
        next(error);
      }
    });
  }
}
