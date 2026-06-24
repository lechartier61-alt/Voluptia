# Corrections V173 — Railway PostgreSQL

## Demande
L'application doit être préparée pour utiliser une base **PostgreSQL sur Railway**.

## Modifications appliquées

- Confirmation du mode PostgreSQL prioritaire : l'application utilise `DATABASE_URL` ou `POSTGRES_URL` dès que la variable est définie.
- Ajout de la variable `REQUIRE_DATABASE_URL=true` pour Railway : en production, l'application peut maintenant refuser de démarrer si PostgreSQL n'est pas configuré, afin d'éviter une bascule silencieuse vers SQLite/JSON éphémère.
- Mise à jour de `.env.production.example` pour Railway Postgres.
- Mise à jour de `.env.example` pour distinguer développement local SQLite et production Railway Postgres.
- Mise à jour de la documentation `DEPLOIEMENT_RAILWAY.md` avec les étapes PostgreSQL.

## Variables Railway recommandées

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REQUIRE_DATABASE_URL=true
DATA_DIR=/app/data
PUBLIC_BASE_URL=https://votre-domaine.up.railway.app
FRONTEND_ORIGIN=https://votre-domaine.up.railway.app
TRUST_PROXY=1
```

## Note importante
PostgreSQL stocke la base applicative. Si vous utilisez des uploads/médias stockés en fichiers dans `/app/data/uploads`, gardez aussi un volume Railway monté sur `/app/data`.
