# Voluptia v114 — Carte des membres et fenêtre flottante

## Ajouts principaux

- Ajout d'un onglet **Carte** dans la rubrique Découvrir.
- La rubrique Découvrir ouvre maintenant la carte en premier pour mieux la mettre en avant.
- Les profils sont regroupés par ville sur la carte.
- Chaque ville affiche une bulle avec le nombre de profils.
- Au clic sur une bulle, une fenêtre flottante affiche les profils de la ville sous forme de grille photo, proche de la capture fournie.
- La fenêtre affiche : photo, pseudo tronqué, statut, type de profil, âge/localisation et badge vérifié.
- Le profil connecté est inclus dans la carte et la ville de l'utilisateur est marquée comme zone « Moi » dans les statistiques.

## Nettoyage demandé

- Les libellés automatiques de type `Personne 1`, `Personne 2`, `Personne 3` ont été remplacés par des libellés plus propres : `Membre 1`, `Membre 2`, `Membre 3` ou `Partenaire` selon le type de profil.
- Aucun faux profil de démonstration n'est ajouté aux nouveaux comptes.

## Backend

- Le bootstrap renvoie maintenant `profileMap`, une liste légère de profils visibles avec leur ville approximative et les données nécessaires à la carte.
- La navigation inclut maintenant `Carte`.

## Frontend

- Nouveau composant `MemberMapPage`.
- Nouveau groupement `buildProfileCityGroups`.
- Nouveaux styles v114 pour la carte, les bulles et la fenêtre flottante.
- Le clic sur une carte profil ouvre la fiche complète existante.

## Vérifications

- `npm run deploy:render:check` : OK.
- Build Vite production : OK.
- Syntaxe backend : OK.
- Test API local `/api/bootstrap` : OK, le champ `profileMap` est renvoyé.
