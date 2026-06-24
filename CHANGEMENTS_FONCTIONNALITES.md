# Finalisation des fonctionnalités incomplètes

Ce document récapitule les trois stubs comblés et ce qu'il vous reste à faire.

## 1. Paiement Stripe Checkout — implémenté

### Ce qui a été fait
- **`POST /api/payments/create-checkout-session`** : crée une vraie session Stripe
  Checkout (montant ponctuel, pas d'abonnement récurrent). Remplace l'ancien stub `501`.
- **`POST /api/payments/webhook`** : nouvelle route, montée avec `express.raw()` AVANT
  le parser JSON (indispensable pour vérifier la signature sur le corps brut).
  - Vérifie la signature `Stripe-Signature` (HMAC SHA-256) via le module `crypto`,
    avec tolérance de 5 minutes contre le rejeu.
  - N'active l'abonnement QUE sur `checkout.session.completed` avec `payment_status = paid`.
  - Idempotent : un même `event.id` Stripe n'active jamais deux fois (champ `stripeEventId`).
- **Aucune dépendance npm ajoutée** : tout passe par `fetch` natif (Node 22) et `crypto`.
- **Frontend** : la page Abonnement redirige vers la page de paiement hébergée par Stripe
  (`startCheckout`) et gère le retour (`?paiement=succes` / `?paiement=annule`).
- **Sécurité** : l'accès n'est jamais activé côté `create-checkout-session`, uniquement
  après confirmation du webhook signé.

### Ce qu'il vous reste à faire
1. Créer un compte Stripe, récupérer `STRIPE_SECRET_KEY` (`sk_live_...` ou `sk_test_...`).
2. Dans Stripe → Developers → Webhooks, ajouter un endpoint :
   `https://VOTRE-DOMAINE/api/payments/webhook`, événement `checkout.session.completed`.
3. Copier le « Signing secret » (`whsec_...`) dans `STRIPE_WEBHOOK_SECRET`.
4. Renseigner `PUBLIC_BASE_URL` (ou `PAYMENT_SUCCESS_URL` / `PAYMENT_CANCEL_URL`).
5. Mettre `PAYMENT_PROVIDER=stripe`.
6. Test local : `stripe listen --forward-to localhost:4000/api/payments/webhook`.

## 2. Contrôle d'âge — déclaration + CGU

### Ce qui a été fait
- Mode retenu : déclaration de majorité obligatoire + acceptation des CGU et de la charte
  de consentement à l'inscription, avec traçabilité serveur (date, version légale, IP, user-agent).
- Statut mis à jour dans la checklist légale (« implemented »).
- Le crochet pour un prestataire de vérification renforcée reste disponible
  (`AGE_VERIFICATION_ENABLED=true` + `AGE_VERIFICATION_PROVIDER`) si besoin plus tard.

### Ce qu'il vous reste à faire
- Rien d'obligatoire. Optionnel : brancher un prestataire (Veriff, etc.) pour un contrôle
  renforcé conforme ARCOM si votre cadre juridique l'exige.

## 3. Mentions légales — texte type pré-rempli

### Ce qui a été fait
- `LEGAL_DOCUMENTS` (backend) et les pages légales publiques (frontend) ont été remplis
  avec un texte type complet : mentions légales, CGU/CGV, confidentialité, cookies,
  charte, conservation des médias, contact/signalement.
- Chaque donnée à confirmer est marquée `[À VALIDER : ...]`.

### Ce qu'il vous reste à faire
1. Remplacer tous les `[À VALIDER : ...]` par vos informations réelles (dénomination
   sociale, SIREN, hébergeur, email de support, etc.).
2. **Faire valider l'ensemble des textes par un professionnel du droit** avant ouverture
   au public. Les textes fournis sont un point de départ, pas un avis juridique.

## Vérifications effectuées
- `node --check` sur le backend : OK.
- Compilation du frontend (esbuild) : OK.
- Test unitaire de la signature webhook (valide / falsifiée / expirée / vide) : OK.
- Test bout-à-bout : inscription → création de session (appel Stripe réel confirmé) →
  webhook signé → activation de l'abonnement → idempotence du rejeu : OK.

## 4. Refonte du tuto utilisateur (onboarding)

### Bugs corrigés
- L'ancien tuto affichait un modal bloquant : cliquer sur une action naviguait mais
  laissait le modal par-dessus la page (déroutant). Désormais l'action emmène
  l'utilisateur sur la rubrique ET ferme le guide proprement.
- Aucun bouton « Précédent » : il est maintenant possible de revenir en arrière.
- Textes télégraphiques remplacés par un ton chaleureux et détendu, en phrases complètes.

### Nouveautés
- **Projecteur sur les éléments réels** : le guide met en surbrillance le vrai bouton
  de navigation concerné (effet « spotlight ») et assombrit le reste, avec une bulle
  explicative positionnée à côté.
- Repli automatique sur la barre de navigation du bas en affichage mobile.
- Navigation au clavier (flèches gauche/droite, Échap pour passer).
- Barre de progression claire (étape courante / faites / à venir).
- Respect de `prefers-reduced-motion` (animations désactivées si l'utilisateur le demande).
- Le guide reste relançable à tout moment via le bouton « Guide rapide » sur l'accueil.

### Vérifications
- Compilation frontend : OK.
- Rendu testé visuellement en desktop ET mobile (captures) : projecteur correctement
  positionné sur l'élément cible, bulle lisible, responsive fonctionnel.
- Audit des actions utilisateur : aucune option cassée (like, pass, suivre, bloquer,
  signaler, messages, chat instantané, albums privés, abonnement, support — toutes branchées).

## 5. Réorganisation de l'interface utilisateur (esprit épuré)

### Page d'accueil — refonte complète
L'ancienne page d'accueil comptait 13 sections et répétait l'information du profil
4 fois (héros, carte d'action, grande carte de setup, KPI). C'était surchargé.

Nouvelle structure, 4 zones aérées seulement :
1. **Carte de bienvenue unique** : salutation selon l'heure, profil et anneau de
   progression circulaire réunis (au lieu d'être éparpillés).
2. **Une seule action prioritaire** mise en avant, qui s'adapte à la situation
   (compléter le profil → activer Premium → lire les messages → découvrir).
3. **4 raccourcis clairs** avec badge de compteur uniquement quand il y a quelque
   chose à traiter (messages non lus, demandes d'album).
4. **Bas de page intelligent** : checklist du profil si incomplet, sinon suggestions
   de profils — jamais les deux en même temps.

Résultat : moins d'éléments, plus d'espace, un seul point de focus à la fois.
Le fichier App.jsx a légèrement diminué de taille malgré l'ajout de fonctionnalités.

### Mon espace
Déjà bien organisé en 4 sous-onglets (Profil, Premium, Paramètres, Sécurité) avec
sous-navigation claire : conservé tel quel.

### Vérifications
- Compilation : OK.
- Rendu testé visuellement (desktop) dans les deux états (profil complet et incomplet) :
  mise en page aérée, hiérarchie claire, responsive (2 colonnes sur mobile).

## 6. Profils professionnels / commerces sur une carte

Nouvelle fonctionnalité : l'admin peut créer des « lieux » (commerces) géolocalisés,
affichés sur une carte interactive accessible à tous les membres connectés.

### Côté admin (section « Lieux » dans le panneau d'administration)
- Formulaire de création : nom, type, adresse, description, téléphone, site web.
- 5 types : Club libertin, Sex-shop, Glory hole, Sauna / lieu de rencontre, Bar / autre.
- L'adresse est **géocodée automatiquement** en coordonnées via Nominatim (OpenStreetMap),
  réutilisant l'infrastructure de géocodage existante.
- Liste de tous les commerces, avec alerte visuelle si une adresse n'a pas pu être localisée,
  et boutons pour corriger l'adresse (re-géocodage) ou supprimer.

### Côté membre (sous-onglet « Lieux » dans Découvrir)
- Carte OpenStreetMap interactive (Leaflet chargé via CDN, sans clé API ni dépendance npm).
- Marqueurs par type avec icône, popup au clic.
- Filtres par type de commerce.
- Liste latérale synchronisée avec la carte : clic sur une fiche = centrage sur la carte.
- Lien « Itinéraire » (ouvre OpenStreetMap) et lien vers le site web du commerce.
- Seuls les commerces correctement géolocalisés sont affichés aux membres.

### Backend
- Nouvelle collection `venues` dans le store.
- Routes admin : GET/POST/PATCH/DELETE `/api/admin/venues` (protégées par requireAdmin).
- Route publique : GET `/api/venues` (membres connectés, filtrable par type).
- Fonction `geocodeAddress` pour convertir une adresse complète en coordonnées précises.

### Vérifications
- Backend : test bout-à-bout (création, géocodage, filtre liste publique excluant les
  non-localisés, liste admin complète, modification, suppression) : OK.
- Frontend : compilation OK, layout testé visuellement (carte + liste + filtres).
- Note : le géocodage et l'affichage de la carte nécessitent un accès réseau à
  OpenStreetMap/Nominatim, disponible en production (Railway) mais bloqué dans
  l'environnement de test — la logique a été validée indépendamment.

## 7. Refonte du panneau profil (fiche flottante dynamique)

Quand on clique sur un profil, un panneau flottant riche s'ouvre, adapté PC et mobile.

### Comportement
- **PC** : panneau latéral qui glisse depuis la droite.
- **Mobile** : plein écran qui monte depuis le bas.
- Fermeture par la croix, le clic à l'extérieur, ou la touche Échap.

### Actions disponibles (barre toujours visible en haut)
- **Coup de cœur** (♥) — état visuel « Aimé » si déjà fait.
- **Chat direct** (⚡) — n'apparaît QUE si la personne est en ligne et accepte le chat
  instantané ; ouvre directement la bulle de chat flottante sur le bon fil
  (via un événement, sans passer par le courrier).
- **Courrier** (✉) — ouvre une conversation classique.
- **Suivre** (+) — état « Suivi » si déjà abonné.

### Contenu dynamique
- Photo en en-tête, badge « En ligne », distance approximative.
- Statistiques (abonnés, médias, albums publics, coup de cœur réciproque).
- À propos, détails des personnes, centres d'intérêt, recherche.
- **Albums publics** de la personne, consultables.
- **Albums privés** de la personne, avec demande d'accès.
- **Mon album privé** : bouton pour donner à cette personne l'accès à votre propre album privé.
- Aperçu carte de la zone, bouton bloquer.
- Les sections vides sont masquées (affichage épuré).

### Technique
- Chat instantané déclenché par l'événement `voluptia-open-instant-chat`, écouté par
  la bulle FloatingInstantChat existante.
- Composant unifié (plus de double mode social/search incohérent).

### Vérifications
- Compilation : OK.
- Rendu testé visuellement en desktop (panneau latéral) ET mobile (plein écran) : OK.

## 8. Nettoyage des textes inutiles + accueil ultra-simple

### Textes retirés (invisibles d'intérêt pour l'utilisateur)
- Numéro de version affiché (« Administration V63 »).
- Étiquettes marketing/techniques au-dessus des titres : « Messagerie privée enrichie »,
  « Réseau privé » (x2), « Mon espace utilisateur », « Déblocage du site ».

### Page d'accueil refaite (version « juste l'essentiel »)
Remplace la version précédente par une page minimale :
- Un bonjour simple (avatar + salutation selon l'heure + une phrase de contexte).
- Une grande action unique mise en avant, qui s'adapte à la situation.
- 4 tuiles de navigation, avec badge de compteur seulement si utile.
- Les étapes de profil restantes sous forme de petits boutons, masqués une fois le profil complet.
- Plus d'anneau de pourcentage, plus de KPI, plus d'étiquettes techniques.

### Vérifications
- Compilation : OK.
- Rendu testé visuellement (profil complet et incomplet) : épuré, lisible, responsive.

## 9. Test avec comptes réels (admin + client) — correctif d'accès

Après création de comptes test, j'ai parcouru les parcours pour trouver les manques.
Voir le détail complet dans ANALYSE_COMPTES_TEST.md.

### Corrigé
- Les réglages sociaux (`/profile/social-preferences`) étaient bloqués sans abonnement
  alors qu'ils font partie de la configuration du compte. Désormais accessibles gratuitement.

### Vérifié conforme à la configuration souhaitée
- Compléter son profil (bio, photo, infos) : gratuit. ✓
- Interactions (coup de cœur, suivre, messages, recherche) : réservées aux abonnés. ✓
- Carte des lieux : réservée aux abonnés. ✓

### Manques identifiés (à décider) — détaillés dans ANALYSE_COMPTES_TEST.md
- Pas de récupération de mot de passe oublié (nécessite un service email).
- Pas de vérification d'email à l'inscription.
- Stratégie d'amorçage de la communauté à prévoir avant le paywall strict.

## 10. Suppression du compte admin de base + admin par email propriétaire

### Changement
- Plus de compte administrateur "de base" / seed créé au démarrage.
- L'accès admin est désormais accordé automatiquement au propriétaire : tout compte
  créé (ou existant) avec l'email défini dans OWNER_ADMIN_EMAILS devient admin.
- Configuré par défaut sur : admin@example.com

### Comment ça marche
- À l'inscription, si l'email correspond à OWNER_ADMIN_EMAILS, le compte est créé
  directement avec le rôle admin (profil vérifié).
- Si le compte existe déjà, il est promu admin au prochain démarrage du serveur.
- ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD laissés vides, DISABLE_BOOTSTRAP_ADMIN=true :
  aucun compte admin temporaire n'est généré.

### Configuration (variables d'environnement)
    OWNER_ADMIN_EMAILS=admin@example.com
    DISABLE_BOOTSTRAP_ADMIN=true
    ADMIN_EMAIL=            (vide)
    ADMIN_INITIAL_PASSWORD= (vide)

Sur Railway, définir OWNER_ADMIN_EMAILS dans les variables du service.

### Vérifications (test en conditions réelles)
- Inscription avec l'email propriétaire -> rôle admin immédiat. ✓
- Accès aux routes admin confirmé pour cet email. ✓
- Un email normal reste membre et se voit refuser l'accès admin. ✓
- Reconnexion de l'owner -> toujours admin. ✓
- Aucun compte admin de base créé. ✓

## 11. Système d'emails (Resend) : vérification + mot de passe oublié

### Fonctionnalités
- **Vérification d'email** : un email de confirmation est envoyé à l'inscription.
  Optionnelle pour les membres, mais elle conditionne l'accès admin du propriétaire.
- **Mot de passe oublié** : depuis la page de connexion, demande d'un lien de
  réinitialisation envoyé par email (lien valable 1 heure).
- **Pages dédiées** : /verifier-email et /reinitialiser-mot-de-passe (accessibles sans
  être connecté, via les liens reçus par email).

### Sécurité
- L'email propriétaire (admin) ne devient admin qu'APRÈS vérification de son adresse :
  empêche l'usurpation de l'accès admin.
- Jetons jamais stockés en clair (empreinte SHA-256), expiration (24h vérif, 1h reset).
- Réponse neutre sur « mot de passe oublié » (ne révèle pas si un compte existe).
- Réinitialisation invalide les sessions existantes du compte.

### Technique
- Envoi via l'API Resend en fetch natif (aucune dépendance npm ajoutée).
- Mode dégradé sans clé : les emails s'affichent dans les logs (dev/test sans coût).
- Configuration : RESEND_API_KEY + EMAIL_FROM (voir DEPLOIEMENT_RAILWAY.md).

### Vérifications (test bout-à-bout)
- Inscription owner -> reste membre. ✓
- Email de vérification généré. ✓
- Après vérification -> promotion admin automatique + accès panneau admin. ✓
- Accès admin refusé avant vérification (sécurité). ✓
- Mot de passe oublié -> réponse neutre. ✓
- Réinitialisation + reconnexion avec le nouveau mot de passe. ✓

## 12. Nettoyage visuel d'après captures (en-têtes encombrés)

D'après les captures fournies, plusieurs éléments faisaient "brouillon". Corrigé :
- **Doubles titres supprimés** : l'en-tête de chaque page (Découvrir, Médias, Messages,
  Mon espace) affiche désormais UN seul titre court, sans étiquette redondante ni
  long sous-titre ("Tinder, recherche, fil, suivis et lieux" -> "Découvrir").
- **Tuiles qui débordaient remplacées par des onglets compacts** : la sous-navigation
  est maintenant une rangée d'onglets type pilule (icône + nom), qui défile proprement
  au lieu de grandes cartes coupées sur le côté.
- **Sous-titres techniques retirés** ("Chat privé", "Vidéos publiques verticales",
  "Nouveautés publiques"...) : ils n'apportaient rien à l'utilisateur.
- **Gros bouton "Déconnexion" masqué sur mobile** : il encombrait la barre du haut avec
  la cloche et le menu. La déconnexion reste accessible dans le menu (burger).

Effet : des écrans plus aérés, un seul point de lecture par section, moins de jargon.

## 13. Densification de la page Messages (espace gâché / doublons)

- Supprimé le grand en-tête redondant "Messagerie instantanée" + les 3 compteurs
  (conversations / non lus / médias privés) : doublon avec le titre et les onglets.
- Retiré le label "Conversations" au-dessus de la recherche (répétait l'onglet).
- Liste de conversations densifiée : padding réduit, coins moins arrondis, espacement
  resserré, 3e ligne secondaire (ville • statut) masquée.
- Espacement vertical des pages "hub" resserré (16px -> 8px).
Résultat : on passe directement du titre aux onglets puis à la liste, sans bloc vide.
