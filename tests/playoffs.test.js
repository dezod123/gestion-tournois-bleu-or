const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
let uuid = 0;
const context = { console, Utilities: { getUuid: () => `TEST-${++uuid}` } };
vm.createContext(context);
// The new file must be safe even when Apps Script evaluates it before Config.gs.
['Playoffs.gs', 'Utils.gs', 'Standings.gs', 'AdminReferences.gs', 'Ids.gs', 'Config.gs'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script', file), 'utf8'), context, { filename: file });
});

const formula4 = JSON.parse(JSON.stringify(context.standardSinglePoolBracket_(4)));
assert.deepEqual(formula4, [
  { code: 'SF1', phase: 'DEMI-FINALE', order: 1, homeSource: '1er général', awaySource: '4e général' },
  { code: 'SF2', phase: 'DEMI-FINALE', order: 2, homeSource: '2e général', awaySource: '3e général' },
  { code: 'F', phase: 'FINALE', order: 3, homeSource: 'Gagnant SF1', awaySource: 'Gagnant SF2' }
]);

const formula3 = JSON.parse(JSON.stringify(context.standardSinglePoolBracket_(3)));
assert.deepEqual(formula3, [
  { code: 'SF1', phase: 'DEMI-FINALE', order: 1, homeSource: '2e général', awaySource: '3e général' },
  { code: 'F', phase: 'FINALE', order: 2, homeSource: '1er général', awaySource: 'Gagnant SF1' }
]);

const formula6 = JSON.parse(JSON.stringify(context.standardSinglePoolBracket_(6)));
assert.equal(formula6.filter((row) => row.phase === 'QUART-DE-FINALE').length, 2);
assert.equal(formula6.filter((row) => row.phase === 'DEMI-FINALE').length, 2);
assert.equal(formula6.at(-1).phase, 'FINALE');
assert.equal(formula6.at(-1).code, 'F');

const crossover = JSON.parse(JSON.stringify(context.standardPlayoffFormula_(2, 4)));
assert.equal(crossover[0].homeSource, '1er pool A');
assert.equal(crossover[0].awaySource, '2e pool B');
assert.equal(crossover[1].homeSource, '1er pool B');
assert.equal(crossover[1].awaySource, '2e pool A');
assert.throws(() => context.standardPlayoffFormula_(3, 6), /Aucun placement ne peut être déduit/);

assert.deepEqual(JSON.parse(JSON.stringify(context.parsePlayoffSource_('1er général', 'test'))), {
  type: 'rank', rank: 1, pool: '', label: '1er général'
});
assert.deepEqual(JSON.parse(JSON.stringify(context.parsePlayoffSource_('2e pool B', 'test'))), {
  type: 'rank', rank: 2, pool: 'B', label: '2e pool B'
});
assert.deepEqual(JSON.parse(JSON.stringify(context.parsePlayoffSource_('Gagnant SF1', 'test'))), {
  type: 'winner', code: 'SF1', label: 'Gagnant SF1'
});
assert.throws(() => context.parsePlayoffSource_('équipe bleue', 'test'), /source invalide/);

const winnerTeamIndex = {
  E1: { 'ID équipe': 'E1', Nom: 'Aigles' },
  E2: { 'ID équipe': 'E2', Nom: 'Lynx' }
};
assert.deepEqual(JSON.parse(JSON.stringify(context.playoffMatchWinner_({
  'Résultat final': true,
  'ID équipe domicile': 'E1',
  'ID équipe visiteuse': 'E2',
  'Score domicile': 3,
  'Score visiteuse': 1,
  'ID équipe gagnante': ''
}, winnerTeamIndex, 'SF1'))), { id: 'E1', name: 'Aigles' });
assert.deepEqual(JSON.parse(JSON.stringify(context.playoffMatchWinner_({
  'Résultat final': true,
  'ID équipe domicile': 'E1',
  'ID équipe visiteuse': 'E2',
  'Score domicile': 2,
  'Score visiteuse': 2,
  'Victoire aux tirs au but': true,
  'ID équipe gagnante': 'E2'
}, winnerTeamIndex, 'SF1'))), { id: 'E2', name: 'Lynx' });
assert.throws(() => context.playoffMatchWinner_({
  'Résultat final': true,
  'ID équipe domicile': 'E1',
  'ID équipe visiteuse': 'E2',
  'Score domicile': 2,
  'Score visiteuse': 2,
  'ID équipe gagnante': ''
}, winnerTeamIndex, 'SF1'), /sélectionnez l’équipe gagnante/);

const configs = formula4.map((row, index) => ({
  __row: index + 2,
  'ID tournoi': 'T1',
  'ID division': 'D1',
  'Code match': row.code,
  Phase: row.phase,
  Ordre: row.order,
  'Source domicile': row.homeSource,
  'Source visiteuse': row.awaySource
}));
assert.equal(context.validatePlayoffFormulaRows_(configs, 'T1', 'D1', 4).length, 3);
assert.throws(() => context.validatePlayoffFormulaRows_(configs, 'T1', 'D1', 3), /la division indique 3/);
configs[2]['Source domicile'] = 'Gagnant INCONNU';
assert.throws(() => context.validatePlayoffFormulaRows_(configs, 'T1', 'D1', 4), /code inexistant/);

configs[2]['Source domicile'] = 'Gagnant SF1';
const division = {
  'ID division': 'D1', 'ID tournoi': 'T1', Nom: 'Atome', 'Équipes qualifiées': 4,
  'Points victoire': 3, 'Points nul': 1, 'Points défaite': 0, 'Ordre bris égalité': 'POINTS,DIFF,BP,NOM'
};
const tournament = { 'ID tournoi': 'T1', Nom: 'Tournoi', 'Édition': '2026' };
const teams = ['E1', 'E2', 'E3', 'E4'].map((id, index) => ({
  'ID équipe': id, 'ID tournoi': 'T1', 'ID division': 'D1', Pool: 'A', Nom: `Équipe ${index + 1}`, Statut: 'APPROUVÉE'
}));
const poolResults = [
  ['E1', 'E2'], ['E1', 'E3'], ['E1', 'E4'], ['E2', 'E3'], ['E2', 'E4'], ['E3', 'E4']
].map((pair, index) => ({
  __row: index + 2, 'ID match': `P${index + 1}`, 'ID tournoi': 'T1', 'ID division': 'D1', Phase: 'POOL',
  'ID équipe domicile': pair[0], 'ID équipe visiteuse': pair[1], 'Score domicile': 2, 'Score visiteuse': 0,
  'Résultat final': true
}));
const teamIndex = Object.fromEntries(teams.map((team) => [team['ID équipe'], team]));
const initialPlan = context.buildPlayoffUpdatePlan_(tournament, division, configs, teams, poolResults, teamIndex);
assert.equal(initialPlan.created.length, 3);
assert.equal(initialPlan.created.find((match) => match['Code série'] === 'SF1')['ID équipe domicile'], 'E1');
assert.equal(initialPlan.created.find((match) => match['Code série'] === 'SF1')['ID équipe visiteuse'], 'E4');
assert.equal(initialPlan.created.find((match) => match['Code série'] === 'F')['ID équipe domicile'], '');

const existingSeries = initialPlan.created.map((match, index) => ({ ...match, __row: 20 + index }));
existingSeries.filter((match) => match.Phase === 'DEMI-FINALE').forEach((match) => {
  match['Score domicile'] = 3;
  match['Score visiteuse'] = 1;
  match['Résultat final'] = true;
});
const progressedPlan = context.buildPlayoffUpdatePlan_(
  tournament, division, configs, teams, poolResults.concat(existingSeries), teamIndex
);
const finalUpdate = progressedPlan.updated.find((update) => update.values['Code série'] === 'F');
assert.equal(finalUpdate.values['ID équipe domicile'], 'E1');
assert.equal(finalUpdate.values['ID équipe visiteuse'], 'E2');

const config = vm.runInContext('JSON.parse(JSON.stringify(APP))', context);
assert.ok(config.headers.FORMULES_SERIES.includes('Source domicile'));
assert.ok(config.headers.MATCHS.includes('ID équipe gagnante'));

console.log('Automatic playoff tests passed.');
