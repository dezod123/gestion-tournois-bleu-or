const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const logic = require(path.join(root, 'site', 'app.js'));

assert.equal(logic.normalizePhase('Demi-finale'), 'DEMI-FINALE');
assert.equal(logic.normalizePhase('ÉLIMINATOIRE'), 'ELIMINATOIRE');
assert.equal(logic.isPlayoffMatch({ phase: 'QUART-DE-FINALE' }), true);
assert.equal(logic.isPlayoffMatch({ phase: 'POOL' }), false);
assert.equal(logic.isPlayoffMatch({ phase: 'AMICAL' }), false);
assert.equal(logic.playoffPhaseLabel('DEMI-FINALE'), 'Demi-finales');
assert.equal(logic.playoffPhaseLabel('ÉLIMINATOIRE'), 'Éliminatoires');

assert.equal(logic.championTeamId({ final: true, homeScore: 4, awayScore: 2, homeTeamId: 'E1', awayTeamId: 'E2' }), 'E1');
assert.equal(logic.championTeamId({ final: true, homeScore: 1, awayScore: 3, homeTeamId: 'E1', awayTeamId: 'E2' }), 'E2');
assert.equal(logic.championTeamId({ final: true, homeScore: 2, awayScore: 2, homeTeamId: 'E1', awayTeamId: 'E2' }), '');
assert.equal(logic.championTeamId({ final: true, homeScore: null, awayScore: null, homeTeamId: 'E1', awayTeamId: 'E2' }), '');
assert.equal(logic.championTeamId({ final: false, homeScore: 4, awayScore: 2, homeTeamId: 'E1', awayTeamId: 'E2' }), '');
assert.equal(logic.championTeamId({ final: true, homeScore: 2, awayScore: 2, winnerTeamId: 'E2', homeTeamId: 'E1', awayTeamId: 'E2' }), 'E2');

const html = fs.readFileSync(path.join(root, 'site', 'index.html'), 'utf8');
assert.match(html, /data-tab="playoffs"/);
assert.match(html, /id="champions-content"/);
assert.match(html, /id="playoffs-content"/);

console.log('Public playoff tests passed.');
