FROM node

WORKDIR /opt/exercism/csharp-language-server/current

RUN curl -L -o omnisharp.tar.gz https://github.com/OmniSharp/omnisharp-roslyn/releases/download/v1.34.9/omnisharp-linux-x64.tar.gz
RUN curl -L -o dotnet.tar.gz https://download.visualstudio.microsoft.com/download/pr/d731f991-8e68-4c7c-8ea0-fad5605b077a/49497b5420eecbd905158d86d738af64/dotnet-sdk-3.1.100-linux-x64.tar.gz
RUN mkdir -p /opt/omnisharp && tar -xzf omnisharp.tar.gz -C /opt/omnisharp
RUN mkdir -p /opt/dotnet && tar -xzf dotnet.tar.gz -C /opt/dotnet

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libc6 \
        libgcc1 \
        libgssapi-krb5-2 \
        libicu57 \
        liblttng-ust0 \
        libssl1.0.2 \
        libstdc++6 \
        zlib1g \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN ln -s /opt/dotnet/dotnet /usr/bin/dotnet
ENV DOTNET_RUNNING_IN_CONTAINER=true \
  NUGET_XMLDOC_MODE=skip \
  DOTNET_USE_POLLING_FILE_WATCHER=true
RUN dotnet help

COPY server/index.ts server/package.json server/tsconfig.json ./
RUN yarn install
RUN npx tsc

CMD node index.js --command='/opt/omnisharp/run' --commandArgs='-lsp' --port=8291
