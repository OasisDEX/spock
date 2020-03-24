export function getVersion(): string {
  return (require('../../../package.json') || {}).version;
}
