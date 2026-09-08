const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { console };
vm.createContext(context);
['Config.gs', 'Utils.gs', 'MatchDisplay.gs'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script', file), 'utf8'), context, { filename: file });
});

const matchHeaders = Array.from(vm.runInContext('APP.headers.MATCHS', context));
assert.equal(matchHeaders.indexOf('Nom équipe domicile'), matchHeaders.indexOf('Équipe domicile') + 1);
assert.equal(matchHeaders.indexOf('Nom équipe visiteuse'), matchHeaders.indexOf('Équipe visiteuse') + 1);

const index = context.buildMatchTeamNameIndex_([
  { 'ID équipe': 'E01', Nom: 'Les Aigles' },
  { 'ID équipe': 'E02', Nom: 'Les Lynx' }
]);
assert.equal(context.matchTeamNameForId_('E01', index), 'Les Aigles');
assert.equal(context.matchTeamNameForId_('', index), '');
assert.equal(context.matchTeamNameForId_('E99', index), '⚠ ID inconnu');
const duplicateIndex = context.buildMatchTeamNameIndex_([
  { 'ID équipe': 'E01', Nom: 'Premier nom' },
  { 'ID équipe': 'E01', Nom: 'Deuxième nom' }
]);
assert.equal(context.matchTeamNameForId_('E01', duplicateIndex), '⚠ ID en double');

class FakeHeaderSheet {
  constructor(headers) { this.headers = headers.slice(); }
  getLastColumn() { return this.headers.length; }
  getName() { return 'MATCHS'; }
  getRange(row, column, rowCount, columnCount) {
    if (row === 1 && column === 1 && rowCount === 1) {
      return { getValues: () => [this.headers.slice(0, columnCount)] };
    }
    if (row === 1 && rowCount === undefined) {
      return { setValue: (value) => { this.headers[column - 1] = value; } };
    }
    throw new Error('Unexpected fake range request.');
  }
  insertColumnAfter(column) { this.headers.splice(column, 0, ''); }
}

const originalHeaders = [
  'ID match', 'ID tournoi', 'ID division', 'Pool', 'Phase', 'Ronde', 'Date', 'Heure', 'ID lieu',
  'Équipe domicile', 'Équipe visiteuse', 'Score domicile', 'Score visiteuse', 'Résultat final', 'Motif', 'Afficher'
];
const fakeSheet = new FakeHeaderSheet(originalHeaders);
context.ensureMatchTeamNameColumns_({ getSheetByName: () => fakeSheet });
assert.equal(fakeSheet.headers.indexOf('Nom équipe domicile'), fakeSheet.headers.indexOf('Équipe domicile') + 1);
assert.equal(fakeSheet.headers.indexOf('Nom équipe visiteuse'), fakeSheet.headers.indexOf('Équipe visiteuse') + 1);
assert.equal(fakeSheet.headers.indexOf('Score domicile'), originalHeaders.indexOf('Score domicile') + 2);

const displaySource = fs.readFileSync(path.join(root, 'apps-script', 'MatchDisplay.gs'), 'utf8');
assert.match(displaySource, /homeNameRange\.clearDataValidations\(\)\.setValues/);
assert.match(displaySource, /awayNameRange\.clearDataValidations\(\)\.setValues/);

console.log('Match display tests passed.');
