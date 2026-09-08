# Formulaire d'inscription et approbation

## Fonctionnement

Le formulaire est une application Web Apps Script appartenant au propriétaire du classeur. Il n'utilise aucun service payant ni marque de formulaire externe.

Un responsable peut ajouter plusieurs équipes dans un même envoi. Le serveur crée toutefois une ligne INSCRIPTIONS et un identifiant distincts pour chaque équipe. Elles peuvent ainsi être approuvées ou refusées séparément. Les coordonnées communes restent dans le classeur administratif privé et ne sont jamais ajoutées aux données publiques.

## Configuration dans TOURNOIS

Pour rendre une édition disponible dans le formulaire :

1. conserver son statut à ACTIF;
2. cocher Inscriptions ouvertes;
3. saisir une date limite actuelle ou future, ou laisser la cellule vide;
4. remplir facultativement les frais, les instructions de paiement et le courriel de contact;
5. vérifier qu'au moins une division active lui est associée.

Les choix présentés par le formulaire sont lus au chargement. Une division inactive ou un tournoi fermé ne peut pas être forcé depuis le navigateur, car le serveur valide de nouveau la configuration au moment de la soumission.

## Déploiement initial

Avant le déploiement, copier tous les fichiers mis à jour dans le projet Apps Script, ajouter Registration.gs et créer un fichier HTML nommé RegistrationForm avec le contenu de RegistrationForm.html. Exécuter ensuite initialiserClasseur depuis l'éditeur lié au Google Sheet. Cette étape enregistre de manière privée l'identifiant du classeur administratif nécessaire à l'application Web.

Dans Apps Script :

1. choisir **Déployer → Nouveau déploiement**;
2. sélectionner le type **Application Web**;
3. ajouter une description, par exemple **Formulaire inscriptions v1**;
4. choisir **Exécuter en tant que : Moi**;
5. choisir **Qui a accès : Tout le monde**;
6. autoriser le déploiement et copier l'URL terminant par /exec.

Utiliser l'URL /exec pour les essais et le site public. L'URL /dev est réservée aux utilisateurs autorisés à modifier le script.

Dans site/config.js, placer l'URL dans REGISTRATION_FORM_URL. Le bouton **Inscrire une équipe** apparaîtra automatiquement sur GitHub Pages.

## Mise à jour ultérieure

Modifier le code dans Apps Script ne remplace pas automatiquement la version publique :

1. choisir **Déployer → Gérer les déploiements**;
2. modifier le déploiement existant;
3. sélectionner **Nouvelle version**;
4. déployer.

L'URL /exec demeure normalement la même. Aucune modification de site/config.js n'est alors nécessaire.

## Traitement administratif

1. Ouvrir INSCRIPTIONS.
2. Sélectionner une ou plusieurs cellules appartenant aux lignes à traiter.
3. Choisir **Tournoi → Approuver les inscriptions sélectionnées** ou **Refuser les inscriptions sélectionnées**.

L'approbation crée une ligne EQUIPES avec un nouvel identifiant, recopie le nom et l'école, conserve le lien vers l'inscription source, puis marque l'inscription APPROUVÉE. Une seconde approbation est bloquée afin de ne pas créer de doublon.

Le refus marque l'inscription REFUSÉE et permet d'ajouter un motif interne facultatif. Aucun courriel automatique n'est envoyé dans cette version.

## Protections intégrées

Le serveur applique plusieurs contrôles complémentaires :

- jeton de formulaire temporaire et utilisable une seule fois;
- délai minimal avant l'envoi;
- champ leurre invisible;
- validation complète de tous les champs côté serveur;
- nouvelle validation du tournoi et des divisions;
- rejet temporaire des soumissions identiques;
- limite globale configurable par période de dix minutes;
- neutralisation des valeurs pouvant être interprétées comme des formules Google Sheets;
- verrou empêchant deux écritures simultanées;
- séparation physique entre les inscriptions privées et l'instantané public.

Ces protections réduisent fortement le spam opportuniste, mais aucun formulaire public ne peut empêcher toutes les requêtes d'atteindre Apps Script. Un service spécialisé comme Turnstile pourra être ajouté plus tard si le volume ou les attaques le justifient.

Les seuils se trouvent dans PARAMETRES :

| Clé | Valeur initiale |
|---|---:|
| LIMITE_EQUIPES_PAR_SOUMISSION | 10 |
| LIMITE_SOUMISSIONS_10_MIN | 20 |
| DELAI_MIN_FORMULAIRE_SECONDES | 3 |
