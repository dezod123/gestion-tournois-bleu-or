function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tournoi')
    .addItem('Publier les changements', 'publierChangements')
    .addSeparator()
    .addItem('Créer une nouvelle édition', 'creerNouvelleEdition')
    .addItem('Générer les identifiants manquants', 'genererIdentifiantsManquants')
    .addItem('Générer l’horaire du tournoi sélectionné', 'genererHoraireTournoiSelectionne')
    .addItem('Actualiser les noms d’équipes dans MATCHS', 'actualiserNomsEquipesMatchs')
    .addSeparator()
    .addItem('Créer / mettre à jour le formulaire sélectionné', 'creerOuMettreAJourFormulaireInscription')
    .addItem('Synchroniser tous les formulaires', 'synchroniserTousFormulairesInscription')
    .addItem('Importer les nouvelles inscriptions', 'importerNouvellesInscriptions')
    .addSeparator()
    .addItem('Approuver les inscriptions sélectionnées', 'approuverInscriptionsSelectionnees')
    .addItem('Refuser les inscriptions sélectionnées', 'refuserInscriptionsSelectionnees')
    .addSeparator()
    .addItem('Charger les données de démonstration', 'chargerDonneesDemonstration')
    .addItem('Initialiser / réparer le classeur', 'initialiserClasseur')
    .addToUi();
}

function assertAdminContext_() {
  if (!SpreadsheetApp.getActive()) {
    throw new Error('Cette commande est réservée aux administrateurs qui l’exécutent depuis Google Sheets.');
  }
  const email = String(Session.getActiveUser().getEmail() || '').trim();
  return email || 'Administrateur Google autorisé';
}

function adminSpreadsheet_() {
  const active = SpreadsheetApp.getActive();
  if (active) return active;
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('ADMIN_SPREADSHEET_ID');
  if (!spreadsheetId) {
    throw new Error('Le classeur administratif n’est pas lié. Exécutez initialiserClasseur depuis Google Sheets.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function normalize_(value) {
  return String(value == null ? '' : value)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isYes_(value) {
  return value === true || ['OUI', 'TRUE', 'VRAI', '1', 'X'].indexOf(normalize_(value)) >= 0;
}

function isActive_(value) {
  return ['ACTIF', 'ACTIVE', 'APPROUVE', 'APPROUVEE', 'CONFIRME', 'CONFIRMEE'].indexOf(normalize_(value)) >= 0;
}

function toNumber_(value, fallback) {
  if (value === '' || value == null) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toIsoDate_(value, timeZone) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timeZone, 'yyyy-MM-dd');
  }
  return String(value).trim();
}

function toTime_(value, timeZone) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timeZone, 'HH:mm');
  }
  return String(value).trim();
}

function rowsAsObjects_(sheetName) {
  const sheet = adminSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Onglet manquant : ' + sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).map(function(row, index) {
    return { values: row, sheetRow: index + 2 };
  }).filter(function(entry) {
    // An unchecked checkbox can be returned as false even on an otherwise empty row.
    return entry.values.some(function(value) { return value !== '' && value !== false && value != null; });
  }).map(function(entry) {
    const object = { __row: entry.sheetRow };
    headers.forEach(function(header, column) { object[header] = entry.values[column]; });
    return object;
  });
}

function sheetHeaders_(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, width).getValues()[0].map(function(value) {
    return String(value || '').trim();
  });
}

function headerColumn_(sheet, header) {
  const column = sheetHeaders_(sheet).indexOf(header) + 1;
  if (!column) throw new Error('Colonne manquante dans ' + sheet.getName() + ' : ' + header);
  return column;
}

function isEmptyBusinessValue_(value) {
  return value === '' || value === false || value == null;
}

function firstAvailableDataRow_(sheet) {
  const headers = sheetHeaders_(sheet);
  const width = headers.length;
  const lastRow = Math.max(sheet.getLastRow(), 2);
  const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (values[index].every(isEmptyBusinessValue_)) return index + 2;
  }
  if (lastRow >= sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 1);
  return lastRow + 1;
}

function writeObjectRow_(sheetName, valuesByHeader, rowNumber) {
  const sheet = adminSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Onglet manquant : ' + sheetName);
  const headers = sheetHeaders_(sheet);
  const row = rowNumber || firstAvailableDataRow_(sheet);
  Object.keys(valuesByHeader).forEach(function(header) {
    const column = headers.indexOf(header) + 1;
    if (!column) throw new Error('Colonne manquante dans ' + sheetName + ' : ' + header);
    sheet.getRange(row, column).setValue(valuesByHeader[header]);
  });
  return row;
}

function setting_(key, fallback) {
  const rows = rowsAsObjects_(APP.sheets.settings);
  const normalizedKey = normalize_(key);
  for (let i = 0; i < rows.length; i += 1) {
    if (normalize_(rows[i]['Clé']) === normalizedKey) return rows[i]['Valeur'];
  }
  return fallback;
}

function upsertSetting_(key, value, description) {
  const sheet = adminSpreadsheet_().getSheetByName(APP.sheets.settings);
  const values = sheet.getDataRange().getValues();
  for (let row = 1; row < values.length; row += 1) {
    if (normalize_(values[row][0]) === normalize_(key)) {
      sheet.getRange(row + 1, 2).setValue(value);
      if (description) sheet.getRange(row + 1, 3).setValue(description);
      return;
    }
  }
  sheet.appendRow([key, value, description || '']);
}

function jsonString_(value) {
  return JSON.stringify(value, function(key, item) {
    return item === undefined ? null : item;
  });
}
