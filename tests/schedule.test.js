const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { console };
vm.createContext(context);
['Config.gs', 'Utils.gs', 'Schedule.gs'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script', file), 'utf8'), context, { filename: file });
});

function team(id, row, pool = '') {
  return { 'ID équipe': id, Nom: id, Pool: pool, __row: row };
}

const pools = context.assignTeamsToPools_([
  team('EQ-1', 2, 'A'),
  team('EQ-2', 3),
  team('EQ-3', 4),
  team('EQ-4', 5),
  team('EQ-5', 6)
], 2, 'Division test');
assert.equal(pools.assignments.length, 4);
assert.equal(pools.teams.filter((item) => item.pool === 'A').length, 3);
assert.equal(pools.teams.filter((item) => item.pool === 'B').length, 2);
assert.throws(
  () => context.assignTeamsToPools_([team('EQ-1', 2, 'C')], 2, 'Division test'),
  /dépasse les 2 pool/
);

const fourTeams = ['A', 'B', 'C', 'D'].map((id) => ({ id, name: id }));
const oneEncounter = context.roundRobinFixtures_(fourTeams, 1);
assert.equal(oneEncounter.length, 6);
assert.deepEqual(Array.from(new Set(oneEncounter.map((fixture) => fixture.round))), [1, 2, 3]);
assert.equal(new Set(oneEncounter.map((fixture) => [fixture.homeTeamId, fixture.awayTeamId].sort().join('|'))).size, 6);
for (let round = 1; round <= 3; round += 1) {
  const teamsInRound = oneEncounter.filter((fixture) => fixture.round === round)
    .flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]);
  assert.equal(new Set(teamsInRound).size, 4);
}

const twoEncounters = context.roundRobinFixtures_(fourTeams, 2);
assert.equal(twoEncounters.length, 12);
const pairCounts = {};
twoEncounters.forEach((fixture) => {
  const key = [fixture.homeTeamId, fixture.awayTeamId].sort().join('|');
  pairCounts[key] = (pairCounts[key] || 0) + 1;
});
assert.equal(Object.values(pairCounts).every((count) => count === 2), true);

function fixture(home, away, round) {
  return {
    tournamentId: 'T1', divisionId: 'D1', divisionName: 'Division test', pool: 'A', duration: 30,
    homeTeamId: home, homeTeamName: home, awayTeamId: away, awayTeamName: away, round
  };
}

const windows = [
  { date: '2026-11-06', start: 9 * 60, end: 10 * 60, venueId: 'V1', venueName: 'Gym 1' },
  { date: '2026-11-06', start: 9 * 60, end: 10 * 60, venueId: 'V2', venueName: 'Gym 2' }
];
const scheduled = context.scheduleFixtures_([
  fixture('A', 'B', 1),
  fixture('C', 'D', 1),
  fixture('A', 'C', 2)
], windows, []);
assert.equal(scheduled[0].start, 9 * 60);
assert.equal(scheduled[1].start, 9 * 60);
assert.notEqual(scheduled[0].venueId, scheduled[1].venueId);
assert.equal(scheduled[2].start, 9 * 60 + 30);

assert.throws(
  () => context.scheduleFixtures_([fixture('A', 'B', 1), fixture('C', 'D', 1), fixture('E', 'F', 1)], [windows[0]], []),
  /Capacité horaire insuffisante/
);
assert.equal(context.scheduleIntervalsOverlap_(540, 570, 570, 600), false);
assert.equal(context.scheduleIntervalsOverlap_(540, 571, 570, 600), true);
assert.equal(context.scheduleTimeToMinutes_('16:30', 'America/Toronto', 'Heure'), 990);
assert.throws(() => context.scheduleTimeToMinutes_('25:00', 'America/Toronto', 'Heure'), /invalide/);

const demoRows = {
  DIVISIONS: [{
    'ID tournoi': 'T-DEMO', 'ID division': 'D-DEMO', Nom: 'Benjamin masculin', Actif: true,
    'Nombre de pools': 1, 'Matchs entre équipes': 1, 'Durée match (minutes)': 30
  }],
  EQUIPES: [
    { 'ID tournoi': 'T-DEMO', 'ID division': 'D-DEMO', 'ID équipe': 'E01', Nom: 'A', Pool: 'A', Statut: 'APPROUVÉE', __row: 2 },
    { 'ID tournoi': 'T-DEMO', 'ID division': 'D-DEMO', 'ID équipe': 'E02', Nom: 'B', Pool: 'A', Statut: 'APPROUVÉE', __row: 3 },
    { 'ID tournoi': 'T-DEMO', 'ID division': 'D-DEMO', 'ID équipe': 'E03', Nom: 'C', Pool: 'A', Statut: 'APPROUVÉE', __row: 4 },
    { 'ID tournoi': 'T-DEMO', 'ID division': 'D-DEMO', 'ID équipe': 'E04', Nom: 'D', Pool: '', Statut: 'APPROUVÉE', __row: 5 }
  ],
  LIEUX: [{ 'ID tournoi': 'T-DEMO', 'ID lieu': 'GYM-1', Nom: 'Gymnase', Actif: true }],
  PLAGES_HORAIRES: [{
    'ID tournoi': 'T-DEMO', 'ID lieu': 'GYM-1', Date: '2026-11-06', 'Heure début': '16:30',
    'Heure fin': '21:30', 'Pause début': '', 'Pause fin': '', Actif: true
  }],
  MATCHS: [
    { 'ID match': 'M01', 'ID tournoi': 'T-DEMO', 'ID division': 'D-DEMO', Pool: 'A', Phase: 'POOL', Date: '2026-11-06', Heure: '17:00', 'ID lieu': 'GYM-1', 'Équipe domicile': 'E01', 'Équipe visiteuse': 'E02' },
    { 'ID match': 'M02', 'ID tournoi': 'T-DEMO', 'ID division': 'D-DEMO', Pool: 'A', Phase: 'POOL', Date: '2026-11-07', Heure: '09:00', 'ID lieu': 'GYM-1', 'Équipe domicile': 'E02', 'Équipe visiteuse': 'E03' },
    { 'ID match': 'M03', 'ID tournoi': 'T-DEMO', 'ID division': 'D-DEMO', Pool: 'A', Phase: 'POOL', Date: '2026-11-07', Heure: '11:00', 'ID lieu': 'GYM-1', 'Équipe domicile': 'E03', 'Équipe visiteuse': 'E01' }
  ]
};
context.Session = { getScriptTimeZone: () => 'America/Toronto' };
context.setting_ = (_key, fallback) => fallback;
context.rowsAsObjects_ = (sheetName) => demoRows[sheetName] || [];
const demoPlan = context.buildSchedulePlan_({
  'ID tournoi': 'T-DEMO', Nom: 'Tournoi démo', 'Durée match par défaut (minutes)': 30
});
assert.equal(demoPlan.poolAssignments.length, 1);
assert.equal(demoPlan.poolAssignments[0].pool, 'A');
assert.equal(demoPlan.existingMatchCount, 3);
assert.equal(demoPlan.matches.length, 3);
assert.equal(demoPlan.matches.every((match) => match.homeTeamId === 'E04' || match.awayTeamId === 'E04'), true);

console.log('Schedule tests passed.');
