function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tournoi')
    .addItem('Publier les changements', 'publierChangements')
    .addSeparator()
    .addItem('Charger les données de démonstration', 'chargerDonneesDemonstration')
    .addItem('Initialiser / réparer le classeur', 'initialiserClasseur')
    .addToUi();
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
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) throw new Error('Onglet manquant : ' + sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(function(row) {
    // An unchecked checkbox can be returned as false even on an otherwise empty row.
    return row.some(function(value) { return value !== '' && value !== false && value != null; });
  }).map(function(row, index) {
    const object = { __row: index + 2 };
    headers.forEach(function(header, column) { object[header] = row[column]; });
    return object;
  });
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
  const sheet = SpreadsheetApp.getActive().getSheetByName(APP.sheets.settings);
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
