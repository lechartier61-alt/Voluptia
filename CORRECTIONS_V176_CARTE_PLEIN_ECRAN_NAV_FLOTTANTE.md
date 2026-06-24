# Corrections V176 — Carte Découvrir plein écran et barre basse flottante

## Demande
- Agrandir la carte de la page **Découvrir** pour qu'elle prenne toute la page utile.
- Transformer la barre de navigation du bas en barre **flottante** et **légèrement transparente**.

## Modifications appliquées

### Page Découvrir / Carte
- Ajout de la classe conditionnelle `discover-map-full-v176` lorsque l'onglet actif est **Carte**.
- La zone de carte utilise maintenant toute la hauteur disponible sous les onglets.
- Suppression des marges internes inutiles dans le contenu de la carte.
- Hauteurs adaptées pour ordinateur, tablette et téléphone.
- Sur mobile, la carte s'étend jusqu'au bas de l'écran, sous la barre flottante transparente.
- Les fenêtres flottantes de profils et le message d'aide sont repositionnés pour ne pas être cachés par la navigation basse.

### Barre basse mobile
- La barre n'est plus collée au bas et aux bords de l'écran.
- Elle devient flottante avec marges gauche/droite et bas.
- Ajout d'un fond translucide, léger flou arrière-plan et bordure rose discrète.
- Boutons rendus plus lisibles sur fond transparent.
- État actif conservé avec un dégradé rose discret.
- Gestion des safe areas iOS/Android conservée.

## Fichiers modifiés
- `frontend/src/App.jsx`
- `frontend/src/main.jsx`
- `frontend/src/responsive-fixes-v176.css`

## Validation technique
- `npm run build` : OK.
- `npm run check:backend-syntax` : OK.
- Configuration Railway PostgreSQL conservée.
- Adresse GitHub conservée : `https://github.com/lechartier61-alt/Voluptia.git`.

## Remarque
La barre basse flotte volontairement au-dessus du contenu. La carte reste visible derrière grâce à la transparence demandée.
