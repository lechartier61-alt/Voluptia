# Voluptia V135 — Administration influenceurs & codes

## Demande
Ajouter côté admin :

- un tableau avec tous les influenceurs ;
- la possibilité de transformer un compte normal en compte influenceur ;
- un onglet `Code` pour suivre les codes influenceur ;
- le suivi du chiffre d’affaires, des commissions et du profit net ;
- la gestion du pourcentage reversé à l’influenceur quand un membre s’abonne avec son code.

## Ajouts côté admin

### Nouvel onglet `Influenceurs`

Ajout d’une section complète dans l’administration avec :

- sélection d’un compte normal existant ;
- ajout comme influenceur ;
- nom public de l’influenceur ;
- email de contact / paiement ;
- pourcentage de commission par défaut ;
- notes internes ;
- tableau de tous les influenceurs ;
- statut actif / désactivé ;
- bouton `Créer code` directement depuis la ligne influenceur ;
- bouton `Sync codes` pour appliquer le pourcentage de l’influenceur à ses codes.

### Nouvel onglet `Code`

L’ancien espace marketing est devenu un onglet plus clair : `Code`.

Il affiche maintenant :

- CA généré par les codes influenceur ;
- commissions à reverser ;
- profit net estimé ;
- nombre de codes rattachés à des influenceurs ;
- création de code promo / influenceur ;
- choix de l’influenceur dans une liste ;
- gestion du % de commission par code ;
- modification d’un code existant ;
- activation / désactivation ;
- suppression si le code n’a jamais été utilisé ;
- export CSV.

## Ajouts backend

### Nouveaux endpoints admin

- `POST /api/admin/influencers`
- `PATCH /api/admin/influencers/:profileId`

Ces routes permettent de transformer un membre normal en influenceur et de gérer :

- statut actif ;
- nom public ;
- email ;
- commission par défaut ;
- notes internes ;
- synchronisation des codes.

### Amélioration des codes promo

Les codes peuvent maintenant être rattachés proprement à un influenceur avec :

- `influencerProfileId` ;
- `influencerName` ;
- `influencerEmail` ;
- `commissionRate` jusqu’à 80 % ;
- `maxUsesTotal` ;
- dates de validité ;
- lien influenceur ;
- CA ;
- commission ;
- profit net estimé.

### Amélioration de `/api/admin/overview`

Ajout de `influencers` dans la réponse admin avec :

- profil influenceur ;
- email ;
- nombre de codes ;
- nombre d’abonnements générés ;
- CA total ;
- commission à reverser ;
- profit net ;
- dernier usage ;
- codes rattachés.

## Fichiers modifiés

- `frontend/src/App.jsx`
- `frontend/src/pro-polish-v118.css`
- `backend/src/app.js`

## Vérifications

Commandes exécutées :

```bash
npm run build
npm run check:backend-syntax
```

Résultat : OK.
