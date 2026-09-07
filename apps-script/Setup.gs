function initialiserClasseur() {
  const spreadsheet = SpreadsheetApp.getActive();
  const ui = SpreadsheetApp.getUi();
  Object.keys(APP.headers).filter(function(sheetName) {
    return sheetName !== APP.sheets.publicData;
  }).forEach(function(sheetName) {
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
    const headers = APP.headers[sheetName];
    const firstRow = sheet.getRange(1, 1, 1, headers.length);
    if (firstRow.getValues()[0].every(function(value) { return value === ''; })) firstRow.setValues([headers]);
    firstRow.setFontWeight('bold').setBackground('#12355b').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  });
  seedSettings_();
  const publicSpreadsheet = ensurePublicSpreadsheet_();
  applyValidations_();
  stylePublicSheet_(publicSpreadsheet);
  onOpen();
  ui.alert('Initialisation terminée',
    'Le classeur privé est prêt et le classeur public a été préparé. Les données existantes ont été conservées.\n\nClasseur public : ' + publicSpreadsheet.getUrl(),
    ui.ButtonSet.OK);
}

function seedSettings_() {
  const defaults = [
    ['VERSION_SCHEMA', '1', 'Version du contrat de données publiques'],
    ['LANGUE', 'fr-CA', 'Langue principale du site'],
    ['FUSEAU_HORAIRE', 'America/Toronto', 'Fuseau utilisé pour les dates de publication'],
    ['DERNIERE_PUBLICATION', '', 'Mise à jour automatiquement'],
    ['ID_CLASSEUR_ADMIN_LIE', '', 'Permet de détecter automatiquement une copie du gabarit'],
    ['ID_CLASSEUR_PUBLIC', '', 'Identifiant du classeur ne contenant que les données publiques'],
    ['MESSAGE_PUBLIC', '', 'Message facultatif affiché sur le site']
  ];
  const current = rowsAsObjects_(APP.sheets.settings).map(function(row) { return normalize_(row['Clé']); });
  const sheet = SpreadsheetApp.getActive().getSheetByName(APP.sheets.settings);
  defaults.forEach(function(row) {
    if (current.indexOf(normalize_(row[0])) < 0) sheet.appendRow(row);
  });
}

function applyValidations_() {
  const spreadsheet = SpreadsheetApp.getActive();
  const checkboxValidation = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  [
    [APP.sheets.tournaments, 5], [APP.sheets.divisions, 4], [APP.sheets.divisions, 5],
    [APP.sheets.venues, 5], [APP.sheets.venues, 6], [APP.sheets.teams, 8],
    [APP.sheets.matches, 14], [APP.sheets.matches, 16], [APP.sheets.photos, 8]
  ].forEach(function(spec) {
    spreadsheet.getSheetByName(spec[0]).getRange(2, spec[1], 1000, 1).setDataValidation(checkboxValidation);
  });
  [
    [APP.sheets.tournaments, 4, ['ACTIF', 'INACTIF']],
    [APP.sheets.registrations, 14, ['EN ATTENTE', 'APPROUVÉE', 'REFUSÉE']],
    [APP.sheets.teams, 7, ['APPROUVÉE', 'INACTIVE']],
    [APP.sheets.matches, 5, ['POOL', 'DEMI-FINALE', 'FINALE', 'AMICAL']]
  ].forEach(function(spec) {
    const validation = SpreadsheetApp.newDataValidation().requireValueInList(spec[2], true).setAllowInvalid(false).build();
    spreadsheet.getSheetByName(spec[0]).getRange(2, spec[1], 1000, 1).setDataValidation(validation);
  });
}

function ensurePublicSpreadsheet_() {
  const adminSpreadsheetId = SpreadsheetApp.getActive().getId();
  const linkedAdminId = String(setting_('ID_CLASSEUR_ADMIN_LIE', '')).trim();
  const existingId = String(setting_('ID_CLASSEUR_PUBLIC', '')).trim();
  if (existingId && linkedAdminId === adminSpreadsheetId) {
    try {
      return SpreadsheetApp.openById(existingId);
    } catch (error) {
      // Le fichier a été déplacé ou supprimé : une nouvelle sortie publique sera créée ci-dessous.
    }
  }
  const adminSpreadsheet = SpreadsheetApp.getActive();
  const publicSpreadsheet = SpreadsheetApp.create(adminSpreadsheet.getName() + ' — DONNÉES PUBLIQUES');
  const sheet = publicSpreadsheet.getSheets()[0];
  sheet.setName(APP.sheets.publicData);
  sheet.getRange(1, 1, 1, APP.headers.DONNEES_PUBLIQUES.length).setValues([APP.headers.DONNEES_PUBLIQUES]);
  upsertSetting_('ID_CLASSEUR_ADMIN_LIE', adminSpreadsheetId, 'Permet de détecter automatiquement une copie du gabarit');
  upsertSetting_('ID_CLASSEUR_PUBLIC', publicSpreadsheet.getId(), 'Identifiant du classeur ne contenant que les données publiques');
  return publicSpreadsheet;
}

function stylePublicSheet_(publicSpreadsheet) {
  const sheet = publicSpreadsheet.getSheetByName(APP.sheets.publicData);
  sheet.setTabColor('#d4a72c');
  sheet.getRange('A1:D1').setNote('Généré automatiquement. Ne pas modifier manuellement. Publier uniquement cet onglet sur le Web.');
  sheet.setColumnWidth(4, 700);
}
