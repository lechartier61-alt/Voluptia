# Déploiement sur Railway avec PostgreSQL

Le code est compatible Railway : il lit `process.env.PORT` et écoute sur `0.0.0.0`.
La base recommandée en production est **PostgreSQL Railway** via la variable `DATABASE_URL`.

## 1. Ajouter PostgreSQL dans Railway

1. Ouvrez votre projet Railway.
2. Ajoutez un service **PostgreSQL** dans le même projet que l'application.
3. Attendez que la base soit déployée.

## 2. Relier l'application à PostgreSQL

Dans le service web de l'application → **Variables**, ajoutez :

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REQUIRE_DATABASE_URL=true
```

`DATABASE_URL` est prioritaire dans le code. Si elle existe, l'application utilise PostgreSQL au lieu de SQLite.
`REQUIRE_DATABASE_URL=true` évite une erreur dangereuse : si la variable PostgreSQL est absente ou invalide, l'application s'arrête au lieu de basculer silencieusement vers SQLite/JSON.

## 3. Variables d'environnement principales

Dans le service Railway → **Variables**, ajoutez ou vérifiez :

```env
NODE_ENV=production
TRUST_PROXY=1
DATA_DIR=/app/data
DATABASE_URL=${{Postgres.DATABASE_URL}}
REQUIRE_DATABASE_URL=true
PUBLIC_BASE_URL=https://votre-domaine.up.railway.app
FRONTEND_ORIGIN=https://votre-domaine.up.railway.app
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYMENT_CURRENCY=eur
OWNER_ADMIN_EMAILS=votre-email-admin@votredomaine.fr
DISABLE_BOOTSTRAP_ADMIN=true
PUBLIC_PRODUCTION_HEALTH=false
```

Ne mettez jamais les secrets dans le code ni dans les fichiers `.env.*` poussés sur Git. Railway les injecte au démarrage.

## 4. Volume Railway pour les médias

PostgreSQL stocke la base principale. En revanche, certains médias/uploads peuvent utiliser `/app/data/uploads`.
Pour éviter la perte des fichiers après redéploiement :

1. Service Railway → **Volumes** → **New Volume**.
2. Montez-le sur : `/app/data`.
3. Gardez `DATA_DIR=/app/data`.

Si vous n'utilisez aucun upload fichier local, PostgreSQL suffit pour la base. Le volume reste recommandé par sécurité.

## 5. Domaine public

1. Service → **Settings → Networking → Generate Domain**.
2. Reportez l'URL dans :

```env
PUBLIC_BASE_URL=https://votre-domaine.up.railway.app
FRONTEND_ORIGIN=https://votre-domaine.up.railway.app
```

## 6. Webhook Stripe

1. Dashboard Stripe → **Developers → Webhooks → Add endpoint**.
2. URL : `https://votre-domaine.up.railway.app/api/payments/webhook`
3. Événement à écouter : `checkout.session.completed`.
4. Copiez le signing secret `whsec_...` dans `STRIPE_WEBHOOK_SECRET` sur Railway.

## 7. Première connexion admin

Le fonctionnement recommandé est :

1. Configurez `OWNER_ADMIN_EMAILS=votre-email-admin@votredomaine.fr`.
2. Inscrivez-vous normalement avec cette adresse.
3. Confirmez l'adresse email.
4. Le compte devient administrateur après confirmation.

Laissez ces variables vides sauf besoin précis :

```env
ADMIN_EMAIL=
ADMIN_INITIAL_PASSWORD=
OWNER_ADMIN_INITIAL_PASSWORD=
ADMIN_BOOTSTRAP_EMAIL=
```

## 8. Emails

Sans configuration email, l'application fonctionne en mode log : les emails sont affichés dans les logs mais ne sont pas envoyés.

### Option SMTP o2switch

```env
SMTP_HOST=mail.votredomaine.fr
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@votredomaine.fr
SMTP_PASS=mot-de-passe-mail
EMAIL_FROM=Voluptia <noreply@votredomaine.fr>
```

### Option Resend

```env
RESEND_API_KEY=re_...
EMAIL_FROM=Voluptia <noreply@votredomaine.fr>
```

## 9. Vérification après déploiement

Après redéploiement, ouvrez :

```text
https://votre-domaine.up.railway.app/api/health
```

En production, le détail public est volontairement limité si `PUBLIC_PRODUCTION_HEALTH=false`.
Pour vérifier côté logs, recherchez :

```text
[persistence] PostgreSQL connecté
```

Cela confirme que l'application utilise bien PostgreSQL.
