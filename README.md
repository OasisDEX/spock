# Spock

Centralized cache for blockchain data

## Features

- scrape any data available on blockchain (events, tx data, traces)
- easily provide semantic layers on top
- ensure data consistency

## Packages 📦

| Package                                | Version                                                                                                                                    | Description                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| [`etl`](/packages/etl)                 | [![npm](https://img.shields.io/npm/v/@oasisdex/spock-etl.svg)](https://www.npmjs.com/package/@oasisdex/spock-etl)                          | Core package - responsible for etl                   |
| [`graphql-api`](/packages/graphql-api) | [![npm](https://img.shields.io/npm/v/@oasisdex/spock-graphql-api.svg)](https://www.npmjs.com/package/@oasisdex/spock-graphql-api)          | Exposes data as GraphQL API                          |
| [`test-utils`](/packages/test-utils)   | [![npm](https://img.shields.io/npm/v/@oasisdex/spock-test-utils.svg)](https://www.npmjs.com/package/@typechain/@oasisdex/spock-test-utils) | Utils for integration tests                          |
| [`utils`](/packages/utils)             | [![npm](https://img.shields.io/npm/v/@oasisdex/spock-utils.svg)](https://www.npmjs.com/package/@oasisdex/spock-utils)                      | Common reusable extractors etc.                      |
| [`validation`](/packages/validation)   | [![npm](https://img.shields.io/npm/v/@oasisdex/spock-validation.svg)](https://www.npmjs.com/package/@oasisdex/spock-validation)            | Scripts to validate spock data with Google Big Query |

## Installation

```
npm install @oasisdex/spock-etl
```

## Usage

```
spock-etl yourconfig.js|ts
```

### Commands

#### @oasisdex/spock-etl

- dist/bin/migrate config — launches database migrations (core and defined in the config)
- dist/bin/etl config — launches ETL process (long running process)

#### @oasisdex/graphql-api

- dist/index.js config — run general GraphQL api exposing database schema `api`

## Response caching

We can automatically cache slow graphql queries. To enable it add: `VL_GRAPHQL_CACHING_ENABLED=true` env variable or in
your config:

```
  api: {
    responseCaching: {
      enabled: true,
      duration: "15 seconds" // default
    };
  };
```

## Query whitelisting

Probably you don't want users to issue any query on GraphQL API. That's why we support query whitelisting.

Enable it by:

```javascript
{
  // ...
  api: {
    whitelisting: {
      enabled: true,
      whitelistedQueriesDir: "./queries",
      bypassSecret: "SECRET VALUE 123",
    },
  }
}
```

We rely on special `operationName` (part of request's body) parameter to match requested query with a query that is
defined in `whitelistedQueriesDir`.

You can bypass whole mechanism (for example to test new queries) by providing `bypassSecret` as `devMode` in request's
body.

## Ethereum node considerations

spock pulls all the data from ethereum node. Nodes can differ greatly between each other, and some are simply not
reliable / consistent. Based on our tests:

- Alchemy works
- Infura DOESN'T WORK. Sometimes it can randomly return empty sets for getLogs calls
- Self hosted nodes should work (not tested yet) but keep in mind that spock can generate quite a lot of network calls
  (around 500k daily)

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

We use [consola](https://github.com/nuxt/consola#readme) for logging. By default it will log everything. To adjust
logging [levels](https://github.com/nuxt/consola#level) set `VL_LOGGING_LEVEL`. env variable. Ex. use
`VL_LOGGING_LEVEL=4` to omit detailed db logs (most verbose).

### Sentry integration

Configure sentry by providing environmental variables:

```
SENTRY_DSN=...
SENTRY_ENV=production
```

We will only report critical errors (ie. stopped jobs).

### How to write transformers?

There are two main requirements for transformers in Spock, both of them are related to processing reorged blocks:

1. Transformers should be written as a "pure" functions operating only on the arguments provided. There can be no
   internal caches placed in the closures etc.
2. All data written to the database has to be linked via foreign keys to the processed block.

When reorg happens spock will cascade delete reorged blocks with all related data. Then it will resync new block.
