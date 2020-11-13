FROM node

WORKDIR /opt/exercism/language-server-proxy/current

COPY proxy/index.ts proxy/package.json proxy/tsconfig.json ./
RUN yarn install
RUN npx tsc

CMD node index.js --port 3000
