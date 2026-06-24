# Corrections V177 — Carte, onglets glissants et icônes centrées

## Demande traitée

Suite aux captures mobile, la page Découvrir avait encore trop d'espace pris par les onglets au-dessus de la carte, la bulle d'aide masquait la carte, et les icônes de navigation n'étaient pas parfaitement centrées.

## Modifications appliquées

### 1. Barre d'onglets au-dessus des contenus

La barre d'onglets utilisée dans Découvrir, Médias, Messages et les autres pages de hub est maintenant :

- plus petite ;
- horizontale ;
- glissante au doigt sur mobile ;
- non empilée en gros blocs 2x2 ;
- avec icônes centrées ;
- avec descriptions secondaires masquées sur mobile pour gagner de l'espace.

Classes concernées :

- `hub-subnav-v65`
- `hub-subnav-v121`

### 2. Page Découvrir / Carte

La carte prend davantage d'espace utile :

- hauteur recalculée après réduction des onglets ;
- le cadre de la carte conserve toute la hauteur disponible ;
- la bulle « Clique sur une bulle » ne couvre plus toute la carte ;
- la bulle d'aide est transformée en petit bandeau compact en bas de la carte ;
- la fenêtre flottante des profils tient compte de la navigation basse flottante.

Classes concernées :

- `discover-map-full-v176`
- `member-map-shell-v114`
- `member-map-canvas-v114`
- `member-map-hint-v114`
- `member-map-floating-v114`

### 3. Barre du bas globale

La barre du bas est harmonisée sur toutes les pages :

- flottante ;
- légèrement transparente ;
- compacte ;
- arrondie ;
- avec flou arrière-plan ;
- avec icônes centrées verticalement et horizontalement ;
- labels masqués sur mobile pour une navigation plus propre.

Classes concernées :

- `mobile-bottom-nav`
- `social-bottom-nav`
- `pro-bottom-nav`

### 4. Icônes globales

Le centrage SVG a été renforcé sur toutes les navigations :

- barre du bas ;
- onglets de hub ;
- tiroir mobile ;
- raccourcis et sections utilisateur.

## Fichiers modifiés

- `frontend/src/main.jsx`
- `frontend/src/responsive-fixes-v177.css`

## Vérifications effectuées

- Build frontend : OK avec `npm run build`
- Syntaxe backend : OK avec `npm run check:backend-syntax`
- Configuration Railway PostgreSQL conservée
- Adresse GitHub de push conservée : `https://github.com/lechartier61-alt/Voluptia.git`

## Remarque

La V177 conserve toutes les corrections précédentes : V171 à V176, Railway PostgreSQL, suppression des blocs inutiles et navigation basse flottante.
