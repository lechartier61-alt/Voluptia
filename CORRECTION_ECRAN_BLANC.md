# Correction écran blanc Render

Cette version corrige le risque principal d'écran blanc après déploiement Render : un ancien cache/service worker pouvait servir un vieux HTML ou un vieux bundle JavaScript.

Corrections incluses :

- le service worker ne met plus en cache l'HTML, le JavaScript ni le CSS ;
- le cache du service worker est passé en `voluptia-clean-v2` et supprime les anciens caches Voluptia ;
- `index.html` et `sw.js` sont servis en `no-store` côté backend ;
- les assets hashés restent cacheables ;
- un garde-fou frontend affiche une erreur visible au lieu d'un écran blanc si React plante ;
- le cas `token présent mais data absente` affiche un chargement au lieu de `null`.

Après déploiement, faire un Ctrl+F5 sur le navigateur. Sur mobile, fermer l'onglet puis rouvrir le site. Si l'ancienne page blanche persiste, vider les données du site dans les paramètres du navigateur.
