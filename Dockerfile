FROM node:12-alpine

# Make sure that `npm run package-lin` was run before!
COPY ./packages/lin/mockoon-cli /usr/local/bin

# Install glibc dependencies
# Credit: https://github.com/shaharv/docker/blob/master/alpine/glibc/Dockerfile
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

ENV GLIBC_REPO=https://github.com/sgerrand/alpine-pkg-glibc
ENV GLIBC_VERSION=2.30-r0

RUN set -ex && \
    apk --update add libstdc++6 curl ca-certificates && \
    for pkg in glibc-${GLIBC_VERSION} glibc-bin-${GLIBC_VERSION}; \
        do curl -sSL ${GLIBC_REPO}/releases/download/${GLIBC_VERSION}/${pkg}.apk -o /tmp/${pkg}.apk; done && \
    apk add --allow-untrusted /tmp/*.apk && \
    rm -v /tmp/*.apk && \
    /usr/glibc-compat/sbin/ldconfig /lib /usr/glibc-compat/lib
