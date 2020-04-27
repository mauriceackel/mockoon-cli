import { EnvironmentService } from './services/environment.service';
import { ServerService } from './services/server.service';
import { ImportService } from './services/import.service';

export class Main {
    private static instance: Main;
    public static get Instance() {
        return this.instance || (this.instance = new Main());
    }

    public Start() {
        let inputFilePath: string;
        let runAll: boolean;
        let uuids: Array<string>;

        let errorOccured = false;

        inputFilePath = process.env.MOCKOON_ENVS;
        runAll = process.env.MOCKOON_RUN_ALL != undefined;
        try {
            uuids = process.env.MOCKOON_RUN_ENVS ? JSON.parse(process.env.MOCKOON_RUN_ENVS) : undefined;
        } catch (err) {}

        process.argv.forEach(arg => {
            let argParts = arg.split("=");
            switch (argParts[0]) {
                case "--environments": {
                    if (argParts[1] != undefined) {
                        inputFilePath = argParts[1];
                    } else {
                        console.log("Please specify the input file in the following way: --environments=/path/to/file");
                        errorOccured = true;
                    }
                } break;
                case "--run-all": {
                    runAll = true;
                } break;
                case "--run-envs": {
                    try {
                        if (argParts[1] == undefined) throw new Error();
                        uuids = JSON.parse(argParts[1]);
                        if (!(uuids instanceof Array)) throw new Error();
                    } catch (err) {
                        console.log("Unable to parse list of uuids, please specify the list of environment uuids in the format --run-envs=[\"uuid1\", \"uuid2\"]");
                        errorOccured = true;
                    }
                } break;
            }
        });

        if (!errorOccured) {
            if (inputFilePath != undefined) {
                ImportService.Instance.importFromFile(inputFilePath);

                if (runAll) {
                    console.log("Starting all environments");
                    EnvironmentService.Instance.Environments.forEach(e => {
                        ServerService.Instance.start(e);
                    })
                } else if (uuids != undefined) {
                    console.log("Starting selected environments:", uuids.join(", "));
                    uuids.map(uuid => EnvironmentService.Instance.Environments.get(uuid)).forEach(e => {
                        if (e != undefined) {
                            ServerService.Instance.start(e);
                        }
                    })
                } else {
                    console.log("No task specified, either add --run-all or --run-envs=[\"uuid1\", \"uuid2\"]");
                }
            } else {
                console.log("No input file specified. Please specify the input file in the following way: --environments=/path/to/file");
            }
        }
    }
}
Main.Instance.Start();