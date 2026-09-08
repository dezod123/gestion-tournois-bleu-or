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
    formatDate: () => '2026-09-07'
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
const app = vm.runInContext('APP', context);

assert.ok(app.headers.TOURNOIS.includes('ID formulaire inscription'));
assert.ok(app.headers.TOURNOIS.includes('URL formulaire inscription'));
assert.ok(app.headers.INSCRIPTIONS.includes('ID réponse formulaire'));

const tournament = {
  __row: 2,
  'ID tournoi': 'TRN-TEST',
  Nom: 'Tournoi test',
  'Édition': '2026',
  Statut: 'ACTIF',
  'Inscriptions ouvertes': true,
  'Date début': '2026-10-09',
  'Date fin': '2026-10-11',
  'Date limite inscription': '2026-09-18',
  'Frais inscription': 350,
  'Instructions paiement': 'Paiement par chèque.',
  'Courriel contact inscriptions': 'tournoi@example.com'
};
const divisions = [
  { 'ID tournoi': 'TRN-TEST', 'ID division': 'DIV-A', Nom: 'Atome masculin', Actif: true },
  { 'ID tournoi': 'TRN-TEST', 'ID division': 'DIV-B', Nom: 'Benjamin féminin', Actif: true }
];

assert.equal(context.registrationFormTitle_(tournament), 'Inscription — Tournoi test — 2026');
assert.equal(context.registrationIsOpen_(tournament, '2026-09-07'), true);
assert.equal(context.registrationIsOpen_(tournament, '2026-09-19'), false);
assert.equal(context.registrationIsOpen_({ ...tournament, 'Inscriptions ouvertes': false }, '2026-09-07'), false);
assert.match(context.registrationFormDescription_(tournament, 'America/Toronto'), /350,00 \$ par équipe/);

assert.equal(context.normalizePostalCode_('h1h-1h1'), 'H1H 1H1');
assert.throws(() => context.normalizePostalCode_('D1A 1A1'), /format A1A 1A1/);
const postalPattern = new RegExp(vm.runInContext('REGISTRATION_POSTAL_PATTERN', context));
assert.equal(postalPattern.test('H2P 2L8'), true);
assert.equal(postalPattern.test('h2p2l8'), true);
assert.equal(postalPattern.test('test postal'), false);
assert.equal(context.normalizePhone_('+1 (514) 555-0101'), '514 555-0101');
assert.equal(context.normalizePhone_('514 555-0101 poste 71157'), '514 555-0101 poste 71157');
assert.throws(() => context.normalizePhone_('555-0101'), /10 chiffres/);
const phonePattern = new RegExp(vm.runInContext('REGISTRATION_PHONE_PATTERN', context));
assert.equal(phonePattern.test('514 555-1234'), true);
assert.equal(phonePattern.test('+1 (514) 555-1234 poste 77'), true);
assert.equal(phonePattern.test('ttestphone'), false);
assert.equal(context.normalizeEmail_(' Camille@Example.com '), 'camille@example.com');
assert.throws(() => context.normalizeEmail_('camille@ecole'), /adresse courriel complète/);
assert.equal(context.safeSheetText_('=IMPORTXML("url")'), "'=IMPORTXML(\"url\")");

function fakeResponse(answers) {
  return {
    getItemResponses: () => Object.entries(answers).map(([title, value]) => ({
      getItem: () => ({ getTitle: () => title }),
      getResponse: () => value
    }))
  };
}

const answers = {
  'Nom de l’équipe sportive': 'Les Aigles',
  École: 'École du Parc',
  'Adresse de l’école': '123, rue Principale',
  Ville: 'Montréal',
  'Code postal': 'h1h 1h1',
  'Nom du responsable de l’équipe': 'Camille Tremblay',
  Téléphone: '514-555-0101 poste 12',
  Courriel: 'Camille@example.com',
  Catégorie: 'Benjamin féminin',
  Consentement: ['Je confirme']
};
const imported = context.registrationFromGoogleFormResponse_(tournament, divisions, fakeResponse(answers));
assert.equal(imported.tournamentId, 'TRN-TEST');
assert.equal(imported.divisionId, 'DIV-B');
assert.equal(imported.postalCode, 'H1H 1H1');
assert.equal(imported.phone, '514 555-0101 poste 12');
assert.equal(imported.email, 'camille@example.com');
assert.throws(
  () => context.registrationFromGoogleFormResponse_(tournament, divisions, fakeResponse({ ...answers, Catégorie: 'Inconnue' })),
  /catégorie sélectionnée/
);
assert.throws(
  () => context.registrationFromGoogleFormResponse_(tournament, divisions, fakeResponse({ ...answers, Consentement: '' })),
  /consentement obligatoire/
);

class FakeItem {
  constructor(type) { this.type = type; this.title = ''; this.helpText = ''; this.required = false; this.choices = []; }
  getType() { return this.type; }
  getTitle() { return this.title; }
  asTextItem() { return this; }
  asListItem() { return this; }
  asCheckboxItem() { return this; }
  setTitle(value) { this.title = value; return this; }
  setHelpText(value) { this.helpText = value; return this; }
  setRequired(value) { this.required = value; return this; }
  setValidation(value) { this.validation = value; return this; }
  setChoiceValues(value) { this.choices = value; return this; }
}

class FakeForm {
  constructor() { this.items = []; }
  getItems() { return this.items; }
  addTextItem() { const item = new FakeItem('TEXT'); this.items.push(item); return item; }
  addListItem() { const item = new FakeItem('LIST'); this.items.push(item); return item; }
  addCheckboxItem() { const item = new FakeItem('CHECKBOX'); this.items.push(item); return item; }
}
[
  'setTitle', 'setDescription', 'setConfirmationMessage', 'setCollectEmail', 'setPublishingSummary', 'setShowLinkToRespondAgain',
  'setLimitOneResponsePerUser', 'setProgressBar', 'setShuffleQuestions', 'setPublished', 'setCustomClosedFormMessage',
  'setAcceptingResponses'
].forEach((method) => {
  FakeForm.prototype[method] = function(value) { this[method + 'Value'] = value; return this; };
});

function validationBuilder() {
  return {
    setHelpText() { return this; },
    requireTextMatchesPattern() { return this; },
    requireTextLengthGreaterThanOrEqualTo() { return this; },
    requireTextIsEmail() { return this; },
    build() { return { valid: true }; }
  };
}
context.FormApp = {
  ItemType: { TEXT: 'TEXT', LIST: 'LIST', CHECKBOX: 'CHECKBOX' },
  DestinationType: { SPREADSHEET: 'SPREADSHEET' },
  createTextValidation: validationBuilder
};
assert.equal(context.formUsesSpreadsheetDestination_({
  getDestinationType() { throw new Error('The form currently has no response destination.'); }
}, 'sheet-1'), false);
assert.equal(context.formUsesSpreadsheetDestination_({
  getDestinationType() { return 'SPREADSHEET'; },
  getDestinationId() { return 'sheet-1'; }
}, 'sheet-1'), true);
const form = new FakeForm();
context.configureRegistrationForm_(form, tournament, divisions.map((division) => ({ id: division['ID division'], name: division.Nom })));
assert.equal(form.items.length, 10);
assert.equal(form.setCollectEmailValue, false);
assert.equal(form.setPublishingSummaryValue, false);
assert.equal(form.setAcceptingResponsesValue, true);
assert.deepEqual(
  form.items.find((item) => item.title === 'Catégorie').choices,
  ['Atome masculin', 'Benjamin féminin']
);
assert.equal(form.items.find((item) => item.title === 'Consentement').choices.join('|'), 'Oui, j’accepte.');

const siteScript = fs.readFileSync(path.join(root, 'site/app.js'), 'utf8');
new vm.Script(siteScript, { filename: 'site/app.js' });
const siteConfig = fs.readFileSync(path.join(root, 'site/config.js'), 'utf8');
assert.equal(siteConfig.includes('REGISTRATION_FORM_URL'), false);
assert.match(fs.readFileSync(path.join(root, 'apps-script/Publisher.gs'), 'utf8'), /registrationUrl/);
const registrationSource = fs.readFileSync(path.join(root, 'apps-script/Registration.gs'), 'utf8');
assert.equal(registrationSource.includes('(?i)'), false);
assert.equal(vm.runInContext('REGISTRATION_PHONE_PATTERN', context).includes('(?:'), false);
assert.equal(vm.runInContext('REGISTRATION_POSTAL_PATTERN', context).includes('(?:'), false);

console.log('Google Forms registration tests passed.');
