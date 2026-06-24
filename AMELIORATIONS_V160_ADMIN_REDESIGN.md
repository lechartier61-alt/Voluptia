# V160 — Refonte du panneau admin + Vue membre

## Frontend
- `frontend/src/admin-redesign-v160.css` (NOUVEAU) : thème "velvet midnight", onglets flottants
  (barre de pilules collante avec pilule active lumineuse ; sur mobile, barre défilante).
  Styles limités à `.vadm` : le reste de l'app n'est pas affecté.
- `frontend/src/main.jsx` : import de la nouvelle feuille de style (en dernier).
- `frontend/src/App.jsx` :
  - Section "Vue membre" ajoutée (composants `ViewAsMember` + `ProfileFullView`).
    L'admin parcourt tous les profils et consulte leurs albums, y compris privés,
    dans un visualiseur plein écran.
  - Barre de sections transformée en onglets flottants (`.vadm-tabbar` / `.vadm-tab`).
  - Classe `vadm` ajoutée à la racine du panneau admin.

## Backend (backend/src/app.js)
- `canViewAlbum` : un administrateur peut désormais consulter tous les albums
  (y compris privés) — pour la modération (`isAdminProfileId`).
- `GET /api/profiles/:id` : en supervision admin, la consultation n'est pas comptée
  comme une vue et ne notifie pas le membre.

## Aperçu
- `admin-redesign-preview.html` (racine) : maquette autonome cliquable de la refonte.

## Note
La consultation d'un album privé par un admin n'est pas encore journalisée côté serveur
(les requêtes GET ne passent pas par le journal d'audit). Recommandé en évolution.

## V161 — Albums par défaut à la création de profil
- `createProfileAlbums` (backend) : un nouveau profil n'a plus d'albums de démo.
  Il reçoit uniquement un album public vide intitulé "Photo de profil".
- Vérifié par test fonctionnel : la création d'albums publics ET privés fonctionne
  (endpoint POST /api/albums, sans limite de nombre).
- À noter (comportement existant) : créer un album nécessite un abonnement actif.
  Les inscrits gratuits sont en lecture seule (paywall `requireSubscriptionOrLimitedAccess`).

## V162 — Mode d'essai gratuit (freemium)
Backend (backend/src/app.js) :
- `freeTierStatus()` : calcule les profils restants sur la fenêtre glissante.
  Réglable via FREE_PROFILE_VIEW_LIMIT (défaut 3) et FREE_PROFILE_VIEW_WINDOW_HOURS (défaut 48).
- `GET /api/profiles/:id` : un non-abonné peut ouvrir au maximum 3 profils / 48 h
  (revisiter un profil déjà vu ne compte pas). Au-delà : 402 free_quota_reached.
- Middleware paywall : les non-abonnés peuvent LIRE leurs conversations et messages
  (GET /conversations, GET /conversations/:id/messages) mais l'ENVOI reste bloqué (402).
- `/bootstrap` expose `freeTier` (used, remaining, windowHours, canSendMessages).

Frontend (frontend/src/App.jsx) :
- FREE_TABS inclut désormais « Découvrir » et « Messages » (accès en lecture).
- Bannière d'essai au-dessus de Découvrir/Messages (profils restants + lien S'abonner).
- Composer de réponse remplacé par un encart « Lecture seule » pour les non-abonnés.

Tests fonctionnels passés : 3 profils OK puis 4e bloqué (402), revisite OK,
lecture messages OK, envoi bloqué (402), statut freeTier correct.

Note : le composer de messages de GROUPE n'est pas désactivé visuellement (le backend
bloque tout de même l'envoi avec un 402). Surface mineure, à fignoler si besoin.

## V163 — Ajustements mode d'essai
- Limite portée à 4 profils / 48 h (FREE_PROFILE_VIEW_LIMIT défaut = 4).
- Albums : un non-abonné ne voit QUE la couverture (titre + photo + nombre de médias) ;
  les médias sont masqués côté serveur (serializeAlbum -> coverOnly, items vidés).
  Le propriétaire et l'admin voient toujours le contenu complet.
- Une fois la limite atteinte, plus AUCUNE consultation, même des profils déjà vus
  (suppression de la reconsultation gratuite).
- Frontend : AlbumCard et SocialAlbumPreview affichent un verrou « Abonnez-vous » sur coverOnly.
Tests fonctionnels passés (couverture seule, 4 puis blocage, pas de reconsultation, propriétaire OK).

## V165 — Durcissement sécurité (suite à l'audit)
1. Journalisation des consultations admin de profils (GET /api/profiles/:id par un admin
   = accès aux albums privés en supervision) -> tracée dans audit_logs ("GET (consultation admin)").
2. Suppression du repli "mot de passe en clair" dans verifyPassword : seules les
   empreintes scrypt sont acceptées.
3. Champ piège anti-bot (honeypot "company") à l'inscription : un robot qui le remplit
   est rejeté (400), invisible et sans effet pour un humain.
4. CORRECTION d'un bug préexistant : l'endpoint /api/admin/audit-logs lisait persistence._db
   qui n'était pas exposé -> le visualiseur d'audit renvoyait toujours vide. Le handle DB
   est maintenant exposé, les journaux s'affichent.

Tous testés en conditions réelles (honeypot, login scrypt, consultation admin journalisée et visible).

Rappel : 2FA admin et chiffrement des médias au repos nécessitent une infra/un flux dédiés
(prestataire TOTP, stockage objet chiffré) — non inclus, à planifier séparément.

## V166 — Double authentification (2FA) pour les admins
Dépendances ajoutées : otplib@^12 (TOTP) + qrcode@^1.5 (QR code). Installées via npm ci au déploiement.

Backend (backend/src/app.js) :
- TOTP standard (compatible Google Authenticator / Authy / 1Password).
- POST /api/admin/2fa/setup : génère un secret + QR code (otpauth) — pas encore activé.
- POST /api/admin/2fa/enable : confirme avec un code, active, renvoie 8 codes de secours (hachés en scrypt).
- POST /api/admin/2fa/disable : désactive après vérification d'un code (TOTP ou code de secours).
- POST /api/admin/2fa/backup-codes : régénère les codes de secours.
- GET /api/admin/2fa/status : état (activé, codes restants).
- Connexion : si le 2FA est activé, /api/auth/login renvoie { twoFactorRequired, challengeToken }
  au lieu d'une session ; POST /api/auth/2fa/verify { challengeToken, code } délivre la session.
- Défis de connexion en mémoire (TTL 5 min). Endpoint de vérification limité par authLimiter.
- Le secret et les codes de secours ne sont jamais renvoyés au client (sérialisation explicite).

Frontend (frontend/src/App.jsx) :
- Connexion : étape de saisie du code à 6 chiffres (ou code de secours) quand le 2FA est requis.
- Panneau admin : nouvel onglet « Sécurité » -> activer/désactiver le 2FA, scanner le QR code,
  afficher/régénérer les codes de secours.

Tests fonctionnels passés (9/9) : setup, activation, login exigeant le 2FA, mauvais code rejeté (401),
bon code TOTP accepté, code de secours à usage unique, désactivation, retour au login normal.

Note : les défis de connexion sont en mémoire — en cas de déploiement multi-instances, prévoir
un stockage partagé (ex. base) ; pour une instance unique (cas actuel), aucun impact.

## V167 — Email SMTP (o2switch) + déploiement Railway
- Dépendance ajoutée : nodemailer (^9). Installée via npm ci au déploiement.
- sendEmail() supporte maintenant le SMTP (o2switch) EN PLUS de Resend :
  priorité SMTP (si SMTP_HOST/SMTP_USER/SMTP_PASS) -> sinon Resend -> sinon mode log.
  Variables : SMTP_HOST, SMTP_PORT (465 SSL / 587 STARTTLS), SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM.
  Testé : avec SMTP défini, l'envoi passe bien par SMTP (et non plus par le mode log).
- railway.json ajouté (build Dockerfile + healthcheck /api/health).
- DEPLOIEMENT_RAILWAY_O2SWITCH.md : guide complet (Railway + Postgres, variables,
  domaine o2switch via CNAME en gardant les MX chez o2switch, email SMTP).
- .env.production.example : section emails mise à jour (option SMTP o2switch + Resend).

Rappel : l'app utilise déjà PostgreSQL si DATABASE_URL est défini (le code gère le réseau
interne railway.internal sans SSL), et la CSP autorise déjà les domaines railway.app.
Sur Railway, AJOUTER un service PostgreSQL est indispensable (disque éphémère).

## V168 — Email de confirmation/reçu d'abonnement
- Nouveau gabarit sendSubscriptionEmail (style cohérent : carte sombre, accents rose, reçu en tableau).
- Envoyé automatiquement à l'activation d'un abonnement (point unique grantSubscriptionFromQuote,
  donc couvre le webhook Stripe ET l'activation démo). Best-effort : n'interrompt jamais l'activation.
- Contenu : remerciement personnalisé (pseudo) + reçu (formule, montant, code promo éventuel,
  date de début, date d'échéance, référence d'achat). Affiche "Offert" pour les mois gratuits.
- Sert à la fois de remerciement ET de reçu/facture (un seul email plutôt que deux).
Testé : déclenché à l'activation, nom de plan/montant/échéance/référence corrects.

### État des emails automatiques (récapitulatif)
- Vérification d'adresse / bienvenue : OUI (à l'inscription) — bouton "Confirmer mon email".
- Réinitialisation de mot de passe : OUI — lien valable 1 h.
- Confirmation + reçu d'abonnement : OUI (ajouté en V168).
Tous utilisent le gabarit HTML emailLayout (thème sombre + rose Voluptia).

## V169 — Correctif : champ âge qui se remettait tout seul à 28
Problème signalé : sur l'inscription, vider le champ "Âge" d'une personne (ex. 28) le
remettait immédiatement à 28 -> impossible de le modifier.
Cause : normalizeMembersForForm() recalculait l'âge à chaque rendu avec `age || 28`,
ce qui retransformait une valeur vide en 28.
Correctif (frontend/src/App.jsx) :
- normalizeMembersForForm : `age: member.age === '' ? '' : (member.age || baseAge || 28)`
  -> on préserve le champ vide pendant la saisie (effaçable), tout en gardant 28 par défaut
  pour un nouveau membre.
- Robustesse à l'envoi : l'âge d'un membre laissé vide est remplacé par l'âge du profil,
  sinon 18 (inscription ET édition de profil) -> jamais d'âge vide/0 envoyé.
Vérifié partout : le seul vrai "retour automatique" était l'âge des membres. Les autres
champs numériques (âge du profil, prix, filtres âge, âge admin) stockent la valeur brute
et étaient déjà effaçables. Logique testée (vide préservé, défaut 28, repli 18 à l'envoi).

## V170 — Refonte page Recherche + retrait de l'onglet Médias
- Barre du bas : l'onglet "Médias" est retiré (USER_NAV_SECTIONS). Les vidéos déménagent
  dans la Recherche. Raccourci d'accueil "Médias" -> "Vidéos" (vers la Recherche).
- Page Recherche refondue (comme la capture fournie) :
  - Barre de recherche épurée "Pseudo" + chevron + bascule cartes/liste.
  - Onglets "Profils" / "Vidéos" (Vidéos = ToktakFeed des vidéos publiées sur les profils).
  - Le chevron ouvre un panneau de FILTRES FLOTTANT (overlay) au lieu des filtres toujours visibles.
  - Résultats en pleine largeur.
- Vidéos branchées : data.videoFeed -> DiscoverHub -> SearchPage -> ToktakFeed (+ callbacks like/vue/partage/commentaires).
- Nouveau CSS scoped : frontend/src/search-redesign-v170.css (importé dans main.jsx).
- MediaHub reste accessible via l'URL /medias (non cassé), mais hors navigation.
Build OK. À TESTER visuellement sur appareil (ajustements couleurs/espacements possibles).
Note : la page "Albums" du hub Médias n'est plus dans la navigation (les albums restent
accessibles depuis chaque profil). À rajouter ailleurs si souhaité.
