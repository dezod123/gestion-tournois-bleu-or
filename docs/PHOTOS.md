# Photos publiques

La galerie publique utilise l’onglet `PHOTOS`. Les fichiers eux-mêmes ne sont pas copiés dans Google Sheets ni dans GitHub : le site affiche les images à partir de leur URL publique.

## Préparer une photo dans Google Drive

1. Déposer la photo dans un dossier Google Drive appartenant à l’organisation.
2. Ouvrir **Partager → Accès général** et choisir **Tous les utilisateurs disposant du lien — Lecteur**.
3. Copier le lien de partage du fichier, et non celui du dossier.
4. Ajouter une ligne dans `PHOTOS` :
   - choisir le tournoi;
   - coller le lien dans `URL`;
   - donner un titre court et descriptif;
   - choisir facultativement une division et une équipe;
   - indiquer facultativement la date;
   - cocher `Afficher`.
5. Choisir **Tournoi → Générer les identifiants manquants**, puis **Publier les changements**.

Les liens HTTPS directs vers des images hébergées ailleurs sont aussi acceptés. Les liens Google Photos et les liens vers un dossier Drive ne sont pas pris en charge.

## Comportement du site

- Les photos les plus récentes apparaissent en premier.
- Les filtres de tournoi, de division et d’équipe s’appliquent à la galerie.
- Une photo sans division ou sans équipe reste générale et peut apparaître dans les sélections plus précises.
- Douze photos sont présentées à la fois; **Voir plus de photos** charge le prochain groupe.
- Les images utilisent le chargement différé du navigateur. Leur consultation n’exécute aucun Apps Script.
- Un clic ouvre la photo dans une vue agrandie.

Il n’existe pas de limite logicielle fixe, mais il est préférable de publier une sélection plutôt que toutes les prises. À titre pratique, quelques dizaines de photos par tournoi gardent la galerie facile à parcourir. Le chargement par groupes évite qu’une grande galerie charge toutes les images immédiatement.

## Confidentialité et droits

Une photo affichée sur le site doit nécessairement être accessible publiquement. L’organisation doit donc confirmer qu’elle possède les autorisations nécessaires, particulièrement lorsqu’une personne mineure est reconnaissable. Ne jamais publier une photo contenant des renseignements personnels, des documents ou des écrans administratifs.

Si une image Drive ne s’affiche pas, vérifier que le **fichier** est partagé avec tous les utilisateurs disposant du lien. Le partage public du classeur `DONNEES_PUBLIQUES` ne rend pas automatiquement les photos publiques.
