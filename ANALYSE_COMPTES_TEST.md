# Analyse après création de comptes test (admin + client)

J'ai créé un compte admin et des comptes clients, puis parcouru les fonctionnalités
pour repérer ce qui manque ou mérite d'être amélioré.

## Corrigé dans cette mise à jour

1. **Réglages sociaux bloqués sans abonnement** → corrigé.
   `/profile/social-preferences` (ex. activer la bulle de chat) est désormais accessible
   gratuitement, comme le reste de la configuration du compte.

## Confirmé conforme à vos choix (pas un bug)

- **Compléter son profil est gratuit** : bio, titre, photo, âge, catégorie, membres —
  via `PUT /profiles/me`, accessible sans abonnement. ✓
- **Interactions réservées aux abonnés** : coup de cœur, suivre, messages, recherche →
  bloqués (402) tant qu'il n'y a pas d'abonnement actif. ✓ (choix : rien voir sans payer)
- **Carte des lieux réservée aux abonnés** : `/venues` bloqué sans abonnement. ✓

## Manques importants à considérer (non corrigés — décision à prendre)

### 1. Pas de récupération de mot de passe oublié
Aucune route « mot de passe oublié » n'existe. Un membre qui oublie son mot de passe ne
peut pas récupérer son compte seul (seul l'admin peut réinitialiser). Pour une app grand
public, c'est un manque qui génère des pertes de comptes et des sollicitations support.
→ Nécessite l'envoi d'emails (lien de réinitialisation). À brancher avec un service email.

### 2. Pas de vérification d'email à l'inscription
L'email n'est jamais vérifié. N'importe qui peut s'inscrire avec un email qui n'est pas le
sien. Recommandé pour la fiabilité des comptes et la lutte contre les faux profils.
→ Nécessite aussi l'envoi d'emails.

### 3. Expérience « première connexion » sur une app vide
Un tout premier membre n'a aucun profil à voir (normal au lancement), mais le paywall
l'empêche même de constater l'activité. À l'ouverture réelle, prévoir d'amorcer la
communauté (profils réels, communication) avant d'activer le paywall strict, sinon la
conversion sera très faible : personne ne paie pour une app qui paraît vide.

### 4. Incohérence mineure : le rôle n'est pas renvoyé au login
`POST /auth/login` renvoie `session.role` mais pas `role` dans l'objet `profile`.
Le rôle admin n'est connu qu'après l'appel à `/bootstrap`. Sans conséquence visible
aujourd'hui (le front recharge via bootstrap), mais à uniformiser pour la clarté.

## Recommandations de priorité
1. Récupération de mot de passe (bloquant pour le grand public).
2. Stratégie d'amorçage de la communauté avant le paywall strict.
3. Vérification d'email (qualité des comptes).
Les points 1 et 3 dépendent d'un service d'envoi d'emails à choisir et configurer.
