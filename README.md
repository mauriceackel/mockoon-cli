# mockoon-cli

This is a small CLI wrapper for the tool [mockoon](https://github.com/mockoon/mockoon). The majority if the code was taken from the original project that can be found via the provided link.

**IMPORTANT: This tool was developed out of need and solely for testing purposes. Especially, this tool does not make the claime to be well-engineered or production ready in the slightest!**

This tool allows you to start a mock-webserver that uses the definitions defined by mockoon. For preparation, export your MockAPI definitions using the Mockoon UI. To start the server and start all mock APIs specified in a certain Mockoon export, run `npm start -- --environments=/path/to/mockoon/export.json --run-all`. If you build the project first and execute it elsewhere, use `node /path/to/build.js --environments=/path/to/mockoon/export.json --run-all`. If you only want to spin up certain Mockoon environments, you have to identify their UUID (i.e. by checking your export in an editor). Then, you can execute `npm start -- --environments=/path/to/mockoon/export.json --run-envs=["uuid1", "uuid2", ...]` to start only the specified environments.

To use a specific SSL cerificate and key, alter the ssl.ts file inside the source folder and rebuild.