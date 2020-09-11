import { Environment } from '../types/environment.type';

export class EnvironmentService {

  private static instance: EnvironmentService;
  public static get Instance() {
    return this.instance || (this.instance = new EnvironmentService());
  }

  private environments: Map<string, Environment> = new Map<string, Environment>();
  public get Environments() {
    return this.environments;
  }
}
