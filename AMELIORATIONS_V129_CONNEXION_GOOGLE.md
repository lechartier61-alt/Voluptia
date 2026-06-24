# Voluptia V129 — Connexion et inscription avec Google

## Ce qui a été ajouté

- Bouton **Se connecter avec Google** sur la page de connexion.
- Bouton **S’inscrire avec Google** sur la page d’inscription.
- Nouvelle route backend : `POST /api/auth/google`.
- Vérification serveur du jeton Google ID Token :
  - signature RS256 vérifiée avec les clés publiques Google ;
  - contrôle du `client_id` autorisé ;
  - contrôle de l’émetteur Google ;
  - contrôle de l’expiration ;
  - email Google obligatoire et vérifié.
- Création automatique d’un compte Voluptia si l’utilisateur passe par l’inscription Google.
- Connexion automatique si l’email Google existe déjà.
- Association d’un ancien compte email/mot de passe avec Google si l’email est identique.
- Photo Google utilisée comme photo de profil si elle est disponible.
- Email marqué comme vérifié pour les comptes Google.
- Conservation des règles Voluptia : majorité, accords légaux, traitement explicite des données sensibles et vérification d’âge côté serveur.

## Fichiers modifiés

- `frontend/src/App.jsx`
- `frontend/src/styles.css`
- `backend/src/app.js`
- `.env.example`
- `.env.production.example`
- `render.yaml`

## Variables à configurer

Dans Google Cloud Console, créer un identifiant **OAuth Client ID** de type **Application Web**.

Ajouter ensuite ces variables :

```env
GOOGLE_CLIENT_ID=votre-client-id-google.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=votre-client-id-google.apps.googleusercontent.com
```

Les deux valeurs doivent être identiques dans la plupart des cas :

- `VITE_GOOGLE_CLIENT_ID` sert au bouton Google côté frontend.
- `GOOGLE_CLIENT_ID` sert au backend pour vérifier que le jeton Google appartient bien à Voluptia.

## Origines JavaScript à autoriser côté Google

Dans Google Cloud Console, ajouter les origines utilisées par le site, par exemple :

```text
http://localhost:5173
http://localhost:4000
https://votre-domaine.com
https://votre-service.onrender.com
```

## Important

Le bouton Google ne s’affichera que si `VITE_GOOGLE_CLIENT_ID` est configuré au moment du build frontend.

Sur Render / Docker, il faut donc définir `VITE_GOOGLE_CLIENT_ID` avant le redéploiement pour que Vite l’injecte dans l’application.

## Vérifications faites

```bash
npm run build
npm run check:backend-syntax
```

Résultat : OK.
