FROM andyta/mockoon-cli:latest

# Ensure that export.json exists in docker folder beforehand!
COPY ./docker/export.json /usr/local/bin/export.json

# Do not run as root.
RUN adduser --shell /bin/sh --disabled-password --gecos "" mockoon
RUN chown -R mockoon /usr/local/bin/export.json
RUN chown -R mockoon /usr/local/bin/mockoon-cli
USER mockoon

WORKDIR /usr/local/bin
ENTRYPOINT ["mockoon-cli", "--environments=export.json", "--run-all"]
