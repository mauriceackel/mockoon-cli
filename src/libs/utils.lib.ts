import { Environment } from '../types/environment.type';
import { RouteResponse } from '../types/route.type';

export const GetRouteResponseContentType = (environment: Environment, routeResponse: RouteResponse) => {
  const routeResponseContentType = routeResponse.headers.find(header => header.key === 'Content-Type');

  if (routeResponseContentType && routeResponseContentType.value) {
    return routeResponseContentType.value;
  }

  const environmentContentType = environment.headers.find(header => header.key === 'Content-Type');

  if (environmentContentType && environmentContentType.value) {
    return environmentContentType.value;
  }

  return '';
};

export const IsEmpty = (obj) => {
  return (
    [Object, Array].includes((obj || {}).constructor) &&
    !Object.entries(obj || {}).length
  );
};
