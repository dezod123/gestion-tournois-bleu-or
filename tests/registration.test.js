const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({
  console,
  Session: {
    getScriptTimeZone: () => 'America/Toronto',
    getActiveUser: () => ({ getEmail: () => 'admin@example.com' })
  },
  Utilities: {
    formatDate: () => '2026-09-07',
    Charset: { UTF_8: 'UTF_8' },
    DigestAlgorithm: { SHA_256: 'SHA_256' }
  }
});

[
  'apps-script/Config.gs',
  'apps-script/Utils.gs',
  'apps-script/Registration.gs'
].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
});

context.setting_ = (_key, fallback) => fallback;
context.registrationOptions_ = () => [{
  id: 'TRN-TEST',
  name: 'Tournoi test',
  divisions: [
    { id: 'DIV-A', name: 'Division A' },
    { id: 'DIV-B', name: 'Division B' }
  ]
}];

const validPayload = {
  token: 'token-test',
  tournamentId: 'TRN-TEST',
  school: 'École du Parc',
  address: '123, rue Principale',
  city: 'Montréal',
  postalCode: 'H1H 1H1',
  contactName: 'Camille Tremblay',
  phone: '+1 514 555-0101',
  email: 'Camille@example.com',
  website: '',
  consent: true,
  teams: [
    { name: 'Les Aigles', divisionId: 'DIV-A' },
    { name: 'Les Lynx', divisionId: 'DIV-B' }
  ]
};

const validated = context.validateRegistrationPayload_(validPayload);
assert.equal(validated.email, 'camille@example.com');
assert.equal(validated.postalCode, 'H1H 1H1');
assert.equal(validated.phone, '514 555-0101');
assert.equal(validated.teams.length, 2);
assert.equal(validated.tournament.id, 'TRN-TEST');

assert.throws(
  () => context.validateRegistrationPayload_({
    ...validPayload,
    teams: [{ name: 'Les Aigles', divisionId: 'DIV-INCONNUE' }]
  }),
  /n’est plus disponible/
);

assert.throws(
  () => context.validateRegistrationPayload_({
    ...validPayload,
    teams: [
      { name: 'Les Aigles', divisionId: 'DIV-A' },
      { name: 'les aigles', divisionId: 'DIV-A' }
    ]
  }),
  /apparaissent deux fois/
);

assert.throws(
  () => context.validateRegistrationPayload_({ ...validPayload, consent: false }),
  /confirmer/
);

assert.equal(context.normalizePostalCode_('h1h-1h1'), 'H1H 1H1');
assert.throws(() => context.normalizePostalCode_('D1A 1A1'), /format A1A 1A1/);
assert.equal(context.normalizePhone_('(514) 555-0101'), '514 555-0101');
assert.equal(context.normalizePhone_('+1 514 555 0101'), '514 555-0101');
assert.throws(() => context.normalizePhone_('555-0101'), /10 chiffres/);
assert.throws(() => context.normalizePhone_('000 555-0101'), /10 chiffres/);
assert.throws(
  () => context.validateRegistrationPayload_({ ...validPayload, email: 'camille@ecole' }),
  /adresse courriel complète/
);

assert.equal(context.safeSheetText_('=IMPORTXML("url")'), "'=IMPORTXML(\"url\")");
assert.equal(context.safeSheetText_('+1 514 555-0101'), "'+1 514 555-0101");
assert.equal(context.safeSheetText_('École du Parc'), 'École du Parc');

const safeJson = context.safeJsonForHtml_({ value: '</script><script>alert(1)</script>' });
assert.equal(safeJson.includes('</script>'), false);

const html = fs.readFileSync(path.join(root, 'apps-script/RegistrationForm.html'), 'utf8');
const scripts = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g));
assert.ok(scripts.length);
const browserScript = scripts.at(-1)[1].replace(
  '<?!= bootstrapJson ?>',
  '{"token":"test","tournaments":[],"maxTeams":10}'
);
new vm.Script(browserScript, { filename: 'Registration.browser.js' });

const browserElements = {
  'registration-form': { hidden: false },
  closed: { hidden: true }
};
const browserContext = vm.createContext({
  console,
  document: { getElementById: (id) => browserElements[id] }
});
vm.runInContext(browserScript, browserContext, { filename: 'Registration.browser.js' });
assert.equal(vm.runInContext("formatPostalCode('h1h-1h1')", browserContext), 'H1H 1H1');
assert.equal(vm.runInContext("formatPhone('+1 514 555-0101')", browserContext), '514 555-0101');
assert.equal(vm.runInContext("formatPhone('51455501019')", browserContext), '51455501019');
assert.equal(vm.runInContext("EMAIL_PATTERN.test('nom@ecole.ca')", browserContext), true);

const writes = [];
let idSequence = 0;
const cacheValues = new Map();
context.newId_ = (prefix) => `${prefix}-TEST-${++idSequence}`;
context.validateRegistrationToken_ = () => {};
context.enforceRegistrationRateLimit_ = () => {};
context.rejectRecentDuplicate_ = () => {};
context.incrementRegistrationRateLimit_ = () => {};
context.registrationDuplicateKey_ = () => 'REG_DUP_TEST';
context.writeObjectRow_ = (sheet, values) => { writes.push({ sheet, values }); };
context.LockService = {
  getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} })
};
context.CacheService = {
  getScriptCache: () => ({
    get: (key) => cacheValues.get(key) || null,
    put: (key, value) => cacheValues.set(key, value),
    remove: (key) => cacheValues.delete(key)
  })
};
context.SpreadsheetApp = { flush: () => {} };

const result = context.soumettreInscription(validPayload);
assert.equal(result.success, true);
assert.equal(result.teamCount, 2);
assert.equal(writes.length, 2);
assert.equal(writes[0].values.Statut, 'EN ATTENTE');
assert.equal(writes[0].values['Nombre équipes'], 1);
assert.equal(writes[0].values['ID soumission'], writes[1].values['ID soumission']);
assert.notEqual(writes[0].values['ID inscription'], writes[1].values['ID inscription']);

console.log('Registration validation tests passed.');
