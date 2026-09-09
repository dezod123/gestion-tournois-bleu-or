const REGISTRATION_FORM_FIELDS = Object.freeze({
  teamName: 'Nom de l’équipe sportive',
  school: 'École',
  address: 'Adresse de l’école',
  city: 'Ville',
  postalCode: 'Code postal',
  contactName: 'Nom du responsable de l’équipe',
  phone: 'Téléphone',
  email: 'Courriel',
  division: 'Catégorie',
  consent: 'Consentement',
  consentChoice: 'Oui, j’accepte.'
});

const REGISTRATION_POSTAL_PATTERN = '^[ABCEGHJ-NPRSTVXYabceghj-nprstvxy][0-9][ABCEGHJ-NPRSTV-Zabceghj-nprstv-z][ -]?[0-9][ABCEGHJ-NPRSTV-Zabceghj-nprstv-z][0-9]$';
const REGISTRATION_PHONE_PATTERN = '^(\\+1[ .-]?)?[(]?[0-9]{3}[)]?[ .-]?[0-9]{3}[ .-]?[0-9]{4}([ ]+([Pp][Oo][Ss][Tt][Ee]?|[Ee][Xx][Tt]?|[Xx])[ .:]*[0-9]{1,8})?$';

function creerOuMettreAJourFormulaireInscription() {
  assertAdminContext_();
  const ui = SpreadsheetApp.getUi();
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) {
    ui.alert('Une autre opération est en cours. Réessayez dans quelques secondes.');
    return;
  }
  try {
    const tournament = selectedTournamentForRegistrationForm_();
    const result = syncRegistrationForm_(tournament);
    ensureRegistrationFormStatusTrigger_();
    SpreadsheetApp.flush();
    ui.alert(
      result.created ? 'Formulaire créé' : 'Formulaire mis à jour',
      'Le formulaire « ' + result.form.getTitle() + ' » est prêt. Son lien public a été enregistré dans TOURNOIS.\n\n' +
        'Utilisez ensuite Tournoi → Publier les changements pour mettre à jour le bouton du site.',
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('Formulaire non créé', error.message || String(error), ui.ButtonSet.OK);
  } finally {
    lock.releaseLock();
  }
}

function synchroniserTousFormulairesInscription() {
  assertAdminContext_();
  const ui = SpreadsheetApp.getUi();
  const tournaments = rowsAsObjects_(APP.sheets.tournaments).filter(function(tournament) {
    return String(tournament['ID formulaire inscription'] || '').trim();
  });
  if (!tournaments.length) {
    ui.alert('Aucun formulaire', 'Aucun tournoi ne possède encore de formulaire d’inscription.', ui.ButtonSet.OK);
    return;
  }
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) {
    ui.alert('Une autre opération est en cours. Réessayez dans quelques secondes.');
    return;
  }
  const errors = [];
  let updated = 0;
  try {
    tournaments.forEach(function(tournament) {
      try {
        syncRegistrationForm_(tournament);
        updated += 1;
      } catch (error) {
        errors.push(registrationTournamentLabel_(tournament) + ' : ' + (error.message || String(error)));
      }
    });
    ensureRegistrationFormStatusTrigger_();
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  ui.alert(
    errors.length ? 'Synchronisation partielle' : 'Synchronisation terminée',
    updated + ' formulaire(s) mis à jour.' + (errors.length ? '\n\n' + errors.slice(0, 10).join('\n') : ''),
    ui.ButtonSet.OK
  );
}

function selectedTournamentForRegistrationForm_() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = spreadsheet && spreadsheet.getActiveSheet();
  const range = spreadsheet && spreadsheet.getActiveRange();
  if (!sheet || sheet.getName() !== APP.sheets.tournaments || !range || range.getRow() < 2) {
    throw new Error('Sélectionnez d’abord une cellule de la ligne du tournoi dans l’onglet TOURNOIS.');
  }
  const tournament = rowsAsObjects_(APP.sheets.tournaments).find(function(row) {
    return row.__row === range.getRow();
  });
  if (!tournament) throw new Error('La ligne sélectionnée ne contient aucun tournoi.');
  if (!String(tournament['ID tournoi'] || '').trim()) {
    const id = newId_('TRN');
    sheet.getRange(tournament.__row, headerColumn_(sheet, 'ID tournoi')).setValue(id);
    tournament['ID tournoi'] = id;
  }
  return tournament;
}

function syncRegistrationForm_(tournament) {
  const config = registrationFormConfig_(tournament);
  const existingId = String(tournament['ID formulaire inscription'] || '').trim();
  let form;
  let created = false;
  if (existingId) {
    try {
      form = FormApp.openById(existingId);
    } catch (error) {
      throw new Error('Le formulaire existant est introuvable ou inaccessible. Vérifiez que votre compte possède un accès de modification.');
    }
  } else {
    form = FormApp.create(registrationFormTitle_(tournament), true);
    created = true;
  }

  configureRegistrationForm_(form, tournament, config.divisions);
  const spreadsheetId = adminSpreadsheet_().getId();
  if (!formUsesSpreadsheetDestination_(form, spreadsheetId)) {
    form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheetId);
  }
  writeRegistrationFormMetadata_(tournament.__row, form);
  return { form: form, created: created };
}

function formUsesSpreadsheetDestination_(form, spreadsheetId) {
  try {
    return form.getDestinationType() === FormApp.DestinationType.SPREADSHEET &&
      form.getDestinationId() === spreadsheetId;
  } catch (error) {
    // Un nouveau formulaire sans destination fait lever une exception dans Google Forms.
    return false;
  }
}

function registrationFormConfig_(tournament) {
  const tournamentId = cleanText_(tournament['ID tournoi'], 80, true, 'ID tournoi');
  cleanText_(tournament['Nom'], 140, true, 'Nom du tournoi');
  const divisions = rowsAsObjects_(APP.sheets.divisions).filter(function(division) {
    return String(division['ID tournoi'] || '').trim() === tournamentId && isYes_(division['Actif']);
  }).map(function(division) {
    return {
      id: cleanText_(division['ID division'], 80, true, 'ID division'),
      name: cleanText_(division['Nom'], 140, true, 'Nom de division')
    };
  });
  if (!divisions.length) throw new Error('Ajoutez au moins une division active avant de créer le formulaire.');
  const names = {};
  divisions.forEach(function(division) {
    const key = normalize_(division.name);
    if (names[key]) throw new Error('Deux divisions actives portent le même nom : « ' + division.name + ' ».');
    names[key] = true;
  });
  return { tournamentId: tournamentId, divisions: divisions };
}

function configureRegistrationForm_(form, tournament, divisions) {
  const timeZone = String(setting_('FUSEAU_HORAIRE', Session.getScriptTimeZone()));
  const today = Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd');
  form.setTitle(registrationFormTitle_(tournament));
  form.setDescription(registrationFormDescription_(tournament, timeZone));
  form.setConfirmationMessage('Votre inscription a été reçue et sera vérifiée par l’organisation. Utilisez le lien proposé pour inscrire une autre équipe.');
  form.setCollectEmail(false);
  form.setPublishingSummary(false);
  form.setShowLinkToRespondAgain(true);
  form.setLimitOneResponsePerUser(false);
  form.setProgressBar(false);
  form.setShuffleQuestions(false);
  form.setPublished(true);
  form.setCustomClosedFormMessage('Les inscriptions à ce tournoi sont actuellement fermées. Communiquez avec l’organisation si vous pensez qu’il s’agit d’une erreur.');
  form.setAcceptingResponses(registrationIsOpen_(tournament, today));

  upsertRegistrationTextItem_(form, REGISTRATION_FORM_FIELDS.teamName, '', null);
  upsertRegistrationTextItem_(form, REGISTRATION_FORM_FIELDS.school, '', null);
  upsertRegistrationTextItem_(form, REGISTRATION_FORM_FIELDS.address, '', null);
  upsertRegistrationTextItem_(form, REGISTRATION_FORM_FIELDS.city, '', null);
  upsertRegistrationTextItem_(form, REGISTRATION_FORM_FIELDS.postalCode, 'Format : A1A 1A1',
    FormApp.createTextValidation().setHelpText('Entrez un code postal canadien au format A1A 1A1.')
      .requireTextMatchesPattern(REGISTRATION_POSTAL_PATTERN).build());
  upsertRegistrationTextItem_(form, REGISTRATION_FORM_FIELDS.contactName, '', null);
  upsertRegistrationTextItem_(form, REGISTRATION_FORM_FIELDS.phone, 'Exemple : 514 555-1234, poste 123',
    FormApp.createTextValidation().setHelpText('Entrez un numéro canadien de 10 chiffres. Un poste est facultatif.')
      .requireTextMatchesPattern(REGISTRATION_PHONE_PATTERN).build());
  upsertRegistrationTextItem_(form, REGISTRATION_FORM_FIELDS.email, '',
    FormApp.createTextValidation().setHelpText('Entrez une adresse courriel complète, par exemple nom@ecole.ca.')
      .requireTextIsEmail().build());
  upsertRegistrationListItem_(form, REGISTRATION_FORM_FIELDS.division,
    'Sélectionnez la catégorie de cette équipe.', divisions.map(function(division) { return division.name; }));
  upsertRegistrationConsentItem_(form);
}

function managedRegistrationItem_(form, title, expectedType) {
  const matches = form.getItems().filter(function(item) { return item.getTitle() === title; });
  if (matches.length > 1) throw new Error('Le formulaire contient plusieurs questions intitulées « ' + title + ' ».');
  if (!matches.length) return null;
  if (matches[0].getType() !== expectedType) {
    throw new Error('La question « ' + title + ' » n’est plus du type attendu.');
  }
  return matches[0];
}

function upsertRegistrationTextItem_(form, title, helpText, validation) {
  const existing = managedRegistrationItem_(form, title, FormApp.ItemType.TEXT);
  const item = existing ? existing.asTextItem() : form.addTextItem();
  item.setTitle(title).setHelpText(helpText || '').setRequired(true);
  if (validation) item.setValidation(validation);
  return item;
}

function upsertRegistrationListItem_(form, title, helpText, choices) {
  const existing = managedRegistrationItem_(form, title, FormApp.ItemType.LIST);
  const item = existing ? existing.asListItem() : form.addListItem();
  item.setTitle(title).setHelpText(helpText || '').setChoiceValues(choices).setRequired(true);
  return item;
}

function upsertRegistrationConsentItem_(form) {
  const existing = managedRegistrationItem_(form, REGISTRATION_FORM_FIELDS.consent, FormApp.ItemType.CHECKBOX);
  const item = existing ? existing.asCheckboxItem() : form.addCheckboxItem();
  item.setTitle(REGISTRATION_FORM_FIELDS.consent)
    .setHelpText('Je confirme que les renseignements sont exacts et qu’ils peuvent être utilisés pour traiter cette inscription.')
    .setChoiceValues([REGISTRATION_FORM_FIELDS.consentChoice])
    .setRequired(true);
  return item;
}

function registrationFormTitle_(tournament) {
  return ['Inscription', String(tournament['Nom'] || '').trim(), String(tournament['Édition'] || '').trim()]
    .filter(Boolean).join(' — ');
}

function registrationTournamentLabel_(tournament) {
  return [String(tournament['Nom'] || '').trim(), String(tournament['Édition'] || '').trim()].filter(Boolean).join(' — ') || 'Tournoi sans nom';
}

function registrationFormDescription_(tournament, timeZone) {
  const lines = ['Une soumission correspond à une seule équipe. Les inscriptions doivent être approuvées par l’organisation.'];
  const startDate = toIsoDate_(tournament['Date début'], timeZone);
  const endDate = toIsoDate_(tournament['Date fin'], timeZone);
  const deadline = toIsoDate_(tournament['Date limite inscription'], timeZone);
  if (startDate) lines.push('Dates du tournoi : ' + (endDate && endDate !== startDate ? startDate + ' au ' + endDate : startDate));
  if (deadline) lines.push('Date limite d’inscription : ' + deadline);
  const fee = formatRegistrationFee_(tournament['Frais inscription']);
  if (fee) lines.push('Frais d’inscription : ' + fee + ' par équipe');
  const payment = String(tournament['Instructions paiement'] || '').trim();
  if (payment) lines.push('Paiement : ' + payment);
  const contact = String(tournament['Courriel contact inscriptions'] || '').trim();
  if (contact) lines.push('Questions : ' + contact);
  lines.push('Les coordonnées fournies demeurent dans l’environnement administratif privé du tournoi.');
  return lines.join('\n\n');
}

function registrationIsOpen_(tournament, todayIso) {
  const deadline = toIsoDate_(tournament['Date limite inscription'], String(setting_('FUSEAU_HORAIRE', Session.getScriptTimeZone())));
  return isActive_(tournament['Statut']) && isYes_(tournament['Inscriptions ouvertes']) && (!deadline || deadline >= todayIso);
}

function writeRegistrationFormMetadata_(row, form) {
  const sheet = adminSpreadsheet_().getSheetByName(APP.sheets.tournaments);
  sheet.getRange(row, headerColumn_(sheet, 'ID formulaire inscription')).setValue(form.getId());
  sheet.getRange(row, headerColumn_(sheet, 'URL formulaire inscription')).setValue(form.getPublishedUrl());
  sheet.getRange(row, headerColumn_(sheet, 'URL modification formulaire')).setValue(form.getEditUrl());
  sheet.getRange(row, headerColumn_(sheet, 'Dernière mise à jour formulaire')).setValue(new Date());
}

function ensureRegistrationFormStatusTrigger_() {
  const handler = 'synchroniserEtatFormulairesInscription';
  const exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === handler;
  });
  if (!exists) ScriptApp.newTrigger(handler).timeBased().everyDays(1).atHour(2).create();
}

function synchroniserEtatFormulairesInscription() {
  const timeZone = String(setting_('FUSEAU_HORAIRE', Session.getScriptTimeZone()));
  const today = Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd');
  rowsAsObjects_(APP.sheets.tournaments).forEach(function(tournament) {
    const formId = String(tournament['ID formulaire inscription'] || '').trim();
    if (!formId) return;
    try {
      const form = FormApp.openById(formId);
      form.setPublishingSummary(false);
      form.setAcceptingResponses(registrationIsOpen_(tournament, today));
    } catch (error) {
      console.error('Formulaire inaccessible pour ' + registrationTournamentLabel_(tournament) + ' : ' + (error.message || String(error)));
    }
  });
}

function importerNouvellesInscriptions() {
  assertAdminContext_();
  const ui = SpreadsheetApp.getUi();
  const tournaments = rowsAsObjects_(APP.sheets.tournaments).filter(function(tournament) {
    return String(tournament['ID formulaire inscription'] || '').trim();
  });
  if (!tournaments.length) {
    ui.alert('Aucun formulaire', 'Créez d’abord un formulaire d’inscription pour au moins un tournoi.', ui.ButtonSet.OK);
    return;
  }
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) {
    ui.alert('Une autre opération est en cours. Réessayez dans quelques secondes.');
    return;
  }
  let imported = 0;
  const errors = [];
  try {
    const importedResponseIds = {};
    rowsAsObjects_(APP.sheets.registrations).forEach(function(registration) {
      const sourceId = String(registration['ID réponse formulaire'] || '').trim();
      if (sourceId) importedResponseIds[sourceId] = true;
    });
    const divisions = rowsAsObjects_(APP.sheets.divisions);
    tournaments.forEach(function(tournament) {
      const formId = String(tournament['ID formulaire inscription'] || '').trim();
      let form;
      try {
        form = FormApp.openById(formId);
      } catch (error) {
        errors.push(registrationTournamentLabel_(tournament) + ' : formulaire inaccessible.');
        return;
      }
      form.getResponses().forEach(function(response) {
        const responseId = String(response.getId() || '').trim();
        const sourceId = formId + ':' + responseId;
        if (!responseId) {
          errors.push(registrationTournamentLabel_(tournament) + ' : une réponse ne possède aucun identifiant Google Forms.');
          return;
        }
        if (importedResponseIds[sourceId]) return;
        try {
          const submitted = registrationFromGoogleFormResponse_(tournament, divisions, response);
          writeObjectRow_(APP.sheets.registrations, {
            'ID inscription': newId_('INS'),
            'Horodatage': response.getTimestamp(),
            'ID tournoi': submitted.tournamentId,
            'Tournoi': submitted.tournamentLabel,
            'Nom équipe': safeSheetText_(submitted.teamName),
            'École': safeSheetText_(submitted.school),
            'Adresse': safeSheetText_(submitted.address),
            'Ville': safeSheetText_(submitted.city),
            'Code postal': safeSheetText_(submitted.postalCode),
            'Responsable': safeSheetText_(submitted.contactName),
            'Téléphone': safeSheetText_(submitted.phone),
            'Courriel': safeSheetText_(submitted.email),
            'ID division': submitted.divisionId,
            'Division': submitted.divisionLabel,
            'Nombre équipes': 1,
            'Statut': APP.statuses.pending,
            'Notes internes': 'Importée depuis Google Forms.',
            'ID soumission': newId_('SOUM'),
            'ID réponse formulaire': sourceId
          });
          importedResponseIds[sourceId] = true;
          imported += 1;
        } catch (error) {
          errors.push(registrationTournamentLabel_(tournament) + ' — réponse ' + responseId + ' : ' + (error.message || String(error)));
        }
      });
    });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  ui.alert(
    errors.length ? 'Importation partielle' : 'Importation terminée',
    imported + ' nouvelle(s) inscription(s) ajoutée(s) dans INSCRIPTIONS.' +
      (errors.length ? '\n\nÀ vérifier :\n' + errors.slice(0, 10).join('\n') : ''),
    ui.ButtonSet.OK
  );
}

function registrationFromGoogleFormResponse_(tournament, divisions, response) {
  const answers = {};
  response.getItemResponses().forEach(function(itemResponse) {
    const value = itemResponse.getResponse();
    answers[normalize_(itemResponse.getItem().getTitle())] = Array.isArray(value) ? value.join(', ') : String(value == null ? '' : value);
  });
  const answer = function(title) { return answers[normalize_(title)] || ''; };
  const tournamentId = cleanText_(tournament['ID tournoi'], 80, true, 'ID tournoi');
  const divisionName = cleanText_(answer(REGISTRATION_FORM_FIELDS.division), 140, true, REGISTRATION_FORM_FIELDS.division);
  const matchingDivisions = divisions.filter(function(division) {
    return String(division['ID tournoi'] || '').trim() === tournamentId && normalize_(division['Nom']) === normalize_(divisionName);
  });
  if (matchingDivisions.length !== 1) throw new Error('La catégorie sélectionnée ne correspond plus à une division unique du tournoi.');
  if (!answer(REGISTRATION_FORM_FIELDS.consent)) throw new Error('Le consentement obligatoire est absent.');
  return {
    tournamentId: tournamentId,
    tournamentLabel: registrationTournamentLabel_(tournament),
    teamName: cleanText_(answer(REGISTRATION_FORM_FIELDS.teamName), 140, true, REGISTRATION_FORM_FIELDS.teamName),
    school: cleanText_(answer(REGISTRATION_FORM_FIELDS.school), 140, true, REGISTRATION_FORM_FIELDS.school),
    address: cleanText_(answer(REGISTRATION_FORM_FIELDS.address), 180, true, REGISTRATION_FORM_FIELDS.address),
    city: cleanText_(answer(REGISTRATION_FORM_FIELDS.city), 100, true, REGISTRATION_FORM_FIELDS.city),
    postalCode: normalizePostalCode_(answer(REGISTRATION_FORM_FIELDS.postalCode)),
    contactName: cleanText_(answer(REGISTRATION_FORM_FIELDS.contactName), 140, true, REGISTRATION_FORM_FIELDS.contactName),
    phone: normalizePhone_(answer(REGISTRATION_FORM_FIELDS.phone)),
    email: normalizeEmail_(answer(REGISTRATION_FORM_FIELDS.email)),
    divisionId: cleanText_(matchingDivisions[0]['ID division'], 80, true, 'ID division'),
    divisionLabel: cleanText_(matchingDivisions[0]['Nom'], 140, true, 'Division')
  };
}

function formatRegistrationFee_(value) {
  if (value === '' || value == null) return '';
  const number = Number(value);
  if (Number.isFinite(number)) return number.toFixed(2).replace('.', ',') + ' $';
  return String(value).trim();
}

function normalizePostalCode_(value) {
  const compact = cleanText_(value, 16, true, 'Code postal').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(compact)) {
    throw new Error('Entrez un code postal canadien au format A1A 1A1.');
  }
  return compact.slice(0, 3) + ' ' + compact.slice(3);
}

function normalizePhone_(value) {
  const phone = cleanText_(value, 40, true, 'Téléphone');
  const extensionMatch = phone.match(/(?:poste|post\.?|ext(?:ension)?\.?|x)\s*[:.]?\s*(\d{1,8})\s*$/i);
  const extension = extensionMatch ? extensionMatch[1] : '';
  const basePhone = extensionMatch ? phone.slice(0, extensionMatch.index) : phone;
  let digits = basePhone.replace(/\D/g, '');
  if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) {
    throw new Error('Entrez un numéro canadien de 10 chiffres, par exemple 514 555-1234.');
  }
  return digits.slice(0, 3) + ' ' + digits.slice(3, 6) + '-' + digits.slice(6) + (extension ? ' poste ' + extension : '');
}

function normalizeEmail_(value) {
  const email = cleanText_(value, 160, true, 'Courriel').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new Error('Entrez une adresse courriel complète, par exemple nom@ecole.ca.');
  }
  return email;
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
    const tournamentById = {};
    rowsAsObjects_(APP.sheets.tournaments).forEach(function(tournament) {
      const id = String(tournament['ID tournoi'] || '').trim();
      if (id) tournamentById[id] = tournament;
    });
    const divisionById = {};
    rowsAsObjects_(APP.sheets.divisions).forEach(function(division) {
      const id = String(division['ID division'] || '').trim();
      if (id) divisionById[id] = division;
    });
    const plans = registrations.map(function(registration) {
      const id = String(registration['ID inscription'] || '').trim() || newId_('INS');
      if (isActive_(registration['Statut'])) throw new Error('L’inscription ' + id + ' est déjà approuvée.');
      if (existingSources[id]) throw new Error('Une équipe existe déjà pour l’inscription ' + id + '.');
      const name = cleanText_(registration['Nom équipe'], 140, true, 'Nom équipe, ligne ' + registration.__row);
      const school = cleanText_(registration['École'], 140, true, 'École, ligne ' + registration.__row);
      const tournamentId = cleanText_(registration['ID tournoi'], 80, true, 'ID tournoi, ligne ' + registration.__row);
      const divisionId = cleanText_(registration['ID division'], 80, true, 'ID division, ligne ' + registration.__row);
      if (!tournamentById[tournamentId]) throw new Error('Le tournoi de la ligne ' + registration.__row + ' est introuvable.');
      if (!divisionById[divisionId] || String(divisionById[divisionId]['ID tournoi'] || '').trim() !== tournamentId) {
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
        tournamentLabel: registrationTournamentLabel_(tournamentById[tournamentId]),
        divisionId: divisionId,
        divisionLabel: String(divisionById[divisionId]['Nom'] || '').trim()
      };
    });

    const registrationSheet = adminSpreadsheet_().getSheetByName(APP.sheets.registrations);
    plans.forEach(function(plan) {
      writeObjectRow_(APP.sheets.teams, {
        'ID équipe': plan.teamId,
        'ID tournoi': plan.tournamentId,
        'Tournoi': plan.tournamentLabel,
        'ID division': plan.divisionId,
        'Division': plan.divisionLabel,
        'Nom': safeSheetText_(plan.name),
        'École': safeSheetText_(plan.school),
        'Statut': APP.statuses.approved,
        'Afficher': true,
        'ID inscription source': plan.registrationId
      });
      setRegistrationProcessing_(registrationSheet, plan.registration.__row, plan.registrationId, APP.statuses.approved, adminEmail);
    });
    SpreadsheetApp.flush();
    applyAdminReferenceDisplayValidations_(adminSpreadsheet_());
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
