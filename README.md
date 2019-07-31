# Spock

Centralized cache for blockchain data

## Features

- scrape any data available on blockchain (events, tx data, traces)
- easily provide semantic layers on top
- ensure data consistency

## Installation

```
npm install spock-etl
```

## Usage

Spock exposes CLI interface like:

```
spock-etl etl|migrate|validate|api yourconfig.js|ts
```

### Commands

- migrate — launches database migrations (core and defined in config)
- etl — launches ETL process (long running process)
- api — run general GraphQL api exposing database schema `api`
- validate-logs — task to check logs against Google BigQueryData
- validate-jobs - checks if there are no errored jobs (transformers or extractors)

## Ethereum node considerations

spock pulls all the data from ethereum node. Nodes can differ greatly between each other, and some
are simply not reliable / consistent. Based on our tests:

- Alchemy works
- Infura DOESN'T WORK. Sometimes it can randomly return empty sets for getLogs calls
- Self hosted nodes should work (not tested yet) but keep in mind that vulcan can generate quite a
  lot of network calls (around 500k daily)

## Development

- `yarn build` — build everything
- `yarn build:watch` - build and watch
- `yarn test:fix` - run tests, auto fix all errors

Tip: Use `yarn link` to link packages locally.

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
