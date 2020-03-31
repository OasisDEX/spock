module.exports = {
  ...require('../../../.mocharc'),
  spec: ['test-e2e/**/*.test.ts'],
  slow: 1000,
  timeout: 10000,
}
