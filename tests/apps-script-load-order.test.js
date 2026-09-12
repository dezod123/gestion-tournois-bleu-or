const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appsScriptDirectory = path.join(root, 'apps-script');
const files = fs.readdirSync(appsScriptDirectory).filter((file) => file.endsWith('.gs')).sort();

[files, files.slice().reverse()].forEach((order) => {
  const context = { console };
  vm.createContext(context);
  order.forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(appsScriptDirectory, file), 'utf8'), context, { filename: file });
  });
  assert.equal(vm.runInContext('APP.version', context), '0.13.0');
  assert.equal(vm.runInContext("typeof mettreAJourSeriesAutomatiques_", context), 'function');
});

console.log('Apps Script load-order tests passed.');
