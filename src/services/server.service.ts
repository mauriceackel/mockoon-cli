import express from 'express';
import { Application } from 'express';
import * as fs from 'fs';
import * as http from 'http';
import * as proxy from 'http-proxy-middleware';
import * as https from 'https';
const killable = require('killable');
import * as mimeTypes from 'mime-types';
import * as path from 'path';
import { ResponseRulesInterpreter } from '../classes/response-rules-interpreter';
import { Errors } from '../enums/errors.enum';
import { DummyJSONParser } from '../libs/dummy-helpers.lib';
import { ExpressMiddlewares } from '../libs/express-middlewares.lib';
import { GetRouteResponseContentType } from '../libs/utils.lib';
import { pemFiles } from '../ssl';
import { Environment } from '../types/environment.type';
import { CORSHeaders, Header, mimeTypesWithTemplating, Route } from '../types/route.type';
import { URL } from 'url';
import { IEnhancedRequest } from '../types/misc.type';
import { EnvironmentService } from './environment.service';

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
    if(this.instances[environment.uuid] != undefined) return; //Don't start a service twice
    console.log("Starting environment:", environment.uuid, "-",environment.name);
    
    const server = express();
    let serverInstance: https.Server | http.Server;

    // create https or http server instance
    if (environment.https) {
      serverInstance = https.createServer(httpsConfig, server);
    } else {
      serverInstance = http.createServer(server);
    }

    // listen to port
    serverInstance.listen(environment.port, () => {
      this.instances[environment.uuid] = serverInstance;
    });

    // apply middlewares
    ExpressMiddlewares().forEach(expressMiddleware => {
      server.use(expressMiddleware);
    });

    // apply latency, cors, routes and proxy to express server
    this.setEnvironmentLatency(server, environment.uuid);
    this.setRoutes(server, environment);
    this.setCors(server, environment);
    this.enableProxy(server, environment);

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
    if(typeof environment === "string") environment = EnvironmentService.Instance.Environments.get(environment);

    const instance = this.instances[environment.uuid];

    if (instance) {
      console.log("Stopping environment:", environment.uuid, "-",environment.name)
      instance.kill(() => {
        delete this.instances[(environment as any).uuid];
      });
    }
  }

  /**
   * Test a header validity
   *
   * @param headerName
   */
  private testHeaderValidity(headerName: string) {
    if (headerName && headerName.match(/[^A-Za-z0-9\-\!\#\$\%\&\'\*\+\.\^\_\`\|\~]/g)) {
      return true;
    }

    return false;
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

        this.setHeaders(CORSHeaders, req, res);

        // override default CORS headers with environment's headers
        this.setHeaders(environmentSelected.headers, req, res);

        res.send(200);
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
          server[declaredRoute.method]('/' + ((environment.endpointPrefix) ? environment.endpointPrefix + '/' : '') + declaredRoute.endpoint.replace(/ /g, '%20'), (req, res) => {
            const currentEnvironment = EnvironmentService.Instance.Environments.get(environment.uuid);
            const currentRoute = currentEnvironment.routes.find(route => route.uuid === declaredRoute.uuid);
            const enabledRouteResponse = new ResponseRulesInterpreter(currentRoute.responses, req).chooseResponse();

            // add route latency if any
            setTimeout(() => {
              const routeContentType = GetRouteResponseContentType(currentEnvironment, enabledRouteResponse);

              // set http code
              res.status(enabledRouteResponse.statusCode as unknown as number);

              this.setHeaders(currentEnvironment.headers, req, res);
              this.setHeaders(enabledRouteResponse.headers, req, res);

              // send the file
              if (enabledRouteResponse.filePath) {
                let filePath: string;

                // throw error or serve file
                try {
                  filePath = DummyJSONParser(enabledRouteResponse.filePath, req);
                  const fileMimeType = mimeTypes.lookup(enabledRouteResponse.filePath);

                  // if no route content type set to the one detected
                  if (!routeContentType && fileMimeType) {
                    res.set('Content-Type', fileMimeType);
                  }

                  let fileContent: Buffer | string = fs.readFileSync(filePath);

                  // parse templating for a limited list of mime types
                  if (fileMimeType && mimeTypesWithTemplating.indexOf(fileMimeType) > -1) {
                    fileContent = DummyJSONParser(fileContent.toString('utf-8', 0, fileContent.length), req);
                  }

                  if (!enabledRouteResponse.sendFileAsBody) {
                    res.set('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
                  }
                  res.send(fileContent);
                } catch (error) {
                  if (error.code === 'ENOENT') {
                    this.sendError(res, Errors.FILE_NOT_EXISTS + filePath, false);
                  } else if (error.message.indexOf('Parse error') > -1) {
                    this.sendError(res, Errors.TEMPLATE_PARSE, false);
                  }
                  res.end();
                }
              } else {
                // detect if content type is json in order to parse
                if (routeContentType === 'application/json') {
                  try {
                    res.json(JSON.parse(DummyJSONParser(enabledRouteResponse.body, req)));
                  } catch (error) {
                    // if JSON parsing error send plain text error
                    if (error.message.indexOf('Unexpected token') > -1 || error.message.indexOf('Parse error') > -1) {
                      this.sendError(res, Errors.JSON_PARSE);
                    } else if (error.message.indexOf('Missing helper') > -1) {
                      this.sendError(res, Errors.MISSING_HELPER + error.message.split('"')[1]);
                    }
                    res.end();
                  }
                } else {
                  try {
                    res.send(DummyJSONParser(enabledRouteResponse.body, req));
                  } catch (error) {
                    // if invalid Content-Type provided
                    if (error.message.indexOf('invalid media type') > -1) {
                      this.sendError(res, Errors.INVALID_CONTENT_TYPE);
                    }
                    res.end();
                  }
                }
              }
            }, enabledRouteResponse.latency);
          });
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
   * Apply each header to the response
   *
   * @param headers
   * @param req
   * @param res
   */
  private setHeaders(headers: Partial<Header>[], req, res) {
    headers.forEach((header) => {
      if (header.key && header.value && !this.testHeaderValidity(header.key)) {
        res.set(header.key, DummyJSONParser(header.value, req));
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
  private sendError(res: any, errorMessage: string, showToast = true) {
    if (showToast) {
      console.log('error', errorMessage);
    }
    res.set('Content-Type', 'text/plain');
    res.send(errorMessage);
  }

  /**
   * Enable catch all proxy.
   * Restream the body to the proxied API because it already has been intercepted by body parser
   *
   * @param server - server on which to launch the proxy
   * @param environment - environment to get proxy settings from
   */
  private enableProxy(server: Application, environment: Environment) {
    // Add catch all proxy if enabled
    if (environment.proxyMode && environment.proxyHost && this.isValidURL(environment.proxyHost)) {
      // res-stream the body (intercepted by body parser method) and mark as proxied
      const processRequest = (proxyReq, req, res, options) => {
        req.proxied = true;

        if (req.body) {
          proxyReq.setHeader('Content-Length', Buffer.byteLength(req.body));
          // stream the content
          proxyReq.write(req.body);
        }
      };

      // logging the proxied response
      const self = this;
      const logResponse = (proxyRes, req, res) => {
        let body = '';
        proxyRes.on('data', (chunk) => {
          body += chunk;
        });
        proxyRes.on('end', () => {
          proxyRes.getHeaders = function () {
            return proxyRes.headers;
          };
          const enhancedReq = req as IEnhancedRequest;
        });
      };

      const logErrorResponse = (err, req, res) => {
        // the response is logged by the overrided function
        res.status(504).send('Error occured while trying to proxy to: ' + req.url);
      };

      server.use('*', proxy({
        target: environment.proxyHost,
        secure: false,
        changeOrigin: true,
        ssl: { ...httpsConfig, agent: false },
        onProxyReq: processRequest,
        onProxyRes: logResponse,
        onError: logErrorResponse
      }));
    } else {
      // if not proxy, log the 404 response
      server.use(function (req, res, next) {
        // the send function is logging the response
        return res.status(404).send('Cannot ' + req.method + ' ' + req.url);
      });
    }
  }

  /**
   * Set the environment latency if any
   *
   * @param server - server instance
   * @param environmentUUID - environment UUID
   */
  private setEnvironmentLatency(server: Application, environmentUUID: string) {
    server.use((req, res, next) => {
      const environmentSelected = EnvironmentService.Instance.Environments.get(environmentUUID);
      setTimeout(next, environmentSelected.latency);
    });
  }

  /**
   * Test if URL is valid
   *
   * @param URL
   */
  public isValidURL(address: string): boolean {
    try {
      const myURL = new URL(address);

      return true;
    } catch (e) {
      return false;
    }
  }
}
