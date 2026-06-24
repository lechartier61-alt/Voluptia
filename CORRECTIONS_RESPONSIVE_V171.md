# Corrections responsive V171

## Changements réalisés

- suppression complète du bloc d’introduction « Carte des membres / Profils regroupés par ville » ;
- suppression complète du bloc d’introduction « Messagerie privée / Conversations », de ses compteurs et du second bandeau descriptif redondant ;
- suppression du double positionnement `sticky` des actions et onglets du profil sur téléphone et tablette ;
- adaptation du profil aux petits téléphones et au mode paysage ;
- sous-navigations mobiles rendues défilables, tactiles et non superposées au contenu ;
- messagerie recalibrée après suppression du hero ;
- bandeau cookies limité en hauteur, défilable et boutons empilés sur petit écran ;
- protections globales contre les débordements horizontaux, textes coupés et médias trop larges ;
- prise en charge portrait et paysage dans le manifeste PWA (`orientation: any`) ;
- retrait de l’import Google Fonts bloqué par la CSP dans l’administration ;
- correction des formulations de sécurité : mots de passe « hachés » et messagerie « privée » ;
- remplacement de l’adresse personnelle dans le fichier d’exemple de production ;
- correction de l’animation d’entrée qui décalait les fenêtres `position: fixed` hors écran ;
- profil mobile forcé en vrai plein écran (`100dvh`) pour éviter les zones coupées.

## Matrice prévue

Téléphones : 320×568 à 430×932, portrait et paysage.  
Tablettes : 600×960 à 1180×820, portrait et paysage.  
Ordinateurs : 1024×768 à 1920×1080.

## Fichiers principaux modifiés

- `frontend/src/App.jsx`
- `frontend/src/responsive-fixes-v171.css`
- `frontend/src/main.jsx`
- `frontend/public/manifest.webmanifest`
- `frontend/src/admin-redesign-v160.css`
- `frontend/index.html`
- `backend/src/app.js`
- `.env.production.example`
