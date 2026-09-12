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
assert.equal(matchHeaders.indexOf('Équipe domicile'), matchHeaders.indexOf('ID équipe domicile') + 1);
assert.equal(matchHeaders.indexOf('Équipe visiteuse'), matchHeaders.indexOf('ID équipe visiteuse') + 1);
assert.equal(matchHeaders.indexOf('Équipe forfait'), matchHeaders.indexOf('ID équipe forfait') + 1);
assert.ok(matchHeaders.includes('Victoire aux tirs au but'));

const lookup = context.buildMatchTeamLookup_([
  { 'ID équipe': 'E01', 'ID tournoi': 'T1', 'ID division': 'D1', Pool: 'A', Nom: 'Les Aigles' },
  { 'ID équipe': 'E02', 'ID tournoi': 'T1', 'ID division': 'D1', Pool: 'A', Nom: 'Les Lynx' },
  { 'ID équipe': 'E03', 'ID tournoi': 'T2', 'ID division': 'D2', Pool: 'A', Nom: 'Les Aigles' }
]);
const matchContext = { tournamentId: 'T1', divisionId: 'D1', pool: 'A' };
assert.equal(context.matchTeamNameForId_('E01', lookup.byId), 'Les Aigles');
assert.equal(context.matchTeamNameForId_('', lookup.byId), '');
assert.equal(context.matchTeamNameForId_('E99', lookup.byId), '⚠ ID inconnu');
assert.deepEqual(
  JSON.parse(JSON.stringify(context.resolveMatchTeamSelection_(matchContext, '', 'Les Aigles', lookup))),
  { id: 'E01', name: 'Les Aigles' }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.resolveMatchTeamSelection_(matchContext, 'E01', 'Les Lynx', lookup))),
  { id: 'E02', name: 'Les Lynx' }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.resolveMatchTeamSelection_(matchContext, 'E01', 'Ancien nom', lookup))),
  { id: 'E01', name: 'Les Aigles' }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.resolveMatchTeamSelection_(matchContext, 'E01', '', lookup))),
  { id: '', name: '' }
);
assert.throws(
  () => context.resolveMatchTeamSelection_({ tournamentId: 'T1', divisionId: 'D9', pool: '' }, '', 'Les Aigles', lookup),
  /aucune équipe/
);
assert.throws(
  () => context.resolveMatchTeamSelection_(matchContext, 'E01', 'Les Aigles', context.buildMatchTeamLookup_([
    { 'ID équipe': 'E01', 'ID tournoi': 'T1', 'ID division': 'D1', Pool: 'A', Nom: 'Équipe renommée' },
    { 'ID équipe': 'E03', 'ID tournoi': 'T2', 'ID division': 'D2', Pool: 'A', Nom: 'Les Aigles' }
  ])),
  /aucune équipe/
);
const duplicateLookup = context.buildMatchTeamLookup_([
  { 'ID équipe': 'E10', 'ID tournoi': 'T1', 'ID division': 'D1', Pool: 'A', Nom: 'Même nom' },
  { 'ID équipe': 'E11', 'ID tournoi': 'T1', 'ID division': 'D1', Pool: 'A', Nom: 'Même nom' }
]);
assert.throws(
  () => context.resolveMatchTeamSelection_(matchContext, '', 'Même nom', duplicateLookup),
  /plusieurs équipes/
);

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
assert.equal(fakeSheet.headers.indexOf('Équipe domicile'), fakeSheet.headers.indexOf('ID équipe domicile') + 1);
assert.equal(fakeSheet.headers.indexOf('Équipe visiteuse'), fakeSheet.headers.indexOf('ID équipe visiteuse') + 1);
assert.equal(fakeSheet.headers.indexOf('Score domicile'), originalHeaders.indexOf('Score domicile') + 2);

const previousVersionHeaders = [
  'ID match', 'ID tournoi', 'ID division', 'Pool', 'Phase', 'Ronde', 'Date', 'Heure', 'ID lieu',
  'Équipe domicile', 'Nom équipe domicile', 'Équipe visiteuse', 'Nom équipe visiteuse',
  'Score domicile', 'Score visiteuse', 'Résultat final', 'Motif', 'Afficher'
];
const migratedSheet = new FakeHeaderSheet(previousVersionHeaders);
context.ensureMatchTeamNameColumns_({ getSheetByName: () => migratedSheet });
assert.equal(migratedSheet.headers.length, previousVersionHeaders.length);
assert.deepEqual(migratedSheet.headers.slice(9, 13), [
  'ID équipe domicile', 'Équipe domicile', 'ID équipe visiteuse', 'Équipe visiteuse'
]);

console.log('Match display tests passed.');
