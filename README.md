# mockoon-cli

This is a small CLI wrapper for the tool [mockoon](https://github.com/mockoon/mockoon). The majority if the code was taken from the original project that can be found via the provided link.

**IMPORTANT: This tool was developed out of need and solely for testing purposes. Especially, this tool does not make the claime to be well-engineered or production ready in the slightest!**

This tool allows you to start a mock-webserver that uses the definitions defined by mockoon. For preparation, export your MockAPI definitions using the Mockoon UI. 

## Play around in an IDE

To build the tool run `npm run build`. This will create a new folder `bin` that contains the transpiled tool.

To start the server and start all mock APIs specified in a certain Mockoon export, run `npm start -- --environments=/path/to/mockoon/export.json --run-all`.

If you only want to spin up certain Mockoon environments, you have to identify their UUID (i.e. by checking your export in an editor). If they don't have an UUID, you can set them manually. Afterwards, you can execute `npm start -- --environments=/path/to/mockoon/export.json --run-envs=["uuid1", "uuid2", ...]` to start only the specified environments.

To use a specific SSL cerificate and key, alter the ssl.ts file inside the source folder and rebuild.

## Package and run elsewhere

To package the tool into a single binary, run `npm run package-<mac|win|lin>` depending on your platform or use `npm run package` to create a binary for all platforms. The results will be written to the `packages` folder. Afterwards, you can invoke the binary anywhere.

## Command line arguments

* To specify your Mockoon file, add the command line argument `--environments=/path/to/mockoon/export.json`.

* To start all environments of that file, add the argument `--run-all`.

* If you only want to run certain environments, make sure that you have set an UUID for the environments in your Mockoon export. Afterwards, you can run the tool with command line argument `--run-envs=["uuid1", "uuid2", ...]` to only start the specified environments.
    
    *NOTE:* When you are using zsh, you might need to use `--run-envs='["uuid1", "uuid2", ...]'`.

## Docker

Since the CLI requires a Mockoon JSON file to run, it is necessary for you to build your own image.
This image shall be the running mockoon-cli loaded with your own Mockoon JSON file.

1. The Dockerfile for a basic mockoon-cli without export.json is available in this folder so you can build it yourself locally, 
  but you can also use `andyta/mockoon-cli:latest` in step 2.
    - If you build the image yourself with the Dockerfile, you have to run `npm run package-lin` beforehand.
    - You can build the image yourself with `docker build --tag mockoon-cli:<version> .` in this folder.

2. An example for building your own image is provided in docker/example.Dockerfile.
    - Make sure that you have a export.json file under the docker folder which is your Mockoon JSON file.
    - If you are using your own mockoon-cli image and not `andyta/mockoon-cli:latest`, 
    change the first line to `mockoon-cli:<version>`, or whatever you tagged your mockoon-cli image as.
    - If you want to change any command line arguments, modify the `ENTRYPOINT` line of the Dockerfile.
    Otherwise, it will run all environments by default.

3. Build your image with `docker build -f docker/example.Dockerfile --tag <name>:<version> .`

4. Run your container with `docker run -p 3002:3002 -p 3003:3003 -d <name>:<version>`
    - The command exposes port 3002 and 3003, if you have more or less ports, modify as needed.
