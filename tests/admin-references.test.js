const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { console };
vm.createContext(context);
// These files must remain safe regardless of the order chosen by Apps Script.
['AdminReferences.gs', 'Utils.gs', 'Config.gs'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script', file), 'utf8'), context, { filename: file });
});

const headers = JSON.parse(vm.runInContext('JSON.stringify(APP.headers)', context));
[
  ['DIVISIONS', 'ID tournoi', 'Tournoi'],
  ['LIEUX', 'ID tournoi', 'Tournoi'],
  ['PLAGES_HORAIRES', 'ID tournoi', 'Tournoi'],
  ['PLAGES_HORAIRES', 'ID lieu', 'Lieu'],
  ['INSCRIPTIONS', 'ID tournoi', 'Tournoi'],
  ['INSCRIPTIONS', 'ID division', 'Division'],
  ['EQUIPES', 'ID tournoi', 'Tournoi'],
  ['EQUIPES', 'ID division', 'Division'],
  ['MATCHS', 'ID tournoi', 'Tournoi'],
  ['MATCHS', 'ID division', 'Division'],
  ['MATCHS', 'ID lieu', 'Lieu'],
  ['FORMULES_SERIES', 'ID tournoi', 'Tournoi'],
  ['FORMULES_SERIES', 'ID division', 'Division'],
  ['PHOTOS', 'ID tournoi', 'Tournoi'],
  ['PHOTOS', 'ID division', 'Division'],
  ['PHOTOS', 'ID équipe', 'Équipe']
].forEach(([sheet, idHeader, labelHeader]) => {
  assert.equal(headers[sheet].indexOf(labelHeader), headers[sheet].indexOf(idHeader) + 1);
});

const lookups = context.buildAdminReferenceLookups_(
  [
    { 'ID tournoi': 'T1', Nom: 'Bleu et Or', 'Édition': '2026' },
    { 'ID tournoi': 'T2', Nom: 'Bleu et Or', 'Édition': '2027' }
  ],
  [
    { 'ID division': 'D1', 'ID tournoi': 'T1', Nom: 'Benjamin masculin' },
    { 'ID division': 'D2', 'ID tournoi': 'T2', Nom: 'Benjamin masculin' }
  ],
  [
    { 'ID lieu': 'L1', 'ID tournoi': 'T1', Nom: 'Gymnase 1' },
    { 'ID lieu': 'L2', 'ID tournoi': 'T2', Nom: 'Gymnase 1' }
  ],
  [
    { 'ID équipe': 'E1', 'ID tournoi': 'T1', 'ID division': 'D1', Nom: 'Les Aigles' },
    { 'ID équipe': 'E2', 'ID tournoi': 'T2', 'ID division': 'D2', Nom: 'Les Aigles' }
  ]
);

assert.deepEqual(
  JSON.parse(JSON.stringify(context.resolveAdminReferenceSelection_('tournament', '', 'Bleu et Or — 2026', lookups, {}))),
  { id: 'T1', label: 'Bleu et Or — 2026' }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.resolveAdminReferenceSelection_('division', '', 'Benjamin masculin', lookups, { tournamentId: 'T1' }))),
  { id: 'D1', label: 'Benjamin masculin' }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.resolveAdminReferenceSelection_('venue', '', 'Gymnase 1', lookups, { tournamentId: 'T2' }))),
  { id: 'L2', label: 'Gymnase 1' }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.resolveAdminReferenceSelection_('team', '', 'Les Aigles', lookups, { tournamentId: 'T1', divisionId: 'D1' }))),
  { id: 'E1', label: 'Les Aigles' }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.resolveAdminReferenceSelection_('division', 'D1', 'Ancien nom', lookups, { tournamentId: 'T1' }))),
  { id: 'D1', label: 'Benjamin masculin' }
);
assert.throws(
  () => context.resolveAdminReferenceSelection_('division', '', 'Benjamin masculin', lookups, {}),
  /tournoi/
);
assert.equal(context.adminReferenceForId_('venue', 'INCONNU', lookups).label, '⚠ ID inconnu');
assert.throws(
  () => context.resolveAdminReferenceSelection_('venue', 'INCONNU', '', lookups, { tournamentId: 'T1' }),
  /ne correspond à aucun lieu/
);

const pendingContextLookups = context.buildAdminReferenceLookups_(
  [{ 'ID tournoi': 'T1', Nom: 'Tournoi', 'Édition': '2026' }],
  [{ 'ID division': 'D1', 'ID tournoi': '', Nom: 'Atome' }],
  [],
  []
);
context.updateAdminReferenceLookupContext_(
  'DIVISIONS',
  { 'ID division': 'D1', 'ID tournoi': '' },
  { 'ID tournoi': 'T1' },
  pendingContextLookups
);
assert.equal(pendingContextLookups.division.byId.D1.tournamentId, 'T1');
assert.equal(
  context.resolveAdminReferenceSelection_('division', '', 'Atome', pendingContextLookups, { tournamentId: 'T1' }).id,
  'D1'
);

const duplicates = context.buildAdminReferenceLookups_(
  [{ 'ID tournoi': 'T1', Nom: 'Tournoi', 'Édition': '2026' }],
  [
    { 'ID division': 'D1', 'ID tournoi': 'T1', Nom: 'Cadet' },
    { 'ID division': 'D2', 'ID tournoi': 'T1', Nom: 'Cadet' }
  ],
  [],
  []
);
assert.throws(
  () => context.resolveAdminReferenceSelection_('division', '', 'Cadet', duplicates, { tournamentId: 'T1' }),
  /plusieurs divisions/
);

class FakeHeaderSheet {
  constructor(name, values) { this.name = name; this.headers = values.slice(); this.clearedValidationColumns = []; }
  getName() { return this.name; }
  getLastColumn() { return this.headers.length; }
  getMaxRows() { return 1000; }
  insertColumnAfter(column) { this.headers.splice(column, 0, ''); }
  getRange(row, column, rowCount, columnCount) {
    if (row === 1 && column === 1 && rowCount === 1) {
      return { getValues: () => [this.headers.slice(0, columnCount)] };
    }
    if (row === 1 && rowCount === undefined) {
      return { setValue: (value) => { this.headers[column - 1] = value; } };
    }
    if (row === 2 && rowCount === 999 && columnCount === 1) {
      return { clearDataValidations: () => { this.clearedValidationColumns.push(column); } };
    }
    throw new Error('Unexpected fake range.');
  }
}

const availability = new FakeHeaderSheet('PLAGES_HORAIRES', [
  'ID plage', 'ID tournoi', 'ID lieu', 'Date', 'Heure début', 'Heure fin', 'Pause début', 'Pause fin', 'Actif', 'Notes'
]);
context.ensureAdminReferenceColumns_({
  getSheetByName: (name) => name === 'PLAGES_HORAIRES' ? availability : null
});
assert.deepEqual(availability.headers.slice(0, 5), ['ID plage', 'ID tournoi', 'Tournoi', 'ID lieu', 'Lieu']);
assert.deepEqual(availability.clearedValidationColumns, [3, 5]);

console.log('Administrative reference tests passed.');
