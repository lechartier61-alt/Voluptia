# Corrections V172 — Adresse de push GitHub

L’adresse GitHub utilisée pour le push a été remplacée par :

https://github.com/lechartier61-alt/Voluptia.git

## Éléments mis à jour

- `push_force_gitbash.sh` : variable `REPO_URL` ;
- `INSTRUCTIONS_PUSH_FORCE.txt` ;
- documents historiques contenant l’ancienne adresse de dépôt ;
- documentation de correction GitHub.

## Utilisation

Depuis Git Bash, à la racine du projet :

```bash
bash push_force_gitbash.sh
```

Le script configure automatiquement `origin` avec la nouvelle adresse puis pousse la branche `main` avec :

```bash
git push --force-with-lease origin main
```
