FROM node:8

EXPOSE 3001

WORKDIR /app

COPY . /app

RUN yarn && cd ./packages/rest-api && yarn

