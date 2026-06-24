# Correction V119 — Accueil : bloc déplacé à droite

## Modification effectuée

Sur la page d'accueil, tout le bloc du hero a été déplacé à droite sur ordinateur :

- logo + nom Voluptia ;
- slogan ;
- sous-titre ;
- boutons « Rejoindre gratuitement » et « Se connecter » ;
- texte rassurant sous les boutons.

## Fichier modifié

- `frontend/src/styles.css`

## Détail technique

Ajout d'un override CSS final avec :

- alignement du `.lp-hero-inner` à droite ;
- contenu aligné à gauche dans ce bloc pour un rendu propre ;
- overlay renforcé côté droit pour garder la lisibilité ;
- centrage conservé sur mobile et tablette.
