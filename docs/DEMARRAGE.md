# Démarrage et éléments requis du propriétaire

## Ce que le propriétaire doit préparer

Vous pouvez commencer avec vos comptes personnels de développement. Aucun accès client n'est requis pour construire et tester le gabarit.

Pour l'environnement de développement, il faut seulement :

1. un compte Google pouvant créer une feuille Google Sheets et un projet Apps Script;
2. un compte GitHub et, lorsque vous serez prêt, un dépôt pour le site;
3. les informations réelles du premier tournoi lorsqu'elles seront disponibles : nom, dates, lieux, divisions, frais et coordonnées publiques;
4. facultativement, le logo et les couleurs officielles.

Ne placez jamais de mot de passe, jeton Google ou jeton GitHub dans ce dépôt.

## Installation Google Sheets

1. Créer une feuille Google Sheets vide, par exemple `Tournoi Bleu & Or — DEV`.
2. Dans la feuille, ouvrir **Extensions → Apps Script**.
3. Créer un fichier Apps Script pour chacun des fichiers `.gs` du dossier `apps-script/`, puis y copier le contenu correspondant.
4. Ouvrir les paramètres du projet, activer l'affichage du fichier manifeste et remplacer son contenu par `apps-script/appsscript.json`.
5. Sélectionner la fonction `initialiserClasseur`, puis cliquer sur **Exécuter**.
6. Autoriser le script avec le compte propriétaire de la feuille.
7. Le script crée également un second classeur nommé `— DONNÉES PUBLIQUES`. Conserver son identifiant dans `PARAMETRES`.
8. Recharger Google Sheets. Le menu **Tournoi** apparaîtra.

L'initialisation crée uniquement les onglets manquants et leurs en-têtes. Elle ne supprime pas les données existantes.

## Première publication

1. Remplir au minimum `TOURNOIS`, `DIVISIONS`, `EQUIPES` et `MATCHS`.
2. Dans Google Sheets, choisir **Tournoi → Publier les changements**.
3. Corriger les erreurs indiquées, le cas échéant, puis relancer la publication.
4. Vérifier la date inscrite dans `PARAMETRES` et les lignes générées dans le classeur public séparé.

Les scores incomplets et les matchs dont la case `Résultat final` n'est pas cochée ne sont pas utilisés dans le classement public.

## Rendre l'instantané lisible par GitHub Pages

Cette opération se fait une seule fois par copie du gabarit :

1. Dans Google Sheets, choisir **Fichier → Partager → Publier sur le Web**.
2. Ouvrir le classeur séparé `— DONNÉES PUBLIQUES` indiqué dans `PARAMETRES`. Ne jamais publier le classeur administratif.
3. Choisir le format CSV et publier.
4. Copier l'URL produite.
5. Dans `site/config.js`, remplacer la valeur vide de `PUBLIC_DATA_URL` par cette URL.

Le classeur administratif reste privé. Le fichier publié ne contient que l'instantané nettoyé, sans coordonnées personnelles ni notes administratives.

## Installation GitHub Pages

1. Créer un dépôt appartenant au propriétaire final.
2. Copier ce projet dans le dépôt.
3. Dans GitHub, ouvrir **Settings → Pages**.
4. Sous **Build and deployment → Source**, sélectionner **GitHub Actions**.
5. Le workflow inclus publie automatiquement le dossier `site` lors d'un envoi sur la branche `main`.
6. Ouvrir l'URL GitHub Pages et vérifier la date de dernière publication.

## Transfert au client

Le transfert ne nécessite pas de reconstruire le produit :

1. transférer ou recopier le dépôt dans l'organisation GitHub du client;
2. faire une copie complète du modèle Google Sheets dans le Drive du client; le projet Apps Script lié est copié avec le classeur;
3. exécuter l'initialisation et autoriser le script avec un compte du client; le script détecte la copie et crée automatiquement un nouveau classeur public appartenant au client;
4. publier le nouveau classeur public et modifier son URL dans `site/config.js`;
5. retirer les accès des développeurs lorsque le client le souhaite.

Les inscriptions publiques nécessiteront une étape additionnelle de déploiement du formulaire Web Apps Script et de protection antibot. Cette étape sera documentée séparément lorsqu'elle sera intégrée.
