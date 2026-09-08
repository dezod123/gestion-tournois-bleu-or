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
4. Sélectionner les identifiants de référence au moyen des listes déroulantes.

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

Le futur générateur combinera les équipes, le nombre de confrontations configuré dans `DIVISIONS`, les durées et les plages actives. Il créera les lignes `MATCHS` avec leurs identifiants, dates, heures et lieux. Les administrateurs pourront ensuite déplacer ou corriger ces matchs dans la feuille avant de choisir **Publier les changements**.
