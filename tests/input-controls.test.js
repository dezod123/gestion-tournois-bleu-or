const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { console };
vm.createContext(context);
// Apps Script does not guarantee file evaluation order. Setup must be safe to load first.
['Setup.gs', 'Config.gs'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script', file), 'utf8'), context, { filename: file });
});

const dateColumns = JSON.parse(vm.runInContext('JSON.stringify(adminDateInputColumns_())', context));
assert.deepEqual(dateColumns, [
  ['TOURNOIS', 'Date début'],
  ['TOURNOIS', 'Date fin'],
  ['TOURNOIS', 'Date limite inscription'],
  ['PLAGES_HORAIRES', 'Date'],
  ['MATCHS', 'Date'],
  ['PHOTOS', 'Date']
]);

const timeColumns = JSON.parse(vm.runInContext('JSON.stringify(adminTimeInputColumns_())', context));
assert.deepEqual(timeColumns, [
  ['PLAGES_HORAIRES', 'Heure début'],
  ['PLAGES_HORAIRES', 'Heure fin'],
  ['PLAGES_HORAIRES', 'Pause début'],
  ['PLAGES_HORAIRES', 'Pause fin'],
  ['MATCHS', 'Heure']
]);

const quarterHours = Array.from(context.timeDropdownOptions_(15));
assert.equal(quarterHours.length, 96);
assert.deepEqual(quarterHours.slice(0, 5), ['00:00', '00:15', '00:30', '00:45', '01:00']);
assert.equal(quarterHours.at(-1), '23:45');

const fallback = Array.from(context.timeDropdownOptions_('invalide'));
assert.equal(fallback.length, 96);

console.log('Input control tests passed.');
