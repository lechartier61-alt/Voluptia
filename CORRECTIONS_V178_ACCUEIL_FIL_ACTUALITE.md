# Voluptia V178 — Nouvelle page Accueil en fil d’actualité

## Objectif
Remplacer l’ancienne page d’accueil après connexion, qui ressemblait à un simple menu, par un vrai fil d’actualité communautaire mobile-first, dans l’identité sombre premium de Voluptia.

## Changements frontend

### Nouvelle page Accueil
- Suppression de l’ancien tableau d’accueil à gros boutons.
- Ajout d’un header : salutation personnalisée + sous-texte communautaire.
- Ajout des boutons notification et menu dans le header de l’accueil.
- Ajout d’un bloc de création de publication avec avatar, champ d’appel à publication et boutons Photo / Vidéo / Message.
- Ajout d’une ligne horizontale de membres actifs avec avatar rond et badge en ligne.
- Ajout des filtres du fil : Tous, Photos, Vidéos, Près de moi, Nouveaux, Populaires.
- Ajout d’un fil de cartes de publications.
- Ajout d’une carte “Profils qui pourraient vous plaire”.
- Ajout d’un état vide : “Aucune publication pour le moment. Soyez le premier à partager un moment.”

### Fenêtre de création de publication
- Zone texte.
- Upload photo.
- Upload vidéo.
- Choix de visibilité : Public, Membres vérifiés, Mes favoris, Privé.
- Bouton Publier.
- Prévisualisation média.
- Message de rappel +18, consentement et respect.

### Cartes de publication
Chaque carte contient :
- avatar auteur ;
- pseudo ;
- ville / distance approximative ;
- date relative ;
- texte ;
- photo ou vidéo ;
- compteur j’aime ;
- compteur commentaires ;
- bouton J’aime ;
- bouton Commenter ;
- bouton Message privé ;
- bouton Voir le profil ;
- menu avec Signaler, Bloquer et Masquer.

### Design
- Thème sombre premium conservé.
- Dégradés noir / bordeaux / violet foncé.
- Accent rose / rose néon.
- Cartes arrondies glassmorphism.
- Interface mobile-first.
- Espacement augmenté pour la lisibilité.
- Padding bas conservé pour la barre de navigation flottante.

## Changements backend

### Nouvelle collection persistante
- Ajout de `feedPosts` dans les collections persistées.
- Compatible avec PostgreSQL Railway, SQLite local et fallback JSON.

### Nouveaux endpoints API
- `GET /api/feed/posts` : liste les publications visibles.
- `POST /api/feed/posts` : crée une publication texte/photo/vidéo.
- `POST /api/feed/posts/:postId/like` : ajoute ou retire un j’aime.
- `POST /api/feed/posts/:postId/comments` : ajoute un commentaire.
- `POST /api/feed/posts/:postId/hide` : masque une publication pour le membre.
- `POST /api/feed/posts/:postId/report` : signale une publication à la modération.
- `GET /api/feed-media/:fileId` : sert les médias du fil selon les droits de visibilité.

### Données prévues par publication
- `id`
- `userId`
- `pseudo` calculé côté API
- `avatar` calculé côté API
- `localisation` calculée depuis le profil
- `distanceKm`
- `text`
- `mediaUrl`
- `mediaType` : `image`, `video`, `none`
- `visibility` : `public`, `verified`, `favorites`, `private`
- `likesCount`
- `commentsCount`
- `createdAt`

### Visibilité
- Public : visible par les membres autorisés.
- Membres vérifiés : visible par les profils vérifiés et l’auteur.
- Mes favoris : visible par les profils favoris de l’auteur.
- Privé : visible uniquement par l’auteur.

### Modération et sécurité
- Les signalements de publication sont transmis au système de rapports existant.
- Les médias du fil sont servis par route protégée.
- Les publications masquées sont exclues du fil du membre.
- Les profils bloqués sont exclus du fil.
- Les médias uploadés gardent les limites et contrôles de format.

## Validations réalisées
- Build frontend : OK (`npm run build`).
- Syntaxe backend : OK (`node --check backend/src/app.js` et `node --check backend/src/server.js`).
- Configuration Railway PostgreSQL conservée.
- Adresse GitHub de push conservée.

## Notes
- Le fil peut afficher les anciennes publications média publiques comme fallback si aucune publication du nouveau fil n’existe encore.
- Les mentions légales marquées `[À VALIDER]` restent à compléter avant mise en production publique.
