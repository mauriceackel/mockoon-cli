# mockoon-cli

This is a small CLI wrapper for the tool [mockoon](https://github.com/mockoon/mockoon). The majority if the code was taken from the original project that can be found via the provided link.

**IMPORTANT: This tool was developed out of need and solely for testing purposes. Especially, this tool does not make the claime to be well-engineered or production ready in the slightest!**

This tool allows you to start a mock-webserver that uses the definitions defined by mockoon. For preparation, export your MockAPI definitions using the Mockoon UI. 

## Play around in an IDE

To build the tool run `npm run build`. This will create a new folder `bin` that contains the transpiled tool.

To start the server and start all mock APIs specified in a certain Mockoon export, run `npm start -- --environments=/path/to/mockoon/export.json --run-all`.

If you only want to spin up certain Mockoon environments, you have to identify their UUID (i.e. by checking your export in an editor). If they don't have an UUID, you can set them manually. Afterwards, you can execute `npm start -- --environments=/path/to/mockoon/export.json --run-envs=["uuid1", "uuid2", ...]` to start only the specified environments.

To use a specific SSL cerificate and key, alter the ssl.ts file inside the source folder and rebuild.

## Packag and run elsewhere

To package the tool into a single binary, run `npm run package-<mac|win|lin>` depending on your platform or use `npm run package` to create a binary for all platforms. The results will be written to the `packages` folder. Afterwards, you can invoke the binary anywhere.

## Command line arguments

* To specify your Mockoon file, add the command line argument `--environments=/path/to/mockoon/export.json`.

* To start all environments of that file, add the argument `--run-all`.

* If you only want to run certain environments, make sure that you have set an UUID for the environments in your Mockoon export. Afterwards, you can run the tool with command line argument `--run-envs=["uuid1", "uuid2", ...]` to only start the specified environments.
    
    *NOTE:* When you are using zsh, you might need to use `--run-envs='["uuid1", "uuid2", ...]'`.
