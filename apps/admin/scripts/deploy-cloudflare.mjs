#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminDir = path.resolve(__dirname, '..');

console.log('🚀 [GamePulse] Déploiement 100% autonome sur Cloudflare Pages & D1...');

const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!apiToken) {
  console.error('❌ ERREUR: La variable CLOUDFLARE_API_TOKEN est manquante.');
  process.exit(1);
}

if (!accountId) {
  console.error('❌ ERREUR: La variable CLOUDFLARE_ACCOUNT_ID est manquante.');
  process.exit(1);
}

const exec = (cmd, options = {}) => {
  return execSync(cmd, {
    cwd: adminDir,
    stdio: 'inherit',
    env: { ...process.env },
    ...options,
  });
};

const execCapture = (cmd) => {
  try {
    return execSync(cmd, {
      cwd: adminDir,
      encoding: 'utf8',
      env: { ...process.env },
    }).trim();
  } catch (err) {
    if (err && err.stdout) return err.stdout.toString().trim();
    return null;
  }
};

const extractJsonArray = (text) => {
  if (!text) return null;
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (_) {}
  }
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
};

const DB_NAME = 'gamepulse-db';
const PAGES_PROJECT = 'gamepulse-admin';
const PRODUCTION_BRANCH = 'master';

// 1. Lister / Créer la base de données D1
console.log(`\n📦 [1/5] Recherche de la base Cloudflare D1 "${DB_NAME}"...`);
let rawList = execCapture(`npx wrangler d1 list --json`);
let dbList = extractJsonArray(rawList) || [];
let targetDb = Array.isArray(dbList) ? dbList.find((d) => d.name === DB_NAME) : null;
let dbUuid = targetDb?.uuid;

if (!dbUuid) {
  console.log(`✨ La base "${DB_NAME}" n'existe pas encore. Création automatique...`);
  const createOutput = execCapture(`npx wrangler d1 create ${DB_NAME}`) || '';
  console.log(createOutput);

  // Essayer d'extraire le database_id depuis l'output de création
  const match = createOutput.match(/database_id\s*=\s*"([a-f0-9-]+)"/i);
  if (match) {
    dbUuid = match[1];
  } else {
    // Re-lister les bases D1
    rawList = execCapture(`npx wrangler d1 list --json`);
    dbList = extractJsonArray(rawList) || [];
    targetDb = Array.isArray(dbList) ? dbList.find((d) => d.name === DB_NAME) : null;
    dbUuid = targetDb?.uuid;
  }
}

if (!dbUuid) {
  console.error(`❌ ERREUR: Impossible de créer ou récupérer l'UUID de la base D1 "${DB_NAME}".`);
  process.exit(1);
}

console.log(`✅ Base D1 prête avec UUID: ${dbUuid}`);

// 2. Mettre à jour wrangler.toml avec le véritable database_id
console.log(`\n📝 [2/5] Configuration de wrangler.toml avec le database_id...`);
const wranglerPath = path.join(adminDir, 'wrangler.toml');
let wranglerContent = fs.readFileSync(wranglerPath, 'utf8');

wranglerContent = wranglerContent.replace(
  /database_id\s*=\s*"[^"]*"/,
  `database_id = "${dbUuid}"`
);

if (process.env.WORKER_SECRET_KEY) {
  wranglerContent = wranglerContent.replace(
    /WORKER_SECRET_KEY\s*=\s*"[^"]*"/,
    `WORKER_SECRET_KEY = "${process.env.WORKER_SECRET_KEY}"`
  );
  console.log('🔒 Secret WORKER_SECRET_KEY injecté depuis les variables d\'environnement.');
}

fs.writeFileSync(wranglerPath, wranglerContent, 'utf8');
console.log('✅ wrangler.toml mis à jour avec succès.');

// 3. Assurer la création du projet Pages
console.log(`\n🌐 [3/5] Vérification / Création du projet Cloudflare Pages "${PAGES_PROJECT}"...`);
try {
  exec(`npx wrangler pages project create ${PAGES_PROJECT} --production-branch ${PRODUCTION_BRANCH}`);
  console.log(`✅ Projet Pages "${PAGES_PROJECT}" créé avec la branche principale "${PRODUCTION_BRANCH}".`);
} catch (_err) {
  console.log(`ℹ️ Projet Pages déjà existant.`);
}

// 4. Appliquer les migrations D1
console.log(`\n🗄️ [4/5] Application des migrations SQL sur Cloudflare D1...`);
try {
  exec(`npx wrangler d1 migrations apply ${DB_NAME} --remote`);
  console.log(`✅ Schéma SQL D1 synchronisé avec succès.`);
} catch (err) {
  console.error(`❌ Échec de la migration D1:`, err);
  process.exit(1);
}

// 5. Déployer sur Cloudflare Pages
console.log(`\n🚀 [5/5] Déploiement sur Cloudflare Pages...`);
try {
  exec(`npx wrangler pages deploy dist --project-name ${PAGES_PROJECT} --branch ${PRODUCTION_BRANCH}`);
  console.log(`\n🎉 [SUCCÈS TOTAL] GamePulse Admin & API sont en ligne sur Cloudflare Pages !`);
} catch (err) {
  console.error(`❌ Échec du déploiement Cloudflare Pages:`, err);
  process.exit(1);
}
