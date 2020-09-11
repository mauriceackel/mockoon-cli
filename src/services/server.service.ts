import express from 'express';
import { Application } from 'express';
const killable = require('killable');
import { readFile } from 'fs';
import { createServer as httpCreateServer, Server as httpServer } from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import {
  createServer as httpsCreateServer,
  Server as httpsServer
} from 'https';
import { lookup as mimeTypeLookup } from 'mime-types';
import { basename } from 'path';
import { ResponseRulesInterpreter } from '../classes/response-rules-interpreter';
import { BINARY_BODY } from '../constants/server.constants';
import { Errors } from '../enums/errors.enum';
import { Middlewares } from '../libs/express-middlewares.lib';
import { TemplateParser } from '../libs/template-parser.lib';
import {
  GetContentType,
  GetRouteResponseContentType,
  IsValidURL,
  TestHeaderValidity
} from '../libs/utils.lib';
import { Environment } from '../types/environment.type';
import { CORSHeaders, Header, mimeTypesWithTemplating, Route } from '../types/route.type';
import { EnvironmentService } from './environment.service';
import { pemFiles } from '../ssl';


const httpsConfig = {
  key: pemFiles.key,
  cert: pemFiles.cert
};

export class ServerService {

  private static instance: ServerService;
  public static get Instance() {
    return this.instance || (this.instance = new ServerService());
  }

  // running servers instances
  private instances: { [key: string]: any } = {};

  constructor() { }

  /**
   * Start an environment / server
   *
   * @param environment - an environment
   */
  public start(environment: Environment) {
    if (this.instances[environment.uuid] != undefined) return; //Don't start a service twice
    console.log("Starting environment:", environment.uuid, "-", environment.name);

    const server = express();
    server.disable('x-powered-by');
    server.disable('etag');

    let serverInstance: httpsServer | httpServer;

    // create https or http server instance

    if (environment.https) {
      serverInstance = httpsCreateServer(httpsConfig, server);
    } else {
      serverInstance = httpCreateServer(server);
    }

    // set timeout long enough to allow long latencies
    serverInstance.setTimeout(3_600_000);

    serverInstance.listen(environment.port, () => {
      this.instances[environment.uuid] = serverInstance;
    });

    Middlewares(environment.latency).forEach((expressMiddleware) => {
      server.use(expressMiddleware);
    });

    // apply latency, cors, routes and proxy to express server
    this.setResponseHeaders(server, environment);
    this.setRoutes(server, environment);
    this.setCors(server, environment);
    this.enableProxy(server, environment);
    this.errorHandler(server);

    // handle server errors
    serverInstance.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.log('error', Errors.PORT_ALREADY_USED);
      } else if (error.code === 'EACCES') {
        console.log('error', Errors.PORT_INVALID);
      } else {
        console.log('error', error.message);
      }
    });

    killable(serverInstance);
  }

  /**
   * Completely stop an environment / server
   */
  public stop(environment: string | Environment) {
    let realEnvironment: Environment;
    if (typeof environment === "string") {
      realEnvironment = EnvironmentService.Instance.Environments.get(environment);
    } else {
      realEnvironment = environment;
    }

    const instance = this.instances[realEnvironment.uuid];

    if (instance) {
      console.log("Stopping environment:", realEnvironment.uuid, "-", realEnvironment.name)
      instance.kill(() => {
        delete this.instances[realEnvironment.uuid];
      });
    }
  }

  /**
   * Always answer with status 200 to CORS pre flight OPTIONS requests if option activated.
   * /!\ Must be called after the routes creation otherwise it will intercept all user defined OPTIONS routes.
   *
   * @param server - express instance
   * @param environment - environment to be started
   */
  private setCors(server: Application, environment: Environment) {
    if (environment.cors) {
      server.options('/*', (req, res) => {
        const environmentSelected = EnvironmentService.Instance.Environments.get(environment.uuid);

        this.setHeaders(
          [...CORSHeaders, ...environmentSelected.headers],
          res,
          req
        );

        res.status(200).end();
      });
    }
  }

  /**
   * Generate an environment routes and attach to running server
   *
   * @param server - server on which attach routes
   * @param environment - environment to get route schema from
   */
  private setRoutes(server: Application, environment: Environment) {
    environment.routes.forEach((declaredRoute: Route) => {

      if (declaredRoute.enabled) {
        try {
          // create route
          server[declaredRoute.method]('/' + (environment.endpointPrefix ? environment.endpointPrefix + '/' : '') + declaredRoute.endpoint.replace(/ /g, '%20'), (req, res) => {
            const currentEnvironment = EnvironmentService.Instance.Environments.get(environment.uuid);
            const currentRoute = currentEnvironment.routes.find(route => route.uuid === declaredRoute.uuid);
            const enabledRouteResponse = new ResponseRulesInterpreter(currentRoute.responses, req).chooseResponse();

            // save route and response UUIDs for logs
            res.routeUUID = declaredRoute.uuid;
            res.routeResponseUUID = enabledRouteResponse.uuid;

            // add route latency if any
            setTimeout(() => {
              const contentType = GetRouteResponseContentType(
                currentEnvironment,
                enabledRouteResponse
              );
              const routeContentType = GetContentType(
                enabledRouteResponse.headers
              );

              // set http code
              res.status(enabledRouteResponse.statusCode);

              this.setHeaders(enabledRouteResponse.headers, res, req);

              try {
                // send the file
                if (enabledRouteResponse.filePath) {
                  const filePath = TemplateParser(
                    enabledRouteResponse.filePath.replace(/\\/g, '/'),
                    req
                  );
                  const fileMimeType = mimeTypeLookup(filePath) || '';

                  // set content-type to route response's one or the detected mime type if none
                  if (!routeContentType) {
                    res.set('Content-Type', fileMimeType);
                  }

                  if (!enabledRouteResponse.sendFileAsBody) {
                    res.set(
                      'Content-Disposition',
                      `attachment; filename="${basename(filePath)}"`
                    );
                  }

                  readFile(filePath, (readError, data) => {
                    try {
                      if (readError) {
                        throw readError;
                      }

                      // parse templating for a limited list of mime types
                      if (
                        mimeTypesWithTemplating.indexOf(fileMimeType) > -1 &&
                        !enabledRouteResponse.disableTemplating
                      ) {
                        const fileContent = TemplateParser(
                          data.toString(),
                          req
                        );
                        res.body = fileContent;
                        res.send(fileContent);
                      } else {
                        res.body = BINARY_BODY;
                        res.send(data);
                      }
                    } catch (error) {
                      const errorMessage = `Error while serving the file content: ${error.message}`;
                      this.sendError(res, errorMessage);
                    }
                  });
                } else {
                  if (contentType.includes('application/json')) {
                    res.set('Content-Type', 'application/json');
                  }

                  let body = enabledRouteResponse.body;

                  if (!enabledRouteResponse.disableTemplating) {
                    body = TemplateParser(body, req);
                  }

                  res.body = body;

                  res.send(body);
                }
              } catch (error) {
                const errorMessage = `Error while serving the content: ${error.message}`;

                this.sendError(res, errorMessage);
              }
            }, enabledRouteResponse.latency);
          }
          );
        } catch (error) {
          // if invalid regex defined
          if (error.message.indexOf('Invalid regular expression') > -1) {
            console.log('error', Errors.INVALID_ROUTE_REGEX + declaredRoute.endpoint);
          }
        }
      }
    });
  }

  /**
   * Ensure that environment headers & proxy headers are returned in response headers
   *
   * @param server - the server serving responses
   * @param environment - the environment where the headers are configured
   */
  private setResponseHeaders(server: any, environment: Environment) {
    server.use((req, res, next) => {
      this.setHeaders(environment.headers, res, req);

      next();
    });
  }

  /**
   * Set the provided headers on the target. Use different headers accessors
   * depending on the type of target:
   * express.Response/http.OutgoingMessage/http.IncomingMessage
   * Use the source in the template parsing of each header value.
   *
   * @param headers
   * @param target
   * @param source
   */
  private setHeaders(headers: Partial<Header>[], target: any, source: any) {
    headers.forEach((header) => {
      if (header.key && header.value && !TestHeaderValidity(header.key)) {
        let parsedHeaderValue: string;
        try {
          parsedHeaderValue = TemplateParser(header.value, source);
        } catch (error) {
          const errorMessage = `-- Parsing error. Check logs for more information --`;
          parsedHeaderValue = errorMessage;
        }

        if (target.set) {
          // for express.Response
          target.set(header.key, parsedHeaderValue);
        } else if (target.setHeader) {
          // for proxy http.OutgoingMessage
          target.setHeader(header.key, parsedHeaderValue);
        } else {
          // for http.IncomingMessage
          target.headers[header.key] = parsedHeaderValue;
        }
      }
    });
  }

  /**
   * Send an error with text/plain content type and the provided message.
   * Also display a toast.
   *
   * @param res
   * @param errorMessage
   * @param showToast
   */
  private sendError(
    res: express.Response,
    errorMessage: string,
    status: number = null
  ) {
    res.set('Content-Type', 'text/plain');
    res.body = errorMessage;

    if (status !== null) {
      res.status(status);
    }

    res.send(errorMessage);
  }

  /**
   * Add catch-all proxy if enabled.
   * Restream the body to the proxied API because it already has been
   * intercepted by the body parser.
   *
   * @param server - server on which to launch the proxy
   * @param environment - environment to get proxy settings from
   */
  private enableProxy(server: Application, environment: Environment) {
    if (
      environment.proxyMode &&
      environment.proxyHost &&
      IsValidURL(environment.proxyHost)
    ) {
      server.use(
        '*',
        createProxyMiddleware({
          target: environment.proxyHost,
          secure: false,
          changeOrigin: true,
          ssl: { ...httpsConfig, agent: false },
          onProxyReq: (proxyReq, req, res) => {
            req.proxied = true;

            this.setHeaders(environment.proxyReqHeaders, proxyReq, req);

            if (req.body) {
              proxyReq.setHeader('Content-Length', Buffer.byteLength(req.body));

              // re-stream the body (intercepted by body parser method) and mark as proxied
              proxyReq.write(req.body);
            }
          },
          onProxyRes: (proxyRes, req, res) => {
            let body = '';
            proxyRes.on('data', (chunk) => {
              body += chunk;
            });
            proxyRes.on('end', () => {
              res.body = body;
            });

            this.setHeaders(environment.proxyResHeaders, proxyRes, req);
          },
          onError: (err, req, res) => {
            this.sendError(
              res,
              `An error occured while trying to proxy to ${environment.proxyHost}${req.url}: ${err}`,
              504
            );
          }
        })
      );
    }
  }

  /**
   * Catch all error handler
   * http://expressjs.com/en/guide/error-handling.html#catching-errors
   *
   * @param server - server on which to log the response
   */
  private errorHandler(server: Application) {
    server.use((err, req, res, next) => {
      this.sendError(res, err, 500);
    });
  }
}