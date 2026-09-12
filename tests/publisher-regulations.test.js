const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { console };
vm.createContext(context);
['Config.gs', 'Utils.gs', 'Standings.gs', 'Publisher.gs'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script', file), 'utf8'), context, { filename: file });
});

const tournaments = [{ __row: 2, 'ID tournoi': 'T1' }];
const divisions = [{ __row: 2, 'ID division': 'D1', 'ID tournoi': 'T1' }];
const teams = [
  { __row: 2, 'ID équipe': 'E1', 'ID tournoi': 'T1', 'ID division': 'D1', Pool: 'A' },
  { __row: 3, 'ID équipe': 'E2', 'ID tournoi': 'T1', 'ID division': 'D1', Pool: 'A' },
  { __row: 4, 'ID équipe': 'E3', 'ID tournoi': 'T1', 'ID division': 'D1', Pool: 'A' }
];
const matches = [{
  __row: 2, 'ID match': 'M1', 'ID tournoi': 'T1', 'ID division': 'D1', Phase: 'POOL',
  'ID équipe domicile': 'E1', 'ID équipe visiteuse': 'E2',
  'Score domicile': 1, 'Score visiteuse': 0, 'Résultat final': true
}];
const divisionIds = new Set(['D1']);
const teamIds = new Set(['E1', 'E2', 'E3']);
const incident = {
  __row: 2, 'ID incident': 'I1', 'ID tournoi': 'T1', 'ID division': 'D1',
  'ID match': 'M1', 'ID équipe': 'E1', Sanction: 'CARTON JAUNE', Actif: true
};

assert.deepEqual(
  Array.from(context.validatePublicData_(
    tournaments, divisions, teams, matches, [], divisionIds, teamIds, [incident], []
  )),
  []
);

const wrongMatchTeam = Object.assign({}, incident, { 'ID incident': 'I2', 'ID équipe': 'E3' });
const errors = context.validatePublicData_(
  tournaments, divisions, teams, matches, [], divisionIds, teamIds, [wrongMatchTeam], []
);
assert.ok(errors.some((message) => message.includes('ne participe pas au match')));

console.log('Publisher regulation validation tests passed.');
