#!/usr/bin/env bash
set -e

REPO_URL="https://github.com/lechartier61-alt/Voluptia.git"
BRANCH="main"

printf "\n=== Push forcé vers GitHub ===\n"
printf "Dépôt : %s\n" "$REPO_URL"
printf "Branche : %s\n\n" "$BRANCH"

# Se placer dans le dossier où se trouve ce script
cd "$(dirname "$0")"

# Initialiser Git si besoin
if [ ! -d ".git" ]; then
  git init
fi

# Configurer le dépôt distant origin
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

# Ajouter tous les fichiers du projet
git add .

# Créer un commit seulement s'il y a des changements
if git diff --cached --quiet; then
  echo "Aucun changement à committer. On pousse quand même la branche actuelle."
else
  git commit -m "Mise à jour complète du projet"
fi

# Utiliser la branche main
git branch -M "$BRANCH"

# Push forcé sécurisé. Remplace l'historique distant si nécessaire.
git push --force-with-lease origin "$BRANCH"

printf "\n✅ Push forcé terminé.\n"
