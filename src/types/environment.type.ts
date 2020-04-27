import { Header, Route } from '../types/route.type';

export type Environment = {
  uuid: string;
  lastMigration: number;
  name: string;
  port: number;
  endpointPrefix: string;
  latency: number;
  routes: Route[];
  proxyMode: boolean;
  proxyHost: string;
  https: boolean;
  cors: boolean;
  headers: Header[];
};

export type Environments = Environment[];
export type EnvironmentProperties = { [T in keyof Environment]?: Environment[T] };

export type EnvironmentStatus = { running: boolean, needRestart: boolean, disabledForIncompatibility: boolean };
export type EnvironmentStatusProperties = { [T in keyof EnvironmentStatus]?: EnvironmentStatus[T] };
export type EnvironmentsStatuses = { [key: string]: EnvironmentStatus };

