import { Environment } from '../types/environment.type';
import { Route } from '../types/route.type';

export type DataSubject = 'environment' | 'route';

export type ExportDataEnvironment = { type: 'environment'; item: Environment };
export type ExportDataRoute = { type: 'route'; item: Route };

export type ExportData = (ExportDataEnvironment | ExportDataRoute)[];

export type Export = {
  source: string;
  data: ExportData;
};
