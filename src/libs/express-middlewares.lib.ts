// import { NextFunction, Request, Response } from 'express';
// import { RequestHandlerParams } from 'express-serve-static-core';

// export const ExpressMiddlewares = function (): RequestHandlerParams[] {
//   return [
//     // Remove multiple slash and replace by single slash
//     (request: Request, response: Response, next: NextFunction) => {
//       request.url = request.url.replace(/\/{2,}/g, '/');

//       next();
//     },
//     // Parse body as a raw string
//     (request: Request, response: Response, next: NextFunction) => {
//       try {
//         request.setEncoding('utf8');
//         request.body = '';

//         request.on('data', (chunk) => {
//           request.body += chunk;
//         });

//         request.on('end', () => {
//           next();
//         });
//       } catch (error) { }
//     },
//     // send entering request analytics event
//     (request: Request, response: Response, next: NextFunction) => {
//       next();
//     }
//   ];
// };

import cookieParser from 'cookie-parser';
import { NextFunction, Request, Response } from 'express';
import { RequestHandlerParams } from 'express-serve-static-core';
import { parse as qsParse } from 'qs';

export const Middlewares = function (delayResponseDuration: number): RequestHandlerParams[] {
  return [
    function delayResponse(
      request: Request,
      response: Response,
      next: NextFunction
    ) {
      setTimeout(next, delayResponseDuration);
    },
    function deduplicateSlashes(
      request: Request,
      response: Response,
      next: NextFunction
    ) {
      // Remove multiple slash and replace by single slash
      request.url = request.url.replace(/\/{2,}/g, '/');

      next();
    },
    // parse cookies
    cookieParser(),
    function parseBody(
      request: Request,
      response: Response,
      next: NextFunction
    ) {
      // Parse body as a raw string and JSON/form if applicable
      const requestContentType: string = request.header('Content-Type');

      request.setEncoding('utf8');
      request.body = '';

      request.on('data', (chunk) => {
        request.body += chunk;
      });

      request.on('end', () => {
        try {
          if (requestContentType) {
            if (requestContentType.includes('application/json')) {
              request.bodyJSON = JSON.parse(request.body);
            } else if (
              requestContentType.includes('application/x-www-form-urlencoded')
            ) {
              request.bodyForm = qsParse(request.body, { depth: 10 });
            }
          }

          next();
        } catch (error) {
          const errorMessage = `Error while parsing entering body: ${error.message}`;

          next();
        }
      });
    }
  ];
};
