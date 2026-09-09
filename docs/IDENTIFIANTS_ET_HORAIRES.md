# Identifiants automatiques et préparation de l'horaire

## Identifiants

Un identifiant est une clé technique stable. Le nom d'une équipe ou d'un tournoi peut changer; son identifiant, lui, ne change jamais. Les administrateurs ne doivent donc pas saisir ces valeurs.

Les préfixes permettent de reconnaître rapidement le type de donnée :

| Préfixe | Donnée |
|---|---|
| `TRN-` | Tournoi ou édition |
| `DIV-` | Division |
| `LIEU-` | Lieu |
| `PLG-` | Plage horaire |
| `INS-` | Inscription |
| `EQ-` | Équipe approuvée |
| `MAT-` | Match |
| `PHO-` | Photo |

Chaque valeur utilise un UUID généré par Google Apps Script. La probabilité de collision est négligeable et une vérification empêche les doublons dans chaque onglet.

### Flux administratif actuel

1. Utiliser **Créer une nouvelle édition** pour le tournoi.
2. Saisir les autres lignes sans remplir leur première colonne grisée.
3. Utiliser **Générer les identifiants manquants** avant de relier ces lignes ailleurs ou de publier.
4. Sélectionner les noms dans les colonnes `Tournoi`, `Division`, `Lieu` et `Équipe`; les identifiants voisins sont remplis automatiquement.
5. Utiliser **Synchroniser les sélections administratives** pour valider les liens avant la publication, au besoin.

Le libellé d'un tournoi combine son nom et son édition, par exemple `Tournoi Bleu & Or — 2026`. Cela permet de distinguer plusieurs éditions simultanées. Les divisions, lieux et équipes sont ensuite validés dans le contexte du tournoi choisi. Un nom ambigu ou provenant d'un autre tournoi produit une erreur explicite plutôt qu'un lien incorrect.

La génération ne remplace jamais une valeur existante. Pour Google Forms, `ID inscription` est créé lors de l'importation administrative de la réponse. Lors de l'approbation, l'équipe reçoit son propre `ID équipe` et conserve `ID inscription source` comme lien vers la demande d'origine.

## Durée d'un match

`TOURNOIS` contient **Durée match par défaut (minutes)**. La valeur initiale proposée est 30 minutes. `DIVISIONS` contient **Durée match (minutes)** : laisser cette cellule vide pour utiliser la valeur du tournoi ou saisir une autre durée pour cette division.

## Plages horaires

Une plage horaire représente la disponibilité d'une installation, pas la disponibilité individuelle des équipes. Exemple :

```text
Tournoi : TRN-…
Lieu : LIEU-…
Date : 2027-11-05
Heure début : 16:30
Heure fin : 21:30
Pause début : 18:00
Pause fin : 18:30
Actif : coché
```

Créer une ligne distincte par combinaison de date et de lieu. Les pauses sont facultatives. Plusieurs lieux peuvent être disponibles en parallèle.

## Sélecteurs de dates et d'heures

L'initialisation applique les mêmes aides de saisie dans tous les onglets administratifs concernés :

- un calendrier dans `TOURNOIS` pour les dates de début, de fin et de limite d'inscription;
- un calendrier et des listes d'heures dans `PLAGES_HORAIRES`;
- un calendrier et une liste d'heures dans `MATCHS`;
- un calendrier dans `PHOTOS` pour la date de la photo.

Les listes proposent des heures par tranches de 15 minutes. Une heure différente peut tout de même être saisie au format `HH:mm`, ce qui permet au générateur d'utiliser des durées de match qui ne sont pas des multiples de 15 minutes. Les horodatages d'importation, de traitement et de publication sont produits automatiquement et ne reçoivent donc pas de sélecteur manuel.

Le générateur combine les équipes approuvées, le nombre de confrontations configuré dans `DIVISIONS`, les durées et les plages actives. Il crée les lignes `MATCHS` avec leurs identifiants, dates, heures et lieux. Les administrateurs peuvent ensuite déplacer ou corriger ces matchs dans la feuille avant de choisir **Publier les changements**.

La procédure complète et les limites de cette première version sont décrites dans [`HORAIRE.md`](HORAIRE.md).
