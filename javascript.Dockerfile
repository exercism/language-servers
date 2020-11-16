FROM node

WORKDIR /opt/exercism/javascript-language-server/current

RUN yarn global add typescript typescript-language-server
COPY server/index.ts server/package.json server/tsconfig.json ./
RUN yarn install
RUN npx tsc

CMD node index.js --command=typescript-language-server --commandArgs=--stdio --commandArgs='--tsserver-path=tsserver' --port=2538
