import { NextFunction, Request, Response } from 'express';
import { RequestHandlerParams } from 'express-serve-static-core';

export const ExpressMiddlewares = function (): RequestHandlerParams[] {
  return [
    // Remove multiple slash and replace by single slash
    (request: Request, response: Response, next: NextFunction) => {
      request.url = request.url.replace(/\/{2,}/g, '/');

      next();
    },
    // Parse body as a raw string
    (request: Request, response: Response, next: NextFunction) => {
      try {
        request.setEncoding('utf8');
        request.body = '';

        request.on('data', (chunk) => {
          request.body += chunk;
        });

        request.on('end', () => {
          next();
        });
      } catch (error) { }
    },
    // send entering request analytics event
    (request: Request, response: Response, next: NextFunction) => {
      next();
    }
  ];
};
