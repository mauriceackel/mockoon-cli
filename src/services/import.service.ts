import * as fs from 'fs';
import { Export } from '../types/data.type';
import { EnvironmentService } from './environment.service';

export class ImportService {

  private static instance: ImportService;
  public static get Instance() {
    return this.instance || (this.instance = new ImportService());
  }

  public importFromFile(path: string) {
    try {
      let fileContent = fs.readFileSync(path, 'utf-8');
      const importedData: Export = JSON.parse(fileContent);

      this.import(importedData);
    } catch(err) {
      console.log("Error while reading file: ", err);
      process.exit(1);
    }
  }

  private import(dataToImport: Export) {

    if (!dataToImport) {
      return;
    }

    dataToImport.data.forEach(data => {
      if (data.type === 'environment') {
        data.item;

        EnvironmentService.Instance.Environments.set(data.item.uuid, data.item);
      } else  {
        console.log('Error: Expected environment');
      }
    });
  }
}
