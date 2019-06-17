# Spock

Centralized cache for blockchain data

## Features

- scrape any data available on blockchain (events, tx data, traces)
- easily provide semantic layers on top
- ensure data consistency

## Ethereum node considerations

spock pulls all the data from ethereum node. Nodes can differ greatly between each other, and some
are simply not reliable / consistent. Based on our tests:

- Alchemy works
- Infura DOESN'T WORK. Sometimes it can randomly return empty sets for getLogs calls
- Self hosted nodes should work (not tested yet) but keep in mind that vulcan can generate quite a
  lot of network calls (around 500k daily)

## Development

### App start

```
yarn migrate         # to apply new migrations
yarn start-etl       # to start blockchain ETL process
yarn start-api       # to start graphql api
yarn start-rest-api  # to start REST api
```

Application assumes all env variables being loaded before it starts. We utilize .env files which are
automatically loaded by `dotenv-flow`. If you wish to override these settings create .env.local
(gitignored).

### PostgreSQL for development

#### Start

```
docker-compose up -d
```

#### Stop (data preserved)

```
docker-compose stop
```

#### Down (data lost)

```
docker-compose down
```

### Logging

We use [consola](https://github.com/nuxt/consola#readme) for logging. By default it will log
everything. To adjust logging [levels](https://github.com/nuxt/consola#level) set
`VL_LOGGING_LEVEL`. env variable. Ex. use `VL_LOGGING_LEVEL=4` to omit detailed db logs (most
verbose).
