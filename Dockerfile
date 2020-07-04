FROM node:12-alpine

# Make sure that `npm run package-lin` was run before!
COPY ./packages/lin/mockoon-cli /usr/local/bin
RUN apk add --no-cache libstdc++ libgcc
