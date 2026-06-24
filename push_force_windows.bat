@echo off
REM Lance ce fichier depuis le dossier du projet.
REM Il utilise Git Bash si Git est installé dans l'emplacement standard.

set SCRIPT_DIR=%~dp0
set BASH_EXE=C:\Program Files\Git\bin\bash.exe

if exist "%BASH_EXE%" (
  "%BASH_EXE%" "%SCRIPT_DIR%push_force_gitbash.sh"
) else (
  echo Git Bash introuvable dans C:\Program Files\Git\bin\bash.exe
  echo Ouvre Git Bash dans ce dossier puis lance : ./push_force_gitbash.sh
  pause
)
