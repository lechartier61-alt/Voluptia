# Audit complet de l’application Voluptia

**Projet analysé :** `volyptia_v2` — version 0.47.0  
**Date :** 18 juin 2026  
**Portée :** frontend React/Vite, backend Express, persistance, sécurité, responsive, PWA, conformité et maintenabilité.

## 1. Méthode et limites

L’audit comprend :

- lecture complète de l’arborescence et des composants principaux ;
- analyse des routes et fonctionnalités utilisateur/admin ;
- compilation de production ;
- vérification syntaxique du backend ;
- audit npm des dépendances de production ;
- inspection des règles CSS et des points de rupture responsive ;
- essais d’exécution représentatifs sur ordinateur et téléphone ;
- comparaison avec les captures fournies par le propriétaire.

Il ne s’agit pas encore d’une recette exhaustive sur chaque modèle physique de téléphone/tablette. Cette recette doit être effectuée **après** les corrections, sur une matrice de tailles définie dans la section 10.

---

## 2. Résumé exécutif

L’application est fonctionnellement riche et possède déjà plusieurs protections sérieuses : Helmet/CSP, CORS contrôlé, limitation de débit, mots de passe scrypt, sessions stockées sous forme d’empreinte, 2FA administrateur, signatures de webhooks et validation des types de médias.

La compilation fonctionne et l’audit npm de production ne remonte aucune vulnérabilité connue. En revanche, la mise en production publique doit être différée jusqu’à correction des points bloquants suivants :

1. chevauchement du profil sur mobile causé par deux barres `sticky` empilées ;
2. blocs d’introduction à supprimer sur la carte et la messagerie ;
3. mentions légales et coordonnées officielles encore incomplètes ;
4. promesse « messagerie chiffrée » non démontrée par l’implémentation ;
5. base SQLite contenant des données de compte incluse dans l’archive ;
6. PWA verrouillée en orientation portrait malgré l’objectif de prise en charge paysage ;
7. dette CSS et architecture monolithique favorisant les régressions responsive.

---

## 3. Vérifications automatiques

| Contrôle | Résultat |
|---|---|
| Build Vite de production | Réussi |
| Syntaxe backend Node | Réussie |
| Audit npm production | 0 vulnérabilité connue |
| Bundle JavaScript principal | 531,71 kB minifié, 143,26 kB gzip |
| CSS principal | 441,41 kB minifié, 82,20 kB gzip |
| Avertissement Vite | Chunk JavaScript supérieur à 500 kB |

Le frontend ne contient que 27 modules transformés, car la majorité de l’interface est regroupée dans un seul très grand composant.

---

## 4. Corrections demandées et confirmées

### 4.1 Carte des membres

Supprimer entièrement le bloc `.member-map-hero-v114`, qui contient :

- « Carte des membres » ;
- « Profils regroupés par ville » ;
- le texte d’explication ;
- les compteurs profils/villes/moi.

La carte, les marqueurs et la fenêtre de profils par ville doivent rester.

### 4.2 Messagerie

Supprimer entièrement le bloc `.messages-hero-v121`, qui contient :

- « Messagerie privée » ;
- « Conversations » ;
- le texte d’introduction ;
- les compteurs conversations/non lus/en ligne.

Le hub Messages possède déjà son propre en-tête. Le bloc actuel crée donc une répétition et consomme trop de hauteur, surtout sur mobile.

### 4.3 Profil social sur mobile

Le bug visible dans la capture est confirmé dans le code :

- `.profile-action-row-v116` est `position: sticky` ;
- `.profile-tabs-v116` est également `position: sticky` ;
- leurs valeurs `top` les empilent sous la barre supérieure ;
- le contenu défile derrière ces deux zones et devient masqué.

Correction recommandée : sur téléphone et tablette compacte, replacer ces deux zones dans le flux normal (`position: static`) ou conserver une seule barre réellement fixe, compacte, avec un espace de compensation calculé. La première option est la plus robuste.

---

## 5. Problèmes bloquants — priorité P0

### P0-1 — Contenu légal incomplet

Les pages publiques contiennent encore des champs tels que :

- dénomination sociale ;
- forme juridique et capital ;
- RCS/SIREN ;
- siège social ;
- directeur de publication ;
- hébergeur ;
- email officiel du support ;
- formulation de rétractation à faire valider.

Ces champs doivent être complétés et validés avant ouverture publique.

### P0-2 — Promesses de chiffrement à corriger

Le HTML public annonce « messagerie chiffrée » et la landing page annonce « données chiffrées ». Le code examiné montre :

- mots de passe correctement **hachés** avec scrypt ;
- transport pouvant être protégé par HTTPS en production ;
- aucun chiffrement applicatif de bout en bout des messages ;
- aucun chiffrement applicatif au repos des conversations visible dans le code.

Il faut soit implémenter réellement la propriété annoncée, soit remplacer ces textes par une formulation exacte, par exemple « connexion sécurisée par HTTPS » et « mots de passe hachés ».

### P0-3 — Données embarquées dans l’archive

Le dossier fourni contient une base `data/laccord_secret.sqlite` et ses fichiers WAL/SHM. L’état embarqué comprend au moins un profil et un utilisateur d’authentification. Même s’il s’agit d’un compte de test, une base active ne doit pas être incluse dans une archive de source ou une image de déploiement.

Le `.gitignore` et le `.dockerignore` excluent déjà `data/`, ce qui est positif. Il faut également nettoyer les archives remises ou sauvegardées manuellement.

### P0-4 — Orientation paysage bloquée dans la PWA

Le manifeste contient :

```json
"orientation": "portrait-primary"
```

Une application installée peut donc rester verrouillée en portrait. Cette règle est incompatible avec la demande de fonctionnement téléphone/tablette en portrait **et** paysage. Il faut supprimer cette propriété ou utiliser `any`.

### P0-5 — Vérification d’âge renforcée non activée par défaut

La configuration de production proposée conserve `AGE_VERIFICATION_ENABLED=false`. Le contrôle est alors une déclaration de majorité et une acceptation légale, pas une vérification documentaire par prestataire. La communication « profils vérifiés » doit préciser ce qui est réellement vérifié, et la stratégie de contrôle d’âge doit être validée juridiquement et opérationnellement.

---

## 6. Problèmes importants — priorité P1

### P1-1 — Architecture frontend monolithique

- `frontend/src/App.jsx` : environ 9 092 lignes ;
- `backend/src/app.js` : environ 8 270 lignes ;
- CSS applicatif : environ 600 kB de source ;
- 156 blocs `@media` ;
- environ 1 847 usages de `!important`.

Cette structure rend les corrections locales risquées : une règle ajoutée à la fin peut casser une autre page ou un autre format. Il faut découper par page/fonctionnalité et centraliser les tokens et breakpoints.

### P1-2 — Bundle trop gros

Le bundle principal dépasse le seuil Vite de 500 kB. Les pages Admin, Toktak, carte Leaflet, profils et messagerie doivent être chargées par découpage dynamique lorsque nécessaire.

### P1-3 — Police Admin bloquée par la CSP

`admin-redesign-v160.css` importe Fraunces depuis Google Fonts, mais la CSP n’autorise que les styles de même origine. Le navigateur bloque donc l’import.

Solution préférée : retirer l’import distant et utiliser une police locale ou une pile système. Une modification de CSP est possible, mais moins favorable à la confidentialité.

### P1-4 — Bandeau cookies trop envahissant sur petit écran

Sur 390 px, le bandeau occupe une grande partie de la hauteur et recouvre le contenu ainsi que la navigation inférieure. Les trois boutons restent sur une ligne flexible et deviennent serrés.

Correction : empiler les boutons sous environ 420 px, limiter la hauteur du panneau, rendre son contenu interne défilable et tenir compte de la barre de navigation de l’application.

### P1-5 — Navigation secondaire mobile peu explicite

Plusieurs hubs utilisent une rangée horizontale dont les onglets suivants sont partiellement coupés. Le défilement existe ou est attendu, mais il n’est pas visuellement évident. Ajouter un indicateur de débordement, un snap horizontal ou une disposition plus compacte.

### P1-6 — Jeton de session dans `localStorage`

Le jeton Bearer est stocké dans `localStorage`. Cela fonctionne, mais tout XSS ayant lieu dans l’origine pourrait le lire. Pour une plateforme traitant des données intimes, une session via cookie `HttpOnly`, `Secure`, `SameSite` est préférable.

### P1-7 — Médias envoyés en JSON/base64

Les limites configurées atteignent 12 MB pour les messages et 38 MB pour les albums. Le base64 augmente la taille et la mémoire utilisée. À terme, préférer des uploads multipart/streaming vers un stockage objet, avec analyse et quotas.

### P1-8 — Absence de tests automatisés

Aucun script Vitest/Jest/Playwright/Cypress n’est présent. Il manque au minimum :

- tests API auth, permissions, blocage et paiements ;
- tests de composants critiques ;
- parcours E2E inscription/connexion/recherche/message/profil ;
- tests visuels responsive ;
- tests de non-régression des rôles admin/membre.

### P1-9 — Purge des médias supprimés manuelle

La documentation prévoit une conservation maximale de six mois, mais la purge est lancée manuellement depuis l’administration. Une tâche planifiée, vérifiable et journalisée est nécessaire pour garantir que la politique annoncée est réellement appliquée.

---

## 7. Points à améliorer — priorité P2

- Remplacer le mot de passe administrateur de développement codé en dur par une variable obligatoire ou un secret généré uniquement au démarrage local.
- Remplacer toute adresse personnelle réelle dans les fichiers `.env.*.example` par un exemple neutre.
- Ajouter un véritable piège de focus et un retour du focus pour les fenêtres modales.
- Vérifier systématiquement les libellés accessibles de tous les boutons uniquement iconographiques.
- Ajouter `prefers-reduced-motion` aux animations lourdes.
- Charger les images avec dimensions réservées pour limiter les déplacements de mise en page.
- Harmoniser les messages d’erreur et les états vides.
- Revoir les anciennes classes suffixées `v28`, `v47`, `v116`, etc., qui s’empilent au fil des versions.
- Ajouter une stratégie centralisée de journalisation et de suivi d’erreurs frontend/backend.
- Mettre en place sauvegardes, restauration testée et rotation des journaux en production.

---

## 8. Analyse page par page

| Zone | État observé | Action principale |
|---|---|---|
| Landing / inscription / connexion | Structure complète | Tester clavier mobile, erreurs, Google OAuth, âge et textes juridiques |
| Pages légales | Accessibles | Compléter tous les champs officiels et faire valider |
| Accueil membre | Globalement lisible | Vérifier cartes et bandeau cookies à 320–390 px |
| Découvrir — Carte | Fonctionnelle | Supprimer le hero demandé ; tester bottom sheet et rotation |
| Découvrir — Recherche | Fonctionnelle mais dense | Simplifier filtres sur mobile, tester très petits écrans et clavier |
| Découvrir — Lieux | À valider avec données réelles | Tester carte/liste, chargement et états d’erreur |
| Découvrir — Événements | À valider avec données réelles | Tester formulaires, images et longues descriptions |
| Médias — Toktak | Interface lourde | Tester hauteur dynamique, clavier, rotation et vidéos lentes |
| Médias — Albums | Fonctionnelle | Tester grilles 2/3/4 colonnes et médias privés |
| Messages — Conversations | Duplication d’en-tête | Supprimer `.messages-hero-v121`, compacter la page mobile |
| Messages — Groupes | Présent | Tester création, départ, droits et clavier mobile |
| Messages — Alertes | Présent | Vérifier lecture de masse et longues listes |
| Messages — Interactions | Présent | Vérifier cartes et actions sur 320 px |
| Profil social modal | Bug confirmé | Supprimer le double sticky mobile et vérifier tout le défilement |
| Mon profil | Formulaire très long | Découper en sections, sauvegarde et erreurs visibles |
| Abonnement | Branché à Stripe | Tester webhook, retours succès/annulation et doubles clics |
| Paramètres / confidentialité | Présents | Tester suppression, blocage, préférences et support |
| Admin | Fonctionnellement riche | Corriger police CSP, tester tableaux et actions destructives |
| PWA / installation | Présente | Déverrouiller paysage, tester mise à jour du service worker |

---

## 9. Ce qui est déjà bien réalisé

- mots de passe scrypt avec comparaison constante ;
- jetons de session stockés sous forme d’empreinte côté serveur ;
- limitation des échecs de connexion et verrouillage temporaire ;
- 2FA TOTP et codes de secours pour l’administration ;
- Helmet, HSTS en production, CSP et protection `frame-ancestors` ;
- CORS limité aux origines autorisées ;
- vérification de signature Stripe ;
- contrôle des magic bytes des images/vidéos ;
- limites de taille et restriction des extensions ;
- séparation des rôles et middleware administrateur ;
- endpoints de santé limitant les détails en production ;
- carte basée sur une ville approximative plutôt qu’une adresse exacte ;
- pages de confidentialité, consentement et conservation déjà structurées ;
- fichier de production et Docker qui excluent normalement les bases et secrets.

---

## 10. Matrice responsive de recette

Après correction, chaque page doit être contrôlée au minimum sur les dimensions suivantes :

### Téléphones portrait

- 320 × 568
- 360 × 640
- 375 × 667
- 390 × 844
- 412 × 915
- 430 × 932

### Téléphones paysage

- 568 × 320
- 667 × 375
- 844 × 390
- 915 × 412

### Tablettes

- 600 × 960
- 768 × 1024
- 820 × 1180
- 1024 × 768
- 1180 × 820

### Ordinateurs

- 1024 × 768
- 1280 × 720
- 1366 × 768
- 1440 × 900
- 1920 × 1080

### Critères d’acceptation

- aucun chevauchement ;
- aucun défilement horizontal involontaire ;
- aucun texte ou bouton coupé ;
- aucune zone fixe masquant du contenu ;
- cibles tactiles d’environ 44 px minimum ;
- navigation utilisable au clavier ;
- modales entièrement accessibles et fermables ;
- clavier virtuel ne masquant pas le champ actif ;
- prise en compte des safe areas iOS/Android ;
- portrait et paysage fonctionnels ;
- longues chaînes, données vides et données très nombreuses testées.

---

## 11. Ordre de correction recommandé

1. Supprimer les deux blocs demandés.
2. Corriger le profil mobile et toutes les barres `sticky/fixed` similaires.
3. Déverrouiller le paysage dans le manifeste.
4. Corriger le bandeau cookies et les sous-navigations mobiles.
5. Compléter les mentions légales et rectifier les promesses de sécurité.
6. Nettoyer les données/secrets des archives et exemples d’environnement.
7. Corriger la police Admin bloquée par CSP.
8. Ajouter les tests E2E responsive et API.
9. Découper `App.jsx`, `app.js` et les feuilles CSS.
10. Optimiser le bundle, les médias et la persistance.

---

## 12. Conclusion

La base est exploitable et la compilation est saine, mais l’application n’est pas encore prête pour une ouverture publique sans réserve. Les corrections visuelles demandées sont précises et relativement localisées. Les sujets légaux, les promesses de chiffrement, la gestion des données sensibles et la recette responsive complète doivent être traités comme des conditions de lancement.
