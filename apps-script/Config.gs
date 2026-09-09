const APP = Object.freeze({
  version: '0.7.0',
  locale: 'fr-CA',
  sheets: Object.freeze({
    settings: 'PARAMETRES',
    tournaments: 'TOURNOIS',
    divisions: 'DIVISIONS',
    venues: 'LIEUX',
    availability: 'PLAGES_HORAIRES',
    registrations: 'INSCRIPTIONS',
    teams: 'EQUIPES',
    matches: 'MATCHS',
    photos: 'PHOTOS',
    publicData: 'DONNEES_PUBLIQUES',
    publicationLog: 'JOURNAL_PUBLICATION'
  }),
  statuses: Object.freeze({
    active: 'ACTIF',
    approved: 'APPROUVÉE',
    pending: 'EN ATTENTE',
    refused: 'REFUSÉE'
  }),
  headers: Object.freeze({
    PARAMETRES: ['Clé', 'Valeur', 'Description'],
    TOURNOIS: ['ID tournoi', 'Nom', 'Édition', 'Statut', 'Afficher', 'Date début', 'Date fin', 'Lieu principal', 'Description publique', 'Durée match par défaut (minutes)', 'Inscriptions ouvertes', 'Date limite inscription', 'Frais inscription', 'Instructions paiement', 'Courriel contact inscriptions', 'ID formulaire inscription', 'URL formulaire inscription', 'URL modification formulaire', 'Dernière mise à jour formulaire'],
    DIVISIONS: ['ID division', 'ID tournoi', 'Nom', 'Actif', 'Afficher', 'Nombre de pools', 'Matchs entre équipes', 'Équipes qualifiées', 'Points victoire', 'Points nul', 'Points défaite', 'Ordre bris égalité', 'Durée match (minutes)'],
    LIEUX: ['ID lieu', 'ID tournoi', 'Nom', 'Adresse publique', 'Actif', 'Afficher'],
    PLAGES_HORAIRES: ['ID plage', 'ID tournoi', 'ID lieu', 'Date', 'Heure début', 'Heure fin', 'Pause début', 'Pause fin', 'Actif', 'Notes'],
    INSCRIPTIONS: ['ID inscription', 'Horodatage', 'ID tournoi', 'Nom équipe', 'École', 'Adresse', 'Ville', 'Code postal', 'Responsable', 'Téléphone', 'Courriel', 'ID division', 'Nombre équipes', 'Statut', 'Notes internes', 'ID soumission', 'Date traitement', 'Compte traitement', 'ID réponse formulaire'],
    EQUIPES: ['ID équipe', 'ID tournoi', 'ID division', 'Pool', 'Nom', 'École', 'Statut', 'Afficher', 'ID inscription source'],
    MATCHS: ['ID match', 'ID tournoi', 'ID division', 'Pool', 'Phase', 'Ronde', 'Date', 'Heure', 'ID lieu', 'ID équipe domicile', 'Équipe domicile', 'ID équipe visiteuse', 'Équipe visiteuse', 'Score domicile', 'Score visiteuse', 'Résultat final', 'Motif', 'Afficher'],
    PHOTOS: ['ID photo', 'ID tournoi', 'URL', 'Titre', 'ID division', 'ID équipe', 'Date', 'Afficher'],
    DONNEES_PUBLIQUES: ['Type', 'ID', 'Ordre', 'Données JSON'],
    JOURNAL_PUBLICATION: ['Horodatage', 'Compte', 'Version', 'Objets publiés', 'Statut', 'Message']
  })
});
