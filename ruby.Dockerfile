FROM ruby:2.6.6

WORKDIR /opt/exercism/ruby-language-server/current

RUN gem install solargraph
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
    curl -sL https://deb.nodesource.com/setup_14.x | bash - && \
    apt-get install -y nodejs yarn
COPY server/index.ts server/package.json server/tsconfig.json ./
RUN yarn install
RUN npx tsc

CMD node index.js --command=solargraph --commandArgs=stdio --port=7658
