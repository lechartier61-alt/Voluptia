# Corrections Voluptia v115

## Inscription : un seul pseudo par fiche

- Le champ visible dans l'inscription devient **Pseudo de la fiche**.
- Les champs **Pseudo** dans les cartes des personnes ont été supprimés.
- Pour un couple, un trio ou un groupe, les personnes gardent uniquement leurs détails : âge, genre, sexualité, cheveux, yeux, origine, taille et poids.
- Le backend ignore désormais les labels/pseudos envoyés pour les personnes et applique des libellés techniques automatiques : `Partenaire 1`, `Partenaire 2`, `Personne 1`, etc.
- Le pseudo public affiché dans l'application reste uniquement `profile.pseudo`.

## Mobile

- Amélioration de la fenêtre d'inscription sur téléphone : panneau bas plus naturel, header fixe, champs plus grands, meilleure lisibilité.
- Amélioration de la carte membres sur téléphone : fenêtre flottante en bottom sheet, grille de profils en 3 colonnes, meilleure hauteur de carte, meilleure gestion des petits écrans.

## Vérifications

- `npm run deploy:render:check` : OK
- Test d'inscription API avec pseudos envoyés par personne : le profil conserve un seul pseudo public et les pseudos par personne sont remplacés par des libellés automatiques.
