process.env.NODE_ENV = 'test';

module.exports = {
  require: 'ts-node/register/transpile-only',
  extension: ['ts'],
  watchExtensions: ['ts'],
  spec: ['test-e2e/**/*.test.ts'],
  slow: 1000,
  timeout: 10000,
}
