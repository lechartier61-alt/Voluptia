# Voluptia V137 — Autocomplétion ville et code postal

## Objectif
Quand une personne renseigne sa ville, Voluptia propose maintenant automatiquement des communes avec code postal, département et région.

## Ajouts frontend
- Champ `CityField` transformé en vrai champ d’autocomplétion.
- Recherche automatique après quelques caractères.
- Suggestions affichées sous le champ.
- Recherche possible par nom de ville : `Paris`, `Lyon`, `Marseille`.
- Recherche possible par code postal : `75000`, `69000`, `13000`.
- Sélection à la souris ou au clavier.
- Affichage du code postal et du département dans les propositions.
- Le champ reste propre : après sélection, la ville enregistrée reste le nom de la commune.

## Endroits concernés
- Inscription.
- Mon espace > Mon profil > Identité.
- Admin > Membres > création de compte.

## Ajouts backend
- Nouvelle route publique : `GET /api/geo/cities?q=...`
- Interrogation de l’API officielle `geo.api.gouv.fr/communes`.
- Résultats normalisés : ville, code postal, département, région, population, coordonnées approximatives.
- Fallback local si le service externe est indisponible.

## Variables d’environnement
Ajout dans `.env.example` et `.env.production.example` :

```env
DISABLE_CITY_SUGGESTIONS=false
```

Mettre `true` permet de désactiver les suggestions externes si besoin.

## Fichiers modifiés
- `frontend/src/App.jsx`
- `frontend/src/styles.css`
- `backend/src/app.js`
- `.env.example`
- `.env.production.example`

## Vérifications
- `npm run build` : OK
- `npm run check:backend-syntax` : OK
