# Google Forms et approbation des inscriptions

## Fonctionnement

Chaque tournoi peut posséder son propre Google Form, créé et mis à jour automatiquement depuis le classeur administratif. Une soumission correspond à une seule équipe.

Le formulaire et ses réponses appartiennent au compte Google du client. Les réponses brutes sont enregistrées dans un onglet privé créé par Google Forms. Elles ne sont jamais publiées directement.

```text
Google Form du tournoi
        ↓
Réponses brutes privées
        ↓  Tournoi → Importer les nouvelles inscriptions
INSCRIPTIONS — EN ATTENTE
        ↓
Approbation ou refus administratif
```

## Créer le formulaire d'un tournoi

1. Compléter la ligne du tournoi dans `TOURNOIS`.
2. Ajouter au moins une division active dans `DIVISIONS`.
3. Sélectionner une cellule de la ligne du tournoi.
4. Choisir **Tournoi → Créer / mettre à jour le formulaire sélectionné**.
5. Autoriser l'accès à Google Forms lors de la première utilisation.
6. Ouvrir l'URL répondant dans une fenêtre de navigation privée et soumettre une réponse d'essai. Si Google exige un compte de l'organisation, vérifier la politique de partage externe de Google Workspace.
7. Choisir **Tournoi → Publier les changements** pour faire apparaître le lien sur le site.

Le script crée le formulaire, configure les champs obligatoires et leurs validations françaises, désactive le résumé public des réponses, relie les réponses au classeur privé et remplit automatiquement les colonnes techniques suivantes :

- `ID formulaire inscription`;
- `URL formulaire inscription`;
- `URL modification formulaire`;
- `Dernière mise à jour formulaire`.

Ces colonnes ne doivent pas être remplies manuellement. Seule l'URL destinée aux répondants peut être incluse dans l'instantané public.

## Configuration et ouverture

Le formulaire reprend automatiquement :

- le nom et l'édition du tournoi;
- les dates;
- la date limite d'inscription;
- les frais par équipe;
- les instructions de paiement;
- le courriel de contact;
- les divisions actives du tournoi.

Pour accepter des réponses, le tournoi doit être `ACTIF`, la case `Inscriptions ouvertes` doit être cochée et la date limite ne doit pas être dépassée. Un déclencheur quotidien ferme automatiquement les formulaires arrivés à échéance. Le site masque également le bouton lorsque les inscriptions sont fermées.

Après avoir modifié les divisions, les frais, les dates ou les instructions, utiliser de nouveau **Créer / mettre à jour le formulaire sélectionné**. La commande **Synchroniser tous les formulaires** permet de mettre à jour en lot tous les formulaires déjà créés.

Le thème, les couleurs et le logo peuvent être personnalisés directement dans Google Forms. Ne pas renommer, supprimer ni changer le type des questions gérées par le système; l'importation dépend de leurs titres stables. Les questions ajoutées manuellement ne sont pas importées dans `INSCRIPTIONS`.

Google Forms crée aussi un onglet de réponses brutes dans le classeur administratif. Le conserver : il sert de sauvegarde lisible par les administrateurs, même si l'importation automatisée consulte directement le formulaire.

## Champs du formulaire

Le formulaire demande :

- nom de l'équipe sportive;
- école;
- adresse;
- ville;
- code postal canadien;
- nom du responsable;
- téléphone, avec poste facultatif;
- courriel;
- catégorie;
- consentement.

La page de confirmation propose de soumettre une autre réponse afin qu'une même école puisse inscrire une autre équipe sans limiter le compte Google à une seule réponse.

## Importer les réponses

Google Forms conserve immédiatement chaque réponse dans le classeur privé sans exécuter notre code. Pour les préparer à l'approbation :

1. choisir **Tournoi → Importer les nouvelles inscriptions**;
2. ouvrir `INSCRIPTIONS`;
3. vérifier les nouvelles lignes marquées `EN ATTENTE`.

L'importation traite tous les formulaires connus en une seule exécution. Elle normalise les coordonnées, retrouve l'identifiant de la division, génère `ID inscription` et `ID soumission`, puis conserve `ID réponse formulaire` afin de ne jamais importer deux fois la même réponse.

Une réponse invalide demeure dans l'onglet brut et est signalée dans le compte rendu d'importation. Les autres réponses valides sont tout de même importées.

## Approuver ou refuser

1. Sélectionner une ou plusieurs lignes dans `INSCRIPTIONS`.
2. Choisir **Tournoi → Approuver les inscriptions sélectionnées** ou **Refuser les inscriptions sélectionnées**.

L'approbation crée une équipe officielle avec un nouvel `ID équipe`, conserve le lien vers l'inscription source et marque la demande `APPROUVÉE`. Le refus marque la demande `REFUSÉE` et permet d'ajouter un motif interne facultatif.

Les équipes approuvées ne deviennent visibles sur le site qu'après **Publier les changements**. Aucun courriel automatique d'acceptation ou de refus n'est envoyé dans cette version.

## Confidentialité, transfert et ancien formulaire

- Le résumé public des réponses Google Forms est explicitement désactivé.
- Les coordonnées, réponses brutes et liens de modification restent privés.
- Le site public reçoit uniquement le lien répondant du formulaire et les équipes approuvées.
- Lorsqu'une copie du gabarit est initialisée sous un autre propriétaire, les références aux anciens formulaires sont effacées. Le client génère ainsi ses propres formulaires dans son Drive.
- L'ancienne application Web Apps Script n'est plus nécessaire. Après la migration, archiver son déploiement dans **Déployer → Gérer les déploiements**.
- Les anciens paramètres de limitation de l'application Web peuvent demeurer dans `PARAMETRES`; cette version les ignore.

Le compte qui exécute la création devient propriétaire du formulaire. Dans l'environnement final, cette commande doit donc être exécutée par un compte appartenant au client.
