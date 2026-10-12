# Guide de Déploiement Rapide - GamePulse 🎮📡

Ce guide contient **uniquement les étapes essentielles** pour mettre en ligne GamePulse et connecter vos bots en moins de 5 minutes.

---

## 1. Déployer l'Interface Web & l'API (Cloudflare)

Tout est automatisé à 100% via GitHub Actions. Vous n'avez rien à créer manuellement sur Cloudflare.

### Configuration (1 seule fois)
Dans votre dépôt GitHub, allez dans **Settings > Secrets and variables > Actions** et ajoutez ces 2 secrets :

| Secret | Où le trouver sur Cloudflare ? |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | *Mon profil > Jetons d'API > Créer un jeton* (Permissions : Pages + D1 en Édition) |
| `CLOUDFLARE_ACCOUNT_ID` | Sur la page d'accueil de votre tableau de bord Cloudflare (colonne de droite) |

### Lancement
Faites un push sur la branche `master` :
```bash
git push origin master
```
GitHub Actions crée automatiquement la base de données D1, applique les tables et publie votre site.

👉 Votre tableau de bord est en ligne sur :  
**`https://gamepulse-admin.pages.dev`**

---

## 2. Lancer un Worker Rust

Le worker interroge vos serveurs DayZ en UDP et gère la présence Discord. Choisissez la méthode qui vous convient :

### Option A : Avec Docker (Recommandé - 1 commande)

Sur votre VPS ou machine Linux :
```bash
docker run -d \
  --name gamepulse-worker \
  --restart unless-stopped \
  --network host \
  -e WORKER_ID=vps-01 \
  -e ADMIN_API_URL="https://gamepulse-admin.pages.dev" \
  ghcr.io/nicolasfvrx/gamepulse-worker:latest
```

### Option B : Avec Docker Compose

1. Modifiez `docker-compose.yml` avec l'URL de votre dashboard :
```yaml
services:
  worker:
    image: ghcr.io/nicolasfvrx/gamepulse-worker:latest
    container_name: gamepulse-worker
    restart: unless-stopped
    network_mode: host
    environment:
      - WORKER_ID=worker-vps-01
      - ADMIN_API_URL=https://gamepulse-admin.pages.dev
      - POLL_INTERVAL_SECS=20
      - RUST_LOG=info
```
2. Démarrez :
```bash
docker compose up -d
```

### Option C : Avec le binaire natif précompilé (Sans Docker)

1. Allez dans l'onglet **Releases** de votre dépôt GitHub (`v1.0.0`).
2. Téléchargez l'archive pour votre système :
   - Linux : `gamepulse-worker-linux-x86_64.tar.gz`
   - Windows : `gamepulse-worker-windows-x86_64.zip`
3. Extrayez l'archive et créez un fichier `.env` à côté de l'exécutable :
```env
WORKER_ID=mon-worker-01
ADMIN_API_URL=https://gamepulse-admin.pages.dev
POLL_INTERVAL_SECS=20
RUST_LOG=info
```
4. Lancez l'exécutable (`./gamepulse-worker` ou `gamepulse-worker.exe`).

---

## 3. Ajouter et Activer un Bot Discord

1. Ouvrez votre dashboard : **`https://gamepulse-admin.pages.dev`**
2. Cliquez sur **« Nouveau Bot »** en haut à droite.
3. Renseignez :
   - **Nom** : ex. `Serveur Chernarus #1`
   - **Discord Client ID** et **Token de bot Discord** (obtenus sur le [Portail Développeur Discord](https://discord.com/developers/applications))
   - **IP du serveur** et **Port Query** (par défaut 2305 pour DayZ, ou 27016 selon le serveur Steam)
   - **Format d'activité** : ex. `🎮 Joue à DayZ - {map} [{players}/{max_players}]`
4. Cliquez sur **« Enregistrer le Bot »**.

Dès la prochaine synchronisation (quelques secondes), le bot se connecte à Discord et met à jour sa Rich Presence en temps réel ! 🚀
