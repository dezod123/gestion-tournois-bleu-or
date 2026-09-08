function doGet() {
  const template = HtmlService.createTemplateFromFile('RegistrationForm');
  template.bootstrapJson = safeJsonForHtml_({
    token: createRegistrationToken_(),
    tournaments: registrationOptions_(),
    maxTeams: Math.max(1, Math.min(20, toNumber_(setting_('LIMITE_EQUIPES_PAR_SOUMISSION', 10), 10)))
  });
  return template.evaluate()
    .setTitle('Inscription au tournoi')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function soumettreInscription(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Soumission invalide.');
  if (cleanText_(payload.website, 200, false)) throw new Error('La soumission n’a pas pu être acceptée.');
  const token = cleanText_(payload.token, 80, true, 'Session du formulaire');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Le formulaire reçoit plusieurs demandes. Veuillez réessayer dans quelques secondes.');
  }

  try {
    validateRegistrationToken_(token);
    const submitted = validateRegistrationPayload_(payload);
    enforceRegistrationRateLimit_();
    rejectRecentDuplicate_(submitted);

    const submissionId = newId_('SOUM');
    const timestamp = new Date();
    const registrationIds = submitted.teams.map(function(team) {
      const registrationId = newId_('INS');
      writeObjectRow_(APP.sheets.registrations, {
        'ID inscription': registrationId,
        'Horodatage': timestamp,
        'ID tournoi': submitted.tournament.id,
        'Nom équipe': safeSheetText_(team.name),
        'École': safeSheetText_(submitted.school),
        'Adresse': safeSheetText_(submitted.address),
        'Ville': safeSheetText_(submitted.city),
        'Code postal': safeSheetText_(submitted.postalCode),
        'Responsable': safeSheetText_(submitted.contactName),
        'Téléphone': safeSheetText_(submitted.phone),
        'Courriel': safeSheetText_(submitted.email),
        'ID division': team.divisionId,
        'Nombre équipes': 1,
        'Statut': APP.statuses.pending,
        'ID soumission': submissionId
      });
      return registrationId;
    });

    const cache = CacheService.getScriptCache();
    cache.remove('REG_TOKEN_' + submitted.token);
    cache.put(registrationDuplicateKey_(submitted), '1', 600);
    incrementRegistrationRateLimit_();
    SpreadsheetApp.flush();
    return {
      success: true,
      submissionId: submissionId,
      registrationIds: registrationIds,
      teamCount: registrationIds.length,
      message: registrationIds.length === 1
        ? 'Votre inscription a été reçue et sera vérifiée par l’organisation.'
        : 'Vos ' + registrationIds.length + ' inscriptions ont été reçues et seront vérifiées séparément par l’organisation.'
    };
  } finally {
    lock.releaseLock();
  }
}

function safeJsonForHtml_(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function createRegistrationToken_() {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('REG_TOKEN_' + token, JSON.stringify({ issuedAt: Date.now() }), 3600);
  return token;
}

function validateRegistrationToken_(token) {
  const cache = CacheService.getScriptCache();
  const stored = cache.get('REG_TOKEN_' + token);
  if (!stored) throw new Error('Cette session de formulaire a expiré. Rechargez la page avant de réessayer.');
  const session = JSON.parse(stored);
  const minimumSeconds = Math.max(0, toNumber_(setting_('DELAI_MIN_FORMULAIRE_SECONDES', 3), 3));
  if (Date.now() - Number(session.issuedAt || 0) < minimumSeconds * 1000) {
    throw new Error('Veuillez prendre un moment pour vérifier les renseignements avant l’envoi.');
  }
}

function registrationOptions_() {
  const timeZone = String(setting_('FUSEAU_HORAIRE', Session.getScriptTimeZone()));
  const today = Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd');
  const divisions = rowsAsObjects_(APP.sheets.divisions);
  return rowsAsObjects_(APP.sheets.tournaments).filter(function(tournament) {
    const deadline = toIsoDate_(tournament['Date limite inscription'], timeZone);
    return isActive_(tournament['Statut']) && isYes_(tournament['Inscriptions ouvertes']) && (!deadline || deadline >= today);
  }).map(function(tournament) {
    const tournamentId = String(tournament['ID tournoi'] || '').trim();
    return {
      id: tournamentId,
      name: String(tournament['Nom'] || '').trim(),
      edition: String(tournament['Édition'] || '').trim(),
      startDate: toIsoDate_(tournament['Date début'], timeZone),
      endDate: toIsoDate_(tournament['Date fin'], timeZone),
      deadline: toIsoDate_(tournament['Date limite inscription'], timeZone),
      fee: formatRegistrationFee_(tournament['Frais inscription']),
      paymentInstructions: String(tournament['Instructions paiement'] || '').trim(),
      contactEmail: String(tournament['Courriel contact inscriptions'] || '').trim(),
      divisions: divisions.filter(function(division) {
        return String(division['ID tournoi'] || '').trim() === tournamentId && isYes_(division['Actif']);
      }).map(function(division) {
        return { id: String(division['ID division'] || '').trim(), name: String(division['Nom'] || '').trim() };
      }).filter(function(division) { return division.id && division.name; })
    };
  }).filter(function(tournament) {
    return tournament.id && tournament.name && tournament.divisions.length;
  });
}

function formatRegistrationFee_(value) {
  if (value === '' || value == null) return '';
  const number = Number(value);
  if (Number.isFinite(number)) return number.toFixed(2).replace('.', ',') + ' $';
  return String(value).trim();
}

function validateRegistrationPayload_(payload) {
  if (payload.consent !== true) throw new Error('Vous devez confirmer l’utilisation des renseignements pour traiter l’inscription.');

  const token = cleanText_(payload.token, 80, true, 'Session du formulaire');
  const tournamentId = cleanText_(payload.tournamentId, 80, true, 'Tournoi');
  const options = registrationOptions_();
  const tournament = options.find(function(item) { return item.id === tournamentId; });
  if (!tournament) throw new Error('Ce tournoi n’accepte plus les inscriptions. Rechargez la page pour obtenir les choix actuels.');

  const school = cleanText_(payload.school, 140, true, 'École');
  const address = cleanText_(payload.address, 180, true, 'Adresse');
  const city = cleanText_(payload.city, 100, true, 'Ville');
  const postalCode = cleanText_(payload.postalCode, 16, true, 'Code postal');
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{2,14}$/.test(postalCode)) throw new Error('Le code postal semble invalide.');
  const contactName = cleanText_(payload.contactName, 140, true, 'Responsable');
  const phone = cleanText_(payload.phone, 40, true, 'Téléphone');
  if ((phone.match(/\d/g) || []).length < 7) throw new Error('Le numéro de téléphone semble invalide.');
  const email = cleanText_(payload.email, 160, true, 'Courriel').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('L’adresse courriel semble invalide.');

  const maxTeams = Math.max(1, Math.min(20, toNumber_(setting_('LIMITE_EQUIPES_PAR_SOUMISSION', 10), 10)));
  if (!Array.isArray(payload.teams) || !payload.teams.length || payload.teams.length > maxTeams) {
    throw new Error('Ajoutez entre 1 et ' + maxTeams + ' équipes.');
  }
  const allowedDivisions = {};
  tournament.divisions.forEach(function(division) { allowedDivisions[division.id] = true; });
  const seenTeams = {};
  const teams = payload.teams.map(function(team, index) {
    const name = cleanText_(team && team.name, 140, true, 'Nom de l’équipe ' + (index + 1));
    const divisionId = cleanText_(team && team.divisionId, 80, true, 'Division de l’équipe ' + (index + 1));
    if (!allowedDivisions[divisionId]) throw new Error('La division de l’équipe ' + (index + 1) + ' n’est plus disponible.');
    const key = normalize_(divisionId + '|' + name);
    if (seenTeams[key]) throw new Error('La même équipe et la même division apparaissent deux fois.');
    seenTeams[key] = true;
    return { name: name, divisionId: divisionId };
  });

  return {
    token: token,
    tournament: tournament,
    school: school,
    address: address,
    city: city,
    postalCode: postalCode,
    contactName: contactName,
    phone: phone,
    email: email,
    teams: teams
  };
}

function cleanText_(value, maxLength, required, label) {
  const text = String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (required && !text) throw new Error((label || 'Ce champ') + ' est obligatoire.');
  if (text.length > maxLength) throw new Error((label || 'Ce champ') + ' est trop long.');
  return text;
}

function safeSheetText_(value) {
  const text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function registrationDuplicateKey_(submission) {
  const signature = [
    submission.tournament.id,
    normalize_(submission.school),
    submission.email.toLowerCase(),
    submission.teams.map(function(team) { return normalize_(team.divisionId + '|' + team.name); }).sort().join(',')
  ].join('|');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, signature, Utilities.Charset.UTF_8);
  return 'REG_DUP_' + Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '');
}

function rejectRecentDuplicate_(submission) {
  if (CacheService.getScriptCache().get(registrationDuplicateKey_(submission))) {
    throw new Error('Une soumission identique a déjà été reçue récemment. Communiquez avec l’organisation plutôt que de la renvoyer.');
  }
}

function registrationRateKey_() {
  return 'REG_RATE_' + Math.floor(Date.now() / 600000);
}

function enforceRegistrationRateLimit_() {
  const limit = Math.max(1, toNumber_(setting_('LIMITE_SOUMISSIONS_10_MIN', 20), 20));
  const count = toNumber_(CacheService.getScriptCache().get(registrationRateKey_()), 0);
  if (count >= limit) throw new Error('Le formulaire reçoit temporairement trop de demandes. Veuillez réessayer plus tard.');
}

function incrementRegistrationRateLimit_() {
  const cache = CacheService.getScriptCache();
  const key = registrationRateKey_();
  cache.put(key, String(toNumber_(cache.get(key), 0) + 1), 900);
}

function selectedRegistrationRows_() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = spreadsheet.getActiveSheet();
  if (!sheet || sheet.getName() !== APP.sheets.registrations) {
    throw new Error('Sélectionnez d’abord une ou plusieurs lignes dans l’onglet INSCRIPTIONS.');
  }
  const range = spreadsheet.getActiveRange();
  if (!range || range.getLastRow() < 2) throw new Error('Sélectionnez au moins une ligne d’inscription.');
  const firstRow = Math.max(2, range.getRow());
  const lastRow = range.getLastRow();
  const selected = rowsAsObjects_(APP.sheets.registrations).filter(function(row) {
    return row.__row >= firstRow && row.__row <= lastRow;
  });
  if (!selected.length) throw new Error('La sélection ne contient aucune inscription.');
  return selected;
}

function refreshRegistrationRows_(registrations) {
  const selectedRows = {};
  registrations.forEach(function(registration) { selectedRows[registration.__row] = true; });
  const current = rowsAsObjects_(APP.sheets.registrations).filter(function(registration) {
    return selectedRows[registration.__row];
  });
  if (current.length !== registrations.length) throw new Error('Une inscription sélectionnée a été supprimée ou déplacée. Recommencez la sélection.');
  return current;
}

function approuverInscriptionsSelectionnees() {
  const adminEmail = assertAdminContext_();
  const ui = SpreadsheetApp.getUi();
  let registrations;
  try {
    registrations = selectedRegistrationRows_();
  } catch (error) {
    ui.alert('Sélection invalide', error.message || String(error), ui.ButtonSet.OK);
    return;
  }
  const answer = ui.alert(
    'Approuver les inscriptions?',
    registrations.length + ' inscription(s) seront transformée(s) en équipes officielles.',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    ui.alert('Une autre opération est en cours. Réessayez dans quelques secondes.');
    return;
  }
  try {
    registrations = refreshRegistrationRows_(registrations);
    const existingSources = {};
    rowsAsObjects_(APP.sheets.teams).forEach(function(team) {
      const source = String(team['ID inscription source'] || '').trim();
      if (source) existingSources[source] = true;
    });
    const tournamentIds = {};
    rowsAsObjects_(APP.sheets.tournaments).forEach(function(tournament) {
      const id = String(tournament['ID tournoi'] || '').trim();
      if (id) tournamentIds[id] = true;
    });
    const divisionTournaments = {};
    rowsAsObjects_(APP.sheets.divisions).forEach(function(division) {
      const id = String(division['ID division'] || '').trim();
      if (id) divisionTournaments[id] = String(division['ID tournoi'] || '').trim();
    });
    const plans = registrations.map(function(registration) {
      const id = String(registration['ID inscription'] || '').trim() || newId_('INS');
      if (isActive_(registration['Statut'])) throw new Error('L’inscription ' + id + ' est déjà approuvée.');
      if (existingSources[id]) throw new Error('Une équipe existe déjà pour l’inscription ' + id + '.');
      const name = cleanText_(registration['Nom équipe'], 140, true, 'Nom équipe, ligne ' + registration.__row);
      const school = cleanText_(registration['École'], 140, true, 'École, ligne ' + registration.__row);
      const tournamentId = cleanText_(registration['ID tournoi'], 80, true, 'ID tournoi, ligne ' + registration.__row);
      const divisionId = cleanText_(registration['ID division'], 80, true, 'ID division, ligne ' + registration.__row);
      if (!tournamentIds[tournamentId]) throw new Error('Le tournoi de la ligne ' + registration.__row + ' est introuvable.');
      if (divisionTournaments[divisionId] !== tournamentId) {
        throw new Error('La division de la ligne ' + registration.__row + ' n’appartient pas au tournoi sélectionné.');
      }
      existingSources[id] = true;
      return {
        registration: registration,
        registrationId: id,
        teamId: newId_('EQ'),
        name: name,
        school: school,
        tournamentId: tournamentId,
        divisionId: divisionId
      };
    });

    const registrationSheet = adminSpreadsheet_().getSheetByName(APP.sheets.registrations);
    plans.forEach(function(plan) {
      writeObjectRow_(APP.sheets.teams, {
        'ID équipe': plan.teamId,
        'ID tournoi': plan.tournamentId,
        'ID division': plan.divisionId,
        'Nom': safeSheetText_(plan.name),
        'École': safeSheetText_(plan.school),
        'Statut': APP.statuses.approved,
        'Afficher': true,
        'ID inscription source': plan.registrationId
      });
      setRegistrationProcessing_(registrationSheet, plan.registration.__row, plan.registrationId, APP.statuses.approved, adminEmail);
    });
    SpreadsheetApp.flush();
    ui.alert('Approbation terminée', plans.length + ' équipe(s) officielle(s) ont été créées.', ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('Approbation annulée', error.message || String(error), ui.ButtonSet.OK);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function refuserInscriptionsSelectionnees() {
  const adminEmail = assertAdminContext_();
  const ui = SpreadsheetApp.getUi();
  let registrations;
  try {
    registrations = selectedRegistrationRows_();
    registrations.forEach(function(registration) {
      if (isActive_(registration['Statut'])) {
        throw new Error('Une inscription déjà approuvée ne peut pas être refusée automatiquement.');
      }
    });
  } catch (error) {
    ui.alert('Refus annulé', error.message || String(error), ui.ButtonSet.OK);
    return;
  }
  const reasonPrompt = ui.prompt(
    'Refuser les inscriptions?',
    'Motif interne facultatif. Les personnes inscrites ne recevront pas automatiquement ce texte.',
    ui.ButtonSet.OK_CANCEL
  );
  if (reasonPrompt.getSelectedButton() !== ui.Button.OK) return;
  const reason = cleanText_(reasonPrompt.getResponseText(), 500, false);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    ui.alert('Une autre opération est en cours. Réessayez dans quelques secondes.');
    return;
  }
  try {
    registrations = refreshRegistrationRows_(registrations);
    const existingSources = {};
    rowsAsObjects_(APP.sheets.teams).forEach(function(team) {
      const source = String(team['ID inscription source'] || '').trim();
      if (source) existingSources[source] = true;
    });
    registrations.forEach(function(registration) {
      const id = String(registration['ID inscription'] || '').trim();
      if (isActive_(registration['Statut']) || (id && existingSources[id])) {
        throw new Error('Une inscription déjà approuvée ne peut pas être refusée automatiquement.');
      }
    });
    const sheet = adminSpreadsheet_().getSheetByName(APP.sheets.registrations);
    registrations.forEach(function(registration) {
      const id = String(registration['ID inscription'] || '').trim() || newId_('INS');
      setRegistrationProcessing_(sheet, registration.__row, id, APP.statuses.refused, adminEmail);
      if (reason) {
        const notesColumn = headerColumn_(sheet, 'Notes internes');
        const previous = String(sheet.getRange(registration.__row, notesColumn).getValue() || '').trim();
        sheet.getRange(registration.__row, notesColumn).setValue((previous ? previous + '\n' : '') + 'Refus : ' + safeSheetText_(reason));
      }
    });
    SpreadsheetApp.flush();
    ui.alert('Refus enregistré', registrations.length + ' inscription(s) ont été marquée(s) REFUSÉE.', ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('Refus annulé', error.message || String(error), ui.ButtonSet.OK);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function setRegistrationProcessing_(sheet, row, registrationId, status, adminEmail) {
  sheet.getRange(row, headerColumn_(sheet, 'ID inscription')).setValue(registrationId);
  sheet.getRange(row, headerColumn_(sheet, 'Statut')).setValue(status);
  sheet.getRange(row, headerColumn_(sheet, 'Date traitement')).setValue(new Date());
  sheet.getRange(row, headerColumn_(sheet, 'Compte traitement')).setValue(adminEmail);
}
