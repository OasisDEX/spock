#!/usr/bin/env node

const command = process.argv[2];

try {
  require(`./bin/${command}.js`);
} catch (e) {
  console.log(`Cant find command ${command}`);
  console.error(e);
  process.exit(1);
}
