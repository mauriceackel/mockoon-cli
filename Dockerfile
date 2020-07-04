FROM node:12

# Make sure that `npm run package-lin` was run before!
COPY ./packages/lin/mockoon-cli /usr/local/bin
