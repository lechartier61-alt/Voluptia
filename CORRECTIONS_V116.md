# Corrections V116 — profils mobile avancés

## Objectif

Refondre la fiche profil pour téléphone afin qu'elle soit plus proche d'une vraie page membre sociale : photo large, résumé, actions visibles, onglets et informations détaillées.

## Changements principaux

- Nouvelle fiche profil mobile plein écran.
- En-tête sticky avec retour, pseudo de la fiche, bouton Suivre et menu options.
- Grand visuel de profil avec badges En ligne / Vérifié.
- Bloc résumé : pseudo unique de la fiche, type, ville, distance, âge, bio et bouton Lire la suite.
- Boutons principaux : Suivre, Lui écrire / Chat direct, Cœur.
- Onglets intégrés au profil : Publications, Profil, Photos, Agenda, Lieux.
- Onglet Publications : liste de publications publiques avec avatar, date, album, image/vidéo, likes et commentaires.
- Onglet Profil : détails de fiche, recherche, centres d'intérêt et personnes de la fiche.
- Les personnes de la fiche n'ont toujours pas de pseudo séparé : un seul pseudo public reste utilisé pour la fiche complète.
- Onglet Photos : grille médias + albums publics/privés.
- Onglet Agenda : emplacement prêt pour les disponibilités/sorties publiques.
- Onglet Lieux : localisation approximative par ville uniquement, avec rappel de confidentialité.
- Améliorations responsive pour petits écrans.

## Vérifications

- `npm run deploy:render:check` : OK.
- Build frontend Vite : OK.
- Syntaxe backend : OK.

