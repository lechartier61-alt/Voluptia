# Déploiement : Railway (hébergement) + o2switch (domaine & email)

Ce guide explique comment mettre Voluptia en ligne sur **Railway**, avec le **domaine et
l'email gérés chez o2switch**.

---

## 1. Héberger l'application sur Railway

1. Créez un compte sur railway.app et un nouveau projet.
2. **Deploy from GitHub repo** → sélectionnez votre dépôt `Voluptia2345`.
   Railway détecte automatiquement le `Dockerfile` (et le fichier `railway.json` fourni).
3. **Ajoutez une base PostgreSQL** : dans le projet Railway → *New* → *Database* → *PostgreSQL*.
   Railway crée alors automatiquement la variable `DATABASE_URL`.
   > ⚠️ Indispensable : le disque de Railway est **éphémère**. Sans PostgreSQL, vos données
   > seraient effacées à chaque redéploiement. L'app bascule automatiquement sur PostgreSQL
   > dès que `DATABASE_URL` est présent (et gère sans souci le réseau interne `railway.internal`).
4. Railway attribue un `PORT` automatiquement : l'app l'utilise déjà, rien à faire.

---

## 2. Variables d'environnement à définir dans Railway

Dans le service → onglet **Variables**. (`DATABASE_URL` est déjà injecté par le plugin Postgres.)

```
NODE_ENV=production
FRONTEND_ORIGIN=https://votredomaine.fr
PUBLIC_BASE_URL=https://votredomaine.fr
TRUST_PROXY=1

# Compte admin (mot de passe FORT, >= 16 caractères)
OWNER_ADMIN_EMAILS=votre-email-reel@exemple.fr

# Connexion Google (optionnel) — VITE_GOOGLE_CLIENT_ID doit être présent AU BUILD
GOOGLE_CLIENT_ID=...
VITE_GOOGLE_CLIENT_ID=...

# Paiement Stripe (clés LIVE)
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
ENABLE_DEMO_PAID_ACTIVATION=false
SEED_WELCOME_PROMO=false

# Email via o2switch (voir section 4)
SMTP_HOST=mail.votredomaine.fr
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@votredomaine.fr
SMTP_PASS=le-mot-de-passe-de-la-boite
EMAIL_FROM=Voluptia <noreply@votredomaine.fr>
```

Après le déploiement, créez le **webhook Stripe** vers
`https://votredomaine.fr/api/payments/webhook` (événement `checkout.session.completed`)
et copiez le *Signing secret* dans `STRIPE_WEBHOOK_SECRET`.

---

## 3. Brancher le domaine o2switch sur Railway

Le **site** pointe vers Railway, mais l'**email reste chez o2switch** (ce sont des
enregistrements DNS différents : web = A/CNAME, email = MX).

1. Dans Railway : service → **Settings → Networking → Custom Domain** → saisissez votre
   domaine (ex. `votredomaine.fr` ou `www.votredomaine.fr`). Railway affiche une **cible CNAME**.
2. Dans o2switch : **cPanel → Éditeur de zone DNS** (Zone Editor) du domaine :
   - Pour un sous-domaine (recommandé, ex. `www`) : ajoutez un **CNAME**
     `www` → *cible fournie par Railway*.
   - Pour le domaine racine `votredomaine.fr` : si o2switch n'accepte pas de CNAME à la racine,
     utilisez le sous-domaine `www` + une redirection du domaine nu vers `www`, ou l'option
     de redirection o2switch.
3. **Ne touchez PAS aux enregistrements MX** : ils restent sur o2switch pour que vos emails
   continuent de fonctionner.
4. Mettez `FRONTEND_ORIGIN` et `PUBLIC_BASE_URL` sur l'URL finale (votre domaine).

---

## 4. Email avec o2switch (SMTP)

L'application sait désormais envoyer via **SMTP** (en plus de Resend). C'est l'idéal avec
o2switch, et la délivrabilité est bonne car SPF/DKIM sont déjà gérés par o2switch pour
votre domaine.

1. **cPanel o2switch → Comptes de messagerie** : créez `noreply@votredomaine.fr`.
2. Cliquez sur **Connecter les appareils** pour voir les réglages SMTP exacts
   (serveur sortant, port). En général :
   - `SMTP_HOST` = `mail.votredomaine.fr` (parfois un serveur o2switch type `xxx.o2switch.net`)
   - `SMTP_PORT` = `465`, `SMTP_SECURE=true` (SSL) — ou `587` avec `SMTP_SECURE=false` (STARTTLS)
   - `SMTP_USER` = l'adresse complète, `SMTP_PASS` = son mot de passe
3. Renseignez ces variables dans Railway (section 2). C'est tout — la vérification de compte
   et la réinitialisation de mot de passe partiront via o2switch.

> Priorité d'envoi dans le code : **SMTP** (si `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` présents),
> sinon **Resend** (`RESEND_API_KEY`), sinon **mode log** (affichage console, rien n'est envoyé).

---

## 5. Derniers points avant l'ouverture publique

- Mentions légales / CGU / RGPD à compléter (champs `[À VALIDER]`).
- Mot de passe admin fort, et activez le **2FA admin** (onglet Sécurité du panneau admin).
- `ENABLE_DEMO_PAID_ACTIVATION=false` (sinon abonnements gratuits possibles).
- Vérifiez que les emails partent réellement (faites un test de mot de passe oublié).
