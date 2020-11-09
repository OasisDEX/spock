module.exports = {
  ...require('../../.mocharc'),
  spec: ['test/**/*.test.ts'],
  slow: 1000,
  timeout: 10000,
}
