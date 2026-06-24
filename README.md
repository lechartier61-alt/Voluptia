# Voluptia / L'Accord Secret

Projet nettoyé pour déploiement : frontend Vite/React, backend Express, Docker et Railway.

## Commandes utiles

```bash
npm install
npm run dev:frontend
npm run dev:backend
npm run build
npm run start
```

## Configuration

Copiez `.env.example` ou `.env.production.example` vers `.env` en local, puis renseignez les valeurs privées.
Le fichier `.env` réel n'est pas inclus volontairement.

## Base de données

- Local : SQLite peut servir pour les essais rapides.
- Production Railway : utiliser PostgreSQL via `DATABASE_URL`.

Variables Railway recommandées :

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REQUIRE_DATABASE_URL=true
DATA_DIR=/app/data
```

`REQUIRE_DATABASE_URL=true` empêche un démarrage accidentel sur SQLite/JSON éphémère en production.

## Déploiement Railway

Voir `DEPLOIEMENT_RAILWAY.md`.

## Compte administrateur

Le mode recommandé est d'utiliser `OWNER_ADMIN_EMAILS` : le compte devient administrateur après inscription et confirmation de l'adresse email.

```env
OWNER_ADMIN_EMAILS=votre-email-admin@votredomaine.fr
DISABLE_BOOTSTRAP_ADMIN=true
```

Ne versionnez jamais les secrets Railway, Stripe, SMTP ou administrateur.

## V174 — Corrections mobiles

Cette version ajoute les corrections responsive demandées après les captures d’écran : page Découvrir/Recherche sans débordement sur téléphone et barre de sauvegarde du profil remise dans le flux pour ne plus masquer les champs. Voir `CORRECTIONS_V174_BUGS_MOBILE.md`.
