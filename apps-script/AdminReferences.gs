function adminReferenceSheetSpecs_() {
  return [
    { sheet: APP.sheets.divisions, references: [adminReference_('tournament', 'ID tournoi', 'Tournoi')] },
    { sheet: APP.sheets.venues, references: [adminReference_('tournament', 'ID tournoi', 'Tournoi')] },
    { sheet: APP.sheets.availability, references: [
      adminReference_('tournament', 'ID tournoi', 'Tournoi'),
      adminReference_('venue', 'ID lieu', 'Lieu')
    ] },
    { sheet: APP.sheets.registrations, readOnly: true, references: [
      adminReference_('tournament', 'ID tournoi', 'Tournoi'),
      adminReference_('division', 'ID division', 'Division')
    ] },
    { sheet: APP.sheets.teams, references: [
      adminReference_('tournament', 'ID tournoi', 'Tournoi'),
      adminReference_('division', 'ID division', 'Division')
    ] },
    { sheet: APP.sheets.matches, references: [
      adminReference_('tournament', 'ID tournoi', 'Tournoi'),
      adminReference_('division', 'ID division', 'Division'),
      adminReference_('venue', 'ID lieu', 'Lieu')
    ] },
    { sheet: APP.sheets.photos, references: [
      adminReference_('tournament', 'ID tournoi', 'Tournoi'),
      adminReference_('division', 'ID division', 'Division'),
      adminReference_('team', 'ID équipe', 'Équipe')
    ] }
  ];
}

function adminReference_(kind, idHeader, labelHeader) {
  return { kind: kind, idHeader: idHeader, labelHeader: labelHeader };
}

function ensureAdminReferenceColumns_(spreadsheet) {
  adminReferenceSheetSpecs_().forEach(function(spec) {
    const sheet = spreadsheet.getSheetByName(spec.sheet);
    if (!sheet || !sheet.getLastColumn()) return;
    spec.references.forEach(function(reference) {
      const headers = sheetHeaders_(sheet);
      if (headers.indexOf(reference.labelHeader) >= 0) return;
      const idColumn = headers.indexOf(reference.idHeader) + 1;
      if (!idColumn) return;
      sheet.insertColumnAfter(idColumn);
      sheet.getRange(1, idColumn + 1).setValue(reference.labelHeader);
      sheet.getRange(2, idColumn + 1, Math.max(sheet.getMaxRows() - 1, 1), 1).clearDataValidations();
    });
  });
}

function synchroniserReferencesAdministratives() {
  assertAdminContext_();
  const spreadsheet = adminSpreadsheet_();
  const ui = SpreadsheetApp.getUi();
  try {
    const references = synchroniserReferencesAdministratives_(spreadsheet);
    SpreadsheetApp.flush();
    const teams = synchroniserSelectionsEquipesMatchs_(spreadsheet);
    SpreadsheetApp.flush();
    applyAdminReferenceDisplayValidations_(spreadsheet);
    spreadsheet.toast(
      references.updated + ' ligne(s) de référence et ' + teams.updated + ' ligne(s) de match synchronisée(s).',
      'Sélections administratives',
      8
    );
  } catch (error) {
    ui.alert('Synchronisation impossible', error.message || String(error), ui.ButtonSet.OK);
  }
}

function synchroniserReferencesAdministratives_(spreadsheet) {
  const lookups = buildAdminReferenceLookups_(
    rowsAsObjects_(APP.sheets.tournaments),
    rowsAsObjects_(APP.sheets.divisions),
    rowsAsObjects_(APP.sheets.venues),
    rowsAsObjects_(APP.sheets.teams)
  );
  const sheetPlans = [];
  const errors = [];
  let updated = 0;

  adminReferenceSheetSpecs_().forEach(function(spec) {
    const sheet = spreadsheet.getSheetByName(spec.sheet);
    if (!sheet || sheet.getLastRow() < 2) return;
    const updates = [];
    rowsAsObjects_(spec.sheet).forEach(function(row) {
      const hasReferenceData = spec.references.some(function(reference) {
        return String(row[reference.idHeader] || row[reference.labelHeader] || '').trim();
      });
      if (!hasReferenceData) return;
      const context = {};
      const values = {};
      try {
        spec.references.forEach(function(reference) {
          let resolved;
          if (spec.readOnly) {
            resolved = adminReferenceForId_(reference.kind, row[reference.idHeader], lookups);
          } else {
            resolved = resolveAdminReferenceSelection_(
              reference.kind,
              row[reference.idHeader],
              row[reference.labelHeader],
              lookups,
              context
            );
          }
          values[reference.idHeader] = resolved.id;
          values[reference.labelHeader] = resolved.label;
          if (reference.kind === 'tournament') context.tournamentId = resolved.id;
          if (reference.kind === 'division') context.divisionId = resolved.id;
        });
        updateAdminReferenceLookupContext_(spec.sheet, row, values, lookups);
        const changed = spec.references.some(function(reference) {
          return String(row[reference.idHeader] || '') !== String(values[reference.idHeader] || '') ||
            String(row[reference.labelHeader] || '') !== String(values[reference.labelHeader] || '');
        });
        if (changed) {
          updates.push({ row: row.__row, values: values });
          updated += 1;
        }
      } catch (error) {
        errors.push(spec.sheet + ', ligne ' + row.__row + ' : ' + (error.message || String(error)));
      }
    });
    if (updates.length) sheetPlans.push({ sheet: sheet, spec: spec, updates: updates });
  });

  if (errors.length) throw new Error(errors.slice(0, 12).join('\n'));
  sheetPlans.forEach(writeAdminReferenceUpdates_);
  return { updated: updated };
}

function updateAdminReferenceLookupContext_(sheetName, row, values, lookups) {
  let kind = '';
  let idHeader = '';
  if (sheetName === APP.sheets.divisions) { kind = 'division'; idHeader = 'ID division'; }
  if (sheetName === APP.sheets.venues) { kind = 'venue'; idHeader = 'ID lieu'; }
  if (sheetName === APP.sheets.teams) { kind = 'team'; idHeader = 'ID équipe'; }
  if (!kind) return;
  const id = String(row[idHeader] || '').trim();
  const entry = id && lookups[kind].byId[id];
  if (!entry) return;
  entry.tournamentId = String(values['ID tournoi'] || row['ID tournoi'] || '').trim();
  if (kind === 'team') entry.divisionId = String(values['ID division'] || row['ID division'] || '').trim();
}

function refreshAdminReferenceLabelsFromIds_(spreadsheet) {
  const lookups = buildAdminReferenceLookups_(
    rowsAsObjects_(APP.sheets.tournaments),
    rowsAsObjects_(APP.sheets.divisions),
    rowsAsObjects_(APP.sheets.venues),
    rowsAsObjects_(APP.sheets.teams)
  );
  let updated = 0;
  adminReferenceSheetSpecs_().forEach(function(spec) {
    const sheet = spreadsheet.getSheetByName(spec.sheet);
    if (!sheet || sheet.getLastRow() < 2) return;
    const rowCount = sheet.getLastRow() - 1;
    spec.references.forEach(function(reference) {
      const ids = sheet.getRange(2, headerColumn_(sheet, reference.idHeader), rowCount, 1).getValues();
      const labelColumn = headerColumn_(sheet, reference.labelHeader);
      const labelRange = sheet.getRange(2, labelColumn, rowCount, 1);
      if (spec.readOnly) labelRange.clearDataValidations();
      const labels = labelRange.getValues();
      ids.forEach(function(idRow, index) {
        const id = String(idRow[0] || '').trim();
        if (!id) return;
        const resolved = adminReferenceForId_(reference.kind, id, lookups);
        if (String(labels[index][0] || '') !== resolved.label) {
          labels[index][0] = resolved.label;
          updated += 1;
        }
      });
      labelRange.setValues(labels);
    });
  });
  return updated;
}

function styleAdminReferenceColumns_(spreadsheet) {
  adminReferenceSheetSpecs_().forEach(function(spec) {
    const sheet = spreadsheet.getSheetByName(spec.sheet);
    if (!sheet) return;
    spec.references.forEach(function(reference) {
      const column = headerColumn_(sheet, reference.labelHeader);
      const range = sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1);
      range.setBackground(spec.readOnly ? '#eef1f4' : '#ffffff');
      sheet.getRange(1, column).setNote(spec.readOnly
        ? 'Libellé rempli automatiquement à partir de l’identifiant technique.'
        : 'Sélectionnez un nom lisible. L’identifiant voisin sera rempli automatiquement lors de la synchronisation ou de la publication.');
    });
  });
}

function applyAdminReferenceDisplayValidations_(spreadsheet) {
  const lookups = buildAdminReferenceLookups_(
    rowsAsObjects_(APP.sheets.tournaments),
    rowsAsObjects_(APP.sheets.divisions),
    rowsAsObjects_(APP.sheets.venues),
    rowsAsObjects_(APP.sheets.teams)
  );
  adminReferenceSheetSpecs_().forEach(function(spec) {
    const sheet = spreadsheet.getSheetByName(spec.sheet);
    if (!sheet) return;
    if (spec.readOnly) {
      spec.references.forEach(function(reference) {
        sheet.getRange(2, headerColumn_(sheet, reference.labelHeader), Math.max(sheet.getMaxRows() - 1, 1), 1)
          .clearDataValidations();
      });
      return;
    }
    spec.references.forEach(function(reference) {
      const labels = uniqueAdminReferenceLabels_(lookups[reference.kind].all);
      if (!labels.length) {
        sheet.getRange(2, headerColumn_(sheet, reference.labelHeader), Math.max(sheet.getMaxRows() - 1, 1), 1)
          .clearDataValidations();
        return;
      }
      const validation = SpreadsheetApp.newDataValidation()
        .requireValueInList(labels, true)
        .setAllowInvalid(true)
        .setHelpText('Choisissez un nom dans la liste. Les choix sont validés selon le tournoi et la division de la ligne.')
        .build();
      applyValidationToColumn_(sheet, reference.labelHeader, validation);
    });
  });
}

function adminReferenceProtectedColumns_() {
  const columns = [];
  adminReferenceSheetSpecs_().forEach(function(spec) {
    spec.references.forEach(function(reference) {
      columns.push({ sheet: spec.sheet, header: reference.idHeader });
      if (spec.readOnly) columns.push({ sheet: spec.sheet, header: reference.labelHeader });
    });
  });
  return columns;
}

function buildAdminReferenceLookups_(tournaments, divisions, venues, teams) {
  return {
    tournament: buildAdminReferenceLookup_(tournaments, 'ID tournoi', function(row) {
      return tournamentSelectionLabel_(row);
    }),
    division: buildAdminReferenceLookup_(divisions, 'ID division', function(row) {
      return String(row['Nom'] || '').trim();
    }, 'ID tournoi'),
    venue: buildAdminReferenceLookup_(venues, 'ID lieu', function(row) {
      return String(row['Nom'] || '').trim();
    }, 'ID tournoi'),
    team: buildAdminReferenceLookup_(teams, 'ID équipe', function(row) {
      return String(row['Nom'] || '').trim();
    }, 'ID tournoi', 'ID division')
  };
}

function buildAdminReferenceLookup_(rows, idHeader, labelBuilder, tournamentHeader, divisionHeader) {
  const byId = {};
  const all = [];
  rows.forEach(function(row) {
    const id = String(row[idHeader] || '').trim();
    if (!id) return;
    const entry = {
      id: id,
      label: String(labelBuilder(row) || '').trim(),
      tournamentId: tournamentHeader ? String(row[tournamentHeader] || '').trim() : '',
      divisionId: divisionHeader ? String(row[divisionHeader] || '').trim() : ''
    };
    if (Object.prototype.hasOwnProperty.call(byId, id)) byId[id] = null;
    else byId[id] = entry;
    all.push(entry);
  });
  return { byId: byId, all: all };
}

function tournamentSelectionLabel_(tournament) {
  const name = String(tournament['Nom'] || '').trim();
  const edition = String(tournament['Édition'] || '').trim();
  return [name, edition].filter(Boolean).join(' — ');
}

function resolveAdminReferenceSelection_(kind, idValue, labelValue, lookups, context) {
  const lookup = lookups[kind];
  const id = String(idValue || '').trim();
  const label = String(labelValue || '').trim();
  const hasId = Boolean(id && Object.prototype.hasOwnProperty.call(lookup.byId, id));
  const idEntry = hasId ? lookup.byId[id] : null;
  if (!label) {
    if (idEntry && adminReferenceFitsContext_(idEntry, kind, context)) return { id: idEntry.id, label: idEntry.label };
    if (id && !hasId) throw new Error('l’identifiant « ' + id + ' » ne correspond à aucun ' + adminReferenceKindLabel_(kind) + '.');
    if (id && !idEntry) throw new Error('l’identifiant « ' + id + ' » est utilisé en double.');
    if (id) throw new Error('l’identifiant « ' + id + ' » ne correspond pas au contexte sélectionné.');
    return { id: '', label: '' };
  }
  if (kind !== 'tournament' && !context.tournamentId) {
    throw new Error('sélectionnez d’abord le tournoi.');
  }
  if (kind === 'team' && !context.divisionId) {
    throw new Error('sélectionnez d’abord la division.');
  }
  const candidates = lookup.all.filter(function(entry) {
    return normalize_(entry.label) === normalize_(label) && adminReferenceFitsContext_(entry, kind, context);
  });
  if (candidates.length === 1) return { id: candidates[0].id, label: candidates[0].label };
  if (candidates.length > 1) {
    const current = candidates.find(function(entry) { return entry.id === id; });
    if (current) return { id: current.id, label: current.label };
    throw new Error('le nom « ' + label + ' » correspond à plusieurs ' + adminReferenceKindPluralLabel_(kind) + ' dans ce contexte.');
  }
  const labelExistsElsewhere = lookup.all.some(function(entry) {
    return normalize_(entry.label) === normalize_(label);
  });
  if (!labelExistsElsewhere && idEntry && adminReferenceFitsContext_(idEntry, kind, context)) {
    return { id: idEntry.id, label: idEntry.label };
  }
  throw new Error('le nom « ' + label + ' » ne correspond à aucun ' + adminReferenceKindLabel_(kind) + ' dans le contexte sélectionné.');
}

function adminReferenceForId_(kind, idValue, lookups) {
  const id = String(idValue || '').trim();
  if (!id) return { id: '', label: '' };
  if (!Object.prototype.hasOwnProperty.call(lookups[kind].byId, id)) return { id: id, label: '⚠ ID inconnu' };
  const entry = lookups[kind].byId[id];
  if (!entry) return { id: id, label: '⚠ ID en double' };
  return { id: entry.id, label: entry.label || '⚠ Nom manquant' };
}

function adminReferenceFitsContext_(entry, kind, context) {
  if (kind !== 'tournament' && context.tournamentId && entry.tournamentId !== context.tournamentId) return false;
  if (kind === 'team' && context.divisionId && entry.divisionId !== context.divisionId) return false;
  return true;
}

function adminReferenceKindLabel_(kind) {
  return { tournament: 'tournoi', division: 'division', venue: 'lieu', team: 'équipe' }[kind] || 'choix';
}

function adminReferenceKindPluralLabel_(kind) {
  return { tournament: 'tournois', division: 'divisions', venue: 'lieux', team: 'équipes' }[kind] || 'choix';
}

function uniqueAdminReferenceLabels_(entries) {
  const seen = {};
  return entries.map(function(entry) { return entry.label; }).filter(function(label) {
    const key = normalize_(label);
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  }).sort(function(a, b) { return a.localeCompare(b, 'fr'); });
}

function writeAdminReferenceUpdates_(plan) {
  const rowCount = plan.sheet.getLastRow() - 1;
  const updateByRow = {};
  plan.updates.forEach(function(update) { updateByRow[update.row] = update.values; });
  plan.spec.references.forEach(function(reference) {
    [reference.idHeader, reference.labelHeader].forEach(function(header) {
      const column = headerColumn_(plan.sheet, header);
      const values = plan.sheet.getRange(2, column, rowCount, 1).getValues();
      for (let index = 0; index < rowCount; index += 1) {
        const update = updateByRow[index + 2];
        if (update) values[index][0] = update[header];
      }
      plan.sheet.getRange(2, column, rowCount, 1).setValues(values);
    });
  });
}
