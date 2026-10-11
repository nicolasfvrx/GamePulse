# DayZ Discord Bot Network 🎮📡

Réseau décentralisé et distribué de bots Discord Rich Presence pour serveurs de jeu DayZ (et jeux Steam Valve), propulsé par une architecture moderne :
- **Control Plane** : Cloudflare Pages + Cloudflare Workers (Hono API) + Cloudflare D1 (Base SQLite distribuée).
- **Data Plane / Workers** : Démon haute performance en **Rust** (Tokio, Tokio-Tungstenite, Reqwest, Sysinfo, Query UDP Steam A2S_INFO).
- **Monorepo PNPM** : Partage de types TypeScript stricts entre l'API Cloudflare et le Dashboard React.

---

## 🏛️ Architecture du Projet

```
gamepresencebot/
├── .github/workflows/
│   ├── ci.yml                 # Validation CI (pnpm build/lint/typecheck, cargo check/test/clippy)
│   ├── deploy-admin.yml       # Déploiement auto Cloudflare Pages & D1 migrations
│   └── release-worker.yml     # Build binaire multi-plateforme (Linux & Windows) et GitHub Release
├── packages/
│   └── shared/                # Bibliothèque TypeScript partagée (types Bots, Workers, Heartbeats, A2S)
├── apps/
│   ├── admin/                 # Dashboard Web React 18 + Tailwind CSS (Gaming Dark Theme) & API Hono D1
│   │   ├── migrations/        # Schémas SQL Cloudflare D1 (0001_initial.sql)
│   │   ├── functions/api/     # Cloudflare Pages Functions (Hono router)
│   │   └── src/               # UI Dashboard (KPIs, Workers live metrics, Bots CRUD, A2S History)
│   └── worker/                # Démon Rust asynchrone Tokio
│       ├── src/
│       │   ├── a2s/           # Protocole Valve A2S_INFO UDP (parseur binaire, challenge, ping)
│       │   ├── discord/       # Gestionnaire multi-bots Gateway v10 WebSocket & Rich Presence
│       │   ├── api/           # Client HTTP Cloudflare synchronisation & heartbeat
│       │   ├── metrics.rs     # Métriques système réelles CPU % et RAM (sysinfo)
│       │   └── poller.rs      # Boucle asynchrone de réconciliation
│       └── Cargo.toml
├── pnpm-workspace.yaml
└── package.json
```

---

## ✨ Fonctionnalités Clés

1. **Query UDP Valve A2S_INFO en Rust** :
   - Interrogation native ultra-rapide des serveurs de jeu DayZ en UDP sans dépendance externe lourde.
   - Gestion automatique des challenges de sécurité Valve (`0x41` challenge handshake).
   - Extraction des métadonnées : nom du serveur, carte (ChernarusPlus, Livonia, Namalsk...), nombre de joueurs en direct, capacité maximale et latence réseau (ping en ms).

2. **Multi-Bots Discord Asynchrones** :
   - Connexion simultanée de plusieurs bots Discord sur un même worker sans blocage grâce à Tokio.
   - Maintien des sessions Discord Gateway v10 en WebSocket sécurisé (`tokio-tungstenite` avec `rustls`).
   - Mise à jour dynamique de l'activité Discord Rich Presence :
     `🎮 Joue à DayZ - ChernarusPlus [34/60]`
   - Formats d'activité personnalisables avec interpolation de balises : `{server_name}`, `{map}`, `{players}`, `{max_players}`, `{ping}`.

3. **Dashboard Web Gaming Moderne (Apps Admin)** :
   - Interface réactive conçue en React 18, Tailwind CSS et Lucide Icons.
   - Thème sombre orienté gaming avec jauges néon et statut visuel du cluster.
   - Monitoring live des Workers Rust : CPU %, RAM utilisée/totale, Uptime, statut En ligne / Dégradé / Hors ligne.
   - CRUD complet des bots Discord (masquage/révélation du token, assignation automatique ou par worker).
   - Historique des 50 dernières interrogations A2S avec visualisation de la fréquentation des serveurs.

4. **Sécurité & Contrôle d'Accès** :
   - Endpoints workers sécurisés par clé secrète via l'en-tête `X-Worker-Key`.
   - Assignation souple : bots dédiés à un worker spécifique (`worker_id`) ou en mode réparti `auto`.

---

## 🚀 Démarrage Rapide

### Prérequis
- [Node.js](https://nodejs.org/) v22+
- [pnpm](https://pnpm.io/) v11+
- [Rust & Cargo](https://rustup.rs/) (édition 2021)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (inclus dans les devDependencies)

### 1. Installation des dépendances
```bash
pnpm install
```

### 2. Démarrage du Dashboard Admin en local
```bash
# Démarrage du serveur de développement Vite
pnpm dev:admin
```
Le dashboard sera accessible sur `http://localhost:3000`.

Pour tester avec Cloudflare D1 en local via Wrangler Pages :
```bash
cd apps/admin
npx wrangler d1 migrations apply dayz-network-db --local
pnpm pages:dev
```

### 3. Lancement du Démon Worker Rust
Copiez le fichier `.env.example` et configurez vos variables :
```bash
cd apps/worker
cp .env.example .env
```

Variables d'environnement disponibles :
```env
WORKER_ID=worker-eu-paris-01
WORKER_NAME="Worker Paris 01"
WORKER_SECRET_KEY=dayz-worker-secret-token-change-in-prod
ADMIN_API_URL=http://127.0.0.1:8788
POLL_INTERVAL_SECS=20
RUST_LOG=info
```

Lancez le worker en mode développement ou release :
```bash
# Lancement direct
cargo run --manifest-path apps/worker/Cargo.toml

# Ou build optimisé release
cargo build --release --manifest-path apps/worker/Cargo.toml
```

---

## 🧪 Tests et Qualité de Code

Le monorepo inclut un script unifié de vérification :
```bash
# Vérification globale (TypeScript typecheck + Cargo check + Cargo test)
pnpm run check:all

# Tests unitaires spécifiques à Rust (packet parsing, presence formatting)
cargo test --manifest-path apps/worker/Cargo.toml

# Linter Rust Clippy
cargo clippy --manifest-path apps/worker/Cargo.toml -- -D warnings
```

---

## 🚢 Déploiement & Intégration Continue (CI/CD)

Les workflows GitHub Actions sont préconfigurés dans `.github/workflows/` :
- **`ci.yml`** : Exécute à chaque push/PR les étapes d'installation pnpm, typecheck TypeScript, linting, build du frontend, `cargo check`, `cargo test` et `cargo clippy`.
- **`deploy-admin.yml`** : Applique les migrations D1 et déploie automatiquement l'application sur Cloudflare Pages.
- **`release-worker.yml`** : Compile les binaires natifs pour Linux x86_64 et Windows x86_64 à chaque tag git `v*` et génère automatiquement une GitHub Release avec les archives compressées.

---

## 📜 Licence
Projet distribué sous licence MIT.
