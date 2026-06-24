# Corrections v122 — adresse du dépôt GitHub

## Modification effectuée

L'adresse du dépôt utilisée pour le push a été remplacée par :

```txt
https://github.com/lechartier61-alt/Voluptia.git
```

## Fichiers modifiés

- `push_force_gitbash.sh`
- `INSTRUCTIONS_PUSH_FORCE.txt`
- `CORRECTIONS_V117.md` (historique mis à jour avec la nouvelle adresse)

## Vérification

La syntaxe du script Bash a été vérifiée avec :

```bash
bash -n push_force_gitbash.sh
```

Commande de push utilisée par le script :

```bash
git push --force-with-lease origin main
```
