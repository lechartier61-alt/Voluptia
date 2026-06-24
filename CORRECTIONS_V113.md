# Corrections v113 — Voluptia

## Corrections fonctionnelles

- Carte des lieux : Leaflet n'est plus chargé depuis `unpkg.com`.
  - Nouvelle dépendance npm : `leaflet@1.9.4`.
  - Chargement dynamique uniquement sur la page Lieux.
  - Compatible avec la CSP stricte du backend.
- Sécurité carte : les champs des popups sont échappés et les liens externes sont validés en `http/https`.
- Email de vérification : `/api/auth/resend-verification` est accessible sans abonnement actif pour les membres connectés.
- Plans admin : remplacement des anciens `planId: 'month'` par `planId: '30d'`.
- Albums : suppression des faux likes/commentaires de démonstration liés à l'ancien profil `me`.
- Erreur de démarrage frontend : message échappé avant insertion HTML.

## Amélioration visuelle globale

- Ajout de `frontend/src/visual-refresh-v113.css`, importé en dernier dans `frontend/src/main.jsx`.
- Rafraîchissement global : fonds, cartes glassmorphism, boutons, formulaires, navigation, admin, profils, messages, pages légales, carte des lieux, badges et responsive.
- Objectif : améliorer toutes les pages sans modifier la logique produit.

## Compte admin

En développement, un compte admin local est créé automatiquement :

- Email : `admin@accord-secret.fr`
- Mot de passe : `ChangeMe-Local-Dev-Only-123!`

En production, ne pas utiliser ce compte. Configurer plutôt :

```env
ADMIN_EMAIL=admin@votre-domaine.fr
ADMIN_INITIAL_PASSWORD=UnMotDePasseFortEtUnique123!
DISABLE_BOOTSTRAP_ADMIN=true
```

Si aucun admin sûr n'est configuré en production et que `DISABLE_BOOTSTRAP_ADMIN` n'est pas activé, le serveur génère un mot de passe temporaire dans les logs et dans `data/admin-initial-password.txt`.

## Vérifications effectuées

- `npm run deploy:render:check` : OK
- `npm audit --omit=dev` : 0 vulnérabilité
- Test connexion admin local : OK
- Test accès `/api/admin/overview` avec token admin : OK
- Test inscription membre : OK
- Test `/api/auth/resend-verification` sans abonnement : OK
- Test paywall sur `/api/profiles` sans abonnement : OK
