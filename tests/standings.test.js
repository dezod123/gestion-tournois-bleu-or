const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { console };
vm.createContext(context);
['Config.gs', 'Utils.gs', 'Standings.gs'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script', file), 'utf8'), context, { filename: file });
});

const division = {
  'ID division': 'D1', 'Points victoire': 3, 'Points nul': 1, 'Points défaite': 0,
  'Ordre bris égalité': 'POINTS,FACE_A_FACE,DIFF,BP,BC,FAIR_PLAY,TIRAGE',
  'Plafond différence par match': 5, 'Points carton jaune': 1,
  'Points deuxième jaune': 3, 'Points carton rouge': 3
};
const teams = ['A', 'B', 'C', 'D'].map((id) => ({
  'ID équipe': id, 'ID tournoi': 'T1', 'ID division': 'D1', Pool: 'A', Nom: id
}));
let matchNumber = 0;
function match(home, away, homeScore, awayScore) {
  matchNumber += 1;
  return { 'ID match': 'M' + matchNumber, 'ID division': 'D1', Phase: 'POOL', 'Résultat final': true,
    'ID équipe domicile': home, 'ID équipe visiteuse': away,
    'Score domicile': homeScore, 'Score visiteuse': awayScore };
}

// A devance B grâce au face-à-face, même si B possède une meilleure différence de buts.
const headToHeadRows = context.calculateStandings_(division, teams, [
  match('A', 'B', 1, 0), match('C', 'A', 5, 0), match('A', 'D', 1, 0),
  match('B', 'C', 10, 0), match('B', 'D', 1, 0)
], [], []);
assert.ok(headToHeadRows.findIndex((row) => row.teamId === 'A') < headToHeadRows.findIndex((row) => row.teamId === 'B'));
const b = headToHeadRows.find((row) => row.teamId === 'B');
assert.equal(b.difference, 10);
assert.equal(b.tieBreakDifference, 5);

// Pour trois équipes, après que le fair-play départage A, la procédure recommence
// au face-à-face pour B et C.
const threeTeams = teams.slice(0, 3);
const restartMatches = [match('A', 'B', 1, 0), match('B', 'C', 1, 0), match('C', 'A', 1, 0)];
const restarted = context.calculateStandings_(division, threeTeams, restartMatches,
  [{ 'ID division': 'D1', 'ID match': restartMatches[0]['ID match'], 'ID équipe': 'A', Sanction: 'CARTON JAUNE', Actif: true }], []);
assert.deepEqual(Array.from(restarted.map((row) => row.teamId)), ['B', 'C', 'A']);
assert.equal(restarted.find((row) => row.teamId === 'A').fairPlayPoints, 1);

// Une égalité parfaite attend un tirage administratif, puis respecte les priorités saisies.
const tiedTeams = teams.slice(0, 2);
const tiedMatch = [match('A', 'B', 1, 1)];
const pending = context.calculateStandings_(division, tiedTeams, tiedMatch, [], []);
assert.equal(pending.every((row) => row.tieBreakPending), true);
const decided = context.calculateStandings_(division, tiedTeams, tiedMatch, [], [
  { 'ID division': 'D1', Pool: 'A', 'ID équipe': 'A', Priorité: 2, Actif: true },
  { 'ID division': 'D1', Pool: 'A', 'ID équipe': 'B', Priorité: 1, Actif: true }
]);
assert.deepEqual(Array.from(decided.map((row) => row.teamId)), ['B', 'A']);
assert.equal(decided.some((row) => row.tieBreakPending), false);

assert.equal(context.disciplinePenaltyPoints_(division, 'Deuxième jaune'), 3);
assert.equal(context.disciplinePenaltyPoints_(division, 'Carton rouge direct'), 3);

console.log('Standings regulation tests passed.');
