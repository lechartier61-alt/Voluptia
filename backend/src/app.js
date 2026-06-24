import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');


const dataRoot = path.resolve(projectRoot, process.env.DATA_DIR || 'data');
const sqlitePath = path.resolve(dataRoot, process.env.DATABASE_PATH || 'laccord_secret.sqlite');
const fallbackJsonPath = path.resolve(dataRoot, 'laccord_secret_fallback.json');
const uploadRoot = path.resolve(dataRoot, 'uploads');
const messageMediaRoot = path.resolve(uploadRoot, 'message-media');
const albumMediaRoot = path.resolve(uploadRoot, 'album-media');
const feedMediaRoot = path.resolve(uploadRoot, 'feed-media');
const eventMediaRoot = path.resolve(uploadRoot, 'event-media');
const DEFAULT_ADMIN_EMAIL = 'admin@accord-secret.fr';
const OWNER_ADMIN_EMAIL = process.env.OWNER_ADMIN_EMAILS?.split(',')[0]?.trim() || '';
const BUNDLED_OWNER_ADMIN_PASSWORD = ''; // V73: aucun mot de passe admin secret dans le code source
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_DEV_ADMIN_PASSWORD || 'ChangeMe-Local-Dev-Only-123!';
const BOOTSTRAP_ADMIN_PASSWORD_FILE = 'admin-initial-password.txt';
const BOOTSTRAP_ADMIN_PASSWORD_LENGTH = 24;
const ADMIN_PASSWORD_MIN_LENGTH = 16;
const BOOTSTRAP_DEFAULT_PROFILE_LIMIT = 80;
const PROFILES_DEFAULT_LIMIT = 48;
const PROFILES_MAX_LIMIT = 120;

const DEFAULT_JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '1mb';
const MESSAGE_JSON_BODY_LIMIT = process.env.MESSAGE_JSON_BODY_LIMIT || '12mb';
const ALBUM_MEDIA_JSON_BODY_LIMIT = process.env.ALBUM_MEDIA_JSON_BODY_LIMIT || '38mb';
const MAX_AUTH_FAILURES_PER_ACCOUNT = 8;
const AUTH_LOCK_MS = 1000 * 60 * 15;
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;
const PUBLIC_PRODUCTION_HEALTH = envFlag('PUBLIC_PRODUCTION_HEALTH', false);

const REMOVED_DEMO_PROFILE_IDS = new Set([
  'me',
  'sofia',
  'ambre-noir',
  'nocturne',
  'velours',
  'horizon-duo',
  'jade-libre',
  'matthias-bi',
  'eliott-prive',
  'claire-lumiere',
]);
const REMOVED_DEMO_USER_EMAILS = new Set(['demo@accord-secret.fr']);
const REMOVED_DEMO_PROMO_CODES = new Set(['SOFIA20']);

function referencesRemovedDemoProfile(value) {
  if (!value) return false;
  if (typeof value === 'string') return REMOVED_DEMO_PROFILE_IDS.has(value);
  if (Array.isArray(value)) return value.some((item) => referencesRemovedDemoProfile(item));
  if (typeof value === 'object') {
    return Object.entries(value).some(([key, item]) => {
      if (/passwordHash|twoFactorSecret|twoFactorPendingSecret|twoFactorBackupCodes|body|description|title|headline|bio/i.test(key)) return false;
      return referencesRemovedDemoProfile(item);
    });
  }
  return false;
}

function isUnsafeDefaultAdminUser(user) {
  if (process.env.NODE_ENV !== 'production' || !user || user.profileId !== 'admin') return false;
  try {
    return verifyPassword(DEFAULT_ADMIN_PASSWORD, user.passwordHash || user.password);
  } catch {
    return false;
  }
}

function purgeRemovedDemoAccounts(store) {
  if (!store || typeof store !== 'object') return store;
  const unsafeAdminUserIds = new Set((store.authUsers || []).filter(isUnsafeDefaultAdminUser).map((user) => user.id));
  store.profiles = (store.profiles || []).filter((profile) => profile.id === 'admin' || !REMOVED_DEMO_PROFILE_IDS.has(profile.id));
  store.authUsers = (store.authUsers || []).filter((user) => {
    if (isUnsafeDefaultAdminUser(user)) return false;
    return user.profileId === 'admin' || (!REMOVED_DEMO_PROFILE_IDS.has(user.profileId) && !REMOVED_DEMO_USER_EMAILS.has(normalizeEmail(user.email)));
  });
  store.sessions = (store.sessions || []).filter((session) => !unsafeAdminUserIds.has(session.userId) && !REMOVED_DEMO_PROFILE_IDS.has(session.profileId));
  store.albumAccess = (store.albumAccess || []).filter((access) => !REMOVED_DEMO_PROFILE_IDS.has(access.ownerId) && !REMOVED_DEMO_PROFILE_IDS.has(access.viewerId));
  store.conversations = (store.conversations || []).filter((conversation) => !referencesRemovedDemoProfile(conversation.participantIds));
  store.notifications = (store.notifications || []).filter((notification) => !REMOVED_DEMO_PROFILE_IDS.has(notification.profileId) && !REMOVED_DEMO_PROFILE_IDS.has(notification.actorId));
  store.feedPosts = (store.feedPosts || []).filter((post) => !REMOVED_DEMO_PROFILE_IDS.has(post.userId));
  store.followers = (store.followers || []).filter((follow) => !REMOVED_DEMO_PROFILE_IDS.has(follow.followerId) && !REMOVED_DEMO_PROFILE_IDS.has(follow.followingId));
  store.profileLikes = (store.profileLikes || []).filter((like) => !REMOVED_DEMO_PROFILE_IDS.has(like.fromId) && !REMOVED_DEMO_PROFILE_IDS.has(like.toId));
  store.profilePasses = (store.profilePasses || []).filter((pass) => !REMOVED_DEMO_PROFILE_IDS.has(pass.fromId) && !REMOVED_DEMO_PROFILE_IDS.has(pass.toId));
  store.profileViews = (store.profileViews || []).filter((view) => !REMOVED_DEMO_PROFILE_IDS.has(view.viewerId) && !REMOVED_DEMO_PROFILE_IDS.has(view.profileId));
  store.blockedProfiles = (store.blockedProfiles || []).filter((block) => !REMOVED_DEMO_PROFILE_IDS.has(block.blockerId) && !REMOVED_DEMO_PROFILE_IDS.has(block.blockedId));
  store.subscriptions = (store.subscriptions || []).filter((subscription) => !REMOVED_DEMO_PROFILE_IDS.has(subscription.profileId));
  store.purchases = (store.purchases || []).filter((purchase) => !REMOVED_DEMO_PROFILE_IDS.has(purchase.profileId));
  store.promoCodes = (store.promoCodes || []).filter((promo) => !REMOVED_DEMO_PROMO_CODES.has(String(promo.code || '').toUpperCase()) && !REMOVED_DEMO_PROFILE_IDS.has(promo.influencerProfileId));
  store.reports = (store.reports || []).filter((report) => !REMOVED_DEMO_PROFILE_IDS.has(report.reporterId) && !REMOVED_DEMO_PROFILE_IDS.has(report.targetId));
  store.moderationWarnings = (store.moderationWarnings || []).filter((warning) => !REMOVED_DEMO_PROFILE_IDS.has(warning.profileId));
  store.moderationActions = (store.moderationActions || []).filter((action) => !REMOVED_DEMO_PROFILE_IDS.has(action.profileId) && !REMOVED_DEMO_PROFILE_IDS.has(action.targetId));
  store.legalAcceptances = (store.legalAcceptances || []).filter((acceptance) => !REMOVED_DEMO_PROFILE_IDS.has(acceptance.profileId));
  store.verificationRequests = (store.verificationRequests || []).filter((request) => !REMOVED_DEMO_PROFILE_IDS.has(request.profileId));
  return store;
}

function ensureStoreCollections(store) {
  const collections = ['profiles', 'feedPosts', 'albumAccess', 'conversations', 'events', 'reports', 'moderationWarnings', 'moderationActions', 'authUsers', 'notifications', 'followers', 'profileLikes', 'profilePasses', 'profileViews', 'blockedProfiles', 'subscriptions', 'promoCodes', 'purchases', 'sessions', 'ageVerifications', 'legalAcceptances', 'deletedMedia', 'venues', 'emailTokens', 'passwordResets', 'verificationRequests', 'profileFavorites', 'profileWinks', 'socialActionLog', 'pushSubscriptions'];
  for (const key of collections) {
    if (!Array.isArray(store[key])) store[key] = [];
  }
  if (!store.authFailures || typeof store.authFailures !== 'object' || Array.isArray(store.authFailures)) store.authFailures = {};
  if (!store.geocodingCache || typeof store.geocodingCache !== 'object' || Array.isArray(store.geocodingCache)) store.geocodingCache = {};
  if (!Array.isArray(store.legalChecklist)) store.legalChecklist = LEGAL_CHECKLIST;
  return purgeRemovedDemoAccounts(store);
}

function cleanStoreForPersistence(store) {
  // PERF: on evite le clone profond (JSON.parse(JSON.stringify(...))) qui serialisait
  // toute la base une 2e/3e fois a CHAQUE ecriture. Une copie superficielle suffit :
  // le resultat est seulement re-serialise en lecture seule juste apres, et on ne
  // recompose en profondeur que les deux collections reellement filtrees.
  const now = Date.now();
  const sessions = (store.sessions || []).filter((session) => new Date(session.expiresAt).getTime() > now);
  let authFailures = store.authFailures;
  if (authFailures && typeof authFailures === 'object' && !Array.isArray(authFailures)) {
    const kept = {};
    for (const [key, item] of Object.entries(authFailures)) {
      if (item?.lockedUntil && new Date(item.lockedUntil).getTime() > now) kept[key] = item;
    }
    authFailures = kept;
  }
  return { ...store, sessions, authFailures };
}

// --- Persistance shardée par collection (scalabilité) -----------------------
// Avant : toute la base était un unique blob JSON ('store') réécrit en entier
// à CHAQUE flush. Coût croissant avec la taille de la base (les médias base64
// des conversations/albums pèsent vite plusieurs Mo).
// Désormais : chaque collection top-level (profiles, conversations, ...) est
// stockée dans sa propre ligne `store:<collection>` et seules les collections
// réellement modifiées (détection par empreinte SHA-1) sont réécrites. Un like
// ne réécrit plus que quelques Ko au lieu de toute la base. La migration depuis
// l'ancien blob unique est automatique et transactionnelle au premier démarrage.
const STORE_SHARD_PREFIX = 'store:';
const STORE_MANIFEST_KEY = 'store:__manifest';
const LEGACY_STORE_KEY = 'store';

function hashJson(json) {
  return crypto.createHash('sha1').update(json).digest('hex');
}

// Sérialise chaque collection top-level séparément (après nettoyage sessions/verrous expirés).
function serializeStoreShards(store) {
  const cleaned = cleanStoreForPersistence(store);
  const shards = new Map();
  for (const key of Object.keys(cleaned)) {
    shards.set(key, JSON.stringify(cleaned[key] === undefined ? null : cleaned[key]));
  }
  return shards;
}

// Reconstruit le store en mémoire depuis les lignes `store:<collection>`.
// Le manifeste (liste des collections valides) évite de ressusciter des
// collections orphelines après un renommage/suppression.
function assembleStoreFromShards(shardRows, manifestJson) {
  let manifestKeys = null;
  try {
    const parsed = JSON.parse(manifestJson || 'null');
    if (Array.isArray(parsed) && parsed.length) manifestKeys = parsed;
  } catch { manifestKeys = null; }
  const available = new Map();
  for (const row of shardRows) {
    const key = String(row.key || '').slice(STORE_SHARD_PREFIX.length);
    if (!key || key.startsWith('__')) continue;
    available.set(key, row.value);
  }
  const wanted = manifestKeys || [...available.keys()];
  const assembled = {};
  for (const key of wanted) {
    const raw = available.get(key);
    if (raw === undefined) continue;
    try { assembled[key] = JSON.parse(raw); }
    catch { console.error(`[persistence] shard "${key}" illisible — collection réinitialisée.`); }
  }
  return assembled;
}

// Suit l'empreinte de chaque shard tel qu'écrit en base pour ne réécrire que ce
// qui a changé. primeRaw() initialise les empreintes depuis les valeurs lues en
// base, si bien que les mutations faites au chargement (purge, réconciliation
// admin...) sont détectées et persistées au premier flush.
function createShardDiffer() {
  const lastHashes = new Map();
  let lastManifestJson = '';
  return {
    primeRaw(shardRows, manifestJson) {
      for (const row of shardRows) {
        const key = String(row.key || '').slice(STORE_SHARD_PREFIX.length);
        if (!key || key.startsWith('__')) continue;
        lastHashes.set(key, hashJson(String(row.value)));
      }
      lastManifestJson = String(manifestJson || '');
    },
    diff(store) {
      const shards = serializeStoreShards(store);
      const changed = [];
      for (const [key, json] of shards) {
        const hash = hashJson(json);
        if (lastHashes.get(key) !== hash) changed.push({ key, json, hash });
      }
      const removed = [...lastHashes.keys()].filter((key) => !shards.has(key));
      const manifestJson = JSON.stringify([...shards.keys()]);
      return { changed, removed, manifestJson, manifestChanged: manifestJson !== lastManifestJson };
    },
    commit(result) {
      for (const { key, hash } of result.changed) lastHashes.set(key, hash);
      for (const key of result.removed) lastHashes.delete(key);
      if (result.manifestChanged) lastManifestJson = result.manifestJson;
    },
  };
}

async function initPostgresStore(databaseUrl, seeded) {
  const pgModule = await import('pg');
  const Pool = pgModule.Pool || pgModule.default?.Pool;
  if (!Pool) throw new Error('Module pg introuvable.');
  // SSL requis par défaut chez les hébergeurs managés (Render, Neon, Supabase…) sauf en local
  // ou sur le réseau privé Railway (postgres.railway.internal) qui ne fait pas de TLS.
  const isLocal = /@(localhost|127\.0\.0\.1|\/)/.test(databaseUrl) || /host=\/(tmp|var)/.test(databaseUrl);
  const isInternalPrivate = /\.railway\.internal|\.internal[:/]/.test(databaseUrl);
  const pgsslEnv = String(process.env.PGSSL || '').toLowerCase();
  const sslDisabled = pgsslEnv === 'disable' || pgsslEnv === 'false' || /sslmode=disable/.test(databaseUrl) || isLocal || isInternalPrivate;
  let ssl = false;
  if (!sslDisabled && (/sslmode=require/.test(databaseUrl) || pgsslEnv === 'require' || isProduction())) {
    ssl = { rejectUnauthorized: false };
  }
  const pool = new Pool({ connectionString: databaseUrl, ssl, max: 5, idleTimeoutMillis: 30000 });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_profile_id TEXT,
      actor_role TEXT,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS age_verification_events (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      status TEXT NOT NULL,
      provider TEXT NOT NULL,
      mode TEXT NOT NULL,
      created_at TEXT NOT NULL,
      verified_at TEXT,
      expires_at TEXT,
      metadata_json TEXT
    );
    CREATE TABLE IF NOT EXISTS legal_acceptances (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      version TEXT NOT NULL,
      accepted_at TEXT NOT NULL,
      ip_hint TEXT,
      user_agent TEXT
    );
  `);

  // Chargement : shards si présents, sinon migration depuis l'ancien blob unique.
  const shardRows = (await pool.query('SELECT key, value FROM app_state WHERE key LIKE $1', [`${STORE_SHARD_PREFIX}%`])).rows;
  const manifestRow = shardRows.find((row) => row.key === STORE_MANIFEST_KEY);
  const dataRows = shardRows.filter((row) => row.key !== STORE_MANIFEST_KEY);
  const legacyRow = (await pool.query('SELECT value FROM app_state WHERE key = $1', [LEGACY_STORE_KEY])).rows[0];
  const differ = createShardDiffer();
  let initial;
  let purgeLegacyOnNextWrite = Boolean(legacyRow?.value);
  if (manifestRow || dataRows.length) {
    initial = assembleStoreFromShards(dataRows, manifestRow?.value);
    differ.primeRaw(dataRows, manifestRow?.value);
  } else if (legacyRow?.value) {
    initial = JSON.parse(legacyRow.value);
    console.log('[persistence] migration du blob unique vers la persistance par collection…');
  } else {
    initial = seeded;
  }
  const store = ensureStoreCollections(initial);

  async function writeChangedShards(snapshot) {
    const result = differ.diff(snapshot);
    const nothingToDo = !result.changed.length && !result.removed.length && !result.manifestChanged && !purgeLegacyOnNextWrite;
    if (nothingToDo) return;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const at = nowIso();
      for (const { key, json } of result.changed) {
        await client.query(
          'INSERT INTO app_state(key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at',
          [STORE_SHARD_PREFIX + key, json, at],
        );
      }
      if (result.removed.length) {
        await client.query('DELETE FROM app_state WHERE key = ANY($1)', [result.removed.map((key) => STORE_SHARD_PREFIX + key)]);
      }
      if (result.manifestChanged) {
        await client.query(
          'INSERT INTO app_state(key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at',
          [STORE_MANIFEST_KEY, result.manifestJson, at],
        );
      }
      if (purgeLegacyOnNextWrite) {
        await client.query('DELETE FROM app_state WHERE key = $1', [LEGACY_STORE_KEY]);
      }
      await client.query('COMMIT');
      differ.commit(result);
      if (purgeLegacyOnNextWrite) {
        purgeLegacyOnNextWrite = false;
        console.log('[persistence] migration terminée : ancien blob supprimé, persistance par collection active.');
      }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  // Sauvegarde sérialisée : jamais deux écritures en parallèle, et si plusieurs
  // persist() arrivent pendant une écriture, seul le dernier état est ré-enregistré.
  let saving = false;
  let pendingStore = null;
  async function flush(next) {
    pendingStore = next;
    if (saving) return;
    saving = true;
    try {
      while (pendingStore) {
        const snapshot = pendingStore;
        pendingStore = null;
        await writeChangedShards(snapshot);
      }
    } catch (error) {
      console.error('[persistence:postgres] échec de sauvegarde :', error.message);
    } finally {
      saving = false;
    }
  }
  function persist(nextStore = store) { flush(nextStore); }
  await flush(store);

  console.log('[persistence] PostgreSQL connecté — persistance par collection (écritures différentielles).');
  return {
    type: 'postgres',
    path: 'postgres',
    store,
    persist,
    audit(entry) {
      pool.query(
        'INSERT INTO audit_logs(id, actor_profile_id, actor_role, method, path, status_code, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [entry.id || makeId('audit'), entry.profileId || null, entry.role || null, entry.method, entry.path, Number(entry.statusCode || 0), entry.createdAt || nowIso()],
      ).catch(() => {});
    },
    recordAgeEvent(entry) {
      pool.query(
        'INSERT INTO age_verification_events(id, session_id, status, provider, mode, created_at, verified_at, expires_at, metadata_json) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [entry.id || makeId('ageevt'), entry.sessionId || null, entry.status || 'created', entry.provider || 'demo', entry.mode || 'demo', entry.createdAt || nowIso(), entry.verifiedAt || null, entry.expiresAt || null, JSON.stringify(entry.metadata || {})],
      ).catch(() => {});
    },
    async close() {
      try { await flush(store); } catch {}
      // attendre la fin d'une écriture en cours avant de fermer le pool
      for (let i = 0; i < 100 && saving; i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
      try { await pool.end(); } catch {}
    },
  };
}

async function initPersistentStore(seedStore) {
  fs.mkdirSync(dataRoot, { recursive: true });
  const seeded = ensureStoreCollections(seedStore);
  // 1) PostgreSQL si DATABASE_URL est défini (Railway Postgres recommandé en production).
  const databaseUrl = String(process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
  const requireDatabaseUrl = envFlag('REQUIRE_DATABASE_URL', false);
  if (!databaseUrl && requireDatabaseUrl) {
    throw new Error('DATABASE_URL ou POSTGRES_URL est obligatoire : ajoutez la variable Railway DATABASE_URL=${{Postgres.DATABASE_URL}} ou désactivez REQUIRE_DATABASE_URL.');
  }
  if (databaseUrl) {
    try {
      return await initPostgresStore(databaseUrl, seeded);
    } catch (error) {
      if (requireDatabaseUrl) {
        throw new Error(`PostgreSQL obligatoire mais indisponible : ${error.message}`);
      }
      console.error(`[persistence] PostgreSQL indisponible (${error.message}) — bascule sur SQLite/JSON.`);
    }
  }
  // 2) SQLite local, puis 3) fichier JSON de secours.
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(sqlitePath);
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        actor_profile_id TEXT,
        actor_role TEXT,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS age_verification_events (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        status TEXT NOT NULL,
        provider TEXT NOT NULL,
        mode TEXT NOT NULL,
        created_at TEXT NOT NULL,
        verified_at TEXT,
        expires_at TEXT,
        metadata_json TEXT
      );
      CREATE TABLE IF NOT EXISTS legal_acceptances (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        version TEXT NOT NULL,
        accepted_at TEXT NOT NULL,
        ip_hint TEXT,
        user_agent TEXT
      );
    `);

    // Chargement : shards si présents, sinon migration depuis l'ancien blob unique.
    const shardRows = db.prepare('SELECT key, value FROM app_state WHERE key LIKE ?').all(`${STORE_SHARD_PREFIX}%`);
    const manifestRow = shardRows.find((row) => row.key === STORE_MANIFEST_KEY);
    const dataRows = shardRows.filter((row) => row.key !== STORE_MANIFEST_KEY);
    const legacyRow = db.prepare('SELECT value FROM app_state WHERE key = ?').get(LEGACY_STORE_KEY);
    const differ = createShardDiffer();
    let initial;
    let purgeLegacyOnNextWrite = Boolean(legacyRow?.value);
    if (manifestRow || dataRows.length) {
      initial = assembleStoreFromShards(dataRows, manifestRow?.value);
      differ.primeRaw(dataRows, manifestRow?.value);
    } else if (legacyRow?.value) {
      initial = JSON.parse(legacyRow.value);
      console.log('[persistence] migration du blob unique vers la persistance par collection…');
    } else {
      initial = seeded;
    }
    const store = ensureStoreCollections(initial);

    const saveStmt = db.prepare('INSERT INTO app_state(key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at');
    const deleteStmt = db.prepare('DELETE FROM app_state WHERE key = ?');
    const auditStmt = db.prepare('INSERT INTO audit_logs(id, actor_profile_id, actor_role, method, path, status_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const ageStmt = db.prepare('INSERT INTO age_verification_events(id, session_id, status, provider, mode, created_at, verified_at, expires_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

    function persist(nextStore = store) {
      const result = differ.diff(nextStore);
      const nothingToDo = !result.changed.length && !result.removed.length && !result.manifestChanged && !purgeLegacyOnNextWrite;
      if (nothingToDo) return;
      const at = nowIso();
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const { key, json } of result.changed) saveStmt.run(STORE_SHARD_PREFIX + key, json, at);
        for (const key of result.removed) deleteStmt.run(STORE_SHARD_PREFIX + key);
        if (result.manifestChanged) saveStmt.run(STORE_MANIFEST_KEY, result.manifestJson, at);
        if (purgeLegacyOnNextWrite) deleteStmt.run(LEGACY_STORE_KEY);
        db.exec('COMMIT');
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
      differ.commit(result);
      if (purgeLegacyOnNextWrite) {
        purgeLegacyOnNextWrite = false;
        console.log('[persistence] migration terminée : ancien blob supprimé, persistance par collection active.');
      }
    }
    persist(store);
    return {
      type: 'sqlite',
      path: sqlitePath,
      store,
      persist,
      _db: db,
      audit(entry) {
        auditStmt.run(entry.id || makeId('audit'), entry.profileId || null, entry.role || null, entry.method, entry.path, Number(entry.statusCode || 0), entry.createdAt || nowIso());
      },
      recordAgeEvent(entry) {
        ageStmt.run(entry.id || makeId('ageevt'), entry.sessionId || null, entry.status || 'created', entry.provider || 'demo', entry.mode || 'demo', entry.createdAt || nowIso(), entry.verifiedAt || null, entry.expiresAt || null, JSON.stringify(entry.metadata || {}));
      },
      close() {
        db.close();
      },
    };
  } catch (error) {
    let store = seeded;
    if (fs.existsSync(fallbackJsonPath)) {
      try { store = ensureStoreCollections(JSON.parse(fs.readFileSync(fallbackJsonPath, 'utf8'))); }
      catch { store = seeded; }
    }
    // Mode secours fichier : on évite au moins les réécritures identiques.
    let lastWrittenHash = '';
    function persist(nextStore = store) {
      const json = JSON.stringify(cleanStoreForPersistence(nextStore), null, 2);
      const hash = hashJson(json);
      if (hash === lastWrittenHash) return;
      const tmpPath = `${fallbackJsonPath}.tmp`;
      fs.writeFileSync(tmpPath, json);
      fs.renameSync(tmpPath, fallbackJsonPath);
      lastWrittenHash = hash;
    }
    persist(store);
    return {
      type: 'json_fallback',
      path: fallbackJsonPath,
      warning: `SQLite indisponible (${error.message}). Mode fichier JSON de secours actif.`,
      store,
      persist,
      audit() {},
      recordAgeEvent() {},
      close() {},
    };
  }
}

const nowIso = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function maskEmail(value) {
  const email = normalizeEmail(value);
  if (!email || !email.includes('@')) return '';
  const [name, domain] = email.split('@');
  const safeName = name.length <= 2 ? `${name[0] || '*'}*` : `${name.slice(0, 2)}***`;
  return `${safeName}@${domain}`;
}

function isSafeIdentifier(value) {
  return SAFE_ID_RE.test(String(value || ''));
}

function isJsonWriteRequest(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return false;
  if (!req.path.startsWith('/api/')) return false;
  return true;
}

function jsonLimitForRequest(req) {
  if (req.method === 'POST' && /^\/api\/albums\/[^/]+\/media$/.test(req.path)) return ALBUM_MEDIA_JSON_BODY_LIMIT;
  if (req.method === 'POST' && req.path === '/api/feed/posts') return ALBUM_MEDIA_JSON_BODY_LIMIT;
  if (req.method === 'POST' && /^\/api\/(conversations|instant-chats)\/[^/]+\/messages$/.test(req.path)) return MESSAGE_JSON_BODY_LIMIT;
  return DEFAULT_JSON_BODY_LIMIT;
}

function requireJsonContentType(req, res, next) {
  if (!isJsonWriteRequest(req)) return next();
  const length = Number(req.get('content-length') || 0);
  if (length > 0 && !String(req.get('content-type') || '').toLowerCase().includes('application/json')) {
    return res.status(415).json({ error: 'unsupported_media_type', message: 'Content-Type application/json requis.' });
  }
  return next();
}

function dynamicJsonParser(req, res, next) {
  return express.json({ limit: jsonLimitForRequest(req), strict: true })(req, res, next);
}

function safeClientError(error) {
  const status = Number(error?.statusCode || error?.status || 500);
  if (status >= 400 && status < 500) return error?.message || 'Requête invalide.';
  return isProduction() ? 'Erreur serveur.' : (error?.message || 'Erreur serveur.');
}

function configuredAdminEmail() {
  return normalizeEmail(process.env.ADMIN_EMAIL || '');
}

function configuredAdminPassword() {
  return String(process.env.ADMIN_INITIAL_PASSWORD || '');
}

function ownerAdminEmails() {
  const raw = process.env.OWNER_ADMIN_EMAILS || process.env.ADMIN_OWNER_EMAILS || (isProduction() ? '' : OWNER_ADMIN_EMAIL);
  return String(raw)
    .split(/[;,\s]+/)
    .map(normalizeEmail)
    .filter(Boolean);
}

function isOwnerAdminEmail(email) {
  return ownerAdminEmails().includes(normalizeEmail(email));
}

function bundledOwnerAdminPassword() {
  return String(process.env.OWNER_ADMIN_INITIAL_PASSWORD || BUNDLED_OWNER_ADMIN_PASSWORD || '');
}

function hasBundledOwnerAdminPassword() {
  const password = bundledOwnerAdminPassword();
  // V73: seul OWNER_ADMIN_INITIAL_PASSWORD défini dans l’environnement peut activer ce mode.
  return Boolean(process.env.OWNER_ADMIN_INITIAL_PASSWORD) && isStrongAdminPassword(password);
}

function primaryOwnerAdminEmail() {
  return ownerAdminEmails()[0] || (isProduction() ? '' : OWNER_ADMIN_EMAIL);
}

function bootstrapAdminEmail() {
  return normalizeEmail(process.env.ADMIN_BOOTSTRAP_EMAIL || primaryOwnerAdminEmail() || DEFAULT_ADMIN_EMAIL);
}

function bootstrapAdminPasswordPath() {
  return path.resolve(dataRoot, BOOTSTRAP_ADMIN_PASSWORD_FILE);
}

function generateBootstrapAdminPassword() {
  return crypto.randomBytes(BOOTSTRAP_ADMIN_PASSWORD_LENGTH).toString('base64url');
}

function bootstrapAdminPassword() {
  const passwordPath = bootstrapAdminPasswordPath();
  try {
    if (fs.existsSync(passwordPath)) {
      const existing = fs.readFileSync(passwordPath, 'utf8').trim();
      if (existing.length >= 16 && existing !== DEFAULT_ADMIN_PASSWORD) return existing;
    }
  } catch {}

  const generated = generateBootstrapAdminPassword();
  try {
    fs.mkdirSync(dataRoot, { recursive: true });
    fs.writeFileSync(passwordPath, `${generated}
`, { mode: 0o600 });
  } catch (error) {
    console.warn(`[admin-bootstrap] Impossible d’écrire ${BOOTSTRAP_ADMIN_PASSWORD_FILE}: ${error.message}`);
  }
  console.warn(`[admin-bootstrap] Compte admin créé automatiquement. Email: ${bootstrapAdminEmail()} Mot de passe initial: ${generated}`);
  console.warn('[admin-bootstrap] Change ce mot de passe en configurant ADMIN_EMAIL et ADMIN_INITIAL_PASSWORD dans Render.');
  return generated;
}

function shouldUseBootstrapAdmin() {
  if (process.env.NODE_ENV !== 'production') return false;
  if (hasSafeConfiguredAdmin()) return false;
  return !envFlag('DISABLE_BOOTSTRAP_ADMIN', false);
}

function adminEmailFromEnv() {
  const configured = configuredAdminEmail();
  if (configured) return configured;
  if (shouldUseBootstrapAdmin()) return bootstrapAdminEmail();
  return process.env.NODE_ENV === 'production' ? '' : DEFAULT_ADMIN_EMAIL;
}

function adminPasswordFromEnv() {
  const configured = configuredAdminPassword();
  if (configured) return configured;
  const targetEmail = adminEmailFromEnv() || bootstrapAdminEmail() || primaryOwnerAdminEmail();
  if (isOwnerAdminEmail(targetEmail) && hasBundledOwnerAdminPassword()) return bundledOwnerAdminPassword();
  if (shouldUseBootstrapAdmin()) return bootstrapAdminPassword();
  return process.env.NODE_ENV === 'production' ? '' : DEFAULT_ADMIN_PASSWORD;
}

function hasSafeConfiguredAdmin() {
  const email = configuredAdminEmail();
  const password = configuredAdminPassword();
  if (!email || !password) return false;
  return isStrongAdminPassword(password);
}

function isStrongAdminPassword(password) {
  const value = String(password || '');
  if (value.length < ADMIN_PASSWORD_MIN_LENGTH) return false;
  if (value === DEFAULT_ADMIN_PASSWORD) return false;
  if (/^(password|motdepasse|admin|secret|changeme)/i.test(value)) return false;
  return true;
}

function shouldSeedAdminAccount() {
  if (process.env.NODE_ENV !== 'production') return true;
  return hasSafeConfiguredAdmin() || hasBundledOwnerAdminPassword() || shouldUseBootstrapAdmin();
}

function allowDemoAgeVerificationInProduction() {
  return envFlag('ALLOW_DEMO_AGE_IN_PRODUCTION', false);
}

function isDemoPaidActivationAllowed() {
  return envFlag('ENABLE_DEMO_PAID_ACTIVATION', false);
}

function seedWelcomePromoEnabled() {
  return envFlag('SEED_WELCOME_PROMO', !isProduction());
}

function paymentProviderConfigured() {
  const provider = String(process.env.PAYMENT_PROVIDER || process.env.PAYMENT_PROVIDER_NAME || '').trim().toLowerCase();
  const stripeSecret = String(process.env.STRIPE_SECRET_KEY || '').trim();
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || '').trim();
  if (provider === 'stripe') return stripeSecret.startsWith('sk_') && webhookSecret.length >= 16;
  return Boolean(provider && !['demo', 'none', 'disabled', 'stub'].includes(provider));
}

// --- Intégration Stripe Checkout ---------------------------------------------
// Aucune dépendance npm : on appelle l'API REST Stripe via fetch (Node 22 natif)
// et on vérifie la signature du webhook avec le module crypto. Pour activer :
//   PAYMENT_PROVIDER=stripe
//   STRIPE_SECRET_KEY=sk_live_... (ou sk_test_...)
//   STRIPE_WEBHOOK_SECRET=whsec_... (obtenu dans le dashboard Stripe → Webhooks)
//   PAYMENT_SUCCESS_URL / PAYMENT_CANCEL_URL (URLs publiques de retour, optionnel)
function stripeSecretKey() {
  return String(process.env.STRIPE_SECRET_KEY || '').trim();
}

function stripeWebhookSecret() {
  return String(process.env.STRIPE_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || '').trim();
}

function isStripeProvider() {
  return String(process.env.PAYMENT_PROVIDER || '').trim().toLowerCase() === 'stripe';
}

function paymentReturnUrls() {
  const base = String(process.env.PUBLIC_BASE_URL || process.env.FRONTEND_ORIGIN || '').split(',')[0].trim().replace(/\/$/, '');
  const success = String(process.env.PAYMENT_SUCCESS_URL || '').trim() || (base ? `${base}/abonnement?paiement=succes&session_id={CHECKOUT_SESSION_ID}` : '');
  const cancel = String(process.env.PAYMENT_CANCEL_URL || '').trim() || (base ? `${base}/abonnement?paiement=annule` : '');
  return { success, cancel };
}

// Encode un objet imbriqué au format application/x-www-form-urlencoded attendu par Stripe
// (ex. { line_items: [{ price: 'x' }] } => line_items[0][price]=x).
function stripeFormEncode(obj, prefix = '') {
  const parts = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const itemKey = `${fullKey}[${index}]`;
        if (item !== null && typeof item === 'object') parts.push(stripeFormEncode(item, itemKey));
        else parts.push(`${encodeURIComponent(itemKey)}=${encodeURIComponent(item)}`);
      });
    } else if (typeof value === 'object') {
      parts.push(stripeFormEncode(value, fullKey));
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(value)}`);
    }
  }
  return parts.filter(Boolean).join('&');
}

// Crée une session Stripe Checkout pour un montant ponctuel (pas d'abonnement récurrent :
// la reconduction automatique reste désactivée comme indiqué dans les CGV).
async function createStripeCheckoutSession({ quote, profileId, profileEmail, returnUrls }) {
  const secret = stripeSecretKey();
  if (!secret) throw Object.assign(new Error('Clé Stripe absente.'), { statusCode: 500, code: 'stripe_not_configured' });

  const planLabel = quote.plan?.label || 'Abonnement';
  const payload = {
    mode: 'payment',
    'line_items': [{
      quantity: 1,
      'price_data': {
        currency: String(process.env.PAYMENT_CURRENCY || 'eur').toLowerCase(),
        'unit_amount': Math.max(0, Math.round(Number(quote.amountDueCents || 0))),
        'product_data': { name: `Voluptia — ${planLabel}` },
      },
    }],
    'success_url': returnUrls.success,
    'cancel_url': returnUrls.cancel,
    'client_reference_id': profileId,
    metadata: {
      profileId,
      planId: quote.plan?.id || '',
      promoCode: quote.promo?.code || '',
      amountCents: String(quote.amountDueCents || 0),
      commissionCents: String(quote.commissionCents || 0),
    },
  };
  if (profileEmail) payload['customer_email'] = profileEmail;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-06-20',
      },
      body: stripeFormEncode(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || 'Création de session Stripe impossible.';
      throw Object.assign(new Error(message), { statusCode: 502, code: 'stripe_session_failed' });
    }
    return data; // { id, url, ... }
  } catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error('Stripe n\'a pas répondu à temps.'), { statusCode: 504, code: 'stripe_timeout' });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// Vérifie la signature du webhook Stripe (en-tête Stripe-Signature) à partir du
// corps BRUT de la requête. Empêche toute activation d'abonnement frauduleuse.
function verifyStripeWebhookSignature(rawBody, signatureHeader, secret, toleranceSeconds = 300) {
  if (!secret || !signatureHeader || !rawBody) return false;
  const parts = String(signatureHeader).split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    if (k === 't') acc.timestamp = v;
    if (k === 'v1') (acc.signatures = acc.signatures || []).push(v);
    return acc;
  }, {});
  if (!parts.timestamp || !parts.signatures?.length) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(parts.timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;
  const payload = `${parts.timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return parts.signatures.some((sig) => {
    const sigBuffer = Buffer.from(String(sig), 'utf8');
    return sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  });
}

// --- Envoi d'emails : SMTP (o2switch) en priorité, sinon Resend, sinon mode log ----
// SMTP (o2switch) : SMTP_HOST, SMTP_PORT (465 SSL ou 587 STARTTLS), SMTP_USER, SMTP_PASS,
//   et EMAIL_FROM="Voluptia <noreply@votredomaine.fr>" (adresse de votre boîte o2switch).
// Resend (alternative) : RESEND_API_KEY=re_... + EMAIL_FROM avec un domaine vérifié.
// Sans aucune configuration, on bascule en "mode log" : l'email est écrit dans la console.
function resendApiKey() {
  return String(process.env.RESEND_API_KEY || '').trim();
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function emailConfigured() {
  return smtpConfigured() || resendApiKey().startsWith('re_');
}

function emailFromAddress() {
  // SMTP/o2switch : mettez votre adresse (ex. "Voluptia <noreply@votredomaine.fr>").
  // Resend sans domaine vérifié n'autorise que onboarding@resend.dev.
  return String(process.env.EMAIL_FROM || 'Voluptia <onboarding@resend.dev>').trim();
}

function publicBaseUrl() {
  return String(process.env.PUBLIC_BASE_URL || process.env.FRONTEND_ORIGIN || '').split(',')[0].trim().replace(/\/$/, '');
}

let smtpTransporter = null;
function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  smtpTransporter = nodemailer.createTransport({
    host: String(process.env.SMTP_HOST || '').trim(),
    port,
    secure,
    auth: { user: String(process.env.SMTP_USER || '').trim(), pass: String(process.env.SMTP_PASS || '') },
  });
  return smtpTransporter;
}

async function sendEmailViaSmtp({ to, subject, html, text }) {
  try {
    const info = await getSmtpTransporter().sendMail({ from: emailFromAddress(), to, subject, html, text });
    return { sent: true, id: info?.messageId, via: 'smtp' };
  } catch (error) {
    console.error(`[email:smtp] Échec d'envoi à ${to}: ${error.message}`);
    return { sent: false, reason: 'smtp_failed', detail: error.message };
  }
}

async function sendEmail({ to, subject, html, text }) {
  if (!to) return { sent: false, reason: 'no_recipient' };
  // 1) SMTP (o2switch) si configuré.
  if (smtpConfigured()) {
    return sendEmailViaSmtp({ to, subject, html, text });
  }
  // 2) Mode dégradé : aucune config -> on journalise au lieu d'envoyer.
  if (!resendApiKey().startsWith('re_')) {
    console.log(`[email:log] (non envoyé, aucun SMTP/Resend configuré) Pour: ${to} | Sujet: ${subject}`);
    if (text) console.log(`[email:log] Contenu: ${text}`);
    return { sent: false, reason: 'not_configured', logged: true };
  }
  // 3) Resend.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: emailFromAddress(), to: [to], subject, html, text }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`[email] Échec d'envoi à ${to}: ${data?.message || response.status}`);
      return { sent: false, reason: 'send_failed', detail: data?.message };
    }
    return { sent: true, id: data?.id, via: 'resend' };
  } catch (error) {
    console.error(`[email] Erreur réseau lors de l'envoi à ${to}: ${error.message}`);
    return { sent: false, reason: 'network_error' };
  } finally {
    clearTimeout(timeout);
  }
}

// Génère un jeton aléatoire et son empreinte (on ne stocke jamais le jeton en clair).
function makeEmailToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

function hashEmailToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function emailLayout(title, bodyHtml) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#1a0f1a;font-family:Arial,Helvetica,sans-serif;color:#fff;padding:24px">
    <div style="max-width:480px;margin:0 auto;background:#2a1a2a;border-radius:16px;padding:28px">
      <h1 style="color:#ff8fc5;font-size:1.4rem;margin:0 0 16px">Voluptia</h1>
      <h2 style="font-size:1.1rem;margin:0 0 12px">${title}</h2>
      ${bodyHtml}
      <p style="color:rgba(255,255,255,.4);font-size:.75rem;margin-top:24px">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    </div></body></html>`;
}

async function sendVerificationEmail(to, token) {
  const base = publicBaseUrl();
  const link = base ? `${base}/verifier-email?token=${token}` : `(configurez PUBLIC_BASE_URL) token=${token}`;
  return sendEmail({
    to,
    subject: 'Confirmez votre adresse email — Voluptia',
    text: `Confirmez votre adresse en ouvrant ce lien : ${link}`,
    html: emailLayout('Confirmez votre adresse', `<p style="color:rgba(255,255,255,.8);line-height:1.6">Bienvenue ! Cliquez sur le bouton ci-dessous pour confirmer votre adresse email.</p>
      <p style="text-align:center;margin:24px 0"><a href="${link}" style="background:linear-gradient(90deg,#ff8fc5,#d93c86);color:#fff;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:600;display:inline-block">Confirmer mon email</a></p>
      <p style="color:rgba(255,255,255,.5);font-size:.8rem">Ou copiez ce lien : ${link}</p>`),
  });
}

async function sendPasswordResetEmail(to, token) {
  const base = publicBaseUrl();
  const link = base ? `${base}/reinitialiser-mot-de-passe?token=${token}` : `(configurez PUBLIC_BASE_URL) token=${token}`;
  return sendEmail({
    to,
    subject: 'Réinitialisation de votre mot de passe — Voluptia',
    text: `Réinitialisez votre mot de passe ici : ${link} (valable 1 heure)`,
    html: emailLayout('Réinitialiser votre mot de passe', `<p style="color:rgba(255,255,255,.8);line-height:1.6">Vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable 1 heure.</p>
      <p style="text-align:center;margin:24px 0"><a href="${link}" style="background:linear-gradient(90deg,#ff8fc5,#d93c86);color:#fff;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:600;display:inline-block">Choisir un nouveau mot de passe</a></p>
      <p style="color:rgba(255,255,255,.5);font-size:.8rem">Ou copiez ce lien : ${link}</p>`),
  });
}

function formatEmailDate(value) {
  try { return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return ''; }
}

// Email envoyé après confirmation d'un abonnement : remerciement + reçu récapitulatif.
async function sendSubscriptionEmail(to, { pseudo, planName, amountLabel, startedAt, expiresAt, reference, promoCode, free }) {
  const row = (label, value) => `<tr><td style="padding:7px 0;color:rgba(255,255,255,.55);font-size:.85rem">${label}</td><td style="padding:7px 0;color:#fff;font-size:.9rem;text-align:right;font-weight:600">${value}</td></tr>`;
  const receipt = `
    <table style="width:100%;border-collapse:collapse;margin:8px 0 4px">
      ${row('Formule', planName)}
      ${row('Montant', free ? 'Offert' : amountLabel)}
      ${promoCode ? row('Code promo', promoCode) : ''}
      ${row('Début', formatEmailDate(startedAt))}
      ${row("Valable jusqu'au", formatEmailDate(expiresAt))}
      ${reference ? row('Référence', reference) : ''}
    </table>`;
  return sendEmail({
    to,
    subject: 'Merci pour votre abonnement — Voluptia',
    text: `Merci ${pseudo || ''} ! Votre abonnement ${planName} est confirmé. ${free ? 'Offert' : 'Montant : ' + amountLabel}. Valable jusqu'au ${formatEmailDate(expiresAt)}. Référence : ${reference || '-'}.`,
    html: emailLayout('Votre abonnement est confirmé', `
      <p style="color:rgba(255,255,255,.8);line-height:1.6">Merci${pseudo ? ' ' + pseudo : ''} ! Votre abonnement est bien activé. Vous avez désormais accès à l'ensemble des profils, albums et messages.</p>
      <div style="background:#1f121f;border:1px solid rgba(255,143,197,.25);border-radius:12px;padding:14px 18px;margin:18px 0">
        <p style="color:#ff8fc5;font-weight:700;margin:0 0 4px;font-size:.95rem">Reçu d'abonnement</p>
        ${receipt}
      </div>
      <p style="color:rgba(255,255,255,.5);font-size:.8rem">Ce message tient lieu de reçu. Pour toute question, répondez simplement à cet email.</p>`),
  });
}

function hasRealAgeVerificationProvider(provider = ageVerificationProvider()) {
  return Boolean(provider && provider !== 'demo' && provider !== 'none' && provider !== 'disabled');
}

function requiresServerAgeVerification() {
  // Vérification d'âge prestataire désactivée — à réactiver en configurant
  // AGE_VERIFICATION_PROVIDER=veriff (ou ageid/idnow) dans les variables d'environnement.
  // En attendant : inscription libre avec déclaration de majorité + acceptation légale.
  if (envFlag('AGE_VERIFICATION_ENABLED', false)) {
    const provider = ageVerificationProvider();
    if (process.env.NODE_ENV === 'production') {
      if (provider === 'demo') return allowDemoAgeVerificationInProduction();
      return hasRealAgeVerificationProvider(provider);
    }
    return ageVerificationIsStrict() || provider === 'demo';
  }
  return false;
}

function productionConfigWarnings() {
  if (process.env.NODE_ENV !== 'production') return [];
  const provider = ageVerificationProvider();
  const warnings = [];
  if (!hasSafeConfiguredAdmin()) {
    if (hasBundledOwnerAdminPassword()) {
      warnings.push('OWNER_ADMIN_INITIAL_PASSWORD est actif : gardez-le uniquement dans les variables secrètes Render, jamais dans Git.');
    } else if (shouldUseBootstrapAdmin()) {
      warnings.push('ADMIN_EMAIL/ADMIN_INITIAL_PASSWORD absents ou non sûrs : un admin bootstrap temporaire est généré automatiquement. Configurez des identifiants admin définitifs dans Render.');
    } else {
      warnings.push('ADMIN_EMAIL/ADMIN_INITIAL_PASSWORD absents ou non sûrs : aucun admin ne sera créé car DISABLE_BOOTSTRAP_ADMIN=true.');
    }
  }
  if (!hasRealAgeVerificationProvider(provider) && !(provider === 'demo' && allowDemoAgeVerificationInProduction())) {
    warnings.push('AGE_VERIFICATION_PROVIDER réel non configuré : inscription en mode déclaration majeure + CGU, sans crash serveur.');
  }
  if (!paymentProviderConfigured()) {
    warnings.push('Prestataire de paiement non configuré : les abonnements payants restent bloqués tant qu’un checkout serveur et des webhooks signés ne sont pas branchés.');
  }
  if (seedWelcomePromoEnabled()) {
    warnings.push('SEED_WELCOME_PROMO actif : un code gratuit de bienvenue est présent. Désactivez-le pour une ouverture officielle sans offre publique.');
  }
  return warnings;
}

function assertProductionConfig() {
  const warnings = productionConfigWarnings();
  if (warnings.length) {
    console.warn(`[config] Production déployée avec avertissements: ${warnings.join(' ')}`);
  }
  return warnings;
}

function pairKey(a, b) {
  return `${a || ''}::${b || ''}`;
}

function parsePositiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.floor(n));
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_TEXT = {
  pseudo: 40,
  city: 80,
  headline: 160,
  bio: 1200,
  message: 1200,
  comment: 600,
  title: 120,
  description: 600,
  reason: 800,
};

const MEDIA_REACTIONS = ['heart', 'fire', 'wow', 'clap', 'eyes'];
const MEDIA_REACTION_LABELS = { heart: '❤️ J’aime', fire: '🔥 Canon', wow: '😍 Waouh', clap: '👏 Bravo', eyes: '👀 Intrigué' };
const ICEBREAKER_MESSAGES = [
  'Tu es libre ce soir ?',
  'On discute un peu ?',
  'Qu’est-ce que tu recherches ici ?',
  'Tu préfères commencer par discuter ou voir les albums ?',
];

const MESSAGE_MEDIA_MAX_CHARS = 9_500_000;
const MESSAGE_MEDIA_MAX_BYTES = 7_000_000;
const MESSAGE_MEDIA_EXPIRIES = new Set([5, 10]);
const MESSAGE_ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MESSAGE_ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
// Messages vocaux : formats produits par MediaRecorder (Chrome/Android: webm/opus, Safari/iOS: mp4).
const MESSAGE_ALLOWED_AUDIO_TYPES = new Set(['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg']);
const MESSAGE_AUDIO_MAX_BYTES = 6_000_000;
const MESSAGE_AUDIO_MAX_SECONDS = 300;
const ALBUM_MEDIA_MAX_CHARS = 34_000_000;
const ALBUM_MEDIA_MAX_BYTES = 25_000_000;
const ALBUM_ALLOWED_IMAGE_TYPES = MESSAGE_ALLOWED_IMAGE_TYPES;
const ALBUM_ALLOWED_VIDEO_TYPES = MESSAGE_ALLOWED_VIDEO_TYPES;


const VALIDATION = {
  minAge: 18,
  maxAge: 99,
  minHeightCm: 100,
  maxHeightCm: 230,
  minWeightKg: 35,
  maxWeightKg: 250,
  minPasswordLength: 10,
};

function limitText(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function defaultProfilePhoto(label = 'AS', from = '#d6a76c', to = '#7b2442') {
  const initials = String(label || 'AS').replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'AS';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="640" height="640" rx="160" fill="url(#g)"/><circle cx="510" cy="120" r="118" fill="rgba(255,255,255,.14)"/><circle cx="120" cy="520" r="160" fill="rgba(0,0,0,.16)"/><text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="190" font-weight="800" fill="#fff8ef">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function cleanProfilePhoto(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('data:image/')) return text.slice(0, 1_500_000);
  if (/^https:\/\//i.test(text) || /^http:\/\/localhost[:/]/i.test(text) || text.startsWith('/')) return text.slice(0, 1200);
  return '';
}


function googleClientIds() {
  return String(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function base64UrlDecodeBuffer(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

function decodeJwtJson(part) {
  try {
    return JSON.parse(base64UrlDecodeBuffer(part).toString('utf8'));
  } catch {
    return null;
  }
}

let googleJwksCache = { keys: [], expiresAt: 0 };

async function getGoogleJwks() {
  if (googleJwksCache.keys.length && googleJwksCache.expiresAt > Date.now()) return googleJwksCache.keys;
  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw Object.assign(new Error('Clés publiques Google indisponibles.'), { statusCode: 502, code: 'google_jwks_unavailable' });
  const data = await response.json();
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600 * 1000;
  googleJwksCache = {
    keys: Array.isArray(data.keys) ? data.keys : [],
    expiresAt: Date.now() + Math.max(60_000, Math.min(maxAgeMs, 12 * 3600 * 1000)),
  };
  return googleJwksCache.keys;
}

async function verifyGoogleIdToken(idToken) {
  const clientIds = googleClientIds();
  if (!clientIds.length) {
    throw Object.assign(new Error('Connexion Google non configurée côté serveur.'), { statusCode: 503, code: 'google_not_configured' });
  }
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw Object.assign(new Error('Jeton Google invalide.'), { statusCode: 400, code: 'invalid_google_token' });
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJwtJson(encodedHeader);
  const payload = decodeJwtJson(encodedPayload);
  if (!header || !payload || header.alg !== 'RS256' || !header.kid) {
    throw Object.assign(new Error('Jeton Google invalide.'), { statusCode: 400, code: 'invalid_google_token' });
  }
  const jwks = await getGoogleJwks();
  const jwk = jwks.find((key) => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) throw Object.assign(new Error('Clé Google introuvable. Réessayez dans quelques instants.'), { statusCode: 502, code: 'google_key_not_found' });
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const verified = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    base64UrlDecodeBuffer(encodedSignature),
  );
  if (!verified) throw Object.assign(new Error('Signature Google invalide.'), { statusCode: 401, code: 'google_signature_invalid' });
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(String(payload.iss || ''))) {
    throw Object.assign(new Error('Émetteur Google invalide.'), { statusCode: 401, code: 'google_issuer_invalid' });
  }
  if (!clientIds.includes(String(payload.aud || ''))) {
    throw Object.assign(new Error('Client ID Google non reconnu.'), { statusCode: 401, code: 'google_audience_invalid' });
  }
  if (Number(payload.exp || 0) <= nowSeconds) {
    throw Object.assign(new Error('Session Google expirée. Réessayez.'), { statusCode: 401, code: 'google_token_expired' });
  }
  if (!payload.sub || !payload.email) {
    throw Object.assign(new Error('Compte Google incomplet.'), { statusCode: 400, code: 'google_profile_incomplete' });
  }
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw Object.assign(new Error('Email Google non vérifié.'), { statusCode: 403, code: 'google_email_not_verified' });
  }
  return payload;
}

function googleDisplayName(payload) {
  return limitText(payload?.name || payload?.given_name || String(payload?.email || '').split('@')[0] || 'Membre Google', MAX_TEXT.pseudo);
}

function inRangeNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number < min || number > max) return null;
  return Math.round(number);
}

function isAccessActive(access) {
  if (!access || access.status !== 'granted') return false;
  if (!access.expiresAt) return true;
  return new Date(access.expiresAt).getTime() > Date.now();
}

const ALBUM_ACCESS_DURATION_SECONDS = new Set([3600, 7200, 18000, 86400, 604800, 2592000]);
function parseAlbumAccessDurationSeconds(raw, fallbackSeconds = null) {
  if (raw === undefined) return fallbackSeconds;
  if (raw === null || raw === '' || raw === 'infinite' || raw === 'infini') return null;
  const value = Number(raw);
  if (!ALBUM_ACCESS_DURATION_SECONDS.has(value)) return undefined;
  return value;
}
function albumAccessExpiresAt(durationSeconds) {
  return durationSeconds ? new Date(Date.now() + durationSeconds * 1000).toISOString() : null;
}
function albumAccessDurationLabel(durationSeconds) {
  if (!durationSeconds) return 'sans limite';
  if (durationSeconds === 3600) return '1h';
  if (durationSeconds === 7200) return '2h';
  if (durationSeconds === 18000) return '5h';
  if (durationSeconds === 86400) return '24h';
  if (durationSeconds === 604800) return '1 semaine';
  if (durationSeconds === 2592000) return '30 jours';
  return `${Math.round(durationSeconds / 3600)}h`;
}

function isPubliclyReachableProfile(profile, currentUser) {
  if (!profile) return false;
  if (!profile.hidden) return true;
  return currentUser?.role === 'admin';
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  // Sécurité : on n'accepte QUE des empreintes scrypt. Aucun repli en clair.
  if (!String(stored).startsWith('scrypt$')) return false;
  const [, salt, expected] = String(stored).split('$');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function authFailureKey(email) {
  return normalizeEmail(email) || 'unknown';
}

function ensureAuthFailures(store) {
  if (!store.authFailures || typeof store.authFailures !== 'object' || Array.isArray(store.authFailures)) store.authFailures = {};
  return store.authFailures;
}

function isAuthLocked(store, email) {
  const failures = ensureAuthFailures(store);
  const item = failures[authFailureKey(email)];
  if (!item?.lockedUntil) return false;
  if (new Date(item.lockedUntil).getTime() > Date.now()) return true;
  delete failures[authFailureKey(email)];
  return false;
}

function recordAuthFailure(store, email) {
  const failures = ensureAuthFailures(store);
  const key = authFailureKey(email);
  const item = failures[key] || { count: 0, firstAt: nowIso(), lockedUntil: null };
  item.count = Number(item.count || 0) + 1;
  item.lastAt = nowIso();
  if (item.count >= MAX_AUTH_FAILURES_PER_ACCOUNT) {
    item.lockedUntil = new Date(Date.now() + AUTH_LOCK_MS).toISOString();
  }
  failures[key] = item;
  return item;
}

function clearAuthFailure(store, email) {
  const failures = ensureAuthFailures(store);
  delete failures[authFailureKey(email)];
}

function issueSession(store, user) {
  const token = crypto.randomBytes(32).toString('base64url');
  const session = {
    id: makeId('sess'),
    tokenHash: hashToken(token),
    userId: user.id,
    profileId: user.profileId,
    role: user.role || 'member',
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
  store.sessions = Array.isArray(store.sessions) ? store.sessions : [];
  store.sessions.push(session);
  return { token, session };
}

function getBearerToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

// ===== Authentification à deux facteurs (TOTP) pour les comptes admin =====
const TWO_FACTOR_ISSUER = 'Voluptia Admin';
const TWO_FACTOR_BACKUP_CODES = 8;
const TWO_FACTOR_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const twoFactorChallenges = new Map(); // challengeToken -> { userId, expiresAt }

function pruneTwoFactorChallenges() {
  const now = Date.now();
  for (const [token, data] of twoFactorChallenges) {
    if (data.expiresAt <= now) twoFactorChallenges.delete(token);
  }
}
function createTwoFactorChallenge(userId) {
  pruneTwoFactorChallenges();
  const token = crypto.randomBytes(32).toString('base64url');
  twoFactorChallenges.set(token, { userId, expiresAt: Date.now() + TWO_FACTOR_CHALLENGE_TTL_MS });
  return token;
}
function peekTwoFactorChallenge(token) {
  if (!token) return null;
  const data = twoFactorChallenges.get(String(token));
  if (!data) return null;
  if (data.expiresAt <= Date.now()) { twoFactorChallenges.delete(String(token)); return null; }
  return data;
}
function clearTwoFactorChallenge(token) {
  twoFactorChallenges.delete(String(token));
}
function userHasTwoFactor(user) {
  return Boolean(user?.twoFactorEnabled && user?.twoFactorSecret);
}
function verifyTotp(secret, code) {
  if (!secret) return false;
  const cleaned = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  try { return authenticator.verify({ token: cleaned, secret }); } catch { return false; }
}
function generateBackupCodes(count = TWO_FACTOR_BACKUP_CODES) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}
function normalizeBackupCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function consumeBackupCode(user, code) {
  const normalized = normalizeBackupCode(code);
  if (!normalized || !Array.isArray(user.twoFactorBackupCodes)) return false;
  const idx = user.twoFactorBackupCodes.findIndex((stored) => verifyPassword(normalized, stored));
  if (idx === -1) return false;
  user.twoFactorBackupCodes.splice(idx, 1); // usage unique
  return true;
}

function getSessionFromRequest(store, req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const session = (store.sessions || []).find((item) => item.tokenHash === hashToken(token));
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return session;
}

function requireAdmin(req, res, next) {
  if (req.currentUser?.role !== 'admin') return res.status(403).json({ error: 'admin_required', message: 'Accès réservé à l’administrateur.' });
  next();
}

function toList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickAvatarTone(type) {
  const normalized = String(type || '').toLowerCase();
  if (normalized.includes('couple')) return 'wine';
  if (normalized.includes('trans')) return 'rose';
  if (normalized.startsWith('f ') || normalized.includes('femme')) return 'rose';
  if (normalized.startsWith('h ') || normalized.includes('homme') || normalized.includes('gay')) return 'blue';
  return 'purple';
}


function albumIdFor(profileId, suffix) {
  return `alb_${profileId}_${suffix}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function mediaIdFor(albumId, index) {
  return `${albumId}_media_${index + 1}`;
}

function makeMedia(album, index, spec = {}) {
  return {
    id: spec.id || mediaIdFor(album.id, index),
    albumId: album.id,
    ownerId: album.ownerId,
    type: spec.type || 'photo',
    title: spec.title || `${spec.type === 'video' ? 'Vidéo' : 'Photo'} ${index + 1}`,
    caption: spec.caption || '',
    url: spec.url || '',
    fileId: spec.fileId || null,
    filename: spec.filename || '',
    mimeType: spec.mimeType || '',
    sizeBytes: Number(spec.sizeBytes || 0),
    viewedBy: Array.isArray(spec.viewedBy) ? spec.viewedBy : [],
    shareCount: Number(spec.shareCount || 0),
    likedBy: Array.isArray(spec.likedBy) ? spec.likedBy : [],
    comments: Array.isArray(spec.comments) ? spec.comments : [],
    createdAt: spec.createdAt || nowIso(),
  };
}

function makeAlbum(profile, suffix, patch = {}) {
  const album = {
    id: patch.id || albumIdFor(profile.id, suffix),
    ownerId: profile.id,
    title: patch.title || 'Album',
    description: patch.description || '',
    visibility: patch.visibility === 'private' ? 'private' : 'public',
    coverTone: patch.coverTone || profile.avatarTone || 'gold',
    createdAt: patch.createdAt || nowIso(),
    updatedAt: patch.updatedAt || nowIso(),
    items: [],
  };
  album.items = (patch.items || []).map((item, index) => makeMedia(album, index, item));
  return album;
}

function createProfileAlbums(profile) {
  // À la création d'un profil : aucun album, sauf un album "Photo de profil" (vide).
  // Le membre ajoute ensuite lui-même ses albums publics ou privés.
  return [
    makeAlbum(profile, 'profile-photo', {
      title: 'Photo de profil',
      description: 'Votre photo de profil, visible par les membres.',
      visibility: 'public',
      items: [],
    }),
  ];
}

function ensureAlbums(profile) {
  if (!Array.isArray(profile.albums) || !profile.albums.length) {
    profile.albums = createProfileAlbums(profile);
  }
  const publicItems = profile.albums.filter((album) => album.visibility === 'public').flatMap((album) => album.items || []);
  const privateItems = profile.albums.filter((album) => album.visibility === 'private').flatMap((album) => album.items || []);
  profile.publicPhotos = publicItems.map((item) => item.title);
  profile.privateAlbum = {
    ...(profile.privateAlbum || {}),
    count: privateItems.length,
    label: profile.albums.find((album) => album.visibility === 'private')?.title || profile.privateAlbum?.label || 'Album privé',
    description: profile.albums.find((album) => album.visibility === 'private')?.description || profile.privateAlbum?.description || 'Album verrouillé.',
  };
  return profile.albums;
}

function findAlbum(store, albumId) {
  for (const profile of store.profiles) {
    const album = ensureAlbums(profile).find((item) => item.id === albumId);
    if (album) return { profile, album };
  }
  return { profile: null, album: null };
}

function findMedia(store, mediaId) {
  for (const profile of store.profiles) {
    for (const album of ensureAlbums(profile)) {
      const media = (album.items || []).find((item) => item.id === mediaId);
      if (media) return { profile, album, media };
    }
  }
  return { profile: null, album: null, media: null };
}

function notificationPreferencesFor(profile) {
  const raw = profile?.notificationPreferences || {};
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...Object.fromEntries(NOTIFICATION_PREFERENCE_ITEMS.map((item) => [item.key, raw[item.key] !== false])),
  };
}

function notificationCategoryFor(type) {
  return NOTIFICATION_TYPE_CATEGORIES[type] || 'support';
}

function canCreateNotification(profile, type) {
  const category = notificationCategoryFor(type);
  const preferences = notificationPreferencesFor(profile);
  return preferences[category] !== false;
}

function clientStatusFor(profile) {
  const raw = profile?.clientStatus || {};
  return {
    notificationsSupported: Boolean(raw.notificationsSupported),
    notificationPermission: raw.notificationPermission || 'default',
    notificationsEnabled: Boolean(raw.notificationsEnabled),
    appInstalled: Boolean(raw.appInstalled),
    standalone: Boolean(raw.standalone),
    platform: raw.platform || '',
    lastClientSeenAt: raw.lastClientSeenAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

function getSupportAdminProfile(store, fallbackProfileId = '') {
  return (store.profiles || []).find((profile) => profile.id === 'admin')
    || (store.profiles || []).find((profile) => profile.role === 'admin')
    || getProfile(store, fallbackProfileId);
}

function pushConversationMessage(store, fromId, toId, body, extras = {}) {
  const from = getProfile(store, fromId);
  const to = getProfile(store, toId);
  if (!from || !to) return null;
  let conversation = getConversation(store, fromId, toId);
  if (!conversation) {
    conversation = { id: makeId('conv'), participantIds: [fromId, toId], messages: [], updatedAt: nowIso() };
    store.conversations.push(conversation);
  }
  const message = {
    id: makeId('msg'),
    fromId,
    body: limitText(body, MAX_TEXT.message),
    createdAt: nowIso(),
    read: false,
    viewedBy: [fromId],
    ...extras,
  };
  conversation.messages.push(message);
  conversation.updatedAt = message.createdAt;
  return { conversation, message, from, to };
}

// --- Notifications push navigateur (Web Push / VAPID) -----------------------
// Les clés VAPID sont lues depuis l'environnement (VAPID_PUBLIC_KEY /
// VAPID_PRIVATE_KEY / VAPID_SUBJECT) ou, à défaut, générées une fois au premier
// démarrage et conservées dans la base (store.webPushConfig) : aucun réglage
// requis pour que le push fonctionne. L'envoi respecte les préférences de
// notification (filtrées en amont par createNotification) et nettoie les
// abonnements expirés (réponses 404/410 du service push).
let webPushModulePromise = null;
function loadWebPush() {
  if (!webPushModulePromise) {
    webPushModulePromise = import('web-push')
      .then((mod) => mod.default || mod)
      .catch((error) => {
        console.error('[push] module web-push indisponible :', error.message);
        return null;
      });
  }
  return webPushModulePromise;
}

async function ensureWebPushConfig(store, persistence) {
  const envPublic = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  const envPrivate = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  if (envPublic && envPrivate) {
    return { publicKey: envPublic, privateKey: envPrivate, subject: webPushSubject() };
  }
  if (store.webPushConfig?.publicKey && store.webPushConfig?.privateKey) {
    return { ...store.webPushConfig, subject: webPushSubject() };
  }
  const webpush = await loadWebPush();
  if (!webpush) return null;
  const keys = webpush.generateVAPIDKeys();
  store.webPushConfig = { publicKey: keys.publicKey, privateKey: keys.privateKey, createdAt: nowIso() };
  try { persistence.persist(store); } catch {}
  console.log('[push] clés VAPID générées et conservées en base (surcharger via VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY si besoin).');
  return { ...store.webPushConfig, subject: webPushSubject() };
}

function webPushSubject() {
  const fromEnv = String(process.env.VAPID_SUBJECT || '').trim();
  if (fromEnv) return fromEnv;
  const base = String(process.env.PUBLIC_BASE_URL || process.env.FRONTEND_ORIGIN || '').split(',')[0].trim();
  return base.startsWith('https://') ? base : 'mailto:contact@voluptia.app';
}

let webPushRuntime = { config: null, store: null };
function pushSubscriptionsFor(store, profileId) {
  return (store.pushSubscriptions || []).filter((item) => item.profileId === profileId);
}

function sendWebPushForNotification(notification) {
  const { config, store } = webPushRuntime;
  if (!config || !store || !notification?.profileId) return;
  const targets = pushSubscriptionsFor(store, notification.profileId);
  if (!targets.length) return;
  loadWebPush().then((webpush) => {
    if (!webpush) return;
    const payload = JSON.stringify({
      title: notification.title || 'Voluptia',
      body: notification.body || '',
      type: notification.type || 'system',
      url: notification.meta?.actionUrl || '/',
      notificationId: notification.id,
    });
    for (const target of targets) {
      webpush.sendNotification(target.subscription, payload, {
        TTL: 86400,
        vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
      }).catch((error) => {
        const statusCode = Number(error?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          // Abonnement expiré ou révoqué côté navigateur : on le retire.
          store.pushSubscriptions = (store.pushSubscriptions || []).filter((item) => item.id !== target.id);
        } else if (!isProduction()) {
          console.error('[push] envoi impossible :', error.message);
        }
      });
    }
  });
}

function createNotification(store, profileId, type, actorId, title, body, meta = {}) {
  if (!profileId || profileId === actorId) return null;
  if (actorId && isProfileBlocked(store, profileId, actorId)) return null;
  const targetProfile = getProfile(store, profileId);
  if (!canCreateNotification(targetProfile, type)) return null;
  const notification = {
    id: makeId('notif'),
    profileId,
    type,
    actorId,
    title,
    body,
    meta,
    read: false,
    createdAt: nowIso(),
  };
  store.notifications.push(notification);
  try { sendWebPushForNotification(notification); } catch {}
  return notification;
}

const REPORT_CATEGORIES = [
  'Comportement inapproprié',
  'Harcèlement ou pression',
  'Faux profil / usurpation',
  'Contenu inapproprié',
  'Mineur suspecté',
  'Spam / arnaque',
  'Autre',
];
const HIGH_PRIORITY_REPORT_CATEGORIES = new Set(['Harcèlement ou pression', 'Contenu inapproprié', 'Mineur suspecté']);

function normalizeReportCategory(value) {
  const clean = limitText(value || '', 80);
  return REPORT_CATEGORIES.includes(clean) ? clean : 'Autre';
}

function reportPriority(category, reason = '') {
  const text = normalize(`${category} ${reason}`);
  if (category === 'Mineur suspecté' || text.includes('mineur') || text.includes('menace') || text.includes('violence') || text.includes('chantage')) return 'urgent';
  if (HIGH_PRIORITY_REPORT_CATEGORIES.has(category) || text.includes('harcelement') || text.includes('pression') || text.includes('photo')) return 'haute';
  return 'normale';
}

function notifyAdmins(store, title, body, meta = {}) {
  return (store.profiles || [])
    .filter((profile) => profile.role === 'admin' || (store.authUsers || []).some((user) => user.profileId === profile.id && user.role === 'admin'))
    .map((profile) => createNotification(store, profile.id, 'admin_message', meta.actorId || null, title, body, meta))
    .filter(Boolean);
}

function moderationWarningsFor(store, profileId) {
  return (store.moderationWarnings || [])
    .filter((warning) => warning.profileId === profileId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function activeModerationWarningsFor(store, profileId) {
  return moderationWarningsFor(store, profileId).filter((warning) => !warning.acknowledgedAt);
}

function createModerationWarning(store, profileId, adminId, message, options = {}) {
  const target = getProfile(store, profileId);
  if (!target) return null;
  const severity = ['info', 'warning', 'final'].includes(String(options.severity || '').toLowerCase()) ? String(options.severity).toLowerCase() : 'warning';
  const warning = {
    id: makeId('warn'),
    profileId,
    adminId: adminId || '',
    reportId: options.reportId || null,
    severity,
    message: limitText(message || 'Avertissement de modération : merci de respecter les règles de la communauté Voluptia.', 600),
    createdAt: nowIso(),
    acknowledgedAt: null,
  };
  store.moderationWarnings.push(warning);
  store.moderationActions.push({ id: makeId('modact'), type: 'warning', profileId, targetId: profileId, adminId: adminId || '', reportId: options.reportId || null, severity, createdAt: warning.createdAt, message: warning.message });
  createNotification(store, profileId, 'admin_message', adminId || null, severity === 'final' ? 'Dernier avertissement modération' : 'Avertissement modération', warning.message, { warningId: warning.id, reportId: options.reportId || null, severity });
  return warning;
}

function serializeReportForAdmin(store, report, viewerId) {
  if (!report) return null;
  return {
    ...report,
    category: report.category || 'Autre',
    priority: report.priority || reportPriority(report.category || 'Autre', report.reason || ''),
    reporter: publicProfile(getProfile(store, report.reporterId), viewerId, store, { shallow: true }),
    target: publicProfile(getProfile(store, report.targetId), viewerId, store, { shallow: true }),
    assignedToProfile: report.assignedTo ? publicProfile(getProfile(store, report.assignedTo), viewerId, store, { shallow: true }) : null,
    warnings: moderationWarningsFor(store, report.targetId).filter((warning) => warning.reportId === report.id),
  };
}



function normalizeGenderPreferenceList(value) {
  const allowed = new Set(['Homme', 'Femme', 'Couple', 'Trans', 'Trio', 'Groupe']);
  const list = Array.isArray(value) ? value : [];
  const cleaned = list.map((item) => String(item || '').trim()).filter((item) => allowed.has(item));
  return cleaned.length ? [...new Set(cleaned)] : ['Homme', 'Femme', 'Couple', 'Trans', 'Trio', 'Groupe'];
}

function profileHeartGender(profile) {
  const category = String(profile?.category || profile?.type || '').trim();
  if (['Homme', 'Femme', 'Couple', 'Trans', 'Trio', 'Groupe'].includes(category)) return category;
  const firstGender = String(profile?.members?.[0]?.gender || '').trim();
  if (firstGender === 'Transgenre') return 'Trans';
  if (['Homme', 'Femme', 'Trans'].includes(firstGender)) return firstGender;
  return 'Groupe';
}

function normalizeSocialPermission(value, allowed = ['everyone', 'followers', 'matches', 'none'], fallback = 'everyone') {
  const clean = String(value || '').trim();
  return allowed.includes(clean) ? clean : fallback;
}

function socialPreferencesFor(profile) {
  const raw = profile?.socialPreferences || {};
  return {
    heartAllowedGenders: normalizeGenderPreferenceList(raw.heartAllowedGenders),
    showProfileViews: raw.showProfileViews !== false,
    instantChatEnabled: raw.instantChatEnabled !== false,
    messagePermission: normalizeSocialPermission(raw.messagePermission, ['everyone', 'matches', 'following', 'none'], 'everyone'),
    mediaLikePermission: normalizeSocialPermission(raw.mediaLikePermission, ['everyone', 'followers', 'matches', 'none'], 'everyone'),
    mediaCommentPermission: normalizeSocialPermission(raw.mediaCommentPermission, ['everyone', 'followers', 'matches', 'none'], 'everyone'),
    allowWinks: raw.allowWinks !== false,
    allowAlbumRequests: raw.allowAlbumRequests !== false,
  };
}

function isFollowingProfile(store, followerId, followingId) {
  return Boolean((store.followers || []).find((follow) => follow.followerId === followerId && follow.followingId === followingId));
}

function isProfileMatch(store, a, b) {
  return Boolean(profileHeart(store, a, b) && profileHeart(store, b, a));
}

function socialRuleAllows(store, rule, actorId, targetId) {
  if (!actorId || !targetId || actorId === targetId) return true;
  if (rule === 'none') return false;
  if (rule === 'matches') return isProfileMatch(store, actorId, targetId);
  if (rule === 'followers') return isFollowingProfile(store, actorId, targetId);
  if (rule === 'following') return isFollowingProfile(store, targetId, actorId);
  return true;
}

function canSendProfileHeart(target, actor) {
  if (!target || !actor) return false;
  const actorGender = profileHeartGender(actor);
  const preferences = socialPreferencesFor(target);
  return preferences.heartAllowedGenders.includes(actorGender);
}

function canSendDirectMessage(store, actorId, targetId) {
  if (isProfileBlocked(store, actorId, targetId)) return false;
  return socialRuleAllows(store, socialPreferencesFor(getProfile(store, targetId)).messagePermission, actorId, targetId);
}

function canReactToMedia(store, actorId, media) {
  if (!media) return false;
  if (isProfileBlocked(store, actorId, media.ownerId)) return false;
  return socialRuleAllows(store, socialPreferencesFor(getProfile(store, media.ownerId)).mediaLikePermission, actorId, media.ownerId);
}

function canCommentOnMedia(store, actorId, media) {
  if (!media) return false;
  if (isProfileBlocked(store, actorId, media.ownerId)) return false;
  return socialRuleAllows(store, socialPreferencesFor(getProfile(store, media.ownerId)).mediaCommentPermission, actorId, media.ownerId);
}

function canSendWink(store, actorId, targetId) {
  if (isProfileBlocked(store, actorId, targetId)) return false;
  return socialPreferencesFor(getProfile(store, targetId)).allowWinks !== false;
}

function canRequestPrivateAlbum(store, actorId, targetId) {
  if (isProfileBlocked(store, actorId, targetId)) return false;
  return socialPreferencesFor(getProfile(store, targetId)).allowAlbumRequests !== false;
}

function profileHeart(store, fromId, toId) {
  return (store.profileLikes || []).find((like) => like.fromId === fromId && like.toId === toId) || null;
}

function profilePass(store, fromId, toId) {
  return (store.profilePasses || []).find((pass) => pass.fromId === fromId && pass.toId === toId) || null;
}

function isProfileBlockActive(block) {
  if (!block) return false;
  if (!block.expiresAt) return true;
  return new Date(block.expiresAt).getTime() > Date.now();
}

function profileBlock(store, blockerId, blockedId) {
  return (store.blockedProfiles || []).find((block) => block.blockerId === blockerId && block.blockedId === blockedId && isProfileBlockActive(block)) || null;
}

function isProfileBlocked(store, a, b) {
  if (!a || !b) return false;
  return Boolean(profileBlock(store, a, b) || profileBlock(store, b, a));
}

function buildSocialIndex(store) {
  const index = {
    followersByProfile: new Map(),
    followingByProfile: new Map(),
    followingPairs: new Set(),
    likePairs: new Set(),
    incomingHeartByProfile: new Map(),
    outgoingHeartByProfile: new Map(),
    matchCountByProfile: new Map(),
    viewsByProfile: new Map(),
    blockPairs: new Set(),
  };
  for (const follow of store.followers || []) {
    if (!follow?.followerId || !follow?.followingId) continue;
    index.followingPairs.add(pairKey(follow.followerId, follow.followingId));
    index.followersByProfile.set(follow.followingId, (index.followersByProfile.get(follow.followingId) || 0) + 1);
    index.followingByProfile.set(follow.followerId, (index.followingByProfile.get(follow.followerId) || 0) + 1);
  }
  for (const like of store.profileLikes || []) {
    if (!like?.fromId || !like?.toId) continue;
    index.likePairs.add(pairKey(like.fromId, like.toId));
    index.incomingHeartByProfile.set(like.toId, (index.incomingHeartByProfile.get(like.toId) || 0) + 1);
    index.outgoingHeartByProfile.set(like.fromId, (index.outgoingHeartByProfile.get(like.fromId) || 0) + 1);
  }
  for (const like of store.profileLikes || []) {
    if (!like?.fromId || !like?.toId) continue;
    if (index.likePairs.has(pairKey(like.toId, like.fromId))) {
      index.matchCountByProfile.set(like.fromId, (index.matchCountByProfile.get(like.fromId) || 0) + 1);
    }
  }
  for (const view of store.profileViews || []) {
    if (!view?.profileId) continue;
    index.viewsByProfile.set(view.profileId, (index.viewsByProfile.get(view.profileId) || 0) + 1);
  }
  for (const block of store.blockedProfiles || []) {
    if (!block?.blockerId || !block?.blockedId || !isProfileBlockActive(block)) continue;
    index.blockPairs.add(pairKey(block.blockerId, block.blockedId));
  }
  return index;
}

function indexedProfileBlocked(index, a, b) {
  if (!index || !a || !b) return false;
  return index.blockPairs.has(pairKey(a, b)) || index.blockPairs.has(pairKey(b, a));
}

function socialCountersFromIndex(index, profileId) {
  return {
    incomingHeartCount: index.incomingHeartByProfile.get(profileId) || 0,
    outgoingHeartCount: index.outgoingHeartByProfile.get(profileId) || 0,
    matchCount: index.matchCountByProfile.get(profileId) || 0,
    profileViewCount: index.viewsByProfile.get(profileId) || 0,
  };
}

function blockedResponse(message = 'Ce profil est bloqué ou vous a bloqué.') {
  return { error: 'profile_blocked', message };
}

function cleanupBlockedRelationship(store, a, b) {
  store.followers = (store.followers || []).filter((follow) => !((follow.followerId === a && follow.followingId === b) || (follow.followerId === b && follow.followingId === a)));
  store.profileLikes = (store.profileLikes || []).filter((like) => !((like.fromId === a && like.toId === b) || (like.fromId === b && like.toId === a)));
  store.profilePasses = (store.profilePasses || []).filter((pass) => !((pass.fromId === a && pass.toId === b) || (pass.fromId === b && pass.toId === a)));
  store.albumAccess = (store.albumAccess || []).filter((access) => !((access.ownerId === a && access.viewerId === b) || (access.ownerId === b && access.viewerId === a)));
  store.notifications = (store.notifications || []).filter((notification) => !((notification.profileId === a && notification.actorId === b) || (notification.profileId === b && notification.actorId === a)));
}

function blockedProfilesFor(store, viewerId) {
  store.blockedProfiles = Array.isArray(store.blockedProfiles) ? store.blockedProfiles : [];
  return store.blockedProfiles
    .filter((block) => block.blockerId === viewerId && isProfileBlockActive(block))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function permanentMessages(conversation) {
  return (conversation?.messages || []).filter((message) => message.channel !== 'instant');
}

function activeInstantMessages(conversation, now = Date.now()) {
  // Chat rendu permanent : on ne masque plus les messages par expiration.
  return (conversation?.messages || []).filter((message) => message.channel === 'instant');
}

function pruneExpiredInstantMessages() {
  // Chat permanent : plus aucune suppression automatique des messages.
  return false;
}
function pruneExpiredInstantMessages_LEGACY(store) {
  const now = Date.now();
  let changed = false;
  for (const conversation of store.conversations || []) {
    const before = (conversation.messages || []).length;
    conversation.messages = (conversation.messages || []).filter((message) => message.channel !== 'instant' || !message.expiresAt || new Date(message.expiresAt).getTime() > now);
    if (conversation.messages.length !== before) changed = true;
  }
  return changed;
}

function recordProfileView(store, viewerId, profileId) {
  if (!viewerId || !profileId || viewerId === profileId) return null;
  store.profileViews = Array.isArray(store.profileViews) ? store.profileViews : [];
  let view = store.profileViews.find((item) => item.viewerId === viewerId && item.profileId === profileId);
  if (!view) {
    view = { id: makeId('view'), viewerId, profileId, count: 0, createdAt: nowIso(), lastViewedAt: nowIso() };
    store.profileViews.push(view);
  }
  view.count = Number(view.count || 0) + 1;
  view.lastViewedAt = nowIso();
  return view;
}

// Mode d'essai gratuit : un inscrit non abonné peut ouvrir un nombre limité de profils
// par fenêtre glissante (défaut : 3 / 48 h) et lire ses messages sans pouvoir répondre.
const FREE_TIER_VIEW_LIMIT = Math.max(1, Number(process.env.FREE_PROFILE_VIEW_LIMIT || 4));
const FREE_TIER_WINDOW_HOURS = Math.max(1, Number(process.env.FREE_PROFILE_VIEW_WINDOW_HOURS || 48));
function freeTierStatus(store, profileId, { subscriptionActive = false, isAdmin = false } = {}) {
  const limit = FREE_TIER_VIEW_LIMIT;
  const windowHours = FREE_TIER_WINDOW_HOURS;
  if (subscriptionActive || isAdmin) {
    return { active: false, limit, windowHours, profileViewsUsed: 0, profileViewsRemaining: null, canSendMessages: true, readOnlyMessages: false, resetAt: null };
  }
  const windowMs = windowHours * 3600 * 1000;
  const windowStart = Date.now() - windowMs;
  const recent = (store.profileViews || []).filter((v) => v.viewerId === profileId && new Date(v.createdAt).getTime() >= windowStart);
  const used = recent.length;
  const oldest = recent.reduce((min, v) => Math.min(min, new Date(v.createdAt).getTime()), Date.now());
  return {
    active: true,
    limit,
    windowHours,
    profileViewsUsed: used,
    profileViewsRemaining: Math.max(0, limit - used),
    canSendMessages: false,
    readOnlyMessages: true,
    resetAt: used >= limit ? new Date(oldest + windowMs).toISOString() : null,
  };
}

function socialCountersFor(store, profileId, index = null) {
  if (index) return socialCountersFromIndex(index, profileId);
  const likes = store.profileLikes || [];
  const views = store.profileViews || [];
  return {
    incomingHeartCount: likes.filter((like) => like.toId === profileId).length,
    outgoingHeartCount: likes.filter((like) => like.fromId === profileId).length,
    matchCount: likes.filter((like) => like.fromId === profileId && profileHeart(store, like.toId, profileId)).length,
    profileViewCount: views.filter((view) => view.profileId === profileId).length,
  };
}

function serializeSocialInbox(store, viewerId, index = null) {
  const likes = store.profileLikes || [];
  const views = store.profileViews || [];
  const incomingLikes = likes
    .filter((like) => like.toId === viewerId && !isProfileBlocked(store, viewerId, like.fromId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((like) => ({ ...like, profile: publicProfile(getProfile(store, like.fromId), viewerId, store, { shallow: true }) }))
    .filter((item) => item.profile);
  const outgoingLikes = likes
    .filter((like) => like.fromId === viewerId && !isProfileBlocked(store, viewerId, like.toId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((like) => ({ ...like, profile: publicProfile(getProfile(store, like.toId), viewerId, store, { shallow: true }) }))
    .filter((item) => item.profile);
  const matches = outgoingLikes
    .filter((item) => profileHeart(store, item.profile.id, viewerId))
    .map((item) => ({ ...item, matchedAt: item.createdAt }));
  const recentViews = views
    .filter((view) => view.profileId === viewerId && !isProfileBlocked(store, viewerId, view.viewerId))
    .sort((a, b) => new Date(b.lastViewedAt || b.createdAt) - new Date(a.lastViewedAt || a.createdAt))
    .map((view) => ({ ...view, profile: publicProfile(getProfile(store, view.viewerId), viewerId, store, { shallow: true }) }))
    .filter((item) => item.profile);
  return {
    incomingLikes,
    outgoingLikes,
    matches,
    recentViews,
    counters: socialCountersFor(store, viewerId, index),
  };
}


function normalizeMediaReactions(media) {
  if (!media) return {};
  const reactions = {};
  if (media.reactions && typeof media.reactions === 'object' && !Array.isArray(media.reactions)) {
    for (const [profileId, reaction] of Object.entries(media.reactions)) {
      if (MEDIA_REACTIONS.includes(reaction)) reactions[profileId] = reaction;
    }
  }
  if (Array.isArray(media.likedBy)) {
    for (const profileId of media.likedBy) {
      if (profileId && !reactions[profileId]) reactions[profileId] = 'heart';
    }
  }
  media.reactions = reactions;
  media.likedBy = Object.entries(reactions).filter(([, reaction]) => reaction === 'heart').map(([profileId]) => profileId);
  return reactions;
}

function mediaReactionCounts(media) {
  const counts = Object.fromEntries(MEDIA_REACTIONS.map((reaction) => [reaction, 0]));
  for (const reaction of Object.values(normalizeMediaReactions(media))) {
    if (counts[reaction] !== undefined) counts[reaction] += 1;
  }
  return counts;
}

function mediaReactionPreview(store, media, viewerId, limit = 3) {
  return Object.keys(normalizeMediaReactions(media))
    .slice(-limit)
    .reverse()
    .map((profileId) => publicProfile(getProfile(store, profileId), viewerId, store, { shallow: true }))
    .filter(Boolean);
}

function extractMentionedProfileIds(store, body = '') {
  const text = String(body || '');
  const names = Array.from(text.matchAll(/@([\p{L}\p{N}_ .-]{2,40})/gu)).map((match) => normalize(match[1]));
  if (!names.length) return [];
  return (store.profiles || [])
    .filter((profile) => names.some((name) => normalize(profile.pseudo || '') === name))
    .map((profile) => profile.id);
}

function mediaCommentCount(media) {
  return (Array.isArray(media?.comments) ? media.comments : []).filter((comment) => !comment.hiddenByOwner).length;
}

function serializeMediaComment(store, media, comment, viewerId, allComments = []) {
  const commentLikes = Array.isArray(comment.likedBy) ? comment.likedBy : [];
  const author = publicProfile(getProfile(store, comment.fromId), viewerId, store, { shallow: true });
  const replies = allComments
    .filter((reply) => reply.parentId === comment.id && !reply.hiddenByOwner)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .map((reply) => serializeMediaComment(store, media, reply, viewerId, allComments));
  return {
    ...comment,
    likedBy: commentLikes,
    liked: commentLikes.includes(viewerId),
    likeCount: commentLikes.length,
    reportCount: Number(comment.reportCount || 0),
    canDelete: comment.fromId === viewerId || media.ownerId === viewerId,
    canPin: media.ownerId === viewerId,
    mentionedProfiles: (comment.mentionedProfileIds || []).map((id) => publicProfile(getProfile(store, id), viewerId, store, { shallow: true })).filter(Boolean),
    author,
    replies,
  };
}

function assertFreshSocialAction(store, actorId, key, windowMs, maxCount, message) {
  store.socialActionLog = Array.isArray(store.socialActionLog) ? store.socialActionLog : [];
  const now = Date.now();
  store.socialActionLog = store.socialActionLog.filter((item) => now - new Date(item.createdAt || 0).getTime() < 24 * 60 * 60 * 1000);
  const recent = store.socialActionLog.filter((item) => item.actorId === actorId && item.key === key && now - new Date(item.createdAt || 0).getTime() < windowMs);
  if (recent.length >= maxCount) {
    const error = new Error(message || 'Trop d’actions en peu de temps.');
    error.statusCode = 429;
    error.code = 'social_rate_limited';
    throw error;
  }
  store.socialActionLog.push({ id: makeId('actlog'), actorId, key, createdAt: nowIso() });
}

function assertNoRepeatedComment(store, media, actorId, body) {
  const clean = normalize(body);
  const lastDuplicate = (media.comments || []).find((comment) => comment.fromId === actorId && normalize(comment.body) === clean && Date.now() - new Date(comment.createdAt || 0).getTime() < 10 * 60 * 1000);
  if (lastDuplicate) {
    const error = new Error('Commentaire déjà envoyé récemment.');
    error.statusCode = 409;
    error.code = 'duplicate_comment';
    throw error;
  }
}

function serializeSocialDetails(store, viewerId, index = null) {
  const social = serializeSocialInbox(store, viewerId, index || buildSocialIndex(store));
  const notBlocked = (profileId) => profileId && !isProfileBlocked(store, viewerId, profileId);
  const followers = (store.followers || [])
    .filter((follow) => follow.followingId === viewerId && notBlocked(follow.followerId))
    .map((follow) => ({ ...follow, profile: publicProfile(getProfile(store, follow.followerId), viewerId, store, { shallow: true }) }))
    .filter((item) => item.profile);
  const following = (store.followers || [])
    .filter((follow) => follow.followerId === viewerId && notBlocked(follow.followingId))
    .map((follow) => ({ ...follow, profile: publicProfile(getProfile(store, follow.followingId), viewerId, store, { shallow: true }) }))
    .filter((item) => item.profile);
  const favorites = (store.profileFavorites || [])
    .filter((fav) => fav.fromId === viewerId && notBlocked(fav.toId))
    .map((fav) => ({ ...fav, profile: publicProfile(getProfile(store, fav.toId), viewerId, store, { shallow: true }) }))
    .filter((item) => item.profile);
  const mediaReactionsReceived = [];
  const commentsReceived = [];
  for (const profile of store.profiles || []) {
    for (const album of ensureAlbums(profile)) {
      const canList = album.ownerId === viewerId || canViewAlbum(store, album, viewerId);
      if (!canList) continue;
      for (const media of album.items || []) {
        const reactions = normalizeMediaReactions(media);
        for (const [actorId, reaction] of Object.entries(reactions)) {
          if (media.ownerId === viewerId && actorId !== viewerId && notBlocked(actorId)) {
            mediaReactionsReceived.push({
              id: `${media.id}-${actorId}-${reaction}`,
              actorId,
              reaction,
              reactionLabel: MEDIA_REACTION_LABELS[reaction] || reaction,
              createdAt: media.reactedAt?.[actorId] || media.createdAt,
              media: serializeMedia(store, media, viewerId),
              album: { id: album.id, title: album.title, visibility: album.visibility },
              profile: publicProfile(getProfile(store, actorId), viewerId, store, { shallow: true }),
            });
          }
        }
        for (const comment of media.comments || []) {
          if (comment.fromId !== viewerId && media.ownerId === viewerId && !comment.hiddenByOwner && notBlocked(comment.fromId)) {
            commentsReceived.push({
              ...comment,
              media: serializeMedia(store, media, viewerId),
              album: { id: album.id, title: album.title, visibility: album.visibility },
              profile: publicProfile(getProfile(store, comment.fromId), viewerId, store, { shallow: true }),
            });
          }
        }
      }
    }
  }
  const albumRequests = (store.albumAccess || [])
    .filter((access) => (access.ownerId === viewerId || access.viewerId === viewerId) && !isProfileBlocked(store, access.ownerId, access.viewerId))
    .map((access) => ({
      ...access,
      owner: publicProfile(getProfile(store, access.ownerId), viewerId, store, { shallow: true }),
      viewer: publicProfile(getProfile(store, access.viewerId), viewerId, store, { shallow: true }),
      album: findAlbum(store, access.albumId).album,
    }))
    .filter((item) => item.owner && item.viewer);
  const privateAlbumGrants = albumRequests.filter((access) => access.status === 'granted' && isAccessActive(access));
  const pendingAlbumRequests = albumRequests.filter((access) => access.status === 'requested');
  return {
    ...social,
    followers,
    following,
    favorites,
    mediaReactionsReceived: mediaReactionsReceived.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 100),
    commentsReceived: commentsReceived.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 100),
    albumRequests,
    privateAlbumGrants,
    pendingAlbumRequests,
    counters: {
      ...(social.counters || {}),
      followers: followers.length,
      following: following.length,
      favorites: favorites.length,
      mediaReactionsReceived: mediaReactionsReceived.length,
      commentsReceived: commentsReceived.length,
      albumRequests: albumRequests.length,
      pendingAlbumRequests: pendingAlbumRequests.length,
      privateAlbumGrants: privateAlbumGrants.length,
    },
  };
}

function isAdminProfileId(store, profileId) {
  if (!profileId) return false;
  const profile = (store.profiles || []).find((p) => p.id === profileId);
  if (profile?.role === 'admin') return true;
  return (store.authUsers || []).some((u) => u.profileId === profileId && u.role === 'admin');
}

function canViewAlbum(store, album, viewerId) {
  if (!album) return false;
  if (album.ownerId === viewerId) return true;
  // Supervision admin : un administrateur peut consulter tous les albums (y compris privés) pour la modération.
  if (viewerId && isAdminProfileId(store, viewerId)) return true;
  if (isProfileBlocked(store, album.ownerId, viewerId)) return false;
  if (album.visibility === 'public') return true;
  return isAccessActive(getAlbumAccess(store, album.ownerId, viewerId, album.id));
}

function serializeMedia(store, media, viewerId) {
  const likedBy = Array.isArray(media.likedBy) ? media.likedBy : [];
  const comments = Array.isArray(media.comments) ? media.comments : [];
  const viewedBy = Array.isArray(media.viewedBy) ? media.viewedBy : [];
  const reactions = normalizeMediaReactions(media);
  const reactionCounts = mediaReactionCounts(media);
  const likePreview = mediaReactionPreview(store, media, viewerId);
  const visibleComments = comments.filter((comment) => !comment.hiddenByOwner);
  const serialized = {
    ...media,
    likedBy: media.likedBy || likedBy,
    viewedBy,
    reactions,
    reactionCounts,
    myReaction: reactions[viewerId] || '',
    liked: reactions[viewerId] === 'heart' || likedBy.includes(viewerId),
    viewed: viewedBy.includes(viewerId),
    likeCount: Object.keys(reactions).length,
    heartCount: reactionCounts.heart || 0,
    viewCount: viewedBy.length,
    shareCount: Number(media.shareCount || 0),
    likePreview,
    commentCount: visibleComments.length,
    comments: visibleComments
      .filter((comment) => !comment.parentId)
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      .map((comment) => serializeMediaComment(store, media, comment, viewerId, visibleComments)),
  };
  delete serialized.storagePath;
  return serialized;
}

function serializeAlbum(store, album, viewerId) {
  const isOwner = album.ownerId === viewerId;
  const isAdmin = !isOwner && isAdminProfileId(store, viewerId);
  // Essai gratuit : un non-abonné (hors propriétaire / admin) ne voit que la couverture de l'album,
  // pas les médias qu'il contient. Les abonnés voient les albums publics et leurs accès privés normaux.
  const coverOnly = !isOwner && !isAdmin && !serializeSubscription(store, viewerId).active;
  const unlocked = !coverOnly && canViewAlbum(store, album, viewerId);
  const access = getAlbumAccess(store, album.ownerId, viewerId, album.id);
  const accessStatus = access?.status === 'granted' && !isAccessActive(access) ? 'expired' : access?.status;
  return {
    ...album,
    unlocked,
    coverOnly,
    itemCount: (album.items || []).length,
    access: album.ownerId === viewerId
      ? { status: 'owner' }
      : access
        ? { status: accessStatus, requestedAt: access.requestedAt, grantedAt: access.grantedAt, expiresAt: access.expiresAt, exchangeRequested: Boolean(access.exchangeRequested), exchange: Boolean(access.exchange) }
        : { status: album.visibility === 'public' ? 'public' : 'none' },
    items: unlocked ? (album.items || []).map((item) => serializeMedia(store, item, viewerId)) : [],
  };
}


function normalizeFeedVisibility(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (['verified', 'favorites', 'private'].includes(raw)) return raw;
  return 'public';
}

function canViewFeedPost(store, post, viewerId) {
  if (!post || !viewerId) return false;
  if (Array.isArray(post.hiddenBy) && post.hiddenBy.includes(viewerId)) return false;
  const author = getProfile(store, post.userId);
  if (!author || author.hidden) return false;
  if (post.userId !== viewerId && isProfileBlocked(store, viewerId, post.userId)) return false;
  const visibility = normalizeFeedVisibility(post.visibility);
  if (post.userId === viewerId) return true;
  if (visibility === 'public') return true;
  const viewer = getProfile(store, viewerId);
  if (visibility === 'verified') return Boolean(viewer?.verified || isAdminProfileId(store, viewerId));
  if (visibility === 'favorites') return (store.profileFavorites || []).some((favorite) => favorite.fromId === post.userId && favorite.toId === viewerId);
  return false;
}

function serializeFeedComment(store, comment, viewerId) {
  const author = publicProfile(getProfile(store, comment.userId), viewerId, store, { shallow: true });
  return {
    id: comment.id,
    user_id: comment.userId,
    userId: comment.userId,
    pseudo: author?.pseudo || comment.pseudo || 'Membre',
    avatar: author?.profilePhotoUrl || comment.avatar || defaultProfilePhoto(author?.pseudo || comment.pseudo || 'M'),
    text: comment.text || comment.body || '',
    body: comment.text || comment.body || '',
    created_at: comment.createdAt,
    createdAt: comment.createdAt,
    mine: comment.userId === viewerId,
  };
}

function serializeFeedPost(store, post, viewerId) {
  const author = publicProfile(getProfile(store, post.userId), viewerId, store, { shallow: true });
  if (!author) return null;
  const likes = Array.isArray(post.likedBy) ? post.likedBy : [];
  const comments = Array.isArray(post.comments) ? post.comments : [];
  const mediaType = ['image', 'video', 'none'].includes(post.mediaType) ? post.mediaType : (post.type === 'video' ? 'video' : post.type === 'photo' ? 'image' : 'none');
  return {
    id: post.id,
    user_id: post.userId,
    userId: post.userId,
    pseudo: author.pseudo,
    avatar: author.profilePhotoUrl,
    author,
    localisation: author.city || post.localisation || '',
    location: author.city || post.localisation || '',
    distance: author.distanceKm,
    distanceKm: author.distanceKm,
    texte: post.text || post.caption || '',
    text: post.text || post.caption || '',
    media_url: post.mediaUrl || post.url || '',
    mediaUrl: post.mediaUrl || post.url || '',
    media_type: mediaType,
    mediaType,
    visibility: normalizeFeedVisibility(post.visibility),
    likes_count: likes.length,
    likesCount: likes.length,
    liked: likes.includes(viewerId),
    comments_count: comments.length,
    commentsCount: comments.length,
    comments: comments.map((comment) => serializeFeedComment(store, comment, viewerId)),
    created_at: post.createdAt,
    createdAt: post.createdAt,
    mine: post.userId === viewerId,
  };
}

function feedPostsForViewer(store, viewerId, limit = 80) {
  return (store.feedPosts || [])
    .filter((post) => canViewFeedPost(store, post, viewerId))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, limit)
    .map((post) => serializeFeedPost(store, post, viewerId))
    .filter(Boolean);
}

function serializeNotification(store, notification, viewerId) {
  return {
    ...notification,
    actor: publicProfile(getProfile(store, notification.actorId), viewerId, store, { shallow: true }),
  };
}



const LEGAL_VERSION = '2026-05-24-fr-eu-v2';
const MEDIA_REMOVED_RETENTION_MONTHS = 6;
const MEDIA_REMOVED_RETENTION_MS = 1000 * 60 * 60 * 24 * 183;
const MEDIA_RETENTION_NOTICE = 'Les photos et vidéos supprimées du site sont conservées au maximum 6 mois en archive technique. La suppression définitive des fichiers éligibles se lance manuellement depuis l’administration s’ils ne sont plus affichés sur la plateforme.';
const AGE_VERIFICATION_TTL_MS = 1000 * 60 * 20;

function ageVerificationProvider() {
  return String(process.env.AGE_VERIFICATION_PROVIDER || 'demo').trim().toLowerCase();
}

function ageVerificationIsStrict() {
  return process.env.NODE_ENV === 'production' || String(process.env.REQUIRE_AGE_VERIFICATION || '').toLowerCase() === 'true';
}

function createAgeVerificationRecord(store, { age, mode = 'demo', status = 'pending', metadata = {} } = {}) {
  const record = {
    id: makeId('age'),
    token: crypto.randomBytes(24).toString('base64url'),
    provider: ageVerificationProvider(),
    mode,
    status,
    declaredAge: Number(age || 0),
    createdAt: nowIso(),
    verifiedAt: status === 'verified' ? nowIso() : null,
    expiresAt: new Date(Date.now() + AGE_VERIFICATION_TTL_MS).toISOString(),
    metadata,
  };
  store.ageVerifications.push(record);
  return record;
}

function getAgeVerification(store, token) {
  if (!token) return null;
  return (store.ageVerifications || []).find((record) => record.token === token) || null;
}

function isAgeVerificationValid(record) {
  return Boolean(
    record
    && record.status === 'verified'
    && !record.profileId
    && !record.consumedAt
    && new Date(record.expiresAt).getTime() > Date.now()
  );
}

function publicAgeVerification(record) {
  if (!record) return null;
  return {
    sessionId: record.id,
    provider: record.provider,
    mode: record.mode,
    status: record.status,
    expiresAt: record.expiresAt,
    token: record.status === 'verified' ? record.token : undefined,
  };
}

const PROFILE_CATEGORIES = [
  'Homme',
  'Femme',
  'Couple',
  'Trans',
  'Trio',
  'Groupe',
];

const DETAIL_OPTIONS = {
  hairColors: ['Noirs', 'Bruns', 'Châtains', 'Blonds', 'Roux', 'Gris', 'Rasés', 'Autre'],
  eyeColors: ['Marron', 'Noisette', 'Verts', 'Bleus', 'Gris', 'Noirs', 'Autre'],
  origins: ['Européenne', 'Africaine', 'Maghrébine', 'Caribéenne', 'Asiatique', 'Latine', 'Métissée', 'Autre', 'Non renseignée'],
  bodyTypes: ['Mince', 'Sportif', 'Normal', 'Pulpeux', 'Rond', 'Athlétique', 'Non renseigné'],
  hairStyles: ['Imberbe / glabre', 'Rasé', 'Entretenu / taillé', 'Poilu / naturel', 'Non renseigné'],
  meetingTypes: ['Échangisme', 'Échangisme soft', 'Mélangisme', 'Candaulisme', 'Triolisme', 'Gangbang / pluriel', 'Exhibition / voyeurisme', 'Club libertin', 'Soirée privée', 'Rencontre virtuelle', 'Sans lendemain', 'Relation suivie', 'Amitié / sans plus', 'Sans tabou'],
  fetishes: ['BDSM', 'Domination', 'Soumission', 'Bondage', 'Fétichisme des pieds', 'Latex / cuir', 'Lingerie', 'Jeux de rôle', 'Voyeurisme', 'Exhibitionnisme', 'Candaulisme', 'Fessée / spanking', 'Tantra / massage', 'Naturisme', 'Sextoys', 'Cross-dressing'],
  smokerOptions: ['Non', 'Occasionnel', 'Oui', 'Non renseigné'],
  experienceLevels: ['Découverte', 'Curieux', 'Confirmé', 'Expérimenté', 'Non renseigné'],
  availabilityOptions: ['Libre ce soir', 'Semaine', 'Week-end', 'Soirées', 'Voyages', 'Événements privés'],
  genderOptions: ['Femme', 'Homme', 'Femme trans', 'Homme trans', 'Non-binaire', 'Genderfluid', 'Agenre', 'Bigenre', 'Intersexe', 'Travesti(e)', 'En questionnement', 'Autre'],
  sexualOrientations: ['Hétéro', 'Gay', 'Lesbienne', 'Bi', 'Pansexuel(le)', 'Bicurieux(se)', 'Hétéroflexible', 'Homoflexible', 'Demisexuel(le)', 'Asexuel(le)', 'Sapiosexuel(le)', 'Queer', 'En questionnement', 'Autre'],
};

const SUBSCRIPTION_PLANS = [
  { id: '5d', label: '5 jours', priceCents: 499, durationDays: 5, highlight: 'Essai sans engagement' },
  { id: '30d', label: '1 mois', priceCents: 999, durationDays: 30, highlight: 'Recommandé ★' },
  { id: '90d', label: '3 mois', priceCents: 2000, durationDays: 90, highlight: 'Économisez 33 %' },
  { id: '365d', label: '1 an', priceCents: 7000, durationDays: 365, highlight: 'Meilleure valeur — 52 % off' },
];

const NOTIFICATION_PREFERENCE_ITEMS = [
  { key: 'messages', label: 'Messages privés', description: 'Nouveaux messages et chats instantanés.' },
  { key: 'likes', label: 'Likes & coups de cœur', description: 'Likes médias, coups de cœur et matchs.' },
  { key: 'comments', label: 'Commentaires', description: 'Commentaires et j’aime sur commentaires.' },
  { key: 'albums', label: 'Albums privés', description: 'Demandes, accès ouverts ou retirés.' },
  { key: 'follows', label: 'Suivis', description: 'Nouveaux abonnés à votre profil.' },
  { key: 'support', label: 'Support', description: 'Réponses de l’administration et messages importants.' },
];
const DEFAULT_NOTIFICATION_PREFERENCES = Object.fromEntries(NOTIFICATION_PREFERENCE_ITEMS.map((item) => [item.key, true]));
const NOTIFICATION_TYPE_CATEGORIES = {
  message: 'messages',
  instant_chat: 'messages',
  like: 'likes',
  profile_heart: 'likes',
  profile_match: 'likes',
  comment: 'comments',
  comment_like: 'comments',
  album_request: 'albums',
  album_granted: 'albums',
  album_revoked: 'albums',
  follow: 'follows',
  support_message: 'support',
  support_reply: 'support',
  admin_message: 'support',
};

const LEGAL_CHECKLIST = [
  { id: 'age_verification', status: 'implemented', title: 'Contrôle d’âge par déclaration + CGU', detail: 'Accès réservé aux majeurs : déclaration de majorité obligatoire, acceptation des CGU et de la charte de consentement, traçabilité serveur (date, version légale, IP, user-agent). Un prestataire de vérification renforcée pourra être branché plus tard via AGE_VERIFICATION_ENABLED + AGE_VERIFICATION_PROVIDER.' },
  { id: 'no_explicit_before_age_gate', status: 'implemented', title: 'Aucun contenu explicite avant contrôle', detail: 'La page d’entrée reste neutre avant connexion, vérification d’âge et abonnement.' },
  { id: 'legal_acceptance', status: 'implemented', title: 'Acceptation CGU/CGV/confidentialité', detail: `Version légale ${LEGAL_VERSION} enregistrée en base au moment de l’inscription.` },
  { id: 'database', status: 'implemented', title: 'Base persistante', detail: 'PostgreSQL managé en production via DATABASE_URL (durable et sauvegardé), avec repli automatique sur SQLite local puis fichier JSON si la base n’est pas configurée.' },
  { id: 'moderation', status: 'implemented_demo', title: 'Signalement et modération', detail: 'Signalement, compte admin et liste de contrôle ajoutés dans la base.' },
  { id: 'gdpr', status: 'draft_ready', title: 'RGPD / CNIL', detail: 'Pages de confidentialité, mentions légales, cookies, conservation et droits utilisateurs ajoutées. À faire valider juridiquement avant production.' },
  { id: 'sensitive_data_consent', status: 'implemented', title: 'Consentement explicite aux données sensibles', detail: 'L’inscription exige une acceptation explicite pour les données liées à la vie intime nécessaires au service.' },
  { id: 'media_retention_6_months', status: 'implemented', title: 'Conservation médias supprimés', detail: MEDIA_RETENTION_NOTICE },
  { id: 'subscriptions', status: 'implemented', title: 'Abonnements', detail: 'CGV d’abonnement ajoutées. Paiement Stripe Checkout branché côté serveur avec webhook signé : l’accès n’est activé qu’après confirmation de paiement vérifiée par signature. Renseigner STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET pour activer.' },
];


const LEGAL_DOCUMENTS = {
  mentionsLegales: {
    title: 'Mentions légales',
    version: LEGAL_VERSION,
    body: [
      'Nom commercial : Voluptia.',
      'Éditeur : [À VALIDER : dénomination sociale] — [À VALIDER : forme juridique, ex. SAS] au capital de [À VALIDER : montant] €, immatriculée au RCS de [À VALIDER : ville] sous le numéro [À VALIDER : SIREN/RCS].',
      'Siège social : [À VALIDER : adresse complète du siège].',
      'Directeur de la publication : [À VALIDER : nom et prénom].',
      'Contact éditeur : [À VALIDER : email de contact officiel].',
      'Hébergeur : [À VALIDER : nom de l’hébergeur], [À VALIDER : adresse de l’hébergeur], [À VALIDER : téléphone ou email de l’hébergeur].',
      'Plateforme strictement réservée aux personnes majeures. Aucun contenu explicite n’est affiché avant déclaration de majorité, acceptation des conditions, connexion et accès autorisé.',
      'Les accès administrateur sont limités, journalisés et protégés par des mots de passe forts.',
      'Les documents légaux restent accessibles depuis le pied de page de la page d’accueil.',
    ],
  },
  cgv: {
    title: 'CGU / CGV abonnements',
    version: LEGAL_VERSION,
    body: [
      'Objet : les présentes conditions régissent l’accès au service Voluptia, l’usage entre membres et les abonnements payants.',
      'Accès : service réservé aux personnes majeures acceptant la déclaration de majorité, les présentes conditions, la politique de confidentialité et la charte de consentement.',
      'Comportement : pseudo, ville approximative et informations de profil doivent rester sincères. Harcèlement, pression, diffusion non autorisée, usurpation d’identité et contenus illégaux sont interdits.',
      'Formules d’abonnement : 4,99 € / 5 jours, 9,99 € / 30 jours, 20,00 € / 90 jours, 70,00 € / 365 jours. Les prix sont affichés toutes taxes comprises avant paiement.',
      'Paiement : le paiement est traité par Stripe (prestataire de paiement sécurisé). Aucune donnée de carte bancaire ne transite ni n’est stockée par Voluptia. L’accès est activé uniquement après confirmation de paiement.',
      'Reconduction : la reconduction automatique est désactivée. Chaque abonnement est ponctuel et prend fin à son terme sans prélèvement supplémentaire.',
      'Droit de rétractation : conformément à l’article L221-28 du Code de la consommation, l’accès à un contenu numérique fourni immédiatement après paiement, avec accord exprès de l’utilisateur, peut faire l’objet d’une renonciation au droit de rétractation. [À VALIDER : confirmer la formulation exacte de la renonciation avec un juriste selon votre configuration commerciale.]',
      'Modération : l’administration peut retirer un contenu, limiter un compte ou suspendre un accès en cas de risque légal, de sécurité ou de non-respect de la charte. Les signalements concernant des mineurs, l’absence de consentement, la violence ou un contenu intime diffusé sans accord sont prioritaires.',
      'Support et réclamations : [À VALIDER : email de support officiel].',
      'Droit applicable : droit français. [À VALIDER : juridiction compétente en cas de litige.]',
    ],
  },
  confidentialite: {
    title: 'Politique de confidentialité',
    version: LEGAL_VERSION,
    body: [
      'Responsable de traitement : [À VALIDER : dénomination sociale et coordonnées de l’éditeur].',
      'Données traitées : compte (email, mot de passe haché, date de création, sessions), profil (pseudo, âge, ville approximative, préférences, description, médias), interactions, messages, abonnements, signalements et journaux de sécurité.',
      'Données sensibles : informations liées à la vie sexuelle / orientation sexuelle ou préférences intimes, traitées uniquement avec le consentement explicite de l’utilisateur recueilli à l’inscription, et strictement pour fournir le service.',
      'Finalités : création et sécurisation du compte, mise en relation des profils, calcul de distances approximatives par ville, modération, prévention des abus, gestion des abonnements et respect des obligations légales.',
      'Base légale : exécution du contrat (service), consentement (données sensibles), intérêt légitime (sécurité et lutte contre la fraude) et obligation légale.',
      'Durées de conservation : les données de compte sont conservées tant que le compte est actif ; les médias supprimés suivent la politique de conservation dédiée (archive technique 6 mois maximum) ; les journaux de sécurité sont conservés pour une durée limitée à des fins de preuve. [À VALIDER : durées précises avec un juriste.]',
      'Sous-traitants : hébergeur ([À VALIDER : nom]), prestataire de paiement (Stripe), service de géocodage par ville (OpenStreetMap / Nominatim).',
      'Droits RGPD : accès, rectification, effacement, limitation, opposition et portabilité, exerçables via le support. Droit de réclamation auprès de la CNIL.',
      'Minimisation : la localisation exacte n’est jamais stockée ; seules des coordonnées approximatives de ville servent au rayon kilométrique.',
      'Contact délégué à la protection des données (DPO) : [À VALIDER : coordonnées du DPO si désigné, sinon email de contact RGPD].',
    ],
  },
  cookies: {
    title: 'Cookies et traceurs',
    version: LEGAL_VERSION,
    body: [
      'Cookies strictement nécessaires : ils maintiennent la session, protègent l’accès au compte et mémorisent certains choix utiles. Ils ne nécessitent pas de consentement séparé.',
      'Stockage local : l’application utilise le stockage du navigateur (token de session, préférences d’installation de l’application) au titre du fonctionnement du service.',
      'Aucun cookie publicitaire n’est utilisé dans cette version.',
      'Si des statistiques, publicités ou traceurs non nécessaires sont ajoutés ultérieurement, un bandeau de consentement permettant d’accepter, refuser ou paramétrer sera affiché avant tout dépôt. [À VALIDER : à mettre en place si vous ajoutez de la mesure d’audience.]',
    ],
  },
  charte: {
    title: 'Charte de consentement et de sécurité',
    version: LEGAL_VERSION,
    body: [
      'Consentement : libre, clair, éclairé, enthousiaste et révocable à tout moment. Un refus ou une absence de réponse doit être respecté immédiatement.',
      'Interdits : aucune pression, harcèlement, diffusion non autorisée, menace, chantage ou usurpation d’identité. Les messages insistants, humiliants ou discriminatoires entraînent une suspension.',
      'Photos et vidéos : publier une personne identifiable suppose son accord. Il est interdit de publier, transmettre ou conserver un média intime d’une autre personne sans son autorisation.',
      'Albums privés : accessibles uniquement après ouverture ou accord explicite du propriétaire.',
      'Protection : blocage, signalement et support sont disponibles à tout moment. La distance affichée est approximative et basée sur la ville.',
      'Tolérance zéro : tout contenu illégal, impliquant un mineur ou publié sans consentement est signalé et supprimé sans délai, et peut faire l’objet d’un signalement aux autorités compétentes.',
    ],
  },
  conservationMedias: {
    title: 'Conservation des photos et vidéos',
    version: LEGAL_VERSION,
    body: [
      MEDIA_RETENTION_NOTICE,
      'Un média visible reste disponible tant qu’il est publié dans un profil, un album ou un message autorisé.',
      'Un média retiré du site n’est plus affiché aux autres utilisateurs, puis il est inscrit dans une archive technique de suppression.',
      'Après 6 mois, le fichier supprimé devient éligible à une purge définitive lancée manuellement par l’administration s’il n’est plus référencé par le site, sauf obligation légale ou signalement sérieux nécessitant une conservation temporaire.',
      'Un utilisateur peut demander la suppression de ses données via le support. La suppression peut être différée uniquement si une obligation légale, une contestation ou un signalement sérieux l’exige.',
    ],
  },
  signalement: {
    title: 'Contact et signalement',
    version: LEGAL_VERSION,
    body: [
      'Support : [À VALIDER : adresse email officielle de support].',
      'Depuis le compte utilisateur : Mon espace → Paramètres → Contacter support.',
      'Depuis un profil : utiliser les boutons bloquer / signaler lorsqu’ils sont disponibles.',
      'À signaler immédiatement : mineur ou suspicion de mineur, média intime diffusé sans autorisation, harcèlement, menace, chantage, usurpation d’identité ou contenu illicite.',
      'Délai de traitement : les signalements touchant à la sécurité ou au consentement sont traités en priorité.',
    ],
  },
};

const CITY_COORDS = {
  paris: { lat: 48.8566, lng: 2.3522, city: 'Paris', source: 'fallback_static' },
  lyon: { lat: 45.7640, lng: 4.8357, city: 'Lyon', source: 'fallback_static' },
  bordeaux: { lat: 44.8378, lng: -0.5792, city: 'Bordeaux', source: 'fallback_static' },
  nice: { lat: 43.7102, lng: 7.2620, city: 'Nice', source: 'fallback_static' },
  lille: { lat: 50.6292, lng: 3.0573, city: 'Lille', source: 'fallback_static' },
  toulouse: { lat: 43.6047, lng: 1.4442, city: 'Toulouse', source: 'fallback_static' },
  marseille: { lat: 43.2965, lng: 5.3698, city: 'Marseille', source: 'fallback_static' },
  nantes: { lat: 47.2184, lng: -1.5536, city: 'Nantes', source: 'fallback_static' },
  montpellier: { lat: 43.6108, lng: 3.8767, city: 'Montpellier', source: 'fallback_static' },
  strasbourg: { lat: 48.5734, lng: 7.7521, city: 'Strasbourg', source: 'fallback_static' },
};

const GEOCODER_TIMEOUT_MS = 6000;
const GEOCODER_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 120;
const GEOCODER_DEFAULT_COUNTRYCODES = 'fr,be,ch,lu,mc';
const GEOCODER_PRECISION = 'approximate_city';

function cleanCityName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT.city);
}

function normalizeCityKey(city) {
  return normalizeForSearch(city).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function clampCoordinate(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function roundCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(5)) : null;
}

function locationPayloadFromCoords(coords, city, source = 'fallback_static') {
  const lat = clampCoordinate(coords?.lat, -90, 90);
  const lng = clampCoordinate(coords?.lng, -180, 180);
  if (lat === null || lng === null) return null;
  return {
    city: cleanCityName(coords?.city || city),
    displayName: cleanCityName(coords?.displayName || coords?.city || city),
    lat: roundCoord(lat),
    lng: roundCoord(lng),
    precision: GEOCODER_PRECISION,
    source: coords?.source || source,
    resolvedAt: coords?.resolvedAt || nowIso(),
  };
}

function getCachedCityCoords(store, city) {
  const key = normalizeCityKey(city);
  if (!key || !store?.geocodingCache?.[key]) return null;
  const cached = store.geocodingCache[key];
  const resolvedAt = new Date(cached.resolvedAt || 0).getTime();
  if (resolvedAt && Date.now() - resolvedAt > GEOCODER_CACHE_TTL_MS) return null;
  return locationPayloadFromCoords(cached, cached.city || city, cached.source || 'cache');
}

function getStaticCityCoords(city) {
  const key = normalizeCityKey(city);
  return CITY_COORDS[key] || CITY_COORDS[key.split(' ')[0]] || null;
}

function getCityCoords(city, store = null) {
  const cleanCity = cleanCityName(city);
  const cached = getCachedCityCoords(store, cleanCity);
  if (cached) return cached;
  const staticCoords = getStaticCityCoords(cleanCity);
  if (staticCoords) return locationPayloadFromCoords(staticCoords, staticCoords.city || cleanCity, staticCoords.source || 'fallback_static');
  return null;
}


function postalCodesLabel(codes = []) {
  const list = Array.isArray(codes) ? codes.map((code) => String(code || '').trim()).filter(Boolean) : [];
  return Array.from(new Set(list)).slice(0, 4).join(', ');
}

function mapFrenchCommuneSuggestion(item, query = '') {
  if (!item || !item.nom) return null;
  const postalCodes = Array.isArray(item.codesPostaux) ? item.codesPostaux.filter(Boolean) : [];
  const postalCode = postalCodes[0] || '';
  const deptName = item.departement?.nom || '';
  const deptCode = item.departement?.code || '';
  const regionName = item.region?.nom || '';
  const coords = Array.isArray(item.centre?.coordinates) ? item.centre.coordinates : [];
  const lng = clampCoordinate(coords[0], -180, 180);
  const lat = clampCoordinate(coords[1], -90, 90);
  const city = cleanCityName(item.nom);
  const postalLabel = postalCodesLabel(postalCodes);
  const meta = [postalLabel, deptCode || deptName, regionName].filter(Boolean).join(' · ');
  return {
    id: String([item.code || city, postalCode, query].filter(Boolean).join('-')),
    city,
    postalCode,
    postalCodes,
    codeInsee: item.code || '',
    department: deptName,
    departmentCode: deptCode,
    region: regionName,
    population: Number(item.population || 0),
    label: `${city}${postalLabel ? ` (${postalLabel})` : ''}`,
    subtitle: meta,
    displayName: [city, postalLabel, deptName || deptCode].filter(Boolean).join(', '),
    lat: lat === null ? null : roundCoord(lat),
    lng: lng === null ? null : roundCoord(lng),
    source: 'geo.api.gouv.fr',
  };
}

function staticCitySuggestions(query = '') {
  const q = normalizeCityKey(query);
  if (!q || q.length < 2) return [];
  const seen = new Set();
  return Object.values(CITY_COORDS)
    .map((coords) => locationPayloadFromCoords(coords, coords.city, coords.source || 'fallback_static'))
    .filter(Boolean)
    .filter((coords) => {
      const key = normalizeCityKey(coords.city || coords.displayName || '');
      if (!key || seen.has(key)) return false;
      const match = key.includes(q) || q.includes(key);
      if (match) seen.add(key);
      return match;
    })
    .slice(0, 8)
    .map((coords) => ({
      id: `static-${normalizeCityKey(coords.city)}`,
      city: coords.city,
      postalCode: '',
      postalCodes: [],
      codeInsee: '',
      department: '',
      departmentCode: '',
      region: '',
      population: 0,
      label: coords.city,
      subtitle: 'Suggestion locale',
      displayName: coords.displayName || coords.city,
      lat: coords.lat,
      lng: coords.lng,
      source: coords.source || 'fallback_static',
    }));
}

async function suggestFrenchCities(rawQuery) {
  const query = cleanCityName(rawQuery).slice(0, 80);
  if (query.length < 2) return [];
  const digits = query.replace(/\D/g, '');
  const isPostalSearch = /^\d{2,5}$/.test(query.replace(/\s+/g, '')) && digits.length >= 2;
  const externalDisabled = envFlag('DISABLE_EXTERNAL_GEOCODING', false) || envFlag('DISABLE_CITY_SUGGESTIONS', false);
  if (!externalDisabled && typeof fetch === 'function') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEOCODER_TIMEOUT_MS);
    try {
      const url = new URL('https://geo.api.gouv.fr/communes');
      url.searchParams.set(isPostalSearch ? 'codePostal' : 'nom', isPostalSearch ? digits : query);
      url.searchParams.set('fields', 'nom,code,codesPostaux,centre,departement,region,population');
      url.searchParams.set('boost', 'population');
      url.searchParams.set('limit', '8');
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': geocoderUserAgent() },
      });
      if (response.ok) {
        const rows = await response.json();
        const suggestions = Array.isArray(rows) ? rows.map((item) => mapFrenchCommuneSuggestion(item, query)).filter(Boolean) : [];
        const seen = new Set();
        return suggestions
          .filter((item) => {
            const key = `${normalizeCityKey(item.city)}-${item.postalCodes.join('|')}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => Number(b.population || 0) - Number(a.population || 0))
          .slice(0, 8);
      }
    } catch {
      // Si l'API officielle est momentanément indisponible, on garde les suggestions locales de secours.
    } finally {
      clearTimeout(timeout);
    }
  }
  return staticCitySuggestions(query);
}

function makeOpenStreetMapUrl(location) {
  if (!location || !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lng))) return '';
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(lat))}&mlon=${encodeURIComponent(String(lng))}#map=12/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lng))}`;
}

function makeOpenStreetMapEmbedUrl(location) {
  if (!location || !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lng))) return '';
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  const delta = 0.085;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].map((value) => Number(value.toFixed(5))).join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
}

function publicCityLocation(profile, store = null) {
  if (!profile?.city) return null;
  const coords = getCityCoords(profile.city, store);
  if (!coords) return null;
  const payload = {
    city: coords.city || profile.city,
    displayName: coords.displayName || coords.city || profile.city,
    lat: coords.lat,
    lng: coords.lng,
    precision: GEOCODER_PRECISION,
    source: coords.source || 'city',
  };
  return {
    ...payload,
    mapUrl: makeOpenStreetMapUrl(payload),
    embedUrl: makeOpenStreetMapEmbedUrl(payload),
  };
}

function storeGeocodeResult(store, key, location) {
  if (!store || !key || !location) return location;
  if (!store.geocodingCache || typeof store.geocodingCache !== 'object' || Array.isArray(store.geocodingCache)) store.geocodingCache = {};
  store.geocodingCache[key] = {
    city: cleanCityName(location.city),
    displayName: cleanCityName(location.displayName || location.city),
    lat: roundCoord(location.lat),
    lng: roundCoord(location.lng),
    precision: GEOCODER_PRECISION,
    source: location.source || 'geocoder',
    resolvedAt: location.resolvedAt || nowIso(),
  };
  return store.geocodingCache[key];
}

function geocoderUserAgent() {
  return process.env.GEOCODER_USER_AGENT
    || `Voluptia/1.0 city-distance-geocoder (${adminEmailFromEnv() || DEFAULT_ADMIN_EMAIL})`;
}

async function geocodeCity(store, rawCity) {
  const city = cleanCityName(rawCity);
  if (!city) return null;
  const key = normalizeCityKey(city);
  const cached = getCachedCityCoords(store, city);
  if (cached) return { ...cached, mapUrl: makeOpenStreetMapUrl(cached), embedUrl: makeOpenStreetMapEmbedUrl(cached) };

  const staticFallback = getStaticCityCoords(city);
  const externalDisabled = envFlag('DISABLE_EXTERNAL_GEOCODING', false);
  if (!externalDisabled && typeof fetch === 'function') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEOCODER_TIMEOUT_MS);
    try {
      const url = new URL(process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', city);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('limit', '1');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('accept-language', 'fr');
      url.searchParams.set('countrycodes', process.env.GEOCODER_COUNTRYCODES || GEOCODER_DEFAULT_COUNTRYCODES);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': geocoderUserAgent(),
        },
      });
      if (response.ok) {
        const results = await response.json();
        const item = Array.isArray(results) ? results[0] : null;
        const lat = clampCoordinate(item?.lat, -90, 90);
        const lng = clampCoordinate(item?.lon, -180, 180);
        if (item && lat !== null && lng !== null) {
          const address = item.address || {};
          const resolvedCity = cleanCityName(address.city || address.town || address.village || address.municipality || address.hamlet || item.name || city);
          const displayName = cleanCityName([resolvedCity, address.state || address.region, address.country].filter(Boolean).join(', '));
          const location = locationPayloadFromCoords({ lat, lng, city: resolvedCity || city, displayName, source: 'nominatim', resolvedAt: nowIso() }, resolvedCity || city, 'nominatim');
          const stored = storeGeocodeResult(store, key, location);
          return { ...stored, mapUrl: makeOpenStreetMapUrl(stored), embedUrl: makeOpenStreetMapEmbedUrl(stored) };
        }
      }
    } catch {
      // Le service externe peut être indisponible : on conserve une position approximative de secours.
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!staticFallback) return null;
  const fallback = locationPayloadFromCoords(staticFallback, staticFallback.city || city, 'fallback_static');
  const stored = storeGeocodeResult(store, key, fallback);
  return { ...stored, mapUrl: makeOpenStreetMapUrl(stored), embedUrl: makeOpenStreetMapEmbedUrl(stored) };
}

function ensureLocation(profile, store = null) {
  if (!profile) return null;
  if (!profile.location || !Number.isFinite(Number(profile.location.lat)) || !Number.isFinite(Number(profile.location.lng))) {
    const coords = getCityCoords(profile.city, store);
    if (!coords) return null;
    profile.location = { lat: coords.lat, lng: coords.lng, precision: GEOCODER_PRECISION, source: coords.source || 'city' };
  }
  return profile.location;
}

// --- Commerces / lieux professionnels (gérés par l'admin) -------------------
const VENUE_TYPES = ['Club libertin', 'Sex-shop', 'Glory hole', 'Sauna / lieu de rencontre', 'Bar / autre'];

// Géocode une ADRESSE COMPLÈTE (rue, ville) en coordonnées précises via Nominatim.
// Différent de geocodeCity qui ne vise qu'une ville. Renvoie null si introuvable.
async function geocodeAddress(store, rawAddress) {
  const address = String(rawAddress || '').trim().replace(/\s+/g, ' ');
  if (!address || address.length < 4) return null;
  const externalDisabled = envFlag('DISABLE_EXTERNAL_GEOCODING', false);
  if (externalDisabled || typeof fetch !== 'function') return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODER_TIMEOUT_MS);
  try {
    const url = new URL(process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', address);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'fr');
    url.searchParams.set('countrycodes', process.env.GEOCODER_COUNTRYCODES || GEOCODER_DEFAULT_COUNTRYCODES);
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': geocoderUserAgent() } });
    if (!response.ok) return null;
    const results = await response.json();
    const item = Array.isArray(results) ? results[0] : null;
    const lat = clampCoordinate(item?.lat, -90, 90);
    const lng = clampCoordinate(item?.lon, -180, 180);
    if (!item || lat === null || lng === null) return null;
    const addr = item.address || {};
    const city = cleanCityName(addr.city || addr.town || addr.village || addr.municipality || '');
    return { lat: roundCoord(lat), lng: roundCoord(lng), city, displayName: item.display_name || address, source: 'nominatim_address', resolvedAt: nowIso() };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeVenueType(value) {
  const strip = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const wanted = strip(value);
  return VENUE_TYPES.find((type) => strip(type) === wanted) || '';
}

function serializeVenue(venue) {
  if (!venue) return null;
  const latNum = venue.lat === null || venue.lat === undefined || venue.lat === '' ? NaN : Number(venue.lat);
  const lngNum = venue.lng === null || venue.lng === undefined || venue.lng === '' ? NaN : Number(venue.lng);
  const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum) && !(latNum === 0 && lngNum === 0);
  return {
    id: venue.id,
    name: venue.name,
    type: venue.type,
    description: venue.description || '',
    address: venue.address || '',
    city: venue.city || '',
    phone: venue.phone || '',
    website: venue.website || '',
    lat: hasCoords ? latNum : null,
    lng: hasCoords ? lngNum : null,
    located: hasCoords,
    mapUrl: hasCoords ? makeOpenStreetMapUrl({ lat: latNum, lng: lngNum }) : '',
    createdAt: venue.createdAt || null,
    updatedAt: venue.updatedAt || null,
  };
}

function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const toRad = (value) => Number(value) * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function profileDistanceKm(store, viewerId, profile) {
  const viewer = getProfile(store, viewerId);
  if (!viewer || !profile || viewer.id === profile.id) return 0;
  return haversineKm(ensureLocation(viewer, store), ensureLocation(profile, store));
}

function getPlan(planId) {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === planId) || null;
}

function formatEuroCents(cents = 0) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(cents || 0) / 100);
}

function getActiveSubscription(store, profileId) {
  return (store.subscriptions || [])
    .filter((sub) => sub.profileId === profileId && new Date(sub.expiresAt).getTime() > Date.now())
    .sort((a, b) => new Date(b.expiresAt) - new Date(a.expiresAt))[0] || null;
}

function serializeSubscription(store, profileId) {
  const active = getActiveSubscription(store, profileId);
  if (!active) return { active: false, label: 'Aucun abonnement actif' };
  const plan = getPlan(active.planId);
  return {
    active: true,
    planId: active.planId,
    label: plan?.label || active.planId,
    startedAt: active.startedAt,
    expiresAt: active.expiresAt,
    source: active.source || 'demo',
  };
}

function makeInfluencerToken(code) {
  return crypto.createHash('sha256').update(`${code}:${crypto.randomBytes(12).toString('hex')}`).digest('hex').slice(0, 24);
}

function getPromo(store, code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;
  const promo = (store.promoCodes || []).find((p) => p.code === normalized) || null;
  if (!promo) return null;
  // AMÉLIORATION : vérifier dates de validité
  const now = Date.now();
  if (promo.validFrom && new Date(promo.validFrom).getTime() > now) return null;
  if (promo.validUntil && new Date(promo.validUntil).getTime() < now) return null;
  // AMÉLIORATION : vérifier limite globale d'utilisations
  if (promo.maxUsesTotal != null && Number.isFinite(Number(promo.maxUsesTotal))) {
    const totalUses = (promo.uses || []).length;
    if (totalUses >= Number(promo.maxUsesTotal)) return null;
  }
  return promo;
}

function quoteSubscription(store, planId, promoCode = '') {
  const promo = getPromo(store, promoCode);
  const isFreeMonthCode = Boolean(promo?.active && promo.type === 'free_month');
  const plan = getPlan(planId) || (isFreeMonthCode ? { id: 'free_month_code', label: '30 jours gratuits', priceCents: 0, durationDays: Number(promo.freeDays || 30), highlight: 'Code offert' } : null);
  if (!plan) return null;

  let discountCents = 0;
  let bonusDays = 0;
  let free = false;
  let accessDays = Number(plan.durationDays || 0);

  if (promo && promo.active) {
    if (promo.type === 'free_month') {
      free = true;
      accessDays = Math.max(1, Math.min(365, Number(promo.freeDays || 30)));
      bonusDays = accessDays;
      discountCents = plan.priceCents;
    } else {
      discountCents = Math.round(plan.priceCents * Math.min(100, Math.max(0, Number(promo.discountPercent || 0))) / 100);
    }
  }

  const amountDueCents = free ? 0 : Math.max(0, plan.priceCents - discountCents);
  const commissionCents = promo?.influencerProfileId ? Math.round(amountDueCents * Number(promo.commissionRate || 20) / 100) : 0;
  return {
    plan,
    promo: promo && promo.active ? promo : null,
    originalCents: plan.priceCents,
    discountCents,
    amountDueCents,
    commissionCents,
    bonusDays,
    accessDays,
    free,
    freeReason: free ? `${accessDays} jours gratuits avec ce code` : '',
    amountLabel: formatEuroCents(amountDueCents),
    originalLabel: formatEuroCents(plan.priceCents),
    discountLabel: formatEuroCents(discountCents),
  };
}

function serializePromo(store, promo) {
  const uses = promo.uses || [];
  const revenueCents = uses.reduce((sum, use) => sum + Number(use.amountCents || 0), 0);
  const commissionCents = uses.reduce((sum, use) => sum + Number(use.commissionCents || 0), 0);
  const now = Date.now();
  const expired = Boolean(promo.validUntil && new Date(promo.validUntil).getTime() < now);
  const notStarted = Boolean(promo.validFrom && new Date(promo.validFrom).getTime() > now);
  const globalLimitReached = promo.maxUsesTotal != null && Number.isFinite(Number(promo.maxUsesTotal)) && uses.length >= Number(promo.maxUsesTotal);
  return {
    ...promo,
    useCount: uses.length,
    revenueCents,
    commissionCents,
    revenueLabel: formatEuroCents(revenueCents),
    commissionLabel: formatEuroCents(commissionCents),
    influencerLink: promo.token ? `/influenceur/${promo.token}` : '',
    influencer: promo.influencerProfileId ? publicProfile(getProfile(store, promo.influencerProfileId), promo.influencerProfileId, store, { shallow: true }) : null,
    expired,
    notStarted,
    globalLimitReached,
    effectivelyActive: promo.active && !expired && !notStarted && !globalLimitReached,
  };
}

function visibleVideoFeed(store, viewerId) {
  const videos = [];
  for (const profile of store.profiles) {
    if (profile.hidden || isProfileBlocked(store, viewerId, profile.id)) continue;
    for (const album of ensureAlbums(profile)) {
      if (album.visibility === 'private') continue;
      if (!canViewAlbum(store, album, viewerId)) continue;
      for (const media of album.items || []) {
        if (media.type === 'video') {
          videos.push({
            owner: publicProfile(profile, viewerId, store, { shallow: true }),
            album: { id: album.id, title: album.title, visibility: album.visibility },
            media: serializeMedia(store, media, viewerId),
          });
        }
      }
    }
  }
  return videos.sort((a, b) => new Date(b.media.createdAt || 0) - new Date(a.media.createdAt || 0) || (b.media.likeCount || 0) - (a.media.likeCount || 0));
}

function sanitizeOptionList(input, allowedList, max = 12) {
  const norm = (v) => String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const allowedByNorm = new Map(allowedList.map((opt) => [norm(opt), opt]));
  const arr = Array.isArray(input) ? input : (typeof input === 'string' ? input.split(/[\n,;]/) : []);
  const out = [];
  for (const raw of arr) {
    const match = allowedByNorm.get(norm(raw));
    if (match && !out.includes(match)) out.push(match);
    if (out.length >= max) break;
  }
  return out;
}

function makeDetails(overrides = {}) {
  return {
    heightCm: overrides.heightCm ?? null,
    weightKg: overrides.weightKg ?? null,
    hairColor: overrides.hairColor || 'Non renseigné',
    eyeColor: overrides.eyeColor || 'Non renseigné',
    origin: overrides.origin || 'Non renseignée',
    bodyType: overrides.bodyType || 'Non renseigné',
    hairStyle: overrides.hairStyle || 'Non renseigné',
    smoker: overrides.smoker || 'Non renseigné',
    relationshipStatus: overrides.relationshipStatus || 'Non renseigné',
    experienceLevel: overrides.experienceLevel || 'Non renseigné',
    languages: toList(overrides.languages || ['Français']),
    availability: toList(overrides.availability || ['Soirées']),
    discretionLevel: overrides.discretionLevel || 'Élevée',
  };
}

function makeProfilePatch(category, details, extras = {}) {
  return {
    category,
    type: category,
    genderCategory: category,
    orientation: extras.orientation || category,
    details: makeDetails(details),
  };
}



function isCoupleCategory(category = '') {
  return normalizeForSearch(category) === 'couple';
}

function isTrioCategory(category = '') {
  return normalizeForSearch(category) === 'trio';
}

function isGroupCategory(category = '') {
  return normalizeForSearch(category) === 'groupe';
}

function orientationOptionsForGender(gender = '') {
  const normalized = normalizeForSearch(gender);
  if (normalized === 'homme') return ['Hétéro', 'Gay', 'Bi', 'Non renseigné'];
  if (normalized === 'femme') return ['Hétéro', 'Lesbienne', 'Bi', 'Non renseigné'];
  if (normalized === 'trans' || normalized === 'transgenre') return ['Hétéro', 'Gay', 'Lesbienne', 'Bi', 'Non renseigné'];
  return ['Hétéro', 'Gay', 'Lesbienne', 'Bi', 'Non renseigné'];
}

function defaultOrientationForGender(gender = '') {
  const options = orientationOptionsForGender(gender);
  return options[options.length - 1] || 'Non renseigné';
}

function inferMembersFromCategory(category = 'Homme', fallbackAge = 28, details = {}) {
  const cleanCategory = String(category || 'Homme');
  const baseAge = Number(fallbackAge || 28);
  const defaultDetails = makeDetails(details || {});
  function member(label, gender, orientation = defaultOrientationForGender(gender), ageOffset = 0) {
    return {
      id: makeId('member'),
      label,
      age: Math.max(VALIDATION.minAge, Math.min(VALIDATION.maxAge, baseAge + ageOffset)),
      gender,
      sexualOrientation: orientation,
      hairColor: defaultDetails.hairColor || 'Non renseigné',
      eyeColor: defaultDetails.eyeColor || 'Non renseigné',
      origin: defaultDetails.origin || 'Non renseignée',
      heightCm: defaultDetails.heightCm,
      weightKg: defaultDetails.weightKg,
    };
  }
  if (isCoupleCategory(cleanCategory)) {
    return [member('Partenaire 1', 'Femme', 'Non renseigné', 0), member('Partenaire 2', 'Homme', 'Non renseigné', 1)];
  }
  if (isTrioCategory(cleanCategory)) {
    return [1, 2, 3].map((n, index) => member(`Membre ${n}`, 'Non renseigné', 'Non renseigné', index));
  }
  if (isGroupCategory(cleanCategory)) {
    return [1, 2].map((n) => member(`Membre ${n}`, 'Non renseigné', 'Non renseigné', 0));
  }
  const normalized = normalizeForSearch(cleanCategory);
  const gender = normalized === 'homme' ? 'Homme'
    : normalized === 'femme' ? 'Femme'
      : normalized === 'trans' ? 'Trans'
        : 'Non renseigné';
  return [member('Personne principale', gender, defaultOrientationForGender(gender), 0)];
}

function memberRoleLabel(category = 'Homme', index = 0) {
  if (isCoupleCategory(category)) return `Partenaire ${index + 1}`;
  if (isTrioCategory(category)) return `Personne ${index + 1}`;
  if (isGroupCategory(category)) return `Personne ${index + 1}`;
  return 'Personne principale';
}
function sanitizeProfileMembers(inputMembers, category, fallbackAge = 28, details = {}, options = {}) {
  const base = Array.isArray(inputMembers) && inputMembers.length ? inputMembers : inferMembersFromCategory(category, fallbackAge, details);
  const min = isGroupCategory(category) ? 2 : isTrioCategory(category) ? 3 : isCoupleCategory(category) ? 2 : 1;
  const max = isGroupCategory(category) ? 20 : isTrioCategory(category) ? 3 : isCoupleCategory(category) ? 2 : 1;
  const cleaned = base.slice(0, max).map((member, index) => {
    const age = Number(member.age ?? fallbackAge);
    const gender = limitText(member.gender || 'Non renseigné', 40);
    const allowedOrientations = orientationOptionsForGender(gender);
    const rawOrientation = limitText(member.sexualOrientation || member.orientation || 'Non renseigné', 60);
    return {
      id: member.id || makeId('member'),
      label: memberRoleLabel(category, index),
      age: Number.isFinite(age) ? age : Number(fallbackAge || 0),
      gender,
      sexualOrientation: allowedOrientations.includes(rawOrientation) ? rawOrientation : 'Non renseigné',
      hairColor: limitText(member.hairColor || member.details?.hairColor || 'Non renseigné', 40),
      eyeColor: limitText(member.eyeColor || member.details?.eyeColor || 'Non renseigné', 40),
      origin: limitText(member.origin || member.details?.origin || 'Non renseignée', 60),
      hairStyle: limitText(member.hairStyle || member.details?.hairStyle || 'Non renseigné', 40),
      heightCm: inRangeNumber(member.heightCm ?? member.details?.heightCm, VALIDATION.minHeightCm, VALIDATION.maxHeightCm),
      weightKg: inRangeNumber(member.weightKg ?? member.details?.weightKg, VALIDATION.minWeightKg, VALIDATION.maxWeightKg),
    };
  });
  while (cleaned.length < min) cleaned.push(inferMembersFromCategory(category, fallbackAge, details)[cleaned.length] || inferMembersFromCategory(category, fallbackAge, details)[0]);
  const invalid = cleaned.find((member) => !Number.isFinite(Number(member.age)) || Number(member.age) < VALIDATION.minAge || Number(member.age) > VALIDATION.maxAge);
  if (invalid && options.throwOnInvalid) {
    const prefix = isCoupleCategory(category) ? 'Chaque personne du couple' : isTrioCategory(category) ? 'Chaque personne du trio' : isGroupCategory(category) ? 'Chaque personne du groupe' : 'La personne du profil';
    const error = new Error(`${prefix} doit avoir entre ${VALIDATION.minAge} et ${VALIDATION.maxAge} ans.`);
    error.statusCode = 400;
    error.code = 'member_age_invalid';
    throw error;
  }
  return cleaned.map((member) => ({ ...member, age: Number(member.age) }));
}

function memberAgeSummary(profile) {
  const members = Array.isArray(profile.members) ? profile.members : [];
  if (!members.length) return profile.age ? `${profile.age} ans` : '';
  if (isCoupleCategory(profile.category || profile.type)) return members.map((m) => `${m.age} ans`).join(' / ');
  if (isTrioCategory(profile.category || profile.type)) return `Trio de ${members.length} personnes`;
  if (isGroupCategory(profile.category || profile.type)) return `Groupe de ${members.length} personnes`;
  return `${members[0]?.age || profile.age} ans`;
}

function profileAgeValues(profile) {
  const members = Array.isArray(profile.members) && profile.members.length ? profile.members : [{ age: profile.age }];
  return members.map((m) => Number(m.age)).filter((age) => Number.isFinite(age));
}

function ensureProfileMembers(store) {
  for (const profile of store.profiles || []) {
    profile.members = sanitizeProfileMembers(profile.members, profile.category || profile.type, profile.age || 28, profile.details || {});
    profile.memberCount = profile.members.length;
    profile.ageDisplay = memberAgeSummary(profile);
  }
  return store;
}

function normalizeForSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// FIX: `normalize` etait appele a plusieurs endroits (priorite des signalements,
// detection des @mentions, anti-doublon des commentaires) mais n'avait jamais ete
// defini -> un ReferenceError cassait le signalement de profil et la creation de
// commentaires (HTTP 500). On le rattache au normaliseur existant.
function normalize(value) {
  return normalizeForSearch(value);
}

function profileMatchesSearch(profile, query) {
  const q = normalizeForSearch(query);
  if (!q) return true;
  const haystack = [
    profile.pseudo,
    profile.type,
    profile.category,
    profile.orientation,
    profile.city,
    profile.headline,
    profile.bio,
    ...(profile.interests || []),
    ...(profile.lookingFor || []),
    ...(profile.limits || []),
    ...Object.values(profile.details || {}).flatMap((value) => Array.isArray(value) ? value : [value]),
    ...(profile.members || []).flatMap((member) => [member?.age, member?.gender, member?.sexualOrientation, member?.hairColor, member?.eyeColor, member?.origin]),
  ].map(normalizeForSearch).join(' ');
  return haystack.includes(q);
}

function updateProfileDetails(profile, patch = {}) {
  const current = profile.details || makeDetails();
  const next = { ...current };
  const textKeys = ['hairColor', 'eyeColor', 'origin', 'bodyType', 'smoker', 'relationshipStatus', 'experienceLevel', 'discretionLevel'];
  for (const key of textKeys) {
    if (patch[key] !== undefined) next[key] = String(patch[key]).trim() || current[key];
  }
  if (patch.heightCm !== undefined) {
    next.heightCm = inRangeNumber(patch.heightCm, VALIDATION.minHeightCm, VALIDATION.maxHeightCm);
  }
  if (patch.weightKg !== undefined) {
    next.weightKg = inRangeNumber(patch.weightKg, VALIDATION.minWeightKg, VALIDATION.maxWeightKg);
  }
  if (patch.languages !== undefined) next.languages = toList(patch.languages);
  if (patch.availability !== undefined) next.availability = toList(patch.availability);
  profile.details = next;
}

function createAdminProfileSeed() {
  const adminProfile = {
    id: 'admin',
    pseudo: 'Administration',
    type: 'Admin',
    category: 'Admin',
    genderCategory: 'Admin',
    orientation: 'Administration',
    age: 30,
    city: 'Paris',
    distanceKm: 0,
    verified: true,
    online: true,
    avatarTone: 'gold',
    profilePhotoUrl: defaultProfilePhoto('AD', '#d6a76c', '#5b3a12'),
    headline: 'Compte administrateur local pour la modération.',
    bio: 'Profil technique masqué dans les recherches publiques.',
    interests: ['Modération', 'Sécurité'],
    lookingFor: ['Protection de la communauté'],
    limits: ['Confidentialité'],
    publicPhotos: [],
    privateAlbum: { count: 0, label: 'Album admin', description: 'Aucun média public.' },
    privacy: { approximateLocation: true, blurredByDefault: true, screenshotsWarning: true },
    lastSeen: 'En ligne',
    hidden: true,
    ...makeProfilePatch('Admin', {
      heightCm: null,
      weightKg: null,
      hairColor: 'Non renseigné',
      eyeColor: 'Non renseigné',
      origin: 'Non renseignée',
      bodyType: 'Non renseigné',
      smoker: 'Non renseigné',
      relationshipStatus: 'Administration',
      experienceLevel: 'Non renseigné',
      languages: ['Français'],
      availability: ['Sécurité'],
    }, { orientation: 'Administration' }),
  };

  ensureLocation(adminProfile);
  ensureAlbums(adminProfile);

  return adminProfile;
}

function promoteOwnerAdminAccounts(store) {
  const owners = ownerAdminEmails();
  if (!owners.length) return [];

  const promoted = [];
  for (const user of store.authUsers || []) {
    if (!owners.includes(normalizeEmail(user.email))) continue;
    // On ne promeut que si l'email a été confirmé (sécurité anti-usurpation).
    // Exception : comptes anciens sans champ emailVerified (compat), considérés vérifiés.
    if (user.emailVerified === false) continue;
    user.role = 'admin';
    user.email = normalizeEmail(user.email);
    delete user.password;
    const profile = getProfile(store, user.profileId);
    if (profile) {
      profile.role = 'admin';
      profile.verified = true;
      profile.hidden = true;
      ensureLocation(profile);
      ensureAlbums(profile);
    }
    promoted.push(user);
  }
  return promoted;
}

function reconcileConfiguredAdminAccount(store) {
  if (!store || typeof store !== 'object') return store;
  promoteOwnerAdminAccounts(store);
  if (!shouldSeedAdminAccount()) return store;

  let adminProfile = (store.profiles || []).find((profile) => profile.id === 'admin');
  if (!adminProfile) {
    adminProfile = createAdminProfileSeed();
    store.profiles.push(adminProfile);
  } else {
    adminProfile.hidden = true;
    adminProfile.role = adminProfile.role || 'admin';
    ensureLocation(adminProfile);
    ensureAlbums(adminProfile);
  }

  const adminEmail = adminEmailFromEnv();
  let adminUser = (store.authUsers || []).find((user) => normalizeEmail(user.email) === adminEmail);
  if (!adminUser) {
    adminUser = (store.authUsers || []).find((user) => user.profileId === 'admin' && user.role === 'admin');
  }
  if (!adminUser) {
    adminUser = { id: 'auth_admin', profileId: 'admin', role: 'admin', createdAt: nowIso() };
    store.authUsers.push(adminUser);
  }
  adminUser.profileId = adminUser.profileId || adminProfile.id;
  const adminPassword = adminPasswordFromEnv();
  const isConfiguredAdminEmail = Boolean(adminEmail && normalizeEmail(adminUser.email) === adminEmail);
  if (adminUser.profileId === 'admin') {
    adminUser.email = adminEmail;
    adminUser.passwordHash = hashPassword(adminPassword);
  } else if (isConfiguredAdminEmail && adminPassword) {
    // Si l’email admin existe déjà comme compte membre, on le promeut ET on synchronise
    // le mot de passe demandé dans Render. Cela évite de garder un ancien mot de passe.
    adminUser.passwordHash = hashPassword(adminPassword);
  } else if (!adminUser.passwordHash && !adminUser.password) {
    adminUser.passwordHash = hashPassword(adminPassword);
  }
  adminUser.role = 'admin';
  delete adminUser.password;

  const promotedProfile = getProfile(store, adminUser.profileId);
  if (promotedProfile) {
    promotedProfile.role = 'admin';
    promotedProfile.verified = true;
    promotedProfile.hidden = true;
    ensureLocation(promotedProfile);
    ensureAlbums(promotedProfile);
  }
  return store;
}

function createDemoStore() {
  const adminProfile = createAdminProfileSeed();
  const seedAdmin = shouldSeedAdminAccount();

  const promoCodes = seedWelcomePromoEnabled() ? [
    {
      id: 'promo_1mois',
      code: 'WELCOME1MOIS',
      type: 'free_month',
      discountPercent: 100,
      freeDays: 30,
      active: true,
      influencerProfileId: null,
      influencerName: 'Voluptia',
      influencerEmail: '',
      commissionRate: 0,
      token: '',
      createdAt: nowIso(),
      uses: [],
      maxUsesPerProfile: 1,
    },
  ] : [];

  return ensureStoreCollections({
    profiles: seedAdmin ? [adminProfile] : [],
    albumAccess: [],
    conversations: [],
    events: [],
    reports: [],
    feedPosts: [],
    moderationWarnings: [],
    moderationActions: [],
    authUsers: seedAdmin ? [
      {
        id: 'auth_admin',
        profileId: 'admin',
        email: adminEmailFromEnv(),
        passwordHash: hashPassword(adminPasswordFromEnv()),
        role: 'admin',
        createdAt: nowIso(),
      },
    ] : [],
    notifications: [],
    followers: [],
    profileLikes: [],
    profilePasses: [],
    profileViews: [],
    blockedProfiles: [],
    subscriptions: [],
    promoCodes,
    purchases: [],
    sessions: [],
    ageVerifications: [],
    legalAcceptances: [],
    deletedMedia: [],
    verificationRequests: [],
    profileFavorites: [],
    profileWinks: [],
    legalChecklist: LEGAL_CHECKLIST,
  });
}



function latestVerificationRequestForProfile(store, profileId) {
  return (store.verificationRequests || [])
    .filter((request) => request.profileId === profileId)
    .sort((a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0))[0] || null;
}

function serializeVerificationRequestForOwner(request) {
  if (!request) return null;
  return {
    id: request.id,
    status: request.status || 'pending',
    submittedAt: request.submittedAt || request.createdAt || null,
    reviewedAt: request.reviewedAt || null,
    reason: request.reason || '',
    adminNote: request.adminNote || '',
    proofImageUrl: request.proofImageUrl || '',
    note: request.note || '',
  };
}

function serializeVerificationRequestForAdmin(store, request, viewerId) {
  if (!request) return null;
  return {
    ...request,
    profile: publicProfile(getProfile(store, request.profileId), viewerId, store, { shallow: true }),
    reviewedByProfile: request.reviewedBy ? publicProfile(getProfile(store, request.reviewedBy), viewerId, store, { shallow: true }) : null,
  };
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
function isProfileOnline(profile) {
  if (!profile || !profile.lastActiveAt) return false;
  const t = Date.parse(profile.lastActiveAt);
  return Number.isFinite(t) && (Date.now() - t) < ONLINE_WINDOW_MS;
}
function publicProfile(profile, viewerId, store, options = {}) {
  const profileOnlineNow = isProfileOnline(profile);
  if (!profile) return null;
  const index = options.index || null;
  const followerCount = index ? (index.followersByProfile.get(profile.id) || 0) : (store.followers || []).filter((follow) => follow.followingId === profile.id).length;
  const followingCount = index ? (index.followingByProfile.get(profile.id) || 0) : (store.followers || []).filter((follow) => follow.followerId === profile.id).length;
  const followedByMe = Boolean(viewerId && (index ? index.followingPairs.has(pairKey(viewerId, profile.id)) : (store.followers || []).find((follow) => follow.followerId === viewerId && follow.followingId === profile.id)));
  const likedByMe = Boolean(viewerId && viewerId !== profile.id && (index ? index.likePairs.has(pairKey(viewerId, profile.id)) : profileHeart(store, viewerId, profile.id)));
  const likedMe = Boolean(viewerId && viewerId !== profile.id && (index ? index.likePairs.has(pairKey(profile.id, viewerId)) : profileHeart(store, profile.id, viewerId)));
  const mutualHeart = Boolean(likedByMe && likedMe);
  const passedByMe = Boolean(viewerId && viewerId !== profile.id && profilePass(store, viewerId, profile.id));
  const blockByMe = viewerId && viewerId !== profile.id && !index ? profileBlock(store, viewerId, profile.id) : null;
  const blockedByMe = Boolean(viewerId && viewerId !== profile.id && (index ? index.blockPairs.has(pairKey(viewerId, profile.id)) : blockByMe));
  const blockingMe = Boolean(viewerId && viewerId !== profile.id && (index ? index.blockPairs.has(pairKey(profile.id, viewerId)) : profileBlock(store, profile.id, viewerId)));
  const blockExpiresAt = blockByMe?.expiresAt || null;
  const heartAllowed = viewerId === profile.id ? true : canSendProfileHeart(profile, getProfile(store, viewerId));
  const socialCounters = socialCountersFor(store, profile.id, index);
  const distanceKm = profileDistanceKm(store, viewerId, profile);
  if (options.shallow) {
    return {
      id: profile.id,
      pseudo: profile.pseudo,
      type: profile.type,
      category: profile.category,
      age: profile.age,
      ageDisplay: memberAgeSummary(profile),
      memberCount: Array.isArray(profile.members) ? profile.members.length : 1,
      members: sanitizeProfileMembers(profile.members, profile.category || profile.type, profile.age || 28, profile.details || {}),
      city: profile.city,
      cityLocation: publicCityLocation(profile, store),
      distanceKm,
      verified: profile.verified,
      online: profileOnlineNow,
      freeTonight: Boolean(profile.freeTonight || (Array.isArray(profile.details?.availability) && profile.details.availability.includes('Libre ce soir'))),
      avatarTone: profile.avatarTone,
      profilePhotoUrl: profile.profilePhotoUrl || defaultProfilePhoto(profile.pseudo || 'AS'),
      lastSeen: profileOnlineNow ? 'En ligne' : (profile.lastActiveAt ? 'Récemment' : 'Hors ligne'),
      followerCount,
      followingCount,
      followedByMe,
      likedByMe,
      likedMe,
      mutualHeart,
      passedByMe,
      blockedByMe,
      blockExpiresAt,
      blockingMe,
      heartAllowed,
      heartGender: profileHeartGender(profile),
      socialPreferences: socialPreferencesFor(profile),
      notificationPreferences: notificationPreferencesFor(profile),
      clientStatus: clientStatusFor(profile),
      moderationWarnings: profile.id === viewerId ? activeModerationWarningsFor(store, profile.id) : undefined,
      verificationRequest: profile.id === viewerId ? serializeVerificationRequestForOwner(latestVerificationRequestForProfile(store, profile.id)) : undefined,
      ...socialCounters,
    };
  }
  const albums = ensureAlbums(profile).map((album) => serializeAlbum(store, album, viewerId));
  const privateAlbums = albums.filter((album) => album.visibility === 'private');
  const firstPrivate = privateAlbums[0] || null;
  const isOwner = profile.id === viewerId;
  const privateItems = privateAlbums.flatMap((album) => album.items || []);
  const privateCount = privateAlbums.reduce((sum, album) => sum + album.itemCount, 0);
  const canSeeAnyPrivate = isOwner || privateAlbums.some((album) => album.unlocked);

  return {
    ...profile,
    online: profileOnlineNow,
    lastSeen: profileOnlineNow ? 'En ligne' : (profile.lastActiveAt ? 'Récemment' : 'Hors ligne'),
    members: sanitizeProfileMembers(profile.members, profile.category || profile.type, profile.age || 28, profile.details || {}),
    memberCount: Array.isArray(profile.members) ? profile.members.length : 1,
    ageDisplay: memberAgeSummary(profile),
    distanceKm,
    followerCount,
    followingCount,
    followedByMe,
    likedByMe,
    likedMe,
    mutualHeart,
    passedByMe,
    blockedByMe,
    blockExpiresAt,
    blockingMe,
    heartAllowed,
    heartGender: profileHeartGender(profile),
    socialPreferences: socialPreferencesFor(profile),
    notificationPreferences: notificationPreferencesFor(profile),
    clientStatus: profile.id === viewerId ? clientStatusFor(profile) : undefined,
    moderationWarnings: profile.id === viewerId ? activeModerationWarningsFor(store, profile.id) : undefined,
    verificationRequest: profile.id === viewerId ? serializeVerificationRequestForOwner(latestVerificationRequestForProfile(store, profile.id)) : undefined,
    ...socialCounters,
    subscription: serializeSubscription(store, profile.id),
    cityLocation: publicCityLocation(profile, store),
    location: profile.id === viewerId ? profile.location : { precision: profile.location?.precision || GEOCODER_PRECISION, city: profile.city },
    albums,
    albumAccess: isOwner
      ? { status: 'owner' }
      : firstPrivate?.access || { status: 'none' },
    privateAlbum: {
      ...(profile.privateAlbum || {}),
      count: privateCount,
      label: firstPrivate?.title || profile.privateAlbum?.label || 'Album privé',
      description: firstPrivate?.description || profile.privateAlbum?.description || 'Album verrouillé.',
      unlocked: canSeeAnyPrivate,
      items: privateItems,
    },
    genders: Array.isArray(profile.genders) ? profile.genders : [],
    orientations: Array.isArray(profile.orientations) ? profile.orientations : [],
    meetingTypes: Array.isArray(profile.meetingTypes) ? profile.meetingTypes : [],
    fetishes: Array.isArray(profile.fetishes) ? profile.fetishes : [],
    searching: profile.searching && typeof profile.searching === 'object'
      ? { genders: profile.searching.genders || [], orientations: profile.searching.orientations || [], meetingTypes: profile.searching.meetingTypes || [] }
      : { genders: [], orientations: [], meetingTypes: [] },
  };
}

function getProfile(store, id) {
  return store.profiles.find((profile) => profile.id === id);
}

function getAlbumAccess(store, ownerId, viewerId, albumId = null) {
  return store.albumAccess.find((access) => (
    access.ownerId === ownerId
    && access.viewerId === viewerId
    && (albumId ? access.albumId === albumId || !access.albumId : true)
  ));
}

function upsertAlbumAccess(store, ownerId, viewerId, albumId, patch) {
  let access = getAlbumAccess(store, ownerId, viewerId, albumId);
  if (!access || (albumId && access.albumId !== albumId)) {
    access = { id: makeId('access'), ownerId, viewerId, albumId: albumId || null, status: 'none', requestedAt: null, grantedAt: null, expiresAt: null };
    store.albumAccess.push(access);
  }
  Object.assign(access, patch, albumId ? { albumId } : {});
  return access;
}

function getConversation(store, a, b) {
  return store.conversations.find((conversation) => {
    if (conversation.isGroup) return false;
    const ids = conversation.participantIds;
    return ids.length === 2 && ids.includes(a) && ids.includes(b);
  });
}

function fileExtensionForMime(mimeType) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'audio/webm': '.weba',
    'audio/mp4': '.m4a',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
  };
  return map[mimeType] || '.bin';
}

function hasExpectedMagicBytes(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return false;
  if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (mimeType === 'video/webm') return buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') return buffer.length > 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  if (mimeType === 'audio/webm') return buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  if (mimeType === 'audio/ogg') return buffer.subarray(0, 4).toString('ascii') === 'OggS';
  if (mimeType === 'audio/mp4') return buffer.length > 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  if (mimeType === 'audio/mpeg') return buffer.subarray(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  return false;
}

function decodeStrictBase64DataUrl({ dataUrl, mimeType, maxChars, maxBytes }) {
  const prefix = `data:${mimeType};base64,`;
  if (!dataUrl.startsWith(prefix) || dataUrl.length > maxChars) {
    const error = new Error('Média trop lourd ou invalide.');
    error.statusCode = 400;
    throw error;
  }
  const encoded = dataUrl.slice(prefix.length);
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    const error = new Error('Média encodé invalide.');
    error.statusCode = 400;
    throw error;
  }
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length || buffer.length > maxBytes) {
    const error = new Error('Média trop lourd ou vide.');
    error.statusCode = 400;
    throw error;
  }
  if (!hasExpectedMagicBytes(buffer, mimeType)) {
    const error = new Error('Le contenu du fichier ne correspond pas au format annoncé.');
    error.statusCode = 400;
    throw error;
  }
  return buffer;
}

function safeStoragePath(root, filename) {
  if (!isSafeIdentifier(filename.replace(/\.[a-z0-9]+$/i, ''))) {
    const error = new Error('Nom de fichier invalide.');
    error.statusCode = 400;
    throw error;
  }
  const resolved = path.resolve(root, filename);
  const safeRoot = path.resolve(root);
  if (!resolved.startsWith(`${safeRoot}${path.sep}`)) {
    const error = new Error('Chemin média invalide.');
    error.statusCode = 400;
    throw error;
  }
  return resolved;
}

function persistMessageMedia({ dataUrl, mimeType, maxChars = MESSAGE_MEDIA_MAX_CHARS, maxBytes = MESSAGE_MEDIA_MAX_BYTES }) {
  const buffer = decodeStrictBase64DataUrl({ dataUrl, mimeType, maxChars, maxBytes });
  const fileId = makeId('msgmedia');
  const filename = `${fileId}${fileExtensionForMime(mimeType)}`;
  fs.mkdirSync(messageMediaRoot, { recursive: true, mode: 0o700 });
  const storagePath = safeStoragePath(messageMediaRoot, filename);
  fs.writeFileSync(storagePath, buffer, { mode: 0o600, flag: 'wx' });
  return { fileId, filename, storagePath, sizeBytes: buffer.length, url: `/api/message-media/${fileId}` };
}

function persistEventMedia({ dataUrl, mimeType }) {
  const buffer = decodeStrictBase64DataUrl({ dataUrl, mimeType, maxChars: ALBUM_MEDIA_MAX_CHARS, maxBytes: ALBUM_MEDIA_MAX_BYTES });
  const fileId = makeId('evtmedia');
  const filename = `${fileId}${fileExtensionForMime(mimeType)}`;
  fs.mkdirSync(eventMediaRoot, { recursive: true, mode: 0o700 });
  const storagePath = safeStoragePath(eventMediaRoot, filename);
  fs.writeFileSync(storagePath, buffer, { mode: 0o600, flag: 'wx' });
  return { fileId, filename, storagePath, mimeType: mimeType || 'image/jpeg', sizeBytes: buffer.length, url: `/api/event-media/${fileId}` };
}

function persistAlbumMedia({ dataUrl, mimeType, mediaType = 'photo' }) {
  const buffer = decodeStrictBase64DataUrl({ dataUrl, mimeType, maxChars: ALBUM_MEDIA_MAX_CHARS, maxBytes: ALBUM_MEDIA_MAX_BYTES });
  const fileId = makeId(mediaType === 'video' ? 'albvideo' : 'albphoto');
  const filename = `${fileId}${fileExtensionForMime(mimeType)}`;
  fs.mkdirSync(albumMediaRoot, { recursive: true, mode: 0o700 });
  const storagePath = safeStoragePath(albumMediaRoot, filename);
  fs.writeFileSync(storagePath, buffer, { mode: 0o600, flag: 'wx' });
  return { fileId, filename, storagePath, mimeType: mimeType || 'application/octet-stream', sizeBytes: buffer.length, url: `/api/album-media/${fileId}` };
}

function persistFeedMedia({ dataUrl, mimeType, mediaType = 'image' }) {
  const buffer = decodeStrictBase64DataUrl({ dataUrl, mimeType, maxChars: ALBUM_MEDIA_MAX_CHARS, maxBytes: ALBUM_MEDIA_MAX_BYTES });
  const fileId = makeId(mediaType === 'video' ? 'feedvideo' : 'feedimage');
  const filename = `${fileId}${fileExtensionForMime(mimeType)}`;
  fs.mkdirSync(feedMediaRoot, { recursive: true, mode: 0o700 });
  const storagePath = safeStoragePath(feedMediaRoot, filename);
  fs.writeFileSync(storagePath, buffer, { mode: 0o600, flag: 'wx' });
  return { fileId, filename, storagePath, mimeType: mimeType || 'application/octet-stream', sizeBytes: buffer.length, url: `/api/feed-media/${fileId}` };
}

const EVENT_AUDIENCES = ['all', 'couples_women', 'couples', 'women'];
const EVENT_AUDIENCE_LABELS = {
  all: '',
  couples_women: 'Soirée réservée aux couples et aux femmes',
  couples: 'Soirée réservée aux couples',
  women: 'Soirée réservée aux femmes',
};
function normalizeEventAudience(value) {
  const v = String(value || 'all').trim();
  return EVENT_AUDIENCES.includes(v) ? v : 'all';
}

function eventEndsAtMs(event) {
  const end = event?.endAt || event?.startAt;
  const ms = end ? new Date(end).getTime() : NaN;
  return Number.isFinite(ms) ? ms : null;
}

function isEventExpired(event, now = Date.now()) {
  const endMs = eventEndsAtMs(event);
  if (endMs === null) return false;
  // Suppression automatique 24 h après la fin de l'événement.
  return now > endMs + 24 * 60 * 60 * 1000;
}

function deleteEventMediaFiles(event) {
  const files = [];
  if (event?.banner?.filename) files.push(path.join(eventMediaRoot, event.banner.filename));
  for (const photo of event?.photos || []) {
    if (photo?.filename) files.push(path.join(eventMediaRoot, photo.filename));
  }
  for (const file of files) {
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch {}
  }
}

function pruneExpiredEvents(store, now = Date.now()) {
  const events = store.events || [];
  const kept = [];
  let changed = false;
  for (const event of events) {
    if (isEventExpired(event, now)) {
      deleteEventMediaFiles(event);
      changed = true;
    } else {
      kept.push(event);
    }
  }
  if (changed) store.events = kept;
  return changed;
}

function findEventMedia(store, fileId) {
  for (const event of store.events || []) {
    if (event.banner?.fileId === fileId) return { event, media: event.banner };
    const photo = (event.photos || []).find((p) => p.fileId === fileId);
    if (photo) return { event, media: photo };
  }
  return { event: null, media: null };
}

function serializeEvent(store, event, viewerId, options = {}) {
  if (!event) return null;
  const owner = getProfile(store, event.ownerId);
  const participantIds = Array.isArray(event.participantIds) ? event.participantIds : [];
  const base = {
    id: event.id,
    title: event.title,
    description: event.description || '',
    bannerUrl: event.banner?.url || '',
    startAt: event.startAt,
    endAt: event.endAt || event.startAt,
    location: {
      label: event.location?.label || event.location?.city || '',
      address: event.location?.address || '',
      city: event.location?.city || '',
      lat: event.location?.lat ?? null,
      lng: event.location?.lng ?? null,
    },
    priceCouple: event.priceCouple ?? null,
    priceWoman: event.priceWoman ?? null,
    audience: event.audience || 'all',
    audienceLabel: EVENT_AUDIENCE_LABELS[event.audience || 'all'] || '',
    visibility: event.visibility || 'public',
    visits: Number(event.visits || 0),
    participantCount: participantIds.length,
    isParticipant: viewerId ? participantIds.includes(viewerId) : false,
    isOwner: viewerId ? event.ownerId === viewerId : false,
    organizer: owner ? publicProfile(owner, viewerId, store, { shallow: true }) : { name: 'Organisateur' },
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
  if (options.includePhotos) {
    base.photos = (event.photos || []).map((photo) => ({ fileId: photo.fileId, url: photo.url, addedAt: photo.addedAt }));
  } else {
    base.photoCount = (event.photos || []).length;
  }
  return base;
}


function findAlbumMedia(store, fileId) {
  for (const profile of store.profiles || []) {
    for (const album of ensureAlbums(profile)) {
      for (const media of album.items || []) {
        if (media.fileId === fileId) return { profile, album, media };
      }
    }
  }
  return { profile: null, album: null, media: null };
}

function findMessageMedia(store, fileId) {
  for (const conversation of store.conversations || []) {
    for (const message of conversation.messages || []) {
      if ((message.attachment?.kind === 'media' || message.attachment?.kind === 'audio') && message.attachment.fileId === fileId) {
        return { conversation, message, attachment: message.attachment };
      }
    }
  }
  return { conversation: null, message: null, attachment: null };
}

function sanitizeMessageForViewer(message, viewerId) {
  const copy = clone(message);
  const viewedBy = Array.isArray(copy.viewedBy) ? copy.viewedBy : [];
  const isRecipient = copy.fromId !== viewerId;
  const isConsumed = Boolean(copy.attachment?.ephemeral && isRecipient && viewedBy.includes(viewerId));
  if (copy.attachment) {
    copy.attachment = { ...copy.attachment, consumed: isConsumed };
    delete copy.attachment.storagePath;
    delete copy.attachment.filename;
    if (isConsumed) {
      delete copy.attachment.dataUrl;
      delete copy.attachment.url;
    }
  }
  return copy;
}

function sanitizeLastMessageForConversation(message, viewerId) {
  if (!message) return null;
  const copy = sanitizeMessageForViewer(message, viewerId);
  if (copy.attachment?.dataUrl) delete copy.attachment.dataUrl;
  return copy;
}

function normalizeMessageAttachment(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = String(raw.kind || '').trim();
  if (kind === 'gif') {
    const url = String(raw.url || '').trim();
    const label = limitText(raw.label || 'GIF', 80) || 'GIF';
    if (!url || !/^\/gifs\/[a-z0-9_.-]+\.gif$/i.test(url)) {
      const error = new Error('GIF non autorisé.');
      error.statusCode = 400;
      throw error;
    }
    return { kind: 'gif', type: 'gif', label, url, ephemeral: false };
  }

  if (kind === 'media') {
    const dataUrl = String(raw.dataUrl || '').trim();
    const mimeType = String(raw.mimeType || '').trim().toLowerCase();
    const mediaType = mimeType.startsWith('video/') ? 'video' : 'image';
    const expiresInSeconds = MESSAGE_MEDIA_EXPIRIES.has(Number(raw.expiresInSeconds)) ? Number(raw.expiresInSeconds) : 5;
    const name = limitText(raw.name || `${mediaType}`, 120) || `${mediaType}`;
    const allowed = mediaType === 'video' ? MESSAGE_ALLOWED_VIDEO_TYPES : MESSAGE_ALLOWED_IMAGE_TYPES;
    if (!allowed.has(mimeType)) {
      const error = new Error('Format média non autorisé.');
      error.statusCode = 400;
      throw error;
    }
    const stored = persistMessageMedia({ dataUrl, mimeType });
    // Médias rendus permanents : plus d'autodestruction après lecture.
    return { kind: 'media', type: mediaType, mimeType, name, ephemeral: false, ...stored };
  }

  if (kind === 'audio') {
    const dataUrl = String(raw.dataUrl || '').trim();
    const mimeType = String(raw.mimeType || '').trim().toLowerCase();
    if (!MESSAGE_ALLOWED_AUDIO_TYPES.has(mimeType)) {
      const error = new Error('Format audio non autorisé.');
      error.statusCode = 400;
      throw error;
    }
    const durationSeconds = Math.min(MESSAGE_AUDIO_MAX_SECONDS, Math.max(0, Math.round(Number(raw.durationSeconds) || 0)));
    const stored = persistMessageMedia({ dataUrl, mimeType, maxBytes: MESSAGE_AUDIO_MAX_BYTES });
    return { kind: 'audio', type: 'audio', mimeType, durationSeconds, ephemeral: false, ...stored };
  }
  const error = new Error('Pièce jointe non reconnue.');
  error.statusCode = 400;
  throw error;
}

function serializeConversation(store, conversation, viewerId) {
  if (conversation.isGroup) {
    const messages = permanentMessages(conversation);
    const lastMessage = sanitizeLastMessageForConversation(messages.at(-1), viewerId);
    const unread = messages.filter((message) => message.fromId && message.fromId !== viewerId && !(Array.isArray(message.viewedBy) ? message.viewedBy : []).includes(viewerId)).length;
    const members = (conversation.participantIds || [])
      .map((id) => publicProfile(getProfile(store, id), viewerId, store, { shallow: true }))
      .filter(Boolean);
    return {
      id: conversation.id,
      isGroup: true,
      name: conversation.name || 'Groupe',
      ownerId: conversation.ownerId || null,
      isOwner: conversation.ownerId === viewerId,
      participant: null,
      members,
      participantIds: conversation.participantIds || [],
      lastMessage,
      unread,
      isTwoWay: true,
      messageCount: messages.length,
      updatedAt: conversation.updatedAt,
    };
  }
  const otherId = conversation.participantIds.find((id) => id !== viewerId);
  const other = getProfile(store, otherId);
  const messages = permanentMessages(conversation);
  const lastMessage = sanitizeLastMessageForConversation(messages.at(-1), viewerId);
  const unread = messages.filter((message) => message.fromId !== viewerId && !message.read).length;
  const senders = new Set(messages.map((message) => message.fromId).filter(Boolean));
  return {
    id: conversation.id,
    isGroup: false,
    participant: other ? publicProfile(other, viewerId, store) : null,
    lastMessage,
    unread,
    isTwoWay: conversation.participantIds.every((id) => senders.has(id)),
    messageCount: messages.length,
    updatedAt: conversation.updatedAt,
  };
}

function serializeInstantChat(store, conversation, viewerId) {
  const otherId = conversation.participantIds.find((id) => id !== viewerId);
  const other = getProfile(store, otherId);
  const messages = activeInstantMessages(conversation);
  const lastMessage = sanitizeLastMessageForConversation(messages.at(-1), viewerId);
  const unread = messages.filter((message) => message.fromId !== viewerId && !message.read).length;
  const senders = new Set(messages.map((message) => message.fromId).filter(Boolean));
  return {
    id: conversation.id,
    participant: other ? publicProfile(other, viewerId, store) : null,
    lastMessage,
    unread,
    isTwoWay: conversation.participantIds.every((id) => senders.has(id)),
    messageCount: messages.length,
    expiresAfterSeconds: 0,
    updatedAt: messages.at(-1)?.createdAt || conversation.updatedAt,
  };
}

function requireAdultGate(req, res, next) {
  const confirmed = req.get('x-adult-confirmed') === 'true' || req.path === '/health';
  if (!confirmed && process.env.NODE_ENV === 'production') {
    return res.status(428).json({
      error: 'adult_confirmation_required',
      message: 'La plateforme est strictement réservée aux personnes majeures.',
    });
  }
  next();
}

function requireSubscriptionOrLimitedAccess(req, res, next) {
  if (!req.currentProfile || req.currentUser?.role === 'admin') return next();
  const openPaths = [
    '/health',
    '/bootstrap',
    '/profile-options',
    '/auth/demo',
    '/auth/logout',
    '/auth/resend-verification',
  ];
  const isOpen = openPaths.includes(req.path)
    || req.path.startsWith('/subscriptions')
    || req.path.startsWith('/payments')
    || req.path.startsWith('/notifications')
    || req.path.startsWith('/push/')
    || req.path === '/support/contact'
    || req.path === '/notification-preferences'
    || req.path === '/profile/notification-preferences'
    || req.path === '/profile/social-preferences'
    || req.path === '/profile/client-status'
    || req.path === '/social'
    || req.path === '/favorites'
    || req.path === '/profiles/me/export'
    || req.path === '/blocks'
    || /^\/profiles\/[^/]+\/block$/.test(req.path)
    || req.path === '/profiles/me'
    || req.path === '/events'
    || req.path.startsWith('/events/')
    || req.path === '/event-media'
    || req.path.startsWith('/event-media/')
    || req.path.startsWith('/admin');
  if (isOpen) return next();
  const subscription = serializeSubscription(req.app.locals.store, req.currentProfile.id);
  if (subscription.active) return next();
  // Accès lecture seule gratuit pour les nouveaux inscrits (amorçage communauté).
  // Les interactions (heart, follow, ENVOI de message, ouverture de conversation,
  // albums privés) restent réservées aux abonnés. La lecture des profils est limitée
  // à FREE_TIER_VIEW_LIMIT profils par FREE_TIER_WINDOW_HOURS (voir GET /profiles/:id).
  const isReadOnlyFreeAccess = (req.method === 'GET' && req.path === '/profiles')
    || (req.method === 'GET' && req.path === '/venues')
    || (req.method === 'GET' && /^\/profiles\/[^/]+$/.test(req.path))
    || (req.method === 'GET' && req.path === '/conversations')
    || (req.method === 'GET' && /^\/conversations\/[^/]+\/messages$/.test(req.path));
  if (isReadOnlyFreeAccess) return next();
  return res.status(402).json({
    error: 'subscription_required',
    message: 'Abonnement nécessaire pour cette action. Découvrez les formules pour débloquer la plateforme complète.',
  });
}

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

function buildAllowedOrigins() {
  const defaults = isProduction() ? '' : 'http://localhost:5173,http://localhost:4000,http://127.0.0.1:4000';
  const allowed = new Set((process.env.FRONTEND_ORIGIN || defaults)
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean));

  for (const key of ['RENDER_EXTERNAL_URL', 'PUBLIC_APP_URL', 'APP_ORIGIN']) {
    const value = String(process.env[key] || '').trim();
    if (value) allowed.add(normalizeOrigin(value));
  }

  const railwayPublicDomain = String(process.env.RAILWAY_PUBLIC_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (railwayPublicDomain) allowed.add(`https://${railwayPublicDomain}`);

  return [...allowed];
}

function isSameRequestOrigin(origin, req) {
  try {
    const url = new URL(normalizeOrigin(origin));
    const host = String(req?.get?.('host') || '').toLowerCase();
    return Boolean(host && url.host.toLowerCase() === host);
  } catch {
    return false;
  }
}

function isAllowedCorsOrigin(origin, allowedOrigins, req = null) {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (req && isSameRequestOrigin(normalized, req)) return true;
  if (allowedOrigins.includes(normalized)) return true;

  try {
    const url = new URL(normalized);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol === 'https:' && (hostname.endsWith('.up.railway.app') || hostname.endsWith('.railway.app'))) return true;
    if (process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(hostname)) return true;
  } catch {}

  return false;
}

function corsOriginDeniedError() {
  const error = new Error('Origine CORS non autorisée');
  error.statusCode = 403;
  return error;
}

function trustProxyValueFromEnv() {
  const raw = String(process.env.TRUST_PROXY || '').trim();
  if (!raw || raw === '0' || raw.toLowerCase() === 'false') return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (raw.toLowerCase() === 'true') return true;
  return raw;
}


function retentionDeleteAfter(removedAt = nowIso()) {
  return new Date(new Date(removedAt).getTime() + MEDIA_REMOVED_RETENTION_MS).toISOString();
}

function isStoredMediaPath(storagePath) {
  if (!storagePath) return false;
  const resolved = path.resolve(storagePath);
  return resolved.startsWith(albumMediaRoot + path.sep) || resolved.startsWith(messageMediaRoot + path.sep) || resolved.startsWith(feedMediaRoot + path.sep);
}

function trackRemovedMediaForRetention(store, media, meta = {}) {
  if (!media?.storagePath || !isStoredMediaPath(media.storagePath)) return null;
  if (!Array.isArray(store.deletedMedia)) store.deletedMedia = [];
  const removedAt = nowIso();
  const record = {
    id: makeId('deleted_media'),
    fileId: media.fileId || '',
    mediaId: media.id || '',
    ownerId: media.ownerId || meta.ownerId || '',
    albumId: media.albumId || meta.albumId || '',
    type: media.type || meta.type || 'media',
    storagePath: media.storagePath,
    filename: media.filename || path.basename(media.storagePath),
    sizeBytes: Number(media.sizeBytes || 0),
    reason: meta.reason || 'user_removed_from_site',
    removedAt,
    deleteAfter: retentionDeleteAfter(removedAt),
    status: 'retained_until_cleanup',
  };
  store.deletedMedia.push(record);
  return record;
}

function mediaRetentionSummary(store) {
  const records = Array.isArray(store.deletedMedia) ? store.deletedMedia : [];
  const now = Date.now();
  const retained = records.filter((item) => item.status !== 'deleted');
  const eligible = retained.filter((item) => item.deleteAfter && new Date(item.deleteAfter).getTime() <= now && item.status !== 'delete_failed');
  const failed = records.filter((item) => item.status === 'delete_failed');
  const upcoming = retained
    .filter((item) => item.deleteAfter && new Date(item.deleteAfter).getTime() > now)
    .sort((a, b) => new Date(a.deleteAfter) - new Date(b.deleteAfter))[0] || null;
  return {
    months: MEDIA_REMOVED_RETENTION_MONTHS,
    mode: 'manual_admin',
    automaticPurge: false,
    notice: MEDIA_RETENTION_NOTICE,
    retainedDeletedMedia: retained.length,
    deletedMedia: records.filter((item) => item.status === 'deleted').length,
    eligibleForPurge: eligible.length,
    failedPurge: failed.length,
    nextEligibleAt: upcoming?.deleteAfter || null,
  };
}

function pruneExpiredRemovedMedia(store) {
  if (!Array.isArray(store.deletedMedia)) store.deletedMedia = [];
  const now = Date.now();
  let changed = false;
  let purgedNow = 0;
  let failedNow = 0;
  for (const record of store.deletedMedia) {
    if (record.status === 'deleted') continue;
    if (!record.deleteAfter || new Date(record.deleteAfter).getTime() > now) continue;
    if (record.storagePath && isStoredMediaPath(record.storagePath)) {
      try {
        if (fs.existsSync(record.storagePath)) fs.unlinkSync(record.storagePath);
      } catch (error) {
        record.status = 'delete_failed';
        record.error = error.message;
        record.lastPurgeAttemptAt = nowIso();
        failedNow += 1;
        changed = true;
        continue;
      }
    }
    record.status = 'deleted';
    record.deletedAt = nowIso();
    record.purgedBy = 'admin_manual';
    purgedNow += 1;
    changed = true;
  }
  return { changed, purgedNow, failedNow, ...mediaRetentionSummary(store) };
}

// Nettoyage périodique des tokens et sessions expirés
function scheduleMaintenanceTasks(store) {
  const ONE_HOUR = 60 * 60 * 1000;
  setInterval(() => {
    const now = Date.now();
    const prevSess = store.sessions?.length || 0;
    const prevTokens = store.emailTokens?.length || 0;
    const prevResets = store.passwordResets?.length || 0;
    store.sessions = (store.sessions || []).filter((s) => new Date(s.expiresAt).getTime() > now);
    store.emailTokens = (store.emailTokens || []).filter((t) => new Date(t.expiresAt).getTime() > now);
    store.passwordResets = (store.passwordResets || []).filter((r) => new Date(r.expiresAt).getTime() > now);
    const cleaned = (prevSess - store.sessions.length) + (prevTokens - store.emailTokens.length) + (prevResets - store.passwordResets.length);
    if (cleaned > 0) console.log(`[maintenance] ${cleaned} entrée(s) expirée(s) purgée(s).`);
  }, ONE_HOUR);
}

export async function createApp() {
  const configWarnings = assertProductionConfig();
  const app = express();
  const persistence = await initPersistentStore(createDemoStore());
  const store = ensureProfileMembers(reconcileConfiguredAdminAccount(persistence.store));
  try { persistence.persist(store); } catch {}
  const allowedOrigins = buildAllowedOrigins();

  app.locals.store = store;
  app.locals.persistence = persistence;

  // Web Push : prépare les clés VAPID (env ou auto-générées) et le runtime d'envoi.
  webPushRuntime.store = store;
  ensureWebPushConfig(store, persistence)
    .then((config) => { webPushRuntime.config = config; })
    .catch((error) => console.error('[push] initialisation impossible :', error.message));
  app.locals.productionConfigWarnings = configWarnings;

  // PERF: persistance debouncee. Avant, CHAQUE requete mutante (POST/PUT/PATCH/DELETE)
  // reecrivait toute la base de facon synchrone. On regroupe desormais les ecritures :
  // au plus une serialisation toutes les ~1,2 s, ce qui ecrase les rafales d'ecritures
  // (messages, likes, vues...) sans impact visible pour l'utilisateur. Un flush est
  // force a l'arret du serveur pour ne perdre aucune ecriture en attente.
  let persistTimer = null;
  let persistDirty = false;
  function flushPersist() {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    if (!persistDirty) return;
    persistDirty = false;
    try { persistence.persist(store); } catch (error) { console.error('Persistence error:', error); }
  }
  function schedulePersist() {
    persistDirty = true;
    if (persistTimer) return;
    persistTimer = setTimeout(() => { persistTimer = null; flushPersist(); }, 1200);
    if (typeof persistTimer.unref === 'function') persistTimer.unref();
  }
  app.locals.schedulePersist = schedulePersist;
  app.locals.flushPersist = flushPersist;

  // Purge médias volontairement manuelle : lancement uniquement via l’admin.
  app.disable('x-powered-by');
  const originalListen = app.listen.bind(app);
  app.listen = (...args) => {
    const server = originalListen(...args);
    const originalClose = server.close.bind(server);
    let persistenceClosed = false;
    server.close = (callback) => originalClose((error) => {
      if (!persistenceClosed) {
        persistenceClosed = true;
        try { flushPersist(); } catch (flushError) { error = error || flushError; }
        try { persistence.close?.(); }
        catch (closeError) { error = error || closeError; }
      }
      if (callback) callback(error);
    });
    return server;
  };

  const trustProxyValue = trustProxyValueFromEnv();
  if (trustProxyValue !== null) {
    app.set('trust proxy', trustProxyValue);
  } else if (process.env.RENDER || process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_PRIVATE_DOMAIN || process.env.RAILWAY_ENVIRONMENT) {
    app.set('trust proxy', 1);
  }

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'none'"],
        "object-src": ["'none'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "media-src": ["'self'", "blob:"],
        "connect-src": ["'self'", ...allowedOrigins, "https://*.up.railway.app", "https://*.railway.app"],
        "frame-src": ["'self'", "https://www.openstreetmap.org"],
        "form-action": ["'self'"],
        "upgrade-insecure-requests": isProduction() ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: isProduction() ? { maxAge: 15552000, includeSubDomains: true, preload: false } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    next();
  });
  app.use((req, res, next) => cors({
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin, allowedOrigins, req)) return callback(null, true);
      return callback(corsOriginDeniedError());
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Adult-Confirmed'],
    maxAge: 600,
  })(req, res, next));
  app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/api/') && /(?:%2e|%2f|%5c|\.\.)/i.test(req.originalUrl)) {
      return res.status(400).json({ error: 'invalid_path', message: 'Chemin invalide.' });
    }
    next();
  });
  // Identifiant unique par requête (utile pour les logs et le débogage)
  app.use((req, res, next) => {
    req.requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });

  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 240, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'rate_limited', message: 'Trop de requêtes, réessaie dans quelques minutes.' } }));
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false, skipSuccessfulRequests: true, message: { error: 'auth_rate_limited', message: 'Trop de tentatives, réessaie dans quelques minutes.' } });
  const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 35, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'upload_rate_limited', message: 'Trop d’envois média, réessaie plus tard.' } });
  const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'admin_rate_limited', message: 'Trop d’actions admin, réessaie plus tard.' } });
  const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'contact_rate_limited', message: 'Limite de messages atteinte, réessaie dans 1 heure.' } });
  const socialInteractionLimiter = rateLimit({ windowMs: 60 * 1000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'social_rate_limited', message: 'Trop d’interactions en peu de temps.' } });
  app.use(['/api/auth/login', '/api/auth/2fa/verify', '/api/auth/register', '/api/auth/google'], authLimiter);
  app.use(['/api/albums/:albumId/media', '/api/conversations/:profileId/messages', '/api/instant-chats/:profileId/messages'], uploadLimiter);
  app.use('/api/admin', adminLimiter);
  app.use(['/api/support/contact', '/api/reports'], contactLimiter);
  app.use(['/api/media', '/api/profiles', '/api/conversations', '/api/instant-chats'], socialInteractionLimiter);
  // Le webhook Stripe doit recevoir le corps BRUT (non parsé en JSON) pour que
  // la signature HMAC soit vérifiable. On l'intercepte donc avant le parser JSON.
  app.post('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
    if (!isStripeProvider()) {
      return res.status(404).json({ error: 'webhook_not_available', message: 'Le webhook Stripe est inactif (PAYMENT_PROVIDER ≠ stripe).' });
    }
    const secret = stripeWebhookSecret();
    const signature = req.get('stripe-signature') || '';
    if (!secret) {
      return res.status(500).json({ error: 'webhook_secret_missing', message: 'STRIPE_WEBHOOK_SECRET non configuré.' });
    }
    if (!verifyStripeWebhookSignature(req.body, signature, secret)) {
      return res.status(401).json({ error: 'invalid_signature', message: 'Signature webhook invalide.' });
    }

    let event;
    try {
      event = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'invalid_payload', message: 'Corps webhook illisible.' });
    }

    // On n'active l'accès que sur paiement réellement confirmé.
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data?.object || {};
      if (session.payment_status && session.payment_status !== 'paid') {
        return res.json({ received: true, ignored: 'payment_not_paid' });
      }
      const meta = session.metadata || {};
      const profileId = meta.profileId || session.client_reference_id || '';
      const planId = meta.planId || '';
      const promoCode = meta.promoCode || '';

      // Idempotence : un même event Stripe ne doit pas activer deux fois.
      const eventId = String(event.id || '');
      const already = (store.purchases || []).some((purchase) => purchase.stripeEventId && purchase.stripeEventId === eventId);
      if (already) return res.json({ received: true, idempotent: true });

      const quote = quoteSubscription(store, planId, promoCode);
      if (!quote || !profileId) {
        console.warn(`[stripe-webhook] event ${eventId} reçu mais profil/plan introuvable (profileId=${profileId}, planId=${planId}).`);
        return res.json({ received: true, ignored: 'unknown_profile_or_plan' });
      }
      try {
        const granted = grantSubscriptionFromQuote(profileId, quote, 'stripe_checkout');
        if (granted?.purchase) {
          granted.purchase.stripeEventId = eventId;
          granted.purchase.stripeSessionId = session.id || '';
        }
        try { persistence.persist(store); } catch (error) { console.error('Persistence error (webhook):', error); }
        console.log(`[stripe-webhook] Abonnement activé pour ${profileId} (plan ${planId}) via session ${session.id}.`);
      } catch (error) {
        console.error(`[stripe-webhook] Activation impossible: ${error.message}`);
        // On renvoie 200 pour éviter que Stripe ne réessaie en boucle si l'erreur est métier (ex. code déjà utilisé).
        return res.json({ received: true, granted: false, reason: error.code || 'activation_failed' });
      }
    }

    res.json({ received: true });
  });

  app.use(requireJsonContentType);
  app.use(dynamicJsonParser);


  app.use('/api', (req, res, next) => {
    res.on('finish', () => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && res.statusCode < 500) {
        schedulePersist();
      }
      // Traçabilité RGPD : on journalise aussi les consultations admin d'un profil
      // (la fiche complète d'un membre inclut l'accès à ses albums privés en mode supervision).
      const isAdminSensitiveRead = req.method === 'GET'
        && req.currentUser?.role === 'admin'
        && res.statusCode < 400
        && /^\/api\/profiles\/[^/?]+(?:\?|$)/.test(req.originalUrl);
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || isAdminSensitiveRead) {
        try {
          persistence.audit({
            profileId: req.currentProfile?.id || null,
            role: req.currentUser?.role || null,
            method: isAdminSensitiveRead ? 'GET (consultation admin)' : req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            createdAt: nowIso(),
          });
        } catch {}
      }
    });
    next();
  });

  const publicApiPaths = new Set(['/api/health', '/api/auth/age-gate', '/api/auth/age-verification/start', '/api/auth/age-verification/demo-confirm', '/api/auth/age-verification/webhook', '/api/auth/login', '/api/auth/2fa/verify', '/api/auth/register', '/api/auth/google', '/api/auth/demo', '/api/auth/verify-email', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/profile-options', '/api/geo/city', '/api/geo/cities', '/api/legal']);
  app.use('/api', (req, res, next) => {
    if (publicApiPaths.has(req.path === '/' ? '/api' : `/api${req.path}`) || req.path.startsWith('/influencer/')) return next();
    const session = getSessionFromRequest(store, req);
    if (!session) return res.status(401).json({ error: 'auth_required', message: 'Connexion obligatoire. Connecte-toi pour continuer.' });
    const user = store.authUsers.find((item) => item.id === session.userId);
    const profile = getProfile(store, session.profileId);
    if (!user || !profile) return res.status(401).json({ error: 'invalid_session', message: 'Session invalide.' });
    req.currentSession = session;
    req.currentUser = user;
    req.currentProfile = profile;
    try { profile.lastActiveAt = new Date().toISOString(); } catch (_) { /* présence best-effort */ }
    // Suspension / bannissement temporaire : bloque l'accès tant que la suspension est active (sauf admin et déconnexion).
    if (user.role !== 'admin' && profile.suspendedUntil && new Date(profile.suspendedUntil).getTime() > Date.now() && req.path !== '/auth/logout') {
      return res.status(403).json({
        error: 'account_suspended',
        message: `Compte suspendu jusqu'au ${new Date(profile.suspendedUntil).toLocaleString('fr-FR')}.${profile.suspendedReason ? ' Motif : ' + profile.suspendedReason : ''}`,
        suspendedUntil: profile.suspendedUntil,
      });
    }
    next();
  });
  app.use('/api', requireAdultGate);
  app.use('/api', requireSubscriptionOrLimitedAccess);

  app.get('/api/health', (req, res) => {
    const publicHealth = !isProduction() || PUBLIC_PRODUCTION_HEALTH || req.currentUser?.role === 'admin';
    res.json({
      ok: true,
      name: 'Voluptia API',
      at: nowIso(),
      database: publicHealth ? { type: persistence.type, warning: persistence.warning || null } : { type: persistence.type },
      legalVersion: LEGAL_VERSION,
      mediaRetention: mediaRetentionSummary(store),
      productionWarnings: publicHealth ? configWarnings : [],
      admin: publicHealth ? {
        email: maskEmail(adminEmailFromEnv()),
        configured: hasSafeConfiguredAdmin(),
        bootstrap: shouldUseBootstrapAdmin(),
        ownerAdmin: isOwnerAdminEmail(adminEmailFromEnv()),
        ownerPasswordFromEnvActive: !hasSafeConfiguredAdmin() && hasBundledOwnerAdminPassword(),
      } : { configured: hasSafeConfiguredAdmin(), bootstrap: shouldUseBootstrapAdmin() },
      ageVerification: publicHealth ? {
        provider: ageVerificationProvider(),
        strict: ageVerificationIsStrict(),
        serverRequired: requiresServerAgeVerification(),
        mode: requiresServerAgeVerification() ? 'provider_or_demo_token' : 'declaration_only',
      } : { serverRequired: requiresServerAgeVerification() },
    });
  });


  app.post('/api/auth/age-gate', (req, res) => {
    res.json({ ok: true, message: 'Accès adulte confirmé pour cette session côté client.' });
  });

  app.post('/api/auth/age-verification/start', (req, res) => {
    const age = Number(req.body?.age || 0);
    if (age < VALIDATION.minAge || age > VALIDATION.maxAge) {
      return res.status(400).json({ error: 'adult_only', message: 'La vérification d’âge est réservée aux personnes majeures.' });
    }
    const provider = ageVerificationProvider();
    const providerUrl = process.env.AGE_VERIFICATION_PROVIDER_URL || '';
    if (!requiresServerAgeVerification()) {
      return res.status(200).json({
        verification: {
          sessionId: null,
          provider,
          mode: 'declaration_only',
          status: 'not_required',
          expiresAt: null,
        },
        providerUrl: '',
        message: 'Vérification prestataire non configurée : inscription autorisée avec déclaration majeure, acceptation légale et traçabilité serveur.',
      });
    }
    const record = createAgeVerificationRecord(store, {
      age,
      mode: provider === 'demo' ? 'demo' : 'provider_redirect',
      status: provider === 'demo' ? 'pending' : 'pending_provider',
      metadata: { ipHint: req.ip, userAgent: req.get('user-agent') || '' },
    });
    persistence.recordAgeEvent({ sessionId: record.id, status: record.status, provider: record.provider, mode: record.mode, metadata: record.metadata, expiresAt: record.expiresAt });
    res.status(201).json({
      verification: publicAgeVerification(record),
      providerUrl: provider === 'demo' ? '' : providerUrl,
      message: provider === 'demo'
        ? 'Mode local/staging : simulation de vérification d’âge. En production publique, branche un prestataire conforme.'
        : 'Session de vérification créée. Redirection vers le prestataire requise.',
    });
  });

  app.post('/api/auth/age-verification/demo-confirm', (req, res) => {
    if (process.env.NODE_ENV === 'production' && ageVerificationProvider() === 'demo' && !allowDemoAgeVerificationInProduction()) {
      return res.status(403).json({ error: 'provider_required', message: 'Le mode démonstration est interdit en production sauf staging explicitement autorisé.' });
    }
    const sessionId = String(req.body?.sessionId || '').trim();
    const record = (store.ageVerifications || []).find((item) => item.id === sessionId);
    if (!record) return res.status(404).json({ error: 'verification_not_found', message: 'Session de vérification introuvable.' });
    if (new Date(record.expiresAt).getTime() <= Date.now()) return res.status(410).json({ error: 'verification_expired', message: 'Session de vérification expirée.' });
    if (Number(record.declaredAge || 0) < VALIDATION.minAge) return res.status(400).json({ error: 'adult_only', message: 'Accès réservé aux personnes majeures.' });
    record.status = 'verified';
    record.verifiedAt = nowIso();
    persistence.recordAgeEvent({ sessionId: record.id, status: record.status, provider: record.provider, mode: record.mode, verifiedAt: record.verifiedAt, expiresAt: record.expiresAt, metadata: record.metadata });
    res.json({ verification: publicAgeVerification(record), message: 'Âge vérifié en mode démonstration locale.' });
  });

  // Webhook prestataire de vérification d'âge réel (Veriff, AgeID, IDnow, etc.)
  // Le prestataire appelle cette route en POST avec le résultat de la vérification.
  // Configurer AGE_VERIFICATION_PROVIDER et AGE_VERIFICATION_PROVIDER_URL, et sécuriser
  // ce webhook avec une signature HMAC dans AGE_VERIFICATION_WEBHOOK_SECRET.
  app.post('/api/auth/age-verification/webhook', (req, res) => {
    const provider = ageVerificationProvider();
    if (provider === 'demo') {
      return res.status(404).json({ error: 'webhook_not_available', message: 'Le webhook n\'est actif qu\'avec un prestataire réel.' });
    }

    // Vérification de la signature HMAC du webhook (adapter selon le prestataire)
    const webhookSecret = process.env.AGE_VERIFICATION_WEBHOOK_SECRET || '';
    if (webhookSecret) {
      const signature = req.get('x-signature') || req.get('x-veriff-signature') || req.get('x-ageid-signature') || '';
      const payload = JSON.stringify(req.body);
      const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
      const signatureBody = signature.replace(/^sha256=/, '');
      const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureBody.padEnd(expected.length, ' ').slice(0, expected.length)));
      if (!valid) {
        return res.status(401).json({ error: 'invalid_webhook_signature', message: 'Signature webhook invalide.' });
      }
    }

    // Extraire l'identifiant de session depuis le corps du webhook
    // Adapter les champs selon le prestataire : Veriff utilise sessionId, AgeID utilise token
    const sessionId = String(req.body?.sessionId || req.body?.token || req.body?.session_id || '').trim();
    const status = String(req.body?.status || req.body?.decision || '').toLowerCase();
    const declaredOrVerifiedAge = Number(req.body?.age || req.body?.verifiedAge || 0);

    if (!sessionId) {
      return res.status(400).json({ error: 'missing_session_id', message: 'Identifiant de session manquant dans le webhook.' });
    }

    const record = (store.ageVerifications || []).find((item) => item.id === sessionId || item.token === sessionId);
    if (!record) {
      return res.status(404).json({ error: 'session_not_found', message: 'Session de vérification introuvable.' });
    }

    // Normaliser le statut reçu du prestataire
    const approved = ['approved', 'verified', 'success', 'passed', 'valid'].includes(status);
    const declined = ['declined', 'failed', 'rejected', 'expired', 'invalid'].includes(status);

    if (approved) {
      if (declaredOrVerifiedAge > 0 && declaredOrVerifiedAge < VALIDATION.minAge) {
        record.status = 'declined_minor';
        record.verifiedAt = nowIso();
        persistence.recordAgeEvent({ sessionId: record.id, status: record.status, provider: record.provider, mode: record.mode, verifiedAt: record.verifiedAt, expiresAt: record.expiresAt, metadata: record.metadata });
        return res.json({ ok: true, status: 'declined_minor' });
      }
      record.status = 'verified';
      record.verifiedAt = nowIso();
      if (declaredOrVerifiedAge >= VALIDATION.minAge) record.declaredAge = declaredOrVerifiedAge;
    } else if (declined) {
      record.status = 'declined';
      record.verifiedAt = nowIso();
    } else {
      // Statut intermédiaire (en cours, en attente de documents supplémentaires, etc.)
      record.status = 'pending_review';
    }

    persistence.recordAgeEvent({ sessionId: record.id, status: record.status, provider: record.provider, mode: record.mode, verifiedAt: record.verifiedAt || null, expiresAt: record.expiresAt, metadata: record.metadata });
    res.json({ ok: true, status: record.status });
  });

  // Export des données personnelles — RGPD art. 20 (droit à la portabilité)
  app.get('/api/profiles/me/export', (req, res) => {
    const profileId = req.currentProfile.id;
    const profile = req.currentProfile;
    const user = req.currentUser;

    const conversations = (store.conversations || [])
      .filter((c) => c.participantIds?.includes(profileId))
      .map((c) => ({
        with: c.participantIds?.find((id) => id !== profileId),
        messages: (c.messages || [])
          .filter((m) => m.fromId === profileId)
          .map((m) => ({ body: m.body, sentAt: m.createdAt, channel: m.channel })),
      }));

    const myMedia = [];
    for (const p of store.profiles || []) {
      for (const album of p.albums || []) {
        for (const media of album.items || []) {
          if (media.ownerId === profileId) {
            myMedia.push({ albumId: album.id, albumTitle: album.title, mediaId: media.id, type: media.type, title: media.title, uploadedAt: media.createdAt });
          }
        }
      }
    }

    const export_data = {
      exportedAt: nowIso(),
      account: {
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      profile: {
        pseudo: profile.pseudo,
        type: profile.type,
        age: profile.age,
        city: profile.city,
        bio: profile.bio,
        interests: profile.interests,
        lookingFor: profile.lookingFor,
        createdAt: profile.createdAt,
      },
      conversations,
      media: myMedia,
      legalAcceptances: (store.legalAcceptances || [])
        .filter((l) => l.profileId === profileId)
        .map((l) => ({ version: l.version, acceptedAt: l.acceptedAt })),
    };

    res.setHeader('Content-Disposition', `attachment; filename="voluptia-export-${profileId}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(export_data);
  });

  app.get('/api/legal', (req, res) => {
    res.json({ version: LEGAL_VERSION, documents: LEGAL_DOCUMENTS, checklist: LEGAL_CHECKLIST });
  });

  app.get('/api/profile-options', (req, res) => {
    res.json({ categories: PROFILE_CATEGORIES, details: DETAIL_OPTIONS, profileOptions: { categories: PROFILE_CATEGORIES, ...DETAIL_OPTIONS } });
  });

  app.get('/api/geo/city', async (req, res) => {
    const city = cleanCityName(req.query?.city);
    if (!city) {
      return res.status(400).json({ error: 'city_required', message: 'Ville obligatoire.' });
    }
    const location = await geocodeCity(store, city);
    if (!location) {
      return res.status(404).json({ error: 'city_not_found', message: 'Ville introuvable.' });
    }
    try { persistence.persist(store); } catch {}
    res.json({
      city: location.city || city,
      location,
      message: `Ville trouvée : ${location.displayName || location.city || city}.`,
    });
  });


  app.get('/api/geo/cities', async (req, res) => {
    const query = cleanCityName(req.query?.q || req.query?.city || '');
    if (query.length < 2) {
      return res.json({ query, suggestions: [] });
    }
    const suggestions = await suggestFrenchCities(query);
    res.json({
      query,
      suggestions,
      message: suggestions.length ? `${suggestions.length} suggestion(s) trouvée(s).` : 'Aucune commune trouvée.',
    });
  });

  app.post('/api/auth/register', async (req, res) => {
    // Anti-bot : champ piège invisible (« company »). Un humain ne le remplit jamais ;
    // les robots qui remplissent tous les champs sont rejetés silencieusement.
    if (String(req.body?.company || '').trim()) {
      return res.status(400).json({ error: 'registration_rejected', message: 'Inscription refusée.' });
    }
    const pseudo = limitText(req.body?.pseudo, MAX_TEXT.pseudo);
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const type = limitText(req.body?.type, 60);
    const city = limitText(req.body?.city, MAX_TEXT.city);
    const profilePhotoUrl = cleanProfilePhoto(req.body?.profilePhotoUrl || req.body?.photoUrl);
    const age = Number(req.body?.age || 0);
    const bio = limitText(req.body?.bio, MAX_TEXT.bio);
    const lookingFor = toList(req.body?.lookingFor);
    const acceptAdult = Boolean(req.body?.acceptAdult);
    const acceptLegal = Boolean(req.body?.acceptLegal);
    const acceptCharter = Boolean(req.body?.acceptCharter);
    const acceptSensitiveData = Boolean(req.body?.acceptSensitiveData || req.body?.acceptSensitive);
    const ageVerificationToken = String(req.body?.ageVerificationToken || '').trim();

    if (!acceptAdult || !acceptLegal || !acceptCharter || !acceptSensitiveData) {
      return res.status(400).json({ error: 'charter_required', message: 'La majorité, les documents légaux, la charte et le traitement explicite des données sensibles nécessaires au service doivent être confirmés.' });
    }
    if (age < VALIDATION.minAge || age > VALIDATION.maxAge) {
      return res.status(400).json({ error: 'adult_only', message: 'L’inscription est réservée aux personnes majeures avec un âge réaliste.' });
    }
    let ageVerification = null;
    if (requiresServerAgeVerification()) {
      ageVerification = getAgeVerification(store, ageVerificationToken);
      if (!isAgeVerificationValid(ageVerification)) {
        return res.status(428).json({ error: 'age_verification_required', message: 'Vérification d’âge requise avant création du compte.' });
      }
    }
    if (!pseudo || !email || !password || !type || !city) {
      return res.status(400).json({ error: 'missing_fields', message: 'Merci de remplir tous les champs obligatoires : pseudo, email, mot de passe, type de profil et ville.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'invalid_email', message: 'Adresse email invalide. Vérifiez le format (ex : prenom@domaine.fr).' });
    }
    if (password.length < VALIDATION.minPasswordLength) {
      return res.status(400).json({ error: 'password_too_short', message: `Mot de passe trop court. Il doit contenir au moins ${VALIDATION.minPasswordLength} caractères, idéalement avec des majuscules, chiffres et symboles.` });
    }
    if (store.authUsers.some((user) => user.email === email)) {
      return res.status(409).json({ error: 'email_exists', message: 'Un compte existe déjà avec cet email. Utilisez le formulaire de connexion ou récupérez votre mot de passe.' });
    }

    const profileDetails = makeDetails(req.body?.details || {});
    let profileMembers;
    try {
      profileMembers = sanitizeProfileMembers(req.body?.members, type, age, profileDetails, { throwOnInvalid: true });
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.code || 'members_invalid', message: error.message || 'Informations des personnes invalides.' });
    }

    const cityLocation = await geocodeCity(store, city);
    const resolvedCity = cityLocation?.city || city;
    const id = makeId('profile');
    const profile = {
      id,
      pseudo,
      type,
      age,
      city: resolvedCity,
      distanceKm: 0,
      region: cityLocation?.region || '',
      location: cityLocation ? { lat: cityLocation.lat, lng: cityLocation.lng, region: cityLocation.region || '', precision: GEOCODER_PRECISION, source: cityLocation.source || 'city' } : null,
      verified: false,
      online: true,
      avatarTone: pickAvatarTone(type),
      profilePhotoUrl: profilePhotoUrl || defaultProfilePhoto(pseudo || 'AS'),
      category: PROFILE_CATEGORIES.includes(type) ? type : type,
      genderCategory: PROFILE_CATEGORIES.includes(type) ? type : type,
      orientation: String(req.body?.orientation || type).trim(),
      genders: sanitizeOptionList(req.body?.genders, DETAIL_OPTIONS.genderOptions),
      orientations: sanitizeOptionList(req.body?.orientations, DETAIL_OPTIONS.sexualOrientations),
      details: profileDetails,
      members: profileMembers,
      meetingTypes: sanitizeOptionList(req.body?.meetingTypes, DETAIL_OPTIONS.meetingTypes),
      fetishes: sanitizeOptionList(req.body?.fetishes, DETAIL_OPTIONS.fetishes),
      searching: {
        genders: sanitizeOptionList(req.body?.searchGenders, DETAIL_OPTIONS.genderOptions),
        orientations: sanitizeOptionList(req.body?.searchOrientations, DETAIL_OPTIONS.sexualOrientations),
        meetingTypes: sanitizeOptionList(req.body?.searchMeetingTypes, DETAIL_OPTIONS.meetingTypes),
      },
      headline: 'Nouveau profil du cercle privé.',
      bio: bio || 'Profil en cours de personnalisation.',
      interests: ['Discrétion', 'Respect', 'Dialogue'],
      lookingFor: lookingFor.length ? lookingFor : ['Profils respectueux'],
      limits: ['Consentement clair', 'Pas d’insistance'],
      publicPhotos: ['Photo publique à ajouter', 'Ambiance', 'Détail discret'],
      privateAlbum: {
        count: 0,
        label: 'Album privé',
        description: 'Galerie privée à compléter et à ouvrir uniquement aux profils choisis.',
      },
      privacy: {
        approximateLocation: true,
        blurredByDefault: true,
        screenshotsWarning: true,
      },
      lastSeen: 'En ligne',
      createdAt: nowIso(),
    };

    ensureAlbums(profile);
    profile.memberCount = profile.members.length;
    profile.ageDisplay = memberAgeSummary(profile);
    store.profiles.push(profile);
    // L'email propriétaire ne devient PAS admin tout de suite : il le devient une fois
    // son email confirmé (voir /auth/verify-email). Cela empêche un inconnu de devenir
    // admin en s'inscrivant avec cet email sans pouvoir lire la boîte mail.
    const user = { id: makeId('auth'), profileId: id, email, passwordHash: hashPassword(password), role: 'member', emailVerified: false, createdAt: nowIso() };
    store.authUsers.push(user);

    // Email de vérification (optionnel pour les membres, mais on l'envoie toujours).
    const { token: emailToken, hash: emailHash } = makeEmailToken();
    store.emailTokens.push({ id: makeId('emailtok'), userId: user.id, email, hash: emailHash, createdAt: nowIso(), expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() });
    sendVerificationEmail(email, emailToken).catch((err) => console.error('Envoi email vérification:', err.message));
    if (ageVerification) {
      ageVerification.profileId = id;
      ageVerification.consumedAt = nowIso();
    }
    const legalAcceptance = { id: makeId('legal'), profileId: id, version: LEGAL_VERSION, acceptedAt: nowIso(), acceptedAdult: acceptAdult, acceptedLegal: acceptLegal, acceptedCharter: acceptCharter, acceptedSensitiveData: acceptSensitiveData, ipHint: req.ip, userAgent: req.get('user-agent') || '' };
    store.legalAcceptances.push(legalAcceptance);
    const { token, session } = issueSession(store, user);

    res.status(201).json({
      token,
      session: { role: session.role, expiresAt: session.expiresAt },
      profile: publicProfile(profile, profile.id, store),
      message: `Bienvenue dans Voluptia, ${profile.pseudo} ! Un email de confirmation vous a été envoyé.`,
    });
  });


  app.post('/api/auth/google', async (req, res) => {
    const credential = String(req.body?.credential || req.body?.idToken || '').trim();
    const mode = String(req.body?.mode || 'login').trim().toLowerCase() === 'register' ? 'register' : 'login';
    if (!credential) return res.status(400).json({ error: 'google_token_required', message: 'Jeton Google manquant.' });

    let googlePayload;
    try {
      googlePayload = await verifyGoogleIdToken(credential);
    } catch (error) {
      return res.status(error.statusCode || 401).json({ error: error.code || 'google_auth_failed', message: error.message || 'Connexion Google impossible.' });
    }

    const email = normalizeEmail(googlePayload.email);
    const googleSub = String(googlePayload.sub || '').trim();
    if (!email || !isValidEmail(email) || !googleSub) {
      return res.status(400).json({ error: 'google_profile_incomplete', message: 'Le compte Google ne fournit pas les informations nécessaires.' });
    }

    let user = (store.authUsers || []).find((item) => item.googleSub === googleSub) || (store.authUsers || []).find((item) => normalizeEmail(item.email) === email);
    if (user) {
      user.googleSub = user.googleSub || googleSub;
      user.googleEmail = email;
      user.emailVerified = true;
      user.lastGoogleLoginAt = nowIso();
      if (isOwnerAdminEmail(email) && user.role !== 'admin') user.role = 'admin';
      const profile = getProfile(store, user.profileId);
      if (!profile) return res.status(404).json({ error: 'profile_not_found', message: 'Profil introuvable.' });
      profile.online = true;
      profile.lastSeen = 'En ligne';
      if (isOwnerAdminEmail(email)) { profile.role = 'admin'; profile.verified = true; }
      const googlePhoto = cleanProfilePhoto(googlePayload.picture);
      if (googlePhoto && (!profile.profilePhotoUrl || String(profile.profilePhotoUrl).startsWith('data:image/svg+xml'))) profile.profilePhotoUrl = googlePhoto;
      clearAuthFailure(store, email);
      const { token, session } = issueSession(store, user);
      return res.json({
        token,
        session: { role: session.role, expiresAt: session.expiresAt },
        profile: publicProfile(profile, profile.id, store),
        isNewAccount: false,
        message: `Bienvenue, ${profile.pseudo || 'membre'} !`,
      });
    }

    if (mode !== 'register') {
      return res.status(404).json({ error: 'google_account_not_found', message: 'Aucun compte Voluptia n’utilise encore cet email Google. Passez par Inscription pour créer le compte.' });
    }

    const rawProfile = req.body?.profile && typeof req.body.profile === 'object' ? req.body.profile : req.body;
    const pseudo = limitText(rawProfile?.pseudo || googleDisplayName(googlePayload), MAX_TEXT.pseudo);
    const type = limitText(rawProfile?.type, 60);
    const city = limitText(rawProfile?.city, MAX_TEXT.city);
    const profilePhotoUrl = cleanProfilePhoto(rawProfile?.profilePhotoUrl || rawProfile?.photoUrl || googlePayload.picture);
    const age = Number(rawProfile?.age || 0);
    const bio = limitText(rawProfile?.bio, MAX_TEXT.bio);
    const lookingFor = toList(rawProfile?.lookingFor);
    const acceptAdult = Boolean(rawProfile?.acceptAdult);
    const acceptLegal = Boolean(rawProfile?.acceptLegal);
    const acceptCharter = Boolean(rawProfile?.acceptCharter || rawProfile?.acceptLegal);
    const acceptSensitiveData = Boolean(rawProfile?.acceptSensitiveData || rawProfile?.acceptSensitive);
    const ageVerificationToken = String(rawProfile?.ageVerificationToken || '').trim();

    if (!acceptAdult || !acceptLegal || !acceptCharter || !acceptSensitiveData) {
      return res.status(400).json({ error: 'charter_required', message: 'La majorité, les documents légaux, la charte et le traitement explicite des données sensibles nécessaires au service doivent être confirmés.' });
    }
    if (age < VALIDATION.minAge || age > VALIDATION.maxAge) {
      return res.status(400).json({ error: 'adult_only', message: 'L’inscription est réservée aux personnes majeures avec un âge réaliste.' });
    }
    let ageVerification = null;
    if (requiresServerAgeVerification()) {
      ageVerification = getAgeVerification(store, ageVerificationToken);
      if (!isAgeVerificationValid(ageVerification)) {
        return res.status(428).json({ error: 'age_verification_required', message: 'Vérification d’âge requise avant création du compte.' });
      }
    }
    if (!pseudo || !type || !city) {
      return res.status(400).json({ error: 'missing_fields', message: 'Merci de compléter pseudo, type de profil et ville avant de continuer avec Google.' });
    }
    if ((store.authUsers || []).some((item) => normalizeEmail(item.email) === email || item.googleSub === googleSub)) {
      return res.status(409).json({ error: 'email_exists', message: 'Un compte existe déjà avec cet email Google. Utilisez le bouton de connexion Google.' });
    }

    const profileDetails = makeDetails(rawProfile?.details || {});
    let profileMembers;
    try {
      profileMembers = sanitizeProfileMembers(rawProfile?.members, type, age, profileDetails, { throwOnInvalid: true });
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.code || 'members_invalid', message: error.message || 'Informations des personnes invalides.' });
    }

    const cityLocation = await geocodeCity(store, city);
    const resolvedCity = cityLocation?.city || city;
    const id = makeId('profile');
    const role = isOwnerAdminEmail(email) ? 'admin' : 'member';
    const profile = {
      id,
      pseudo,
      type,
      age,
      city: resolvedCity,
      distanceKm: 0,
      region: cityLocation?.region || '',
      location: cityLocation ? { lat: cityLocation.lat, lng: cityLocation.lng, region: cityLocation.region || '', precision: GEOCODER_PRECISION, source: cityLocation.source || 'city' } : null,
      verified: role === 'admin',
      role: role === 'admin' ? 'admin' : undefined,
      online: true,
      avatarTone: pickAvatarTone(type),
      profilePhotoUrl: profilePhotoUrl || defaultProfilePhoto(pseudo || 'VG'),
      category: PROFILE_CATEGORIES.includes(type) ? type : type,
      genderCategory: PROFILE_CATEGORIES.includes(type) ? type : type,
      orientation: String(rawProfile?.orientation || type).trim(),
      details: profileDetails,
      members: profileMembers,
      meetingTypes: sanitizeOptionList(rawProfile?.meetingTypes, DETAIL_OPTIONS.meetingTypes),
      fetishes: sanitizeOptionList(rawProfile?.fetishes, DETAIL_OPTIONS.fetishes),
      headline: 'Nouveau profil du cercle privé.',
      bio: bio || 'Profil en cours de personnalisation.',
      interests: ['Discrétion', 'Respect', 'Dialogue'],
      lookingFor: lookingFor.length ? lookingFor : ['Profils respectueux'],
      limits: ['Consentement clair', 'Pas d’insistance'],
      publicPhotos: ['Photo publique à ajouter', 'Ambiance', 'Détail discret'],
      privateAlbum: {
        count: 0,
        label: 'Album privé',
        description: 'Galerie privée à compléter et à ouvrir uniquement aux profils choisis.',
      },
      privacy: {
        approximateLocation: true,
        blurredByDefault: true,
        screenshotsWarning: true,
      },
      lastSeen: 'En ligne',
      createdAt: nowIso(),
      authProvider: 'google',
    };

    ensureAlbums(profile);
    profile.memberCount = profile.members.length;
    profile.ageDisplay = memberAgeSummary(profile);
    store.profiles.push(profile);

    user = {
      id: makeId('auth'),
      profileId: id,
      email,
      passwordHash: '',
      role,
      emailVerified: true,
      authProvider: 'google',
      googleSub,
      googleEmail: email,
      createdAt: nowIso(),
      lastGoogleLoginAt: nowIso(),
    };
    store.authUsers.push(user);

    if (ageVerification) {
      ageVerification.profileId = id;
      ageVerification.consumedAt = nowIso();
    }
    store.legalAcceptances.push({
      id: makeId('legal'),
      profileId: id,
      version: LEGAL_VERSION,
      acceptedAt: nowIso(),
      acceptedAdult: acceptAdult,
      acceptedLegal: acceptLegal,
      acceptedCharter: acceptCharter,
      acceptedSensitiveData,
      ipHint: req.ip,
      userAgent: req.get('user-agent') || '',
      authProvider: 'google',
    });

    const { token, session } = issueSession(store, user);
    res.status(201).json({
      token,
      session: { role: session.role, expiresAt: session.expiresAt },
      profile: publicProfile(profile, profile.id, store),
      isNewAccount: true,
      message: `Bienvenue dans Voluptia, ${profile.pseudo} ! Votre compte Google est connecté.`,
    });
  });

  // Confirmer une adresse email via le jeton reçu par email.
  app.post('/api/auth/verify-email', (req, res) => {
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token_required', message: 'Jeton manquant.' });
    const hash = hashEmailToken(token);
    const record = (store.emailTokens || []).find((t) => t.hash === hash);
    if (!record) return res.status(404).json({ error: 'token_invalid', message: 'Lien invalide ou déjà utilisé.' });
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      store.emailTokens = store.emailTokens.filter((t) => t.id !== record.id);
      return res.status(410).json({ error: 'token_expired', message: 'Lien expiré. Demandez un nouvel email de confirmation.' });
    }
    const user = (store.authUsers || []).find((u) => u.id === record.userId);
    if (user) {
      user.emailVerified = true;
      // Sécurité : l'email propriétaire ne devient admin qu'une fois l'email confirmé.
      if (isOwnerAdminEmail(user.email) && user.role !== 'admin') {
        user.role = 'admin';
        const profile = getProfile(store, user.profileId);
        if (profile) { profile.role = 'admin'; profile.verified = true; }
      }
    }
    store.emailTokens = store.emailTokens.filter((t) => t.id !== record.id);
    res.json({ message: 'Adresse email confirmée. Merci !' });
  });

  // Renvoyer un email de confirmation (utilisateur connecté).
  app.post('/api/auth/resend-verification', (req, res) => {
    const user = req.currentUser;
    if (!user) return res.status(401).json({ error: 'not_authenticated' });
    if (user.emailVerified) return res.json({ message: 'Votre email est déjà confirmé.' });
    store.emailTokens = (store.emailTokens || []).filter((t) => t.userId !== user.id);
    const { token, hash } = makeEmailToken();
    store.emailTokens.push({ id: makeId('emailtok'), userId: user.id, email: user.email, hash, createdAt: nowIso(), expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() });
    sendVerificationEmail(user.email, token).catch((err) => console.error('Renvoi vérification:', err.message));
    res.json({ message: 'Un nouvel email de confirmation a été envoyé.' });
  });

  // Demande de réinitialisation de mot de passe. Réponse volontairement neutre
  // (ne révèle pas si l'email existe) pour éviter l'énumération de comptes.
  app.post('/api/auth/forgot-password', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const neutral = { message: 'Si un compte existe avec cet email, un lien de réinitialisation vient d’être envoyé.' };
    if (!email) return res.json(neutral);
    const user = (store.authUsers || []).find((u) => normalizeEmail(u.email) === email);
    if (user) {
      store.passwordResets = (store.passwordResets || []).filter((r) => r.userId !== user.id);
      const { token, hash } = makeEmailToken();
      store.passwordResets.push({ id: makeId('pwreset'), userId: user.id, hash, createdAt: nowIso(), expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() });
      sendPasswordResetEmail(user.email, token).catch((err) => console.error('Envoi reset:', err.message));
    }
    res.json(neutral);
  });

  // Définir un nouveau mot de passe à partir du jeton de réinitialisation.
  app.post('/api/auth/reset-password', (req, res) => {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');
    if (!token || !password) return res.status(400).json({ error: 'missing_fields', message: 'Jeton et mot de passe requis.' });
    if (password.length < VALIDATION.minPasswordLength) return res.status(400).json({ error: 'weak_password', message: `Le mot de passe doit faire au moins ${VALIDATION.minPasswordLength} caractères.` });
    const hash = hashEmailToken(token);
    const record = (store.passwordResets || []).find((r) => r.hash === hash);
    if (!record) return res.status(404).json({ error: 'token_invalid', message: 'Lien invalide ou déjà utilisé.' });
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      store.passwordResets = store.passwordResets.filter((r) => r.id !== record.id);
      return res.status(410).json({ error: 'token_expired', message: 'Lien expiré. Refaites une demande.' });
    }
    const user = (store.authUsers || []).find((u) => u.id === record.userId);
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    user.passwordHash = hashPassword(password);
    delete user.password;
    store.passwordResets = store.passwordResets.filter((r) => r.id !== record.id);
    // Par sécurité, on invalide les sessions existantes de ce compte.
    store.sessions = (store.sessions || []).filter((s) => s.userId !== user.id);
    res.json({ message: 'Mot de passe modifié avec succès. Vous pouvez maintenant vous connecter.' });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (isAuthLocked(store, email)) {
      return res.status(429).json({ error: 'account_temporarily_locked', message: 'Trop de tentatives sur ce compte. Réessaie dans 15 minutes.' });
    }
    const user = store.authUsers.find((item) => item.email === email && verifyPassword(password, item.passwordHash || item.password));
    if (!user) {
      recordAuthFailure(store, email);
      return res.status(401).json({ error: 'invalid_credentials', message: 'Email ou mot de passe incorrect.' });
    }
    clearAuthFailure(store, email);
    const profile = getProfile(store, user.profileId);
    if (!profile) return res.status(404).json({ error: 'profile_not_found', message: 'Profil introuvable.' });
    if (user.role !== 'admin' && profile.suspendedUntil && new Date(profile.suspendedUntil).getTime() > Date.now()) {
      return res.status(403).json({ error: 'account_suspended', message: `Compte suspendu jusqu'au ${new Date(profile.suspendedUntil).toLocaleString('fr-FR')}.${profile.suspendedReason ? ' Motif : ' + profile.suspendedReason : ''}`, suspendedUntil: profile.suspendedUntil });
    }
    // Deuxième facteur (TOTP) : on ne délivre pas la session tant que le code n'est pas validé.
    if (userHasTwoFactor(user)) {
      const challengeToken = createTwoFactorChallenge(user.id);
      return res.json({ twoFactorRequired: true, challengeToken, message: 'Code de vérification à deux facteurs requis.' });
    }
    profile.online = true;
    profile.lastSeen = 'En ligne';
    const { token, session } = issueSession(store, user);
    res.json({ token, session: { role: session.role, expiresAt: session.expiresAt }, profile: publicProfile(profile, profile.id, store), message: `Bienvenue, ${profile.pseudo || 'membre'} !` });
  });

  app.post('/api/auth/2fa/verify', (req, res) => {
    const challengeToken = String(req.body?.challengeToken || '');
    const code = String(req.body?.code || '');
    const challenge = peekTwoFactorChallenge(challengeToken);
    if (!challenge) return res.status(401).json({ error: 'challenge_invalid', message: 'Session de vérification expirée. Reconnecte-toi.' });
    const user = store.authUsers.find((item) => item.id === challenge.userId);
    if (!user || !userHasTwoFactor(user)) {
      clearTwoFactorChallenge(challengeToken);
      return res.status(401).json({ error: 'challenge_invalid', message: 'Vérification impossible.' });
    }
    const okTotp = verifyTotp(user.twoFactorSecret, code);
    const okBackup = !okTotp && consumeBackupCode(user, code);
    if (!okTotp && !okBackup) {
      return res.status(401).json({ error: 'invalid_2fa_code', message: 'Code de vérification incorrect.' });
    }
    clearTwoFactorChallenge(challengeToken);
    const profile = getProfile(store, user.profileId);
    if (!profile) return res.status(404).json({ error: 'profile_not_found', message: 'Profil introuvable.' });
    profile.online = true;
    profile.lastSeen = 'En ligne';
    const { token, session } = issueSession(store, user);
    try { persistence.persist(store); } catch {}
    res.json({ token, session: { role: session.role, expiresAt: session.expiresAt }, profile: publicProfile(profile, profile.id, store), usedBackupCode: okBackup, message: `Bienvenue, ${profile.pseudo || 'membre'} !` });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = getBearerToken(req);
    if (token) {
      store.sessions = (store.sessions || []).filter((session) => session.tokenHash !== hashToken(token));
    }
    res.json({ ok: true, message: 'Session fermée.' });
  });

  app.get('/api/auth/demo', (req, res) => {
    if (isProduction()) {
      return res.json({
        adminConfigured: hasSafeConfiguredAdmin(),
        adminBootstrap: shouldUseBootstrapAdmin(),
        demoEmail: null,
        note: 'Mode production : aucun identifiant admin ou démo n’est exposé publiquement.',
      });
    }
    res.json({
      adminEmail: adminEmailFromEnv(),
      adminConfigured: hasSafeConfiguredAdmin(),
      adminBootstrap: shouldUseBootstrapAdmin(),
      demoEmail: null,
      note: shouldUseBootstrapAdmin()
        ? 'Compte admin bootstrap actif. Récupérez le mot de passe initial dans les logs Render puis configurez ADMIN_EMAIL et ADMIN_INITIAL_PASSWORD.'
        : 'Les comptes membres fictifs ont été supprimés : connectez-vous avec votre compte ou créez-en un.',
    });
  });

  // Liste des commerces/lieux pour la carte (tous les membres connectés).
  app.get('/api/venues', (req, res) => {
    const typeFilter = normalizeVenueType(req.query?.type);
    let venues = (store.venues || []).map(serializeVenue).filter((v) => v.located);
    if (typeFilter) venues = venues.filter((v) => v.type === typeFilter);
    res.json({ venues, types: VENUE_TYPES });
  });

  app.get('/api/bootstrap', (req, res) => {
    const viewerId = req.currentProfile.id;
    const index = buildSocialIndex(store);
    const profileLimit = parsePositiveInt(req.query?.profileLimit || process.env.BOOTSTRAP_PROFILE_LIMIT, BOOTSTRAP_DEFAULT_PROFILE_LIMIT, PROFILES_MAX_LIMIT);
    const visibleProfiles = store.profiles
      .filter((profile) => profile.id !== viewerId && !profile.hidden && !indexedProfileBlocked(index, viewerId, profile.id));
    const profiles = visibleProfiles
      .slice(0, profileLimit)
      .map((profile) => publicProfile(profile, viewerId, store, { index }));
    const profileMap = visibleProfiles
      .map((profile) => publicProfile(profile, viewerId, store, { shallow: true, index }))
      .filter(Boolean);
    const incomingRequests = store.albumAccess
      .filter((access) => access.ownerId === viewerId && access.status === 'requested' && !isProfileBlocked(store, viewerId, access.viewerId))
      .map((access) => ({ ...access, album: findAlbum(store, access.albumId).album, viewer: publicProfile(getProfile(store, access.viewerId), viewerId, store, { index }) }))
      .filter((item) => item.album && item.viewer);
    const grantedByMe = store.albumAccess
      .filter((access) => access.ownerId === viewerId && isAccessActive(access) && !isProfileBlocked(store, viewerId, access.viewerId))
      .map((access) => ({ ...access, album: findAlbum(store, access.albumId).album, viewer: publicProfile(getProfile(store, access.viewerId), viewerId, store, { index }) }))
      .filter((item) => item.album && item.viewer);
    if (pruneExpiredInstantMessages(store)) { try { persistence.persist(store); } catch {} }
    const conversations = store.conversations
      .filter((conversation) => conversation.participantIds.includes(viewerId))
      .filter((conversation) => conversation.isGroup || !isProfileBlocked(store, viewerId, conversation.participantIds.find((id) => id !== viewerId)))
      .map((conversation) => serializeConversation(store, conversation, viewerId))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const instantChats = store.conversations
      .filter((conversation) => conversation.participantIds.includes(viewerId))
      .filter((conversation) => !conversation.isGroup && !isProfileBlocked(store, viewerId, conversation.participantIds.find((id) => id !== viewerId)))
      .map((conversation) => serializeInstantChat(store, conversation, viewerId))
      .filter((conversation) => conversation.messageCount > 0)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const notifications = store.notifications
      .filter((notification) => notification.profileId === viewerId && !isProfileBlocked(store, viewerId, notification.actorId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((notification) => serializeNotification(store, notification, viewerId));
    const visibleAlbums = store.profiles
      .filter((profile) => !profile.hidden && (profile.id === viewerId || !indexedProfileBlocked(index, viewerId, profile.id)))
      .flatMap((profile) => ensureAlbums(profile));
    const mediaItems = visibleAlbums.reduce((sum, album) => sum + (album.items || []).length, 0);
    const counters = socialCountersFor(store, viewerId, index);
    const subscription = serializeSubscription(store, viewerId);

    res.json({
      me: { ...publicProfile(req.currentProfile, viewerId, store, { index }), role: req.currentUser?.role || 'member' },
      profiles,
      profileMap,
      profilesPage: { limit: profileLimit, total: visibleProfiles.length, nextCursor: visibleProfiles.length > profileLimit ? String(profileLimit) : null },
      incomingRequests,
      grantedByMe,
      conversations,
      instantChats,
      blockedProfiles: blockedProfilesFor(store, viewerId).map((block) => ({ ...block, profile: publicProfile(getProfile(store, block.blockedId), viewerId, store, { shallow: true, index }) })).filter((block) => block.profile),
      notifications,
      unreadNotifications: notifications.filter((notification) => !notification.read).length,
      social: serializeSocialDetails(store, viewerId, index),
      events: store.events,
      stats: {
        membersOnline: store.profiles.filter((profile) => profile.online && !profile.hidden).length,
        verifiedProfiles: store.profiles.filter((profile) => profile.verified && !profile.hidden).length,
        albums: visibleAlbums.length,
        mediaItems,
        videos: visibleAlbums.flatMap((album) => album.items || []).filter((media) => media.type === 'video').length,
        followers: index.followersByProfile.get(viewerId) || 0,
        following: index.followingByProfile.get(viewerId) || 0,
        hearts: counters.incomingHeartCount,
        profileViews: counters.profileViewCount,
        privateAlbums: visibleAlbums.filter((album) => album.visibility === 'private').reduce((sum, album) => sum + (album.items || []).length, 0),
      },
      subscription,
      subscriptionLocked: req.currentUser?.role !== 'admin' && !subscription.active,
      freeTier: freeTierStatus(store, viewerId, { subscriptionActive: subscription.active, isAdmin: req.currentUser?.role === 'admin' }),
      subscriptionPlans: SUBSCRIPTION_PLANS,
      videoFeed: visibleVideoFeed(store, viewerId).slice(0, 30),
      feedPosts: feedPostsForViewer(store, viewerId, 80),
      legalChecklist: store.legalChecklist,
      legalDocuments: LEGAL_DOCUMENTS,
      legalVersion: LEGAL_VERSION,
      database: { type: persistence.type, path: persistence.path, warning: persistence.warning || null },
      navigation: ['Accueil', 'Carte', 'Recherche', 'Fil d’actualité', 'Suivis', 'Lieux', 'Albums', 'Toktak', 'Messages', 'Notifications', 'Mon profil', 'Abonnement', 'Confidentialité'],
      session: { role: req.currentUser?.role || 'member', expiresAt: req.currentSession?.expiresAt },
      profileOptions: { categories: PROFILE_CATEGORIES, details: DETAIL_OPTIONS },
    });
  });

  app.get('/api/profiles', (req, res) => {
    const viewerId = req.currentProfile.id;
    const {
      type,
      category,
      verified,
      online,
      city,
      q,
      hairColor,
      eyeColor,
      origin,
      minAge,
      maxAge,
      minHeight,
      maxHeight,
      minWeight,
      maxWeight,
      maxKm,
      orientation,
      bodyType,
    } = req.query;
    const selectedCategory = category || type;
    const index = buildSocialIndex(store);
    const limit = parsePositiveInt(req.query?.limit, PROFILES_DEFAULT_LIMIT, PROFILES_MAX_LIMIT);
    const cursor = Math.max(0, Number.parseInt(String(req.query?.cursor || '0'), 10) || 0);
    // PERF: une seule passe au lieu de 17 .filter() chaines (17 iterations + 16 tableaux
    // intermediaires). Le && court-circuite, et les criteres couteux (distance) sont
    // evalues en dernier. Les valeurs de recherche sont normalisees une seule fois.
    const nCategory = selectedCategory ? normalizeForSearch(selectedCategory) : null;
    const nCity = city ? normalizeForSearch(city) : null;
    const nHair = hairColor ? normalizeForSearch(hairColor) : null;
    const nEye = eyeColor ? normalizeForSearch(eyeColor) : null;
    const nOrigin = origin ? normalizeForSearch(origin) : null;
    const nOrientation = orientation ? normalizeForSearch(orientation) : null;
    const nBodyType = bodyType ? normalizeForSearch(bodyType) : null;
    const minAgeNum = minAge ? Number(minAge) : null;
    const maxAgeNum = maxAge ? Number(maxAge) : null;
    const matchesOrientation = (profile) => {
      const vals = [
        profile.details?.sexualOrientation,
        profile.orientation,
        ...(Array.isArray(profile.members) ? profile.members.map((m) => m?.sexualOrientation || m?.orientation) : []),
      ].filter(Boolean);
      return vals.some((v) => normalizeForSearch(v) === nOrientation);
    };
    // PERF: on resout le profil du viewer UNE seule fois (au lieu d'un getProfile()
    // lineaire repete pour chaque profil quand le filtre distance est actif -> O(N2)).
    const viewerForDistance = maxKm ? getProfile(store, viewerId) : null;
    const matchedProfiles = store.profiles.filter((profile) => {
      if (profile.id === viewerId || profile.hidden || indexedProfileBlocked(index, viewerId, profile.id)) return false;
      if (nCategory && normalizeForSearch(profile.category || profile.type) !== nCategory) return false;
      if (verified === 'true' && !profile.verified) return false;
      if (online === 'true' && !profile.online) return false;
      if (nCity && !normalizeForSearch(profile.city).includes(nCity)) return false;
      if (!profileMatchesSearch(profile, q)) return false;
      if (nHair && normalizeForSearch(profile.details?.hairColor) !== nHair) return false;
      if (nEye && normalizeForSearch(profile.details?.eyeColor) !== nEye) return false;
      if (nOrigin && normalizeForSearch(profile.details?.origin) !== nOrigin) return false;
      if (minAgeNum && !profileAgeValues(profile).some((age) => age >= minAgeNum)) return false;
      if (maxAgeNum && !profileAgeValues(profile).some((age) => age <= maxAgeNum)) return false;
      if (minHeight && Number(profile.details?.heightCm || 0) < Number(minHeight)) return false;
      if (maxHeight && Number(profile.details?.heightCm || 999) > Number(maxHeight)) return false;
      if (minWeight && Number(profile.details?.weightKg || 0) < Number(minWeight)) return false;
      if (maxWeight && Number(profile.details?.weightKg || 999) > Number(maxWeight)) return false;
      if (nOrientation && !matchesOrientation(profile)) return false;
      if (nBodyType && normalizeForSearch(profile.details?.bodyType) !== nBodyType) return false;
      if (maxKm) {
        const dist = (!viewerForDistance || viewerForDistance.id === profile.id)
          ? 0
          : haversineKm(ensureLocation(viewerForDistance, store), ensureLocation(profile, store));
        // dist === null/undefined => localisation inconnue => hors perimetre (comportement
        // d'origine conserve). dist === 0 => meme localisation => DANS le perimetre :
        // corrige le bug "0 || 999999" qui faisait disparaitre les profils de la meme ville.
        const effectiveKm = (dist == null) ? Infinity : dist;
        if (effectiveKm > Number(maxKm)) return false;
      }
      return true;
    });
    const profiles = matchedProfiles
      .slice(cursor, cursor + limit)
      .map((profile) => publicProfile(profile, viewerId, store, { index }));
    res.json({ profiles, page: { limit, cursor, total: matchedProfiles.length, nextCursor: cursor + limit < matchedProfiles.length ? String(cursor + limit) : null }, filters: { categories: PROFILE_CATEGORIES, details: DETAIL_OPTIONS } });
  });

  app.get('/api/profiles/me', (req, res) => {
    res.json({ profile: publicProfile(req.currentProfile, req.currentProfile.id, store) });
  });

  app.put('/api/profiles/me', async (req, res) => {
    const profile = req.currentProfile;
    const patch = req.body || {};
    const allowedText = ['pseudo', 'headline', 'bio'];
    const cityChanged = patch.city !== undefined;

    for (const key of allowedText) {
      if (patch[key] !== undefined) profile[key] = String(patch[key]).trim();
    }
    if (cityChanged) profile.city = cleanCityName(patch.city);
    if (patch.pseudo !== undefined && !profile.pseudo) {
      return res.status(400).json({ error: 'pseudo_required', message: 'Le pseudo est obligatoire.' });
    }
    if (patch.profilePhotoUrl !== undefined || patch.photoUrl !== undefined) {
      const rawPhoto = patch.profilePhotoUrl !== undefined ? patch.profilePhotoUrl : patch.photoUrl;
      const photo = cleanProfilePhoto(rawPhoto);
      profile.profilePhotoUrl = photo || defaultProfilePhoto(profile.pseudo || 'AS');
    }
    if (patch.age !== undefined) {
      const age = Number(patch.age);
      if (Number.isFinite(age) && age >= VALIDATION.minAge && age <= VALIDATION.maxAge) profile.age = age;
    }
    if (patch.freeTonight !== undefined) {
      profile.freeTonight = Boolean(patch.freeTonight);
      profile.freeTonightUpdatedAt = nowIso();
      const details = profile.details || makeDetails();
      const availability = toList(details.availability || []);
      const withoutTonight = availability.filter((item) => normalizeForSearch(item) !== normalizeForSearch('Libre ce soir'));
      details.availability = profile.freeTonight ? ['Libre ce soir', ...withoutTonight] : withoutTonight;
      profile.details = details;
    }
    if (patch.type !== undefined || patch.category !== undefined) {
      const nextCategory = String(patch.category || patch.type).trim();
      profile.type = nextCategory;
      profile.category = nextCategory;
      profile.genderCategory = nextCategory;
      profile.orientation = String(patch.orientation || nextCategory).trim();
      profile.avatarTone = pickAvatarTone(profile.type);
    }
    if (patch.orientation !== undefined) profile.orientation = String(patch.orientation).trim();
    if (cityChanged) {
      const cityLocation = await geocodeCity(store, profile.city);
      if (cityLocation) {
        profile.city = cityLocation.city || profile.city;
        profile.location = { lat: cityLocation.lat, lng: cityLocation.lng, precision: GEOCODER_PRECISION, source: cityLocation.source || 'city' };
      }
    } else if (patch.location !== undefined && envFlag('ALLOW_MANUAL_PROFILE_LOCATION', false)) {
      const lat = Number(patch.location?.lat);
      const lng = Number(patch.location?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        profile.location = { lat, lng, precision: 'approximate_user' };
      }
    }
    if (patch.details !== undefined) updateProfileDetails(profile, patch.details);
    if (patch.members !== undefined || patch.category !== undefined || patch.type !== undefined) {
      try {
        profile.members = sanitizeProfileMembers(patch.members, profile.category || profile.type, profile.age || 28, profile.details || {}, { throwOnInvalid: true });
        profile.memberCount = profile.members.length;
        profile.ageDisplay = memberAgeSummary(profile);
      } catch (error) {
        return res.status(error.statusCode || 400).json({ error: error.code || 'members_invalid', message: error.message || 'Informations des personnes invalides.' });
      }
    }
    if (patch.interests !== undefined) profile.interests = toList(patch.interests);
    if (patch.lookingFor !== undefined) profile.lookingFor = toList(patch.lookingFor);
    if (patch.limits !== undefined) profile.limits = toList(patch.limits);
    if (patch.meetingTypes !== undefined) profile.meetingTypes = sanitizeOptionList(patch.meetingTypes, DETAIL_OPTIONS.meetingTypes);
    if (patch.fetishes !== undefined) profile.fetishes = sanitizeOptionList(patch.fetishes, DETAIL_OPTIONS.fetishes);
    if (patch.publicPhotos !== undefined) {
      profile.publicPhotos = toList(patch.publicPhotos);
      const publicAlbum = ensureAlbums(profile).find((album) => album.visibility === 'public');
      if (publicAlbum) {
        publicAlbum.items = profile.publicPhotos.map((title, index) => makeMedia(publicAlbum, index, { type: index % 4 === 3 ? 'video' : 'photo', title, caption: 'Média public de présentation.' }));
        publicAlbum.updatedAt = nowIso();
      }
    }
    if (patch.socialPreferences !== undefined) {
      profile.socialPreferences = {
        ...socialPreferencesFor(profile),
        heartAllowedGenders: normalizeGenderPreferenceList(patch.socialPreferences?.heartAllowedGenders),
        showProfileViews: patch.socialPreferences?.showProfileViews !== false,
        instantChatEnabled: patch.socialPreferences?.instantChatEnabled !== false,
      };
    }
    if (patch.notificationPreferences !== undefined) {
      profile.notificationPreferences = {
        ...notificationPreferencesFor(profile),
        ...Object.fromEntries(NOTIFICATION_PREFERENCE_ITEMS.map((item) => [item.key, patch.notificationPreferences?.[item.key] !== false])),
      };
    }
    if (patch.privateAlbum !== undefined) {
      const privateCount = Math.max(0, Number(patch.privateAlbum?.count ?? profile.privateAlbum.count) || 0);
      profile.privateAlbum = {
        ...profile.privateAlbum,
        label: String(patch.privateAlbum?.label || profile.privateAlbum.label).trim(),
        description: String(patch.privateAlbum?.description || profile.privateAlbum.description).trim(),
        count: privateCount,
      };
      const privateAlbum = ensureAlbums(profile).find((album) => album.visibility === 'private');
      if (privateAlbum) {
        privateAlbum.title = profile.privateAlbum.label;
        privateAlbum.description = profile.privateAlbum.description;
        privateAlbum.items = Array.from({ length: privateCount }, (_, index) => makeMedia(privateAlbum, index, { type: index % 5 === 4 ? 'video' : 'photo', title: `${index % 5 === 4 ? 'Vidéo privée' : 'Photo privée'} ${index + 1}`, caption: 'Média privé visible uniquement après accord.' }));
        privateAlbum.updatedAt = nowIso();
      }
    }
    ensureAlbums(profile);
    res.json({ profile: publicProfile(profile, profile.id, store), message: 'Profil mis à jour avec succès.' });
  });



app.post('/api/profile-verification/request', (req, res) => {
  const profile = req.currentProfile;
  const proofImageUrl = cleanProfilePhoto(req.body?.proofImageUrl || req.body?.photoUrl || req.body?.imageUrl);
  const note = limitText(req.body?.note || '', 500);
  if (!proofImageUrl) {
    return res.status(400).json({ error: 'proof_required', message: 'Ajoutez une photo de vérification avant d’envoyer votre demande.' });
  }
  const request = {
    id: makeId('verifyreq'),
    profileId: profile.id,
    status: 'pending',
    submittedAt: nowIso(),
    reviewedAt: null,
    reviewedBy: null,
    adminNote: '',
    reason: '',
    note,
    proofImageUrl,
    categorySnapshot: profile.category || profile.type || 'Profil',
    pseudoSnapshot: profile.pseudo || 'Profil',
  };
  store.verificationRequests = (store.verificationRequests || []).filter((item) => !(item.profileId === profile.id && item.status === 'pending'));
  store.verificationRequests.push(request);
  profile.verificationRequestedAt = request.submittedAt;
  createNotification(store, profile.id, 'profile_verification', null, 'Demande de vérification envoyée', 'Votre photo de vérification a bien été envoyée à l’administration. Vous serez notifié après validation ou refus.', { requestId: request.id, status: 'pending' });
  notifyAdmins(store, 'Vérification profil à valider', `${profile.pseudo} a envoyé une photo pour faire vérifier son profil.`, { requestId: request.id, profileId: profile.id });
  persistence.persist(store);
  res.status(201).json({ request: serializeVerificationRequestForOwner(request), message: 'Demande envoyée à l’administration.' });
});

  // RGPD art. 17 — Droit à l'effacement : suppression du compte par l'utilisateur lui-même.
  app.delete('/api/profiles/me', (req, res) => {
    const profileId = req.currentProfile.id;
    const userId = req.currentUser.id;

    // Refuser si l'utilisateur est admin (protection contre suppression accidentelle)
    if (req.currentUser.role === 'admin') {
      return res.status(403).json({ error: 'admin_cannot_self_delete', message: 'Un compte administrateur ne peut pas être supprimé par cette route. Contactez un autre administrateur.' });
    }

    // 1. Révoquer toutes les sessions actives
    store.sessions = (store.sessions || []).filter((s) => s.userId !== userId);

    // 2. Marquer tous les médias d'albums pour la rétention (6 mois puis purge manuelle)
    for (const profile of store.profiles || []) {
      for (const album of profile.albums || []) {
        const toRemove = (album.items || []).filter((m) => m.ownerId === profileId);
        for (const media of toRemove) {
          trackRemovedMediaForRetention(store, media, { ownerId: profileId, albumId: album.id, reason: 'account_deletion' });
        }
        album.items = (album.items || []).filter((m) => m.ownerId !== profileId);
      }
    }

    // 3. Anonymiser les messages envoyés dans les conversations (garder le fil, effacer l'auteur)
    for (const conv of store.conversations || []) {
      for (const msg of conv.messages || []) {
        if (msg.fromId === profileId) {
          msg.fromId = '[supprimé]';
          msg.body = '[Message d\'un compte supprimé]';
          msg.deletedByOwner = true;
        }
      }
    }

    // 4. Supprimer les données sociales liées au profil
    store.profileLikes = (store.profileLikes || []).filter((l) => l.fromId !== profileId && l.toId !== profileId);
    store.profilePasses = (store.profilePasses || []).filter((p) => p.fromId !== profileId && p.toId !== profileId);
    store.profileViews = (store.profileViews || []).filter((v) => v.viewerId !== profileId && v.profileId !== profileId);
    store.followers = (store.followers || []).filter((f) => f.followerId !== profileId && f.followingId !== profileId);
    store.blockedProfiles = (store.blockedProfiles || []).filter((b) => b.blockerId !== profileId && b.blockedId !== profileId);
    store.albumAccess = (store.albumAccess || []).filter((a) => a.viewerId !== profileId && a.ownerId !== profileId);
    store.notifications = (store.notifications || []).filter((n) => n.profileId !== profileId);

    // 5. Supprimer le profil et le compte auth
    store.profiles = (store.profiles || []).filter((p) => p.id !== profileId);
    store.authUsers = (store.authUsers || []).filter((u) => u.id !== userId);

    // 6. Conserver legalAcceptances et subscriptions à des fins de preuve légale (obligations comptables)
    // Elles sont anonymisées : le profileId reste pour traçabilité mais le compte n'existe plus.

    try { persistence.persist(store); } catch (e) { console.error('Persistence error on account deletion:', e); }

    res.json({
      ok: true,
      message: 'Votre compte a été supprimé. Vos données personnelles ont été effacées. Les médias supprimés seront définitivement purgés dans un délai maximum de 6 mois conformément à notre politique de conservation.',
    });
  });

  app.get('/api/profiles/:id', (req, res) => {
    const profile = getProfile(store, req.params.id);
    if (!isPubliclyReachableProfile(profile, req.currentUser)) return res.status(404).json({ error: 'profile_not_found' });
    if (profile.id !== req.currentProfile.id && isProfileBlocked(store, req.currentProfile.id, profile.id)) return res.status(403).json({ error: 'profile_blocked', message: 'Ce profil est bloqué ou vous a bloqué.' });
    const isAdminViewer = req.currentUser?.role === 'admin';
    const viewerSubscription = serializeSubscription(store, req.currentProfile.id);
    // Mode d'essai : un non-abonné peut ouvrir un nombre limité de profils par fenêtre.
    // Une fois la limite atteinte, plus aucune consultation n'est possible — même les profils
    // déjà vus ne peuvent plus être reconsultés (tant que la fenêtre de 48 h ne libère pas un créneau).
    if (!isAdminViewer && !viewerSubscription.active && profile.id !== req.currentProfile.id) {
      const status = freeTierStatus(store, req.currentProfile.id, { subscriptionActive: false, isAdmin: false });
      const alreadySeen = (store.profileViews || []).some((v) => v.viewerId === req.currentProfile.id && v.profileId === profile.id);
      // Bloqué si le quota est atteint (que le profil soit nouveau OU déjà vu).
      if (status.profileViewsRemaining <= 0) {
        return res.status(402).json({
          error: 'free_quota_reached',
          message: `Version d'essai : ${status.limit} profils maximum par tranche de ${status.windowHours} h, sans reconsultation. Abonnez-vous pour un accès illimité.`,
          freeTier: status,
        });
      }
      void alreadySeen;
    }
    // En supervision admin, ne pas enregistrer de vue ni notifier le membre.
    const view = isAdminViewer ? null : recordProfileView(store, req.currentProfile.id, profile.id);
    if (view) { try { persistence.persist(store); } catch {} }
    res.json({ profile: publicProfile(profile, req.currentProfile.id, store), view, adminView: isAdminViewer });
  });

  app.get('/api/blocks', (req, res) => {
    const blocks = blockedProfilesFor(store, req.currentProfile.id)
      .map((block) => ({ ...block, profile: publicProfile(getProfile(store, block.blockedId), req.currentProfile.id, store, { shallow: true }) }))
      .filter((block) => block.profile);
    res.json({ blocks });
  });

  app.post('/api/profiles/:id/block', (req, res) => {
    const target = getProfile(store, req.params.id);
    if (!isPubliclyReachableProfile(target, req.currentUser) || target.id === req.currentProfile.id) return res.status(404).json({ error: 'profile_not_found' });
    store.blockedProfiles = Array.isArray(store.blockedProfiles) ? store.blockedProfiles : [];
    const allowedDurations = new Set([3600, 7200, 18000, 86400, 604800]);
    const rawDuration = req.body?.durationSeconds;
    const durationSeconds = rawDuration === null || rawDuration === undefined || rawDuration === '' ? null : Number(rawDuration);
    if (durationSeconds !== null && !allowedDurations.has(durationSeconds)) {
      return res.status(400).json({ error: 'invalid_block_duration', message: 'Durée de cadenas invalide.' });
    }
    let block = (store.blockedProfiles || []).find((item) => item.blockerId === req.currentProfile.id && item.blockedId === target.id);
    const expiresAt = durationSeconds ? new Date(Date.now() + durationSeconds * 1000).toISOString() : null;
    if (!block) {
      block = { id: makeId('block'), blockerId: req.currentProfile.id, blockedId: target.id, createdAt: nowIso(), expiresAt, durationSeconds };
      store.blockedProfiles.push(block);
    } else {
      block.expiresAt = expiresAt;
      block.durationSeconds = durationSeconds;
      block.updatedAt = nowIso();
    }
    cleanupBlockedRelationship(store, req.currentProfile.id, target.id);
    const suffix = expiresAt ? ` jusqu’au ${new Date(expiresAt).toLocaleString('fr-FR')}` : ' sans limite';
    res.status(201).json({ block, profile: publicProfile(target, req.currentProfile.id, store, { shallow: true }), message: `${target.pseudo} est bloqué${suffix}.` });
  });

  app.delete('/api/profiles/:id/block', (req, res) => {
    const target = getProfile(store, req.params.id);
    store.blockedProfiles = Array.isArray(store.blockedProfiles) ? store.blockedProfiles : [];
    const before = store.blockedProfiles.length;
    store.blockedProfiles = store.blockedProfiles.filter((block) => !(block.blockerId === req.currentProfile.id && block.blockedId === req.params.id));
    res.json({ removed: before !== store.blockedProfiles.length, profile: target ? publicProfile(target, req.currentProfile.id, store, { shallow: true }) : null, message: target ? `${target.pseudo} est débloqué.` : 'Profil débloqué.' });
  });

  app.post('/api/profiles/:id/album-access/open', (req, res) => {
    const viewer = getProfile(store, req.params.id);
    if (!isPubliclyReachableProfile(viewer, req.currentUser) || viewer.id === req.currentProfile.id) return res.status(404).json({ error: 'profile_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, viewer.id)) return res.status(403).json(blockedResponse('Ouverture impossible : profil bloqué.'));

    const requestedAlbumId = String(req.body?.albumId || '').trim();
    const album = requestedAlbumId
      ? findAlbum(store, requestedAlbumId).album
      : ensureAlbums(req.currentProfile).find((item) => item.visibility === 'private');
    if (!album || album.ownerId !== req.currentProfile.id) return res.status(404).json({ error: 'album_not_found', message: 'Votre album privé est introuvable.' });
    if (album.visibility !== 'private') return res.status(400).json({ error: 'album_is_public', message: 'Choisissez un album privé.' });

    const durationSeconds = parseAlbumAccessDurationSeconds(req.body?.durationSeconds, null);
    if (durationSeconds === undefined) {
      return res.status(400).json({ error: 'invalid_album_access_duration', message: 'Durée d’ouverture invalide.' });
    }
    const expiresAt = albumAccessExpiresAt(durationSeconds);
    const existing = getAlbumAccess(store, req.currentProfile.id, viewer.id, album.id);
    const access = upsertAlbumAccess(store, req.currentProfile.id, viewer.id, album.id, {
      status: 'granted',
      requestedAt: existing?.requestedAt || null,
      grantedAt: nowIso(),
      revokedAt: null,
      expiresAt,
      durationSeconds,
    });

    let conversation = getConversation(store, req.currentProfile.id, viewer.id);
    if (!conversation) {
      conversation = { id: makeId('conv'), participantIds: [req.currentProfile.id, viewer.id], updatedAt: nowIso(), messages: [] };
      store.conversations.push(conversation);
    }
    conversation.messages.push({
      id: makeId('msg'),
      fromId: req.currentProfile.id,
      body: `${req.currentProfile.pseudo} vous a ouvert son album privé « ${album.title} » pendant ${albumAccessDurationLabel(durationSeconds)}.`,
      createdAt: nowIso(),
      read: false,
      system: true,
    });
    conversation.updatedAt = nowIso();
    createNotification(store, viewer.id, 'album_granted', req.currentProfile.id, 'Album privé ouvert', `${req.currentProfile.pseudo} vous a ouvert « ${album.title} » pendant ${albumAccessDurationLabel(durationSeconds)}.`, { albumId: album.id });

    res.status(201).json({ access, album: serializeAlbum(store, album, viewer.id), viewer: publicProfile(viewer, req.currentProfile.id, store, { shallow: true }), message: `Album privé ouvert à ${viewer.pseudo} pendant ${albumAccessDurationLabel(durationSeconds)}.` });
  });

  app.post('/api/profiles/:id/album-access/request', (req, res) => {
    const owner = getProfile(store, req.params.id);
    if (!isPubliclyReachableProfile(owner, req.currentUser)) return res.status(404).json({ error: 'profile_not_found' });
    if (owner.id === req.currentProfile.id) return res.status(400).json({ error: 'cannot_request_own_album' });
    if (isProfileBlocked(store, req.currentProfile.id, owner.id)) return res.status(403).json(blockedResponse('Demande impossible : profil bloqué.'));

    const requestedAlbumId = String(req.body?.albumId || '').trim();
    const album = requestedAlbumId
      ? findAlbum(store, requestedAlbumId).album
      : ensureAlbums(owner).find((item) => item.visibility === 'private');
    if (!album || album.ownerId !== owner.id) return res.status(404).json({ error: 'album_not_found', message: 'Album privé introuvable.' });
    if (album.visibility !== 'private') return res.status(400).json({ error: 'album_is_public', message: 'Cet album est déjà public.' });

    const existing = getAlbumAccess(store, owner.id, req.currentProfile.id, album.id);
    if (existing?.status === 'granted') {
      return res.json({ access: existing, message: 'Accès déjà accordé.' });
    }

    const access = upsertAlbumAccess(store, owner.id, req.currentProfile.id, album.id, {
      status: 'requested',
      requestedAt: nowIso(),
      grantedAt: null,
      expiresAt: null,
    });

    let conversation = getConversation(store, owner.id, req.currentProfile.id);
    if (!conversation) {
      conversation = { id: makeId('conv'), participantIds: [owner.id, req.currentProfile.id], updatedAt: nowIso(), messages: [] };
      store.conversations.push(conversation);
    }
    conversation.messages.push({
      id: makeId('msg'),
      fromId: req.currentProfile.id,
      body: `Demande d’accès à l’album privé « ${album.title} » de ${owner.pseudo}.`,
      createdAt: nowIso(),
      read: false,
      system: true,
    });
    conversation.updatedAt = nowIso();
    createNotification(store, owner.id, 'album_request', req.currentProfile.id, 'Demande d’album privé', `${req.currentProfile.pseudo} demande l’accès à « ${album.title} ».`, { albumId: album.id });

    res.status(201).json({ access, album: serializeAlbum(store, album, req.currentProfile.id), message: 'Demande d’accès envoyée. La personne sera notifiée.' });
  });


  app.post('/api/profiles/:id/album-access/exchange', (req, res) => {
    const target = getProfile(store, req.params.id);
    if (!isPubliclyReachableProfile(target, req.currentUser) || target.id === req.currentProfile.id) return res.status(404).json({ error: 'profile_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, target.id)) return res.status(403).json(blockedResponse('Échange impossible : profil bloqué.'));

    const durationSeconds = parseAlbumAccessDurationSeconds(req.body?.durationSeconds, 24 * 60 * 60);
    if (durationSeconds === undefined) {
      return res.status(400).json({ error: 'invalid_album_access_duration', message: 'Durée d’échange invalide.' });
    }

    const myAlbum = ensureAlbums(req.currentProfile).find((item) => item.visibility === 'private');
    const targetAlbum = ensureAlbums(target).find((item) => item.visibility === 'private');
    if (!myAlbum) return res.status(404).json({ error: 'my_private_album_not_found', message: 'Créez d’abord un album privé sur votre profil.' });
    if (!targetAlbum) return res.status(404).json({ error: 'target_private_album_not_found', message: 'Ce profil n’a pas encore d’album privé.' });

    const expiresAt = albumAccessExpiresAt(durationSeconds);
    const existingMine = getAlbumAccess(store, req.currentProfile.id, target.id, myAlbum.id);
    const mineToTarget = upsertAlbumAccess(store, req.currentProfile.id, target.id, myAlbum.id, {
      status: 'granted',
      requestedAt: existingMine?.requestedAt || null,
      grantedAt: nowIso(),
      revokedAt: null,
      expiresAt,
      durationSeconds,
      exchange: true,
      exchangeRequestedAt: nowIso(),
    });

    const existingTarget = getAlbumAccess(store, target.id, req.currentProfile.id, targetAlbum.id);
    const targetToMine = isAccessActive(existingTarget)
      ? existingTarget
      : upsertAlbumAccess(store, target.id, req.currentProfile.id, targetAlbum.id, {
          status: 'requested',
          requestedAt: nowIso(),
          grantedAt: null,
          revokedAt: null,
          expiresAt: null,
          durationSeconds,
          exchangeRequested: true,
          exchangeRequesterId: req.currentProfile.id,
        });

    let conversation = getConversation(store, req.currentProfile.id, target.id);
    if (!conversation) {
      conversation = { id: makeId('conv'), participantIds: [req.currentProfile.id, target.id], updatedAt: nowIso(), messages: [] };
      store.conversations.push(conversation);
    }
    conversation.messages.push({
      id: makeId('msg'),
      fromId: req.currentProfile.id,
      body: `${req.currentProfile.pseudo} propose un échange d’albums privés : son album est ouvert pendant ${albumAccessDurationLabel(durationSeconds)} et attend votre accord pour l’échange inverse.`,
      createdAt: nowIso(),
      read: false,
      system: true,
      meta: { albumAccessExchange: true, ownerAlbumId: myAlbum.id, targetAlbumId: targetAlbum.id },
    });
    conversation.updatedAt = nowIso();

    createNotification(store, target.id, 'album_exchange_request', req.currentProfile.id, 'Échange d’albums privés', `${req.currentProfile.pseudo} vous a ouvert son album privé et demande un échange pendant ${albumAccessDurationLabel(durationSeconds)}.`, { albumId: targetAlbum.id, exchange: true });

    res.status(201).json({
      accessOpenedByMe: mineToTarget,
      accessRequestedToMe: targetToMine,
      target: publicProfile(target, req.currentProfile.id, store, { shallow: true }),
      message: isAccessActive(existingTarget)
        ? 'Échange déjà actif : vos albums privés sont ouverts l’un à l’autre.'
        : `Échange proposé : votre album est ouvert à ${target.pseudo} pendant ${albumAccessDurationLabel(durationSeconds)}.`,
    });
  });

  app.get('/api/album-access/requests', (req, res) => {
    const viewerId = req.currentProfile.id;
    const incoming = store.albumAccess
      .filter((access) => access.ownerId === viewerId)
      .map((access) => ({ ...access, album: findAlbum(store, access.albumId).album, viewer: publicProfile(getProfile(store, access.viewerId), viewerId, store) }));
    const outgoing = store.albumAccess
      .filter((access) => access.viewerId === viewerId)
      .map((access) => ({ ...access, album: findAlbum(store, access.albumId).album, owner: publicProfile(getProfile(store, access.ownerId), viewerId, store) }));
    res.json({ incoming, outgoing });
  });

  app.post('/api/album-access/:ownerId/:viewerId/respond', (req, res) => {
    const { ownerId, viewerId } = req.params;
    const decision = req.body?.decision;
    const albumId = String(req.body?.albumId || '').trim();
    const durationSeconds = req.body?.durationSeconds !== undefined
      ? parseAlbumAccessDurationSeconds(req.body.durationSeconds, 7 * 24 * 60 * 60)
      : Math.max(1, Number(req.body?.durationHours || 168)) * 60 * 60;

    if (ownerId !== req.currentProfile.id) {
      return res.status(403).json({ error: 'only_owner_can_respond' });
    }
    const owner = getProfile(store, ownerId);
    const viewer = getProfile(store, viewerId);
    if (!owner || !viewer) return res.status(404).json({ error: 'profile_not_found' });
    if (isProfileBlocked(store, ownerId, viewerId) && decision === 'accept') return res.status(403).json(blockedResponse('Accès impossible : profil bloqué.'));
    if (!['accept', 'decline'].includes(decision)) return res.status(400).json({ error: 'invalid_decision' });
    if (decision === 'accept' && durationSeconds === undefined) return res.status(400).json({ error: 'invalid_album_access_duration', message: 'Durée d’ouverture invalide.' });

    const targetAlbum = albumId ? findAlbum(store, albumId).album : ensureAlbums(owner).find((album) => album.visibility === 'private');
    if (!targetAlbum || targetAlbum.ownerId !== ownerId) return res.status(404).json({ error: 'album_not_found' });

    const existingAccess = getAlbumAccess(store, ownerId, viewerId, targetAlbum.id);
    const access = upsertAlbumAccess(store, ownerId, viewerId, targetAlbum.id, {
      status: decision === 'accept' ? 'granted' : 'declined',
      grantedAt: decision === 'accept' ? nowIso() : null,
      expiresAt: decision === 'accept' ? albumAccessExpiresAt(durationSeconds) : null,
      durationSeconds: decision === 'accept' ? durationSeconds : null,
      exchangeAcceptedAt: decision === 'accept' && existingAccess?.exchangeRequested ? nowIso() : existingAccess?.exchangeAcceptedAt,
    });

    let reciprocalAccess = null;
    if (decision === 'accept' && existingAccess?.exchangeRequested) {
      const reciprocalAlbum = ensureAlbums(viewer).find((album) => album.visibility === 'private');
      if (reciprocalAlbum) {
        reciprocalAccess = upsertAlbumAccess(store, viewerId, ownerId, reciprocalAlbum.id, {
          status: 'granted',
          requestedAt: existingAccess.requestedAt || null,
          grantedAt: nowIso(),
          revokedAt: null,
          expiresAt: albumAccessExpiresAt(durationSeconds),
          durationSeconds,
          exchange: true,
          exchangeAcceptedAt: nowIso(),
        });
        createNotification(store, ownerId, 'album_exchange_accepted', viewerId, 'Échange privé actif', `${viewer.pseudo} a confirmé l’échange : vos albums privés sont ouverts pendant ${albumAccessDurationLabel(durationSeconds)}.`, { albumId: reciprocalAlbum.id, exchange: true });
      }
    }

    const conversation = getConversation(store, ownerId, viewerId);
    if (conversation) {
      conversation.messages.push({
        id: makeId('msg'),
        fromId: ownerId,
        body: decision === 'accept'
          ? existingAccess?.exchangeRequested
            ? `${owner.pseudo} a accepté l’échange d’albums privés. Les accès sont ouverts pendant ${albumAccessDurationLabel(durationSeconds)}.`
            : `${owner.pseudo} a ouvert l’album « ${targetAlbum.title} ».`
          : `${owner.pseudo} n’a pas ouvert l’album « ${targetAlbum.title} » pour le moment.`,
        createdAt: nowIso(),
        read: false,
        system: true,
      });
      conversation.updatedAt = nowIso();
    }
    createNotification(
      store,
      viewerId,
      decision === 'accept' ? 'album_granted' : 'album_declined',
      ownerId,
      decision === 'accept' ? 'Album ouvert' : 'Demande refusée',
      decision === 'accept' ? `${owner.pseudo} vous a ouvert « ${targetAlbum.title} ».` : `${owner.pseudo} n’a pas ouvert « ${targetAlbum.title} » pour le moment.`,
      { albumId: targetAlbum.id }
    );

    res.json({ access, reciprocalAccess, album: serializeAlbum(store, targetAlbum, viewerId), message: decision === 'accept' ? (reciprocalAccess ? 'Échange privé accepté.' : 'Album ouvert.') : 'Demande refusée.' });
  });

  app.delete('/api/album-access/:ownerId/:viewerId', (req, res) => {
    const { ownerId, viewerId } = req.params;
    const albumId = String(req.query?.albumId || req.body?.albumId || '').trim();
    if (ownerId !== req.currentProfile.id) return res.status(403).json({ error: 'only_owner_can_revoke' });
    const targetAlbum = albumId ? findAlbum(store, albumId).album : ensureAlbums(req.currentProfile).find((album) => album.visibility === 'private');
    if (!targetAlbum || targetAlbum.ownerId !== ownerId) return res.status(404).json({ error: 'album_not_found' });
    const access = upsertAlbumAccess(store, ownerId, viewerId, targetAlbum.id, {
      status: 'revoked',
      revokedAt: nowIso(),
      expiresAt: null,
    });
    createNotification(store, viewerId, 'album_revoked', ownerId, 'Accès retiré', `${req.currentProfile.pseudo} a retiré l’accès à « ${targetAlbum.title} ».`, { albumId: targetAlbum.id });
    res.json({ access, message: 'Accès retiré.' });
  });

  app.get('/api/conversations', (req, res) => {
    const conversations = store.conversations
      .filter((conversation) => conversation.participantIds.includes(req.currentProfile.id))
      .filter((conversation) => conversation.isGroup || !isProfileBlocked(store, req.currentProfile.id, conversation.participantIds.find((id) => id !== req.currentProfile.id)))
      .map((conversation) => serializeConversation(store, conversation, req.currentProfile.id))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json({ conversations });
  });


  app.post('/api/conversations/:profileId/open', (req, res) => {
    const other = getProfile(store, req.params.profileId);
    if (!isPubliclyReachableProfile(other, req.currentUser) || other.id === req.currentProfile.id) return res.status(404).json({ error: 'profile_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, other.id)) return res.status(403).json({ error: 'profile_blocked', message: 'Communication impossible : profil bloqué.' });
    let conversation = getConversation(store, req.currentProfile.id, other.id);
    if (!conversation) {
      conversation = { id: makeId('conv'), participantIds: [req.currentProfile.id, other.id], updatedAt: nowIso(), messages: [] };
      store.conversations.push(conversation);
      try { persistence.persist(store); } catch {}
    }
    res.json({ conversation: serializeConversation(store, conversation, req.currentProfile.id), message: `Conversation ouverte avec ${other.pseudo}.` });
  });

  app.get('/api/conversations/:profileId/messages', (req, res) => {
    const other = getProfile(store, req.params.profileId);
    if (!isPubliclyReachableProfile(other, req.currentUser)) return res.status(404).json({ error: 'profile_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, other.id)) return res.status(403).json({ error: 'profile_blocked', message: 'Communication impossible : profil bloqué.' });
    let conversation = getConversation(store, req.currentProfile.id, other.id);
    if (!conversation) {
      conversation = { id: makeId('conv'), participantIds: [req.currentProfile.id, other.id], updatedAt: nowIso(), messages: [] };
      store.conversations.push(conversation);
      try { persistence.persist(store); } catch {}
    }
    let markedRead = false;
    for (const message of permanentMessages(conversation)) {
      if (message.fromId !== req.currentProfile.id && !message.read) { message.read = true; markedRead = true; }
    }
    if (markedRead) { try { persistence.persist(store); } catch {} }
    const messages = permanentMessages(conversation).map((message) => sanitizeMessageForViewer(message, req.currentProfile.id));
    res.json({ conversation: serializeConversation(store, conversation, req.currentProfile.id), messages });
  });

  // Suppression / annulation d'un message : seul l'expéditeur peut supprimer le sien.
  app.delete('/api/conversations/:profileId/messages/:messageId', (req, res) => {
    const other = getProfile(store, req.params.profileId);
    if (!other) return res.status(404).json({ error: 'profile_not_found' });
    const conversation = getConversation(store, req.currentProfile.id, other.id);
    if (!conversation) return res.status(404).json({ error: 'conversation_not_found' });
    const message = (conversation.messages || []).find((m) => m.id === req.params.messageId);
    if (!message) return res.status(404).json({ error: 'message_not_found', message: 'Message introuvable.' });
    if (message.fromId !== req.currentProfile.id) return res.status(403).json({ error: 'not_your_message', message: 'Vous ne pouvez supprimer que vos propres messages.' });
    if (message.attachment?.storagePath) { try { fs.unlinkSync(message.attachment.storagePath); } catch {} }
    message.deletedAt = nowIso();
    message.body = '';
    message.attachment = null;
    message.kind = 'deleted';
    conversation.updatedAt = nowIso();
    try { persistence.persist(store); } catch {}
    res.json({
      message: sanitizeMessageForViewer(message, req.currentProfile.id),
      conversation: serializeConversation(store, conversation, req.currentProfile.id),
    });
  });

  app.post('/api/conversations/:profileId/messages', (req, res) => {
    const other = getProfile(store, req.params.profileId);
    const body = limitText(req.body?.body, MAX_TEXT.message);
    if (!isPubliclyReachableProfile(other, req.currentUser)) return res.status(404).json({ error: 'profile_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, other.id)) return res.status(403).json({ error: 'profile_blocked', message: 'Communication impossible : profil bloqué.' });
    if (!canSendDirectMessage(store, req.currentProfile.id, other.id)) return res.status(403).json({ error: 'message_not_allowed', message: 'Ce profil n’accepte pas ce type de message.' });
    let attachment = null;
    try { attachment = normalizeMessageAttachment(req.body?.attachment); }
    catch (error) { return res.status(error.statusCode || 400).json({ error: 'invalid_attachment', message: error.message || 'Pièce jointe invalide.' }); }
    if (!body && !attachment) return res.status(400).json({ error: 'empty_message', message: 'Ajoutez un texte, un GIF ou un média.' });
    if (body.length > 1200) return res.status(400).json({ error: 'message_too_long' });

    let conversation = getConversation(store, req.currentProfile.id, other.id);
    if (!conversation) {
      conversation = { id: makeId('conv'), participantIds: [req.currentProfile.id, other.id], updatedAt: nowIso(), messages: [] };
      store.conversations.push(conversation);
    }
    const message = {
      id: makeId('msg'),
      fromId: req.currentProfile.id,
      body,
      kind: attachment?.kind || 'text',
      channel: 'messagerie',
      attachment,
      viewedBy: [],
      createdAt: nowIso(),
      read: false,
    };
    conversation.messages.push(message);
    conversation.updatedAt = message.createdAt;
    const notificationText = attachment?.kind === 'gif' ? 'vous a envoyé un GIF.' : attachment?.kind === 'audio' ? 'vous a envoyé un message vocal.' : attachment?.kind === 'media' ? `vous a envoyé un média éphémère (${attachment.expiresInSeconds}s).` : 'vous a envoyé un message.';
    createNotification(store, other.id, 'message', req.currentProfile.id, 'Nouveau message', `${req.currentProfile.pseudo} ${notificationText}`, { conversationWith: req.currentProfile.id });
    res.status(201).json({ message: sanitizeMessageForViewer(message, req.currentProfile.id), conversation: serializeConversation(store, conversation, req.currentProfile.id) });
  });

  // ===== Messagerie de groupe (5 personnes max : créateur + 4 invités) =====
  const GROUP_MAX_MEMBERS = 5;
  function getGroupConv(reqStore, id) {
    return (reqStore.conversations || []).find((conversation) => conversation.id === id && conversation.isGroup);
  }

  app.post('/api/group-conversations', (req, res) => {
    const me = req.currentProfile.id;
    const name = limitText(req.body?.name || '', 80).trim();
    const rawIds = Array.isArray(req.body?.participantIds) ? req.body.participantIds : [];
    const invited = [...new Set(rawIds.map((value) => String(value || '').trim()).filter(Boolean))].filter((id) => id !== me);
    if (!invited.length) return res.status(400).json({ error: 'no_participants', message: 'Invitez au moins une personne.' });
    if (invited.length > GROUP_MAX_MEMBERS - 1) return res.status(400).json({ error: 'too_many_members', message: `Un groupe contient ${GROUP_MAX_MEMBERS} personnes maximum (vous + ${GROUP_MAX_MEMBERS - 1} invités).` });
    for (const id of invited) {
      const profile = getProfile(store, id);
      if (!isPubliclyReachableProfile(profile, req.currentUser)) return res.status(404).json({ error: 'profile_not_found', message: 'Un des profils invités est introuvable.' });
      if (isProfileBlocked(store, me, id)) return res.status(403).json({ error: 'profile_blocked', message: 'Vous ne pouvez pas inviter un profil bloqué.' });
    }
    const conversation = {
      id: makeId('grp'),
      isGroup: true,
      name,
      ownerId: me,
      participantIds: [me, ...invited],
      messages: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.conversations.push(conversation);
    for (const id of invited) createNotification(store, id, 'message', me, 'Nouveau groupe', `${req.currentProfile.pseudo} vous a ajouté à un groupe.`, { conversationId: conversation.id });
    res.status(201).json({ conversation: serializeConversation(store, conversation, me), message: 'Groupe créé.' });
  });

  app.get('/api/group-conversations/:id/messages', (req, res) => {
    const me = req.currentProfile.id;
    const conversation = getGroupConv(store, req.params.id);
    if (!conversation || !conversation.participantIds.includes(me)) return res.status(404).json({ error: 'group_not_found', message: 'Groupe introuvable.' });
    let changed = false;
    for (const message of permanentMessages(conversation)) {
      const viewed = Array.isArray(message.viewedBy) ? message.viewedBy : (message.viewedBy = []);
      if (message.fromId !== me && !viewed.includes(me)) { viewed.push(me); changed = true; }
    }
    if (changed) { try { persistence.persist(store); } catch {} }
    const messages = permanentMessages(conversation).map((message) => sanitizeMessageForViewer(message, me));
    res.json({ conversation: serializeConversation(store, conversation, me), messages });
  });

  app.post('/api/group-conversations/:id/messages', (req, res) => {
    const me = req.currentProfile.id;
    const conversation = getGroupConv(store, req.params.id);
    if (!conversation || !conversation.participantIds.includes(me)) return res.status(404).json({ error: 'group_not_found', message: 'Groupe introuvable.' });
    const body = limitText(req.body?.body, MAX_TEXT.message);
    if (!body) return res.status(400).json({ error: 'empty_message', message: 'Message vide.' });
    if (body.length > 1200) return res.status(400).json({ error: 'message_too_long' });
    const message = { id: makeId('msg'), fromId: me, body, kind: 'text', channel: 'groupe', viewedBy: [me], createdAt: nowIso(), read: false };
    conversation.messages.push(message);
    conversation.updatedAt = message.createdAt;
    for (const id of conversation.participantIds) {
      if (id !== me) createNotification(store, id, 'message', me, conversation.name ? `Groupe · ${conversation.name}` : 'Message de groupe', `${req.currentProfile.pseudo} a écrit dans le groupe.`, { conversationId: conversation.id });
    }
    res.status(201).json({ message: sanitizeMessageForViewer(message, me), conversation: serializeConversation(store, conversation, me) });
  });

  app.post('/api/group-conversations/:id/members', (req, res) => {
    const me = req.currentProfile.id;
    const conversation = getGroupConv(store, req.params.id);
    if (!conversation || !conversation.participantIds.includes(me)) return res.status(404).json({ error: 'group_not_found', message: 'Groupe introuvable.' });
    if (conversation.ownerId !== me) return res.status(403).json({ error: 'not_owner', message: 'Seul le créateur peut ajouter des membres.' });
    const targetId = String(req.body?.profileId || '').trim();
    const target = getProfile(store, targetId);
    if (!isPubliclyReachableProfile(target, req.currentUser)) return res.status(404).json({ error: 'profile_not_found', message: 'Profil introuvable.' });
    if (conversation.participantIds.includes(targetId)) return res.status(409).json({ error: 'already_member', message: 'Cette personne est déjà dans le groupe.' });
    if (conversation.participantIds.length >= GROUP_MAX_MEMBERS) return res.status(400).json({ error: 'group_full', message: `Le groupe est complet (${GROUP_MAX_MEMBERS} personnes maximum).` });
    if (isProfileBlocked(store, me, targetId)) return res.status(403).json({ error: 'profile_blocked', message: 'Profil bloqué.' });
    conversation.participantIds.push(targetId);
    conversation.updatedAt = nowIso();
    createNotification(store, targetId, 'message', me, 'Ajouté à un groupe', `${req.currentProfile.pseudo} vous a ajouté à un groupe.`, { conversationId: conversation.id });
    res.json({ conversation: serializeConversation(store, conversation, me), message: 'Membre ajouté.' });
  });

  app.delete('/api/group-conversations/:id/members/:profileId', (req, res) => {
    const me = req.currentProfile.id;
    const conversation = getGroupConv(store, req.params.id);
    if (!conversation || !conversation.participantIds.includes(me)) return res.status(404).json({ error: 'group_not_found', message: 'Groupe introuvable.' });
    if (conversation.ownerId !== me) return res.status(403).json({ error: 'not_owner', message: 'Seul le créateur peut retirer des membres.' });
    const targetId = String(req.params.profileId || '').trim();
    if (targetId === me) return res.status(400).json({ error: 'cannot_remove_self', message: 'Le créateur ne peut pas se retirer ; utilisez « quitter le groupe ».' });
    if (!conversation.participantIds.includes(targetId)) return res.status(404).json({ error: 'not_member', message: 'Cette personne n’est pas dans le groupe.' });
    conversation.participantIds = conversation.participantIds.filter((id) => id !== targetId);
    conversation.updatedAt = nowIso();
    res.json({ conversation: serializeConversation(store, conversation, me), message: 'Membre retiré.' });
  });

  app.post('/api/group-conversations/:id/leave', (req, res) => {
    const me = req.currentProfile.id;
    const conversation = getGroupConv(store, req.params.id);
    if (!conversation || !conversation.participantIds.includes(me)) return res.status(404).json({ error: 'group_not_found', message: 'Groupe introuvable.' });
    conversation.participantIds = conversation.participantIds.filter((id) => id !== me);
    if (conversation.ownerId === me) conversation.ownerId = conversation.participantIds[0] || null;
    conversation.updatedAt = nowIso();
    if (conversation.participantIds.length === 0) {
      store.conversations = store.conversations.filter((conv) => conv.id !== conversation.id);
    }
    res.json({ message: 'Vous avez quitté le groupe.' });
  });

  app.post('/api/conversations/:profileId/messages/:messageId/view', (req, res) => {
    const other = getProfile(store, req.params.profileId);
    if (!isPubliclyReachableProfile(other, req.currentUser)) return res.status(404).json({ error: 'profile_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, other.id)) return res.status(403).json(blockedResponse('Média indisponible : profil bloqué.'));
    const conversation = getConversation(store, req.currentProfile.id, other.id);
    if (!conversation) return res.status(404).json({ error: 'conversation_not_found', message: 'Conversation introuvable.' });
    const message = conversation.messages.find((item) => item.id === req.params.messageId);
    if (!message || !message.attachment?.ephemeral) return res.status(404).json({ error: 'media_not_found', message: 'Média introuvable.' });
    if (message.fromId === req.currentProfile.id) return res.json({ message: sanitizeMessageForViewer(message, req.currentProfile.id), expiresInSeconds: message.attachment.expiresInSeconds || 5 });
    if (!Array.isArray(message.viewedBy)) message.viewedBy = [];
    if (!message.viewedBy.includes(req.currentProfile.id)) message.viewedBy.push(req.currentProfile.id);
    message.viewedAt = message.viewedAt || {};
    message.viewedAt[req.currentProfile.id] = nowIso();
    try { persistence.persist(store); } catch {}
    res.json({ message: sanitizeMessageForViewer(message, req.currentProfile.id), expiresInSeconds: message.attachment.expiresInSeconds || 5 });
  });

  app.get('/api/message-media/:fileId', (req, res) => {
    const fileId = String(req.params.fileId || '').trim();
    const { conversation, message, attachment } = findMessageMedia(store, fileId);
    if (!conversation || !message || !attachment) return res.status(404).json({ error: 'media_not_found', message: 'Média introuvable.' });
    if (!conversation.participantIds.includes(req.currentProfile.id)) return res.status(403).json({ error: 'media_forbidden', message: 'Média non accessible.' });
    const otherId = conversation.participantIds.find((id) => id !== req.currentProfile.id);
    if (isProfileBlocked(store, req.currentProfile.id, otherId)) return res.status(403).json(blockedResponse('Média indisponible : profil bloqué.'));
    if (message.expiresAt && new Date(message.expiresAt).getTime() <= Date.now()) return res.status(410).json({ error: 'media_expired', message: 'Média expiré.' });
    const isSender = message.fromId === req.currentProfile.id;
    // Barrière « ouverture unique » réservée aux médias éphémères. L'audio et les
    // médias permanents sont accessibles directement par les participants.
    if (!isSender && attachment.ephemeral) {
      const viewedAt = message.viewedAt?.[req.currentProfile.id];
      if (!viewedAt) return res.status(403).json({ error: 'media_not_opened', message: 'Ouvrez le média depuis la conversation.' });
      const allowedUntil = new Date(viewedAt).getTime() + Number(attachment.expiresInSeconds || 5) * 1000;
      if (Date.now() > allowedUntil) return res.status(410).json({ error: 'media_consumed', message: 'Média expiré.' });
    }
    if (!attachment.storagePath || !fs.existsSync(attachment.storagePath)) return res.status(404).json({ error: 'media_file_missing', message: 'Fichier média introuvable.' });
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store, private');
    res.sendFile(attachment.storagePath);
  });

  app.get('/api/album-media/:fileId', (req, res) => {
    const fileId = String(req.params.fileId || '').trim();
    const { album, media } = findAlbumMedia(store, fileId);
    if (!album || !media) return res.status(404).json({ error: 'media_not_found', message: 'Média introuvable.' });
    if (!canViewAlbum(store, album, req.currentProfile.id)) return res.status(403).json({ error: 'album_locked', message: 'Cet album est verrouillé.' });
    const candidates = [media.storagePath, media.filename ? path.join(albumMediaRoot, media.filename) : ''].filter(Boolean);
    const storagePath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!storagePath) return res.status(404).json({ error: 'media_file_missing', message: 'Fichier média introuvable.' });
    res.setHeader('Content-Type', media.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', album.visibility === 'public' ? 'private, max-age=300' : 'no-store, private');
    res.sendFile(storagePath);
  });

  // Médias d'événements : accessibles à tout membre connecté (images publiques de l'événement).
  app.get('/api/feed-media/:fileId', (req, res) => {
    const fileId = String(req.params.fileId || '').trim();
    const post = (store.feedPosts || []).find((item) => item.fileId === fileId && canViewFeedPost(store, item, req.currentProfile.id));
    if (!post) return res.status(404).json({ error: 'feed_media_not_found', message: 'Média introuvable.' });
    const candidates = [post.storagePath, post.filename ? path.join(feedMediaRoot, post.filename) : ''].filter(Boolean);
    const storagePath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!storagePath) return res.status(404).json({ error: 'media_file_missing', message: 'Fichier média introuvable.' });
    res.setHeader('Content-Type', post.mimeType || 'application/octet-stream');
    res.sendFile(storagePath);
  });

  app.get('/api/event-media/:fileId', (req, res) => {
    const fileId = String(req.params.fileId || '').trim();
    const { media } = findEventMedia(store, fileId);
    if (!media) return res.status(404).json({ error: 'media_not_found', message: 'Média introuvable.' });
    const candidates = [media.storagePath, media.filename ? path.join(eventMediaRoot, media.filename) : ''].filter(Boolean);
    const storagePath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!storagePath) return res.status(404).json({ error: 'media_file_missing', message: 'Fichier média introuvable.' });
    res.setHeader('Content-Type', media.mimeType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(storagePath);
  });

  app.get('/api/instant-chats', (req, res) => {
    if (pruneExpiredInstantMessages(store)) { try { persistence.persist(store); } catch {} }
    const chats = store.conversations
      .filter((conversation) => conversation.participantIds.includes(req.currentProfile.id))
      .filter((conversation) => !isProfileBlocked(store, req.currentProfile.id, conversation.participantIds.find((id) => id !== req.currentProfile.id)))
      .map((conversation) => serializeInstantChat(store, conversation, req.currentProfile.id))
      .filter((chat) => chat.messageCount > 0)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json({ chats });
  });

  app.get('/api/instant-chats/:profileId/messages', (req, res) => {
    const other = getProfile(store, req.params.profileId);
    if (!isPubliclyReachableProfile(other, req.currentUser) || other.id === req.currentProfile.id) return res.status(404).json({ error: 'profile_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, other.id)) return res.status(403).json({ error: 'profile_blocked', message: 'Chat impossible : profil bloqué.' });
    let conversation = getConversation(store, req.currentProfile.id, other.id);
    if (!conversation) {
      conversation = { id: makeId('conv'), participantIds: [req.currentProfile.id, other.id], updatedAt: nowIso(), messages: [] };
      store.conversations.push(conversation);
    }
    if (pruneExpiredInstantMessages(store)) { try { persistence.persist(store); } catch {} }
    let markedRead = false;
    for (const message of activeInstantMessages(conversation)) {
      if (message.fromId !== req.currentProfile.id && !message.read) { message.read = true; markedRead = true; }
    }
    if (markedRead) { try { persistence.persist(store); } catch {} }
    const messages = activeInstantMessages(conversation).map((message) => sanitizeMessageForViewer(message, req.currentProfile.id));
    res.json({ chat: serializeInstantChat(store, conversation, req.currentProfile.id), messages });
  });

  app.post('/api/instant-chats/:profileId/messages', (req, res) => {
    const other = getProfile(store, req.params.profileId);
    const body = limitText(req.body?.body, MAX_TEXT.message);
    if (!isPubliclyReachableProfile(other, req.currentUser) || other.id === req.currentProfile.id) return res.status(404).json({ error: 'profile_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, other.id)) return res.status(403).json({ error: 'profile_blocked', message: 'Chat impossible : profil bloqué.' });
    if (!canSendDirectMessage(store, req.currentProfile.id, other.id)) return res.status(403).json({ error: 'message_not_allowed', message: 'Ce profil n’accepte pas ce type de chat.' });
    let attachment = null;
    try { attachment = normalizeMessageAttachment(req.body?.attachment); }
    catch (error) { return res.status(error.statusCode || 400).json({ error: 'invalid_attachment', message: error.message || 'Pièce jointe invalide.' }); }
    if (!body && !attachment) return res.status(400).json({ error: 'empty_message', message: 'Ajoutez un texte, un GIF ou un média.' });
    let conversation = getConversation(store, req.currentProfile.id, other.id);
    if (!conversation) {
      conversation = { id: makeId('conv'), participantIds: [req.currentProfile.id, other.id], updatedAt: nowIso(), messages: [] };
      store.conversations.push(conversation);
    }
    const createdAt = nowIso();
    const message = {
      id: makeId('ichat'),
      fromId: req.currentProfile.id,
      body,
      kind: attachment?.kind || 'text',
      channel: 'instant',
      attachment,
      viewedBy: [],
      createdAt,
      read: false,
    };
    conversation.messages.push(message);
    conversation.updatedAt = createdAt;
    createNotification(store, other.id, 'instant_chat', req.currentProfile.id, 'Nouveau message', `${req.currentProfile.pseudo} vous a écrit dans le chat.`, { conversationWith: req.currentProfile.id });
    res.status(201).json({ message: sanitizeMessageForViewer(message, req.currentProfile.id), chat: serializeInstantChat(store, conversation, req.currentProfile.id) });
  });

  app.get('/api/notifications', (req, res) => {
    const notifications = store.notifications
      .filter((notification) => notification.profileId === req.currentProfile.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((notification) => serializeNotification(store, notification, req.currentProfile.id));
    res.json({ notifications, unread: notifications.filter((notification) => !notification.read).length });
  });

  app.post('/api/notifications/read-all', (req, res) => {
    for (const notification of store.notifications) {
      if (notification.profileId === req.currentProfile.id) notification.read = true;
    }
    res.json({ ok: true, message: 'Notifications marquées comme lues.' });
  });

  app.get('/api/feed/posts', (req, res) => {
    res.json({ posts: feedPostsForViewer(store, req.currentProfile.id, 120) });
  });

  app.post('/api/feed/posts', (req, res) => {
    const text = limitText(req.body?.text || req.body?.texte || '', MAX_TEXT.description);
    const visibility = normalizeFeedVisibility(req.body?.visibility);
    const rawMediaType = String(req.body?.mediaType || req.body?.media_type || 'none').trim().toLowerCase();
    const mediaType = rawMediaType === 'video' ? 'video' : rawMediaType === 'image' || rawMediaType === 'photo' ? 'image' : 'none';
    const dataUrl = String(req.body?.dataUrl || '').trim();
    const mimeType = String(req.body?.mimeType || '').trim().toLowerCase();
    if (!text && !dataUrl) return res.status(400).json({ error: 'post_empty', message: 'Ajoutez un texte, une photo ou une vidéo avant de publier.' });
    let stored = {};
    if (dataUrl) {
      const allowed = mediaType === 'video' ? ALBUM_ALLOWED_VIDEO_TYPES : ALBUM_ALLOWED_IMAGE_TYPES;
      if (!allowed.has(mimeType)) return res.status(400).json({ error: 'media_format_not_allowed', message: 'Format média non autorisé.' });
      try {
        stored = persistFeedMedia({ dataUrl, mimeType, mediaType });
      } catch (error) {
        return res.status(error.statusCode || 400).json({ error: 'feed_media_upload_failed', message: error.message || 'Média impossible à enregistrer.' });
      }
    }
    const post = {
      id: makeId('feedpost'),
      userId: req.currentProfile.id,
      text,
      mediaType: dataUrl ? mediaType : 'none',
      mediaUrl: stored.url || '',
      fileId: stored.fileId || null,
      filename: stored.filename || '',
      storagePath: stored.storagePath || '',
      mimeType: stored.mimeType || mimeType || '',
      sizeBytes: stored.sizeBytes || 0,
      visibility,
      likedBy: [],
      comments: [],
      hiddenBy: [],
      createdAt: nowIso(),
    };
    store.feedPosts = Array.isArray(store.feedPosts) ? store.feedPosts : [];
    store.feedPosts.unshift(post);
    res.status(201).json({ post: serializeFeedPost(store, post, req.currentProfile.id), message: 'Publication ajoutée au fil.' });
  });

  app.post('/api/feed/posts/:postId/like', (req, res) => {
    const post = (store.feedPosts || []).find((item) => item.id === req.params.postId);
    if (!post || !canViewFeedPost(store, post, req.currentProfile.id)) return res.status(404).json({ error: 'feed_post_not_found', message: 'Publication introuvable.' });
    post.likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
    const index = post.likedBy.indexOf(req.currentProfile.id);
    const liked = index === -1;
    if (liked) post.likedBy.push(req.currentProfile.id);
    else post.likedBy.splice(index, 1);
    if (liked && post.userId !== req.currentProfile.id) {
      createNotification(store, post.userId, 'feed_like', req.currentProfile.id, 'Nouveau j’aime', `${req.currentProfile.pseudo} aime votre publication.`, { postId: post.id, targetType: 'feed_post', targetId: post.id, actionUrl: '/accueil' });
    }
    res.json({ post: serializeFeedPost(store, post, req.currentProfile.id), liked, message: liked ? 'Publication aimée.' : 'J’aime retiré.' });
  });

  app.post('/api/feed/posts/:postId/comments', (req, res) => {
    const post = (store.feedPosts || []).find((item) => item.id === req.params.postId);
    if (!post || !canViewFeedPost(store, post, req.currentProfile.id)) return res.status(404).json({ error: 'feed_post_not_found', message: 'Publication introuvable.' });
    const text = limitText(req.body?.text || req.body?.body || '', MAX_TEXT.comment);
    if (!text) return res.status(400).json({ error: 'comment_required', message: 'Le commentaire est obligatoire.' });
    post.comments = Array.isArray(post.comments) ? post.comments : [];
    const comment = { id: makeId('feedcomment'), userId: req.currentProfile.id, text, createdAt: nowIso() };
    post.comments.push(comment);
    if (post.userId !== req.currentProfile.id) {
      createNotification(store, post.userId, 'feed_comment', req.currentProfile.id, 'Nouveau commentaire', `${req.currentProfile.pseudo} a commenté votre publication.`, { postId: post.id, targetType: 'feed_post', targetId: post.id, actionUrl: '/accueil' });
    }
    res.status(201).json({ post: serializeFeedPost(store, post, req.currentProfile.id), comment: serializeFeedComment(store, comment, req.currentProfile.id), message: 'Commentaire ajouté.' });
  });

  app.post('/api/feed/posts/:postId/hide', (req, res) => {
    const post = (store.feedPosts || []).find((item) => item.id === req.params.postId);
    if (!post || !canViewFeedPost(store, post, req.currentProfile.id)) return res.status(404).json({ error: 'feed_post_not_found', message: 'Publication introuvable.' });
    post.hiddenBy = Array.isArray(post.hiddenBy) ? post.hiddenBy : [];
    if (!post.hiddenBy.includes(req.currentProfile.id)) post.hiddenBy.push(req.currentProfile.id);
    res.json({ hidden: true, postId: post.id, message: 'Publication masquée.' });
  });

  app.post('/api/feed/posts/:postId/report', (req, res) => {
    const post = (store.feedPosts || []).find((item) => item.id === req.params.postId);
    if (!post || !canViewFeedPost(store, post, req.currentProfile.id)) return res.status(404).json({ error: 'feed_post_not_found', message: 'Publication introuvable.' });
    if (post.userId === req.currentProfile.id) return res.status(400).json({ error: 'cannot_report_self', message: 'Vous ne pouvez pas signaler votre propre publication.' });
    const reason = limitText(req.body?.reason || req.body?.details || 'Publication signalée depuis le fil.', MAX_TEXT.reason);
    const category = normalizeReportCategory(req.body?.category || 'Contenu adulte non conforme');
    const duplicate = (store.reports || []).find((item) => item.reporterId === req.currentProfile.id && item.targetId === post.userId && item.context === post.id && item.status !== 'resolved' && item.status !== 'dismissed');
    if (duplicate) return res.status(409).json({ error: 'duplicate_report', message: 'Un signalement est déjà ouvert pour cette publication.', report: duplicate });
    const priority = reportPriority(category, reason);
    const report = { id: makeId('report'), reporterId: req.currentProfile.id, targetId: post.userId, category, reason, source: 'feed_post', context: post.id, priority, createdAt: nowIso(), status: 'new' };
    store.reports = Array.isArray(store.reports) ? store.reports : [];
    store.reports.push(report);
    notifyAdmins(store, priority === 'urgent' ? 'Signalement urgent' : 'Nouveau signalement', `${req.currentProfile.pseudo} a signalé une publication du fil.`, { reportId: report.id, targetId: post.userId, actorId: req.currentProfile.id, priority, postId: post.id });
    res.status(201).json({ report, message: 'Signalement reçu, merci. Notre équipe de modération l’examinera.' });
  });

  app.get('/api/albums', (req, res) => {
    const mine = ensureAlbums(req.currentProfile).map((album) => serializeAlbum(store, album, req.currentProfile.id));
    const visible = store.profiles
      .filter((profile) => profile.id !== req.currentProfile.id && !profile.hidden && !isProfileBlocked(store, req.currentProfile.id, profile.id))
      .flatMap((profile) => ensureAlbums(profile).map((album) => ({ owner: publicProfile(profile, req.currentProfile.id, store, { shallow: true }), album: serializeAlbum(store, album, req.currentProfile.id) })))
      .filter(({ album }) => album.visibility === 'public' || album.unlocked);
    res.json({ mine, visible });
  });

  app.post('/api/albums', (req, res) => {
    const title = limitText(req.body?.title, MAX_TEXT.title);
    const description = limitText(req.body?.description, MAX_TEXT.description);
    const visibility = req.body?.visibility === 'private' ? 'private' : 'public';
    if (!title) return res.status(400).json({ error: 'title_required', message: 'Le nom de l’album est obligatoire.' });
    const albums = ensureAlbums(req.currentProfile);
    const album = makeAlbum(req.currentProfile, makeId('custom'), { title, description, visibility, items: [] });
    albums.push(album);
    ensureAlbums(req.currentProfile);
    res.status(201).json({ album: serializeAlbum(store, album, req.currentProfile.id), message: 'Album créé.' });
  });

  app.put('/api/albums/:albumId', (req, res) => {
    const { album } = findAlbum(store, req.params.albumId);
    if (!album) return res.status(404).json({ error: 'album_not_found' });
    if (album.ownerId !== req.currentProfile.id) return res.status(403).json({ error: 'only_owner_can_edit' });
    if (req.body?.title !== undefined) album.title = String(req.body.title).trim() || album.title;
    if (req.body?.description !== undefined) album.description = String(req.body.description).trim();
    if (req.body?.visibility !== undefined) album.visibility = req.body.visibility === 'private' ? 'private' : 'public';
    album.updatedAt = nowIso();
    ensureAlbums(req.currentProfile);
    res.json({ album: serializeAlbum(store, album, req.currentProfile.id), message: 'Album mis à jour.' });
  });

  app.post('/api/albums/:albumId/media', (req, res) => {
    const { album } = findAlbum(store, req.params.albumId);
    if (!album) return res.status(404).json({ error: 'album_not_found' });
    if (album.ownerId !== req.currentProfile.id) return res.status(403).json({ error: 'only_owner_can_add_media' });
    const type = req.body?.type === 'video' ? 'video' : 'photo';
    const title = limitText(req.body?.title, MAX_TEXT.title);
    const caption = limitText(req.body?.caption, MAX_TEXT.description);
    if (!title) return res.status(400).json({ error: 'title_required', message: 'Le titre du média est obligatoire.' });
    let stored = {};
    const dataUrl = String(req.body?.dataUrl || '').trim();
    const mimeType = String(req.body?.mimeType || '').trim().toLowerCase();
    if (dataUrl || mimeType) {
      const allowed = type === 'video' ? ALBUM_ALLOWED_VIDEO_TYPES : ALBUM_ALLOWED_IMAGE_TYPES;
      if (!allowed.has(mimeType)) return res.status(400).json({ error: 'media_format_not_allowed', message: 'Format média non autorisé.' });
      try {
        stored = persistAlbumMedia({ dataUrl, mimeType, mediaType: type });
      } catch (error) {
        return res.status(error.statusCode || 400).json({ error: 'media_upload_failed', message: error.message || 'Média impossible à enregistrer.' });
      }
    }
    const media = makeMedia(album, album.items.length, { type, title, caption, likedBy: [], comments: [], viewedBy: [], shareCount: 0, mimeType, ...stored });
    album.items.push(media);
    album.updatedAt = nowIso();
    ensureAlbums(req.currentProfile);
    res.status(201).json({ media: serializeMedia(store, media, req.currentProfile.id), album: serializeAlbum(store, album, req.currentProfile.id), message: `${type === 'video' ? 'Vidéo' : 'Photo'} ajoutée.` });
  });

  app.post('/api/albums/:albumId/access/request', (req, res) => {
    const { profile: owner, album } = findAlbum(store, req.params.albumId);
    if (!album || !owner) return res.status(404).json({ error: 'album_not_found' });
    if (album.ownerId === req.currentProfile.id) return res.status(400).json({ error: 'cannot_request_own_album' });
    if (isProfileBlocked(store, req.currentProfile.id, album.ownerId)) return res.status(403).json(blockedResponse('Demande impossible : profil bloqué.'));
    if (!canRequestPrivateAlbum(store, req.currentProfile.id, album.ownerId)) return res.status(403).json({ error: 'album_request_not_allowed', message: 'Ce profil n’accepte pas les demandes d’albums privés.' });
    if (album.visibility !== 'private') return res.status(400).json({ error: 'album_is_public', message: 'Cet album est déjà public.' });

    const existing = getAlbumAccess(store, album.ownerId, req.currentProfile.id, album.id);
    if (existing?.status === 'granted') return res.json({ access: existing, message: 'Accès déjà accordé.' });
    const access = upsertAlbumAccess(store, album.ownerId, req.currentProfile.id, album.id, { status: 'requested', requestedAt: nowIso(), grantedAt: null, expiresAt: null });
    createNotification(store, album.ownerId, 'album_request', req.currentProfile.id, 'Demande d’album privé', `${req.currentProfile.pseudo} demande l’accès à « ${album.title} ».`, { albumId: album.id });
    res.status(201).json({ access, album: serializeAlbum(store, album, req.currentProfile.id), message: 'Demande d’accès envoyée. La personne sera notifiée.' });
  });


  app.delete('/api/media/:mediaId', (req, res) => {
    const { profile, album, media } = findMedia(store, req.params.mediaId);
    if (!media || !album || !profile) return res.status(404).json({ error: 'media_not_found', message: 'Média introuvable.' });
    if (album.ownerId !== req.currentProfile.id && media.ownerId !== req.currentProfile.id) return res.status(403).json({ error: 'only_owner_can_delete_media', message: 'Vous ne pouvez supprimer que vos médias.' });
    const index = (album.items || []).findIndex((item) => item.id === media.id);
    if (index === -1) return res.status(404).json({ error: 'media_not_found', message: 'Média introuvable.' });
    const [removed] = album.items.splice(index, 1);
    album.updatedAt = nowIso();
    const retention = trackRemovedMediaForRetention(store, removed, { ownerId: album.ownerId, albumId: album.id, reason: 'deleted_by_owner' });
    res.json({ ok: true, album: serializeAlbum(store, album, req.currentProfile.id), retention: retention ? { months: MEDIA_REMOVED_RETENTION_MONTHS, deleteAfter: retention.deleteAfter } : null, message: retention ? MEDIA_RETENTION_NOTICE : 'Média supprimé du site.' });
  });

  function applyMediaReaction(req, res, forcedReaction = null) {
    const { profile, album, media } = findMedia(store, req.params.mediaId);
    if (!media || !album || !profile) return res.status(404).json({ error: 'media_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, profile.id)) return res.status(403).json(blockedResponse('Interaction impossible : profil bloqué.'));
    if (!canViewAlbum(store, album, req.currentProfile.id)) return res.status(403).json({ error: 'album_locked', message: 'Cet album est verrouillé.' });
    if (!canReactToMedia(store, req.currentProfile.id, media)) return res.status(403).json({ error: 'media_reaction_not_allowed', message: 'Ce profil n’autorise pas cette réaction.' });
    try { assertFreshSocialAction(store, req.currentProfile.id, 'media_reaction', 60 * 1000, 25); } catch (error) { return res.status(error.statusCode || 429).json({ error: error.code || 'rate_limited', message: error.message }); }
    const reaction = forcedReaction || String(req.body?.reaction || 'heart').trim();
    if (!MEDIA_REACTIONS.includes(reaction)) return res.status(400).json({ error: 'invalid_reaction', message: 'Réaction inconnue.' });
    const reactions = normalizeMediaReactions(media);
    const previous = reactions[req.currentProfile.id] || '';
    const removed = previous === reaction;
    if (removed) delete reactions[req.currentProfile.id];
    else reactions[req.currentProfile.id] = reaction;
    media.reactions = reactions;
    media.reactedAt = media.reactedAt && typeof media.reactedAt === 'object' ? media.reactedAt : {};
    if (removed) delete media.reactedAt[req.currentProfile.id];
    else media.reactedAt[req.currentProfile.id] = nowIso();
    normalizeMediaReactions(media);
    if (!removed && media.ownerId !== req.currentProfile.id) {
      const label = MEDIA_REACTION_LABELS[reaction] || 'a réagi';
      createNotification(store, media.ownerId, 'media_reaction', req.currentProfile.id, 'Nouvelle réaction', `${req.currentProfile.pseudo} a réagi ${label} à « ${media.title} ».`, { albumId: album.id, mediaId: media.id, reaction, targetType: 'media', targetId: media.id, actionUrl: `/medias?media=${media.id}` });
    }
    res.json({ media: serializeMedia(store, media, req.currentProfile.id), reaction: removed ? '' : reaction, removed, message: removed ? 'Réaction retirée.' : 'Réaction envoyée.' });
  }

  app.post('/api/media/:mediaId/reaction', (req, res) => applyMediaReaction(req, res));
  app.post('/api/media/:mediaId/like', (req, res) => applyMediaReaction(req, res, 'heart'));

  app.post('/api/media/:mediaId/view', (req, res) => {
    const { profile, album, media } = findMedia(store, req.params.mediaId);
    if (!media || !album || !profile) return res.status(404).json({ error: 'media_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, profile.id)) return res.status(403).json(blockedResponse('Interaction impossible : profil bloqué.'));
    if (!canViewAlbum(store, album, req.currentProfile.id)) return res.status(403).json({ error: 'album_locked', message: 'Cet album est verrouillé.' });
    media.viewedBy = Array.isArray(media.viewedBy) ? media.viewedBy : [];
    if (!media.viewedBy.includes(req.currentProfile.id)) media.viewedBy.push(req.currentProfile.id);
    res.json({ media: serializeMedia(store, media, req.currentProfile.id), message: 'Vue enregistrée.' });
  });

  app.post('/api/media/:mediaId/share', (req, res) => {
    const { profile, album, media } = findMedia(store, req.params.mediaId);
    if (!media || !album || !profile) return res.status(404).json({ error: 'media_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, profile.id)) return res.status(403).json(blockedResponse('Interaction impossible : profil bloqué.'));
    if (!canViewAlbum(store, album, req.currentProfile.id)) return res.status(403).json({ error: 'album_locked', message: 'Cet album est verrouillé.' });
    media.shareCount = Number(media.shareCount || 0) + 1;
    res.json({ media: serializeMedia(store, media, req.currentProfile.id), message: 'Partage enregistré.' });
  });

  app.post('/api/media/:mediaId/comments', (req, res) => {
    const { profile, album, media } = findMedia(store, req.params.mediaId);
    if (!media || !album || !profile) return res.status(404).json({ error: 'media_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, profile.id)) return res.status(403).json(blockedResponse('Interaction impossible : profil bloqué.'));
    if (!canViewAlbum(store, album, req.currentProfile.id)) return res.status(403).json({ error: 'album_locked', message: 'Cet album est verrouillé.' });
    if (!canCommentOnMedia(store, req.currentProfile.id, media)) return res.status(403).json({ error: 'media_comment_not_allowed', message: 'Ce profil n’autorise pas les commentaires.' });
    const body = limitText(req.body?.body, MAX_TEXT.comment);
    if (!body) return res.status(400).json({ error: 'empty_comment', message: 'Le commentaire ne peut pas être vide.' });
    if (body.length > 600) return res.status(400).json({ error: 'comment_too_long', message: 'Commentaire trop long.' });
    media.comments = Array.isArray(media.comments) ? media.comments : [];
    try {
      assertFreshSocialAction(store, req.currentProfile.id, 'media_comment', 60 * 1000, 8);
      assertNoRepeatedComment(store, media, req.currentProfile.id, body);
    } catch (error) { return res.status(error.statusCode || 429).json({ error: error.code || 'comment_rate_limited', message: error.message }); }
    const mentionedProfileIds = extractMentionedProfileIds(store, body).filter((id) => !isProfileBlocked(store, req.currentProfile.id, id));
    const comment = { id: makeId('com'), fromId: req.currentProfile.id, body, parentId: null, mentionedProfileIds, reportCount: 0, hiddenByOwner: false, pinned: false, likedBy: [], createdAt: nowIso(), updatedAt: nowIso() };
    media.comments.push(comment);
    if (media.ownerId !== req.currentProfile.id) createNotification(store, media.ownerId, 'comment', req.currentProfile.id, 'Nouveau commentaire', `${req.currentProfile.pseudo} a commenté « ${media.title} ».`, { albumId: album.id, mediaId: media.id, commentId: comment.id, targetType: 'comment', targetId: comment.id, actionUrl: `/medias?media=${media.id}&comment=${comment.id}` });
    for (const mentionedId of mentionedProfileIds) {
      if (mentionedId !== req.currentProfile.id && mentionedId !== media.ownerId) createNotification(store, mentionedId, 'mention', req.currentProfile.id, 'Vous avez été mentionné', `${req.currentProfile.pseudo} vous a mentionné dans un commentaire.`, { albumId: album.id, mediaId: media.id, commentId: comment.id, targetType: 'comment', targetId: comment.id, actionUrl: `/medias?media=${media.id}&comment=${comment.id}` });
    }
    res.status(201).json({ comment, media: serializeMedia(store, media, req.currentProfile.id), message: 'Commentaire ajouté.' });
  });

  app.post('/api/media/:mediaId/comments/:commentId/reply', (req, res) => {
    const { profile, album, media } = findMedia(store, req.params.mediaId);
    if (!media || !album || !profile) return res.status(404).json({ error: 'media_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, profile.id)) return res.status(403).json(blockedResponse('Interaction impossible : profil bloqué.'));
    if (!canViewAlbum(store, album, req.currentProfile.id)) return res.status(403).json({ error: 'album_locked', message: 'Cet album est verrouillé.' });
    if (!canCommentOnMedia(store, req.currentProfile.id, media)) return res.status(403).json({ error: 'media_comment_not_allowed', message: 'Ce profil n’autorise pas les réponses.' });
    media.comments = Array.isArray(media.comments) ? media.comments : [];
    const parent = media.comments.find((item) => item.id === req.params.commentId && !item.hiddenByOwner);
    if (!parent) return res.status(404).json({ error: 'comment_not_found', message: 'Commentaire introuvable.' });
    const body = limitText(req.body?.body, MAX_TEXT.comment);
    if (!body) return res.status(400).json({ error: 'empty_comment', message: 'La réponse ne peut pas être vide.' });
    try {
      assertFreshSocialAction(store, req.currentProfile.id, 'media_comment_reply', 60 * 1000, 8);
      assertNoRepeatedComment(store, media, req.currentProfile.id, body);
    } catch (error) { return res.status(error.statusCode || 429).json({ error: error.code || 'comment_rate_limited', message: error.message }); }
    const mentionedProfileIds = [...new Set([parent.fromId, ...extractMentionedProfileIds(store, body)])].filter((id) => id && !isProfileBlocked(store, req.currentProfile.id, id));
    const reply = { id: makeId('com'), fromId: req.currentProfile.id, body, parentId: parent.id, mentionedProfileIds, reportCount: 0, hiddenByOwner: false, pinned: false, likedBy: [], createdAt: nowIso(), updatedAt: nowIso() };
    media.comments.push(reply);
    if (parent.fromId !== req.currentProfile.id) createNotification(store, parent.fromId, 'comment_reply', req.currentProfile.id, 'Réponse à votre commentaire', `${req.currentProfile.pseudo} vous a répondu.`, { albumId: album.id, mediaId: media.id, commentId: parent.id, replyId: reply.id, targetType: 'comment', targetId: reply.id, actionUrl: `/medias?media=${media.id}&comment=${reply.id}` });
    for (const mentionedId of mentionedProfileIds) {
      if (mentionedId !== req.currentProfile.id && mentionedId !== parent.fromId) createNotification(store, mentionedId, 'mention', req.currentProfile.id, 'Vous avez été mentionné', `${req.currentProfile.pseudo} vous a mentionné dans une réponse.`, { albumId: album.id, mediaId: media.id, commentId: reply.id, targetType: 'comment', targetId: reply.id, actionUrl: `/medias?media=${media.id}&comment=${reply.id}` });
    }
    res.status(201).json({ comment: reply, media: serializeMedia(store, media, req.currentProfile.id), message: 'Réponse ajoutée.' });
  });

  app.post('/api/media/:mediaId/comments/:commentId/report', (req, res) => {
    const { profile, album, media } = findMedia(store, req.params.mediaId);
    if (!media || !album || !profile) return res.status(404).json({ error: 'media_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, profile.id)) return res.status(403).json(blockedResponse('Signalement impossible : profil bloqué.'));
    if (!canViewAlbum(store, album, req.currentProfile.id)) return res.status(403).json({ error: 'album_locked', message: 'Cet album est verrouillé.' });
    media.comments = Array.isArray(media.comments) ? media.comments : [];
    const comment = media.comments.find((item) => item.id === req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'comment_not_found', message: 'Commentaire introuvable.' });
    comment.reportCount = Number(comment.reportCount || 0) + 1;
    comment.reportedBy = Array.isArray(comment.reportedBy) ? comment.reportedBy : [];
    if (!comment.reportedBy.includes(req.currentProfile.id)) comment.reportedBy.push(req.currentProfile.id);
    if (comment.reportCount >= 3) comment.hiddenByOwner = true;
    const report = {
      id: makeId('report'),
      reporterId: req.currentProfile.id,
      targetId: comment.fromId,
      category: 'Contenu inapproprié',
      reason: limitText(req.body?.reason || `Commentaire signalé sur le média « ${media.title} ».`, MAX_TEXT.reason),
      source: 'comment',
      context: `media:${media.id} comment:${comment.id}`,
      priority: reportPriority('Contenu inapproprié', req.body?.reason || ''),
      status: 'new',
      createdAt: nowIso(),
    };
    store.reports.push(report);
    notifyAdmins(store, 'Commentaire signalé', `${req.currentProfile.pseudo} a signalé un commentaire.`, { reportId: report.id, mediaId: media.id, commentId: comment.id, actorId: req.currentProfile.id });
    res.status(201).json({ report, media: serializeMedia(store, media, req.currentProfile.id), message: comment.hiddenByOwner ? 'Commentaire signalé et masqué automatiquement.' : 'Commentaire signalé.' });
  });

  app.post('/api/media/:mediaId/comments/:commentId/pin', (req, res) => {
    const { profile, album, media } = findMedia(store, req.params.mediaId);
    if (!media || !album || !profile) return res.status(404).json({ error: 'media_not_found' });
    if (media.ownerId !== req.currentProfile.id) return res.status(403).json({ error: 'only_owner_can_pin', message: 'Seul le propriétaire du média peut épingler un commentaire.' });
    media.comments = Array.isArray(media.comments) ? media.comments : [];
    const comment = media.comments.find((item) => item.id === req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'comment_not_found', message: 'Commentaire introuvable.' });
    comment.pinned = !comment.pinned;
    comment.updatedAt = nowIso();
    res.json({ comment, media: serializeMedia(store, media, req.currentProfile.id), message: comment.pinned ? 'Commentaire épinglé.' : 'Épinglage retiré.' });
  });

  app.post('/api/media/:mediaId/comments/:commentId/like', (req, res) => {
    const { profile, album, media } = findMedia(store, req.params.mediaId);
    if (!media || !album || !profile) return res.status(404).json({ error: 'media_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, profile.id)) return res.status(403).json(blockedResponse('Interaction impossible : profil bloqué.'));
    if (!canViewAlbum(store, album, req.currentProfile.id)) return res.status(403).json({ error: 'album_locked', message: 'Cet album est verrouillé.' });
    media.comments = Array.isArray(media.comments) ? media.comments : [];
    const comment = media.comments.find((item) => item.id === req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'comment_not_found', message: 'Commentaire introuvable.' });
    comment.likedBy = Array.isArray(comment.likedBy) ? comment.likedBy : [];
    const index = comment.likedBy.indexOf(req.currentProfile.id);
    const liked = index === -1;
    if (liked) comment.likedBy.push(req.currentProfile.id);
    else comment.likedBy.splice(index, 1);
    if (liked && comment.fromId !== req.currentProfile.id) createNotification(store, comment.fromId, 'comment_like', req.currentProfile.id, 'J’aime sur votre commentaire', `${req.currentProfile.pseudo} a aimé votre commentaire.`, { albumId: album.id, mediaId: media.id, commentId: comment.id });
    res.json({ comment, media: serializeMedia(store, media, req.currentProfile.id), message: liked ? 'Commentaire aimé.' : 'J’aime retiré.' });
  });

  app.delete('/api/media/:mediaId/comments/:commentId', (req, res) => {
    const { profile, album, media } = findMedia(store, req.params.mediaId);
    if (!media || !album || !profile) return res.status(404).json({ error: 'media_not_found' });
    if (isProfileBlocked(store, req.currentProfile.id, profile.id)) return res.status(403).json(blockedResponse('Interaction impossible : profil bloqué.'));
    if (!canViewAlbum(store, album, req.currentProfile.id)) return res.status(403).json({ error: 'album_locked', message: 'Cet album est verrouillé.' });
    media.comments = Array.isArray(media.comments) ? media.comments : [];
    const index = media.comments.findIndex((item) => item.id === req.params.commentId);
    if (index === -1) return res.status(404).json({ error: 'comment_not_found', message: 'Commentaire introuvable.' });
    const comment = media.comments[index];
    if (comment.fromId !== req.currentProfile.id && media.ownerId !== req.currentProfile.id) return res.status(403).json({ error: 'comment_delete_forbidden', message: 'Vous ne pouvez supprimer que vos commentaires ou ceux publiés sous vos médias.' });
    const removedIds = new Set([comment.id, ...media.comments.filter((item) => item.parentId === comment.id).map((item) => item.id)]);
    media.comments = media.comments.filter((item) => !removedIds.has(item.id));
    res.json({ media: serializeMedia(store, media, req.currentProfile.id), message: 'Commentaire supprimé.' });
  });



  app.get('/api/social', (req, res) => {
    const social = serializeSocialDetails(store, req.currentProfile.id, buildSocialIndex(store));
    res.json({ ...social, social });
  });

  app.put('/api/profile/social-preferences', (req, res) => {
    const current = socialPreferencesFor(req.currentProfile);
    req.currentProfile.socialPreferences = {
      ...current,
      heartAllowedGenders: req.body?.heartAllowedGenders !== undefined ? normalizeGenderPreferenceList(req.body?.heartAllowedGenders) : current.heartAllowedGenders,
      showProfileViews: req.body?.showProfileViews !== undefined ? req.body?.showProfileViews !== false : current.showProfileViews,
      instantChatEnabled: req.body?.instantChatEnabled !== undefined ? req.body?.instantChatEnabled !== false : current.instantChatEnabled,
      messagePermission: normalizeSocialPermission(req.body?.messagePermission ?? current.messagePermission, ['everyone', 'matches', 'following', 'none'], current.messagePermission),
      mediaLikePermission: normalizeSocialPermission(req.body?.mediaLikePermission ?? current.mediaLikePermission, ['everyone', 'followers', 'matches', 'none'], current.mediaLikePermission),
      mediaCommentPermission: normalizeSocialPermission(req.body?.mediaCommentPermission ?? current.mediaCommentPermission, ['everyone', 'followers', 'matches', 'none'], current.mediaCommentPermission),
      allowWinks: req.body?.allowWinks !== undefined ? req.body?.allowWinks !== false : current.allowWinks,
      allowAlbumRequests: req.body?.allowAlbumRequests !== undefined ? req.body?.allowAlbumRequests !== false : current.allowAlbumRequests,
    };
    res.json({ preferences: socialPreferencesFor(req.currentProfile), profile: publicProfile(req.currentProfile, req.currentProfile.id, store), message: 'Préférences sociales enregistrées.' });
  });

  app.put('/api/profile/notification-preferences', (req, res) => {
    const incoming = req.body?.preferences || req.body || {};
    req.currentProfile.notificationPreferences = {
      ...notificationPreferencesFor(req.currentProfile),
      ...Object.fromEntries(NOTIFICATION_PREFERENCE_ITEMS.map((item) => [item.key, incoming[item.key] !== false])),
    };
    res.json({
      preferences: notificationPreferencesFor(req.currentProfile),
      options: NOTIFICATION_PREFERENCE_ITEMS,
      profile: publicProfile(req.currentProfile, req.currentProfile.id, store),
      message: 'Préférences de notifications enregistrées.',
    });
  });

  // --- Notifications push navigateur ---
  app.get('/api/push/public-key', (req, res) => {
    if (!webPushRuntime.config?.publicKey) {
      return res.status(503).json({ error: 'push_not_ready', message: 'Notifications push indisponibles pour le moment.' });
    }
    res.json({ publicKey: webPushRuntime.config.publicKey });
  });

  app.post('/api/push/subscribe', (req, res) => {
    const subscription = req.body?.subscription;
    const endpoint = String(subscription?.endpoint || '').trim();
    if (!endpoint || !endpoint.startsWith('https://') || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'invalid_subscription', message: 'Abonnement push invalide.' });
    }
    // Un même navigateur (endpoint) ne peut être associé qu'à un seul profil :
    // en cas de changement de compte sur le même appareil, on ré-attribue.
    store.pushSubscriptions = (store.pushSubscriptions || []).filter((item) => item.subscription?.endpoint !== endpoint);
    const maxPerProfile = 8;
    const existing = pushSubscriptionsFor(store, req.currentProfile.id);
    if (existing.length >= maxPerProfile) {
      const oldest = existing.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
      store.pushSubscriptions = store.pushSubscriptions.filter((item) => item.id !== oldest.id);
    }
    store.pushSubscriptions.push({
      id: makeId('push'),
      profileId: req.currentProfile.id,
      subscription: { endpoint, keys: { p256dh: String(subscription.keys.p256dh), auth: String(subscription.keys.auth) } },
      userAgent: limitText(req.get('user-agent') || '', 200),
      createdAt: nowIso(),
    });
    persistence.persist(store);
    res.status(201).json({ ok: true, message: 'Notifications push activées sur cet appareil.' });
  });

  app.post('/api/push/unsubscribe', (req, res) => {
    const endpoint = String(req.body?.endpoint || '').trim();
    if (!endpoint) return res.status(400).json({ error: 'missing_endpoint', message: 'Endpoint requis.' });
    const before = (store.pushSubscriptions || []).length;
    store.pushSubscriptions = (store.pushSubscriptions || []).filter((item) => !(item.profileId === req.currentProfile.id && item.subscription?.endpoint === endpoint));
    if (store.pushSubscriptions.length !== before) persistence.persist(store);
    res.json({ ok: true, message: 'Notifications push désactivées sur cet appareil.' });
  });

  app.post('/api/profile/client-status', (req, res) => {
    req.currentProfile.clientStatus = {
      ...clientStatusFor(req.currentProfile),
      notificationsSupported: Boolean(req.body?.notificationsSupported),
      notificationPermission: String(req.body?.notificationPermission || 'default').slice(0, 40),
      notificationsEnabled: Boolean(req.body?.notificationsEnabled),
      appInstalled: Boolean(req.body?.appInstalled),
      standalone: Boolean(req.body?.standalone),
      platform: String(req.body?.platform || '').slice(0, 80),
      lastClientSeenAt: nowIso(),
      updatedAt: nowIso(),
    };
    res.json({ clientStatus: clientStatusFor(req.currentProfile), message: 'État client mis à jour.' });
  });

  app.get('/api/notification-preferences', (req, res) => {
    res.json({ preferences: notificationPreferencesFor(req.currentProfile), options: NOTIFICATION_PREFERENCE_ITEMS, clientStatus: clientStatusFor(req.currentProfile) });
  });

  app.post('/api/support/contact', (req, res) => {
    const body = limitText(req.body?.message || req.body?.body, MAX_TEXT.message);
    if (!body) return res.status(400).json({ error: 'message_required', message: 'Message obligatoire.' });
    const adminProfile = getSupportAdminProfile(store, req.currentProfile.id);
    if (!adminProfile || adminProfile.id === req.currentProfile.id) return res.status(404).json({ error: 'support_unavailable', message: 'Support indisponible.' });
    const result = pushConversationMessage(store, req.currentProfile.id, adminProfile.id, body, { kind: 'support', support: true });
    createNotification(store, adminProfile.id, 'support_message', req.currentProfile.id, 'Message support', `${req.currentProfile.pseudo} a contacté le support.`, { conversationWith: req.currentProfile.id, support: true });
    res.status(201).json({ conversation: serializeConversation(store, result.conversation, req.currentProfile.id), message: 'Message envoyé au support.' });
  });

  app.post('/api/profiles/:id/heart', (req, res) => {
    const target = getProfile(store, req.params.id);
    if (!isPubliclyReachableProfile(target, req.currentUser)) return res.status(404).json({ error: 'profile_not_found' });
    if (target.id === req.currentProfile.id) return res.status(400).json({ error: 'cannot_heart_self', message: 'Vous ne pouvez pas envoyer un coup de cœur à votre propre profil.' });
    if (isProfileBlocked(store, req.currentProfile.id, target.id)) return res.status(403).json(blockedResponse('Coup de cœur impossible : profil bloqué.'));
    if (!canSendProfileHeart(target, req.currentProfile)) {
      return res.status(403).json({ error: 'heart_not_allowed', message: `${target.pseudo} n’accepte pas les coups de cœur de ce type de profil.` });
    }
    store.profileLikes = Array.isArray(store.profileLikes) ? store.profileLikes : [];
    store.profilePasses = Array.isArray(store.profilePasses) ? store.profilePasses : [];
    const passIndex = store.profilePasses.findIndex((pass) => pass.fromId === req.currentProfile.id && pass.toId === target.id);
    if (passIndex !== -1) store.profilePasses.splice(passIndex, 1);
    let like = profileHeart(store, req.currentProfile.id, target.id);
    const alreadyLiked = Boolean(like);
    if (!like) {
      like = { id: makeId('heart'), fromId: req.currentProfile.id, toId: target.id, createdAt: nowIso() };
      store.profileLikes.push(like);
      createNotification(store, target.id, 'profile_heart', req.currentProfile.id, 'Nouveau coup de cœur', `${req.currentProfile.pseudo} vous a envoyé un coup de cœur.`, { profileId: req.currentProfile.id });
    }
    const matched = Boolean(profileHeart(store, target.id, req.currentProfile.id));
    if (matched && !alreadyLiked) {
      createNotification(store, target.id, 'profile_match', req.currentProfile.id, 'Coup de cœur réciproque', `Vous avez un coup de cœur réciproque avec ${req.currentProfile.pseudo}.`, { profileId: req.currentProfile.id });
      createNotification(store, req.currentProfile.id, 'profile_match', target.id, 'Coup de cœur réciproque', `Vous avez un coup de cœur réciproque avec ${target.pseudo}.`, { profileId: target.id });
    }
    res.json({ liked: true, matched, profile: publicProfile(target, req.currentProfile.id, store), social: serializeSocialInbox(store, req.currentProfile.id, buildSocialIndex(store)), message: matched ? 'Match : coup de cœur réciproque.' : alreadyLiked ? 'Vous avez déjà liké ce profil.' : 'Coup de cœur envoyé.' });
  });

  app.post('/api/profiles/:id/pass', (req, res) => {
    const target = getProfile(store, req.params.id);
    if (!isPubliclyReachableProfile(target, req.currentUser)) return res.status(404).json({ error: 'profile_not_found' });
    if (target.id === req.currentProfile.id) return res.status(400).json({ error: 'cannot_pass_self' });
    if (isProfileBlocked(store, req.currentProfile.id, target.id)) return res.status(403).json(blockedResponse('Action impossible : profil bloqué.'));
    store.profileLikes = Array.isArray(store.profileLikes) ? store.profileLikes : [];
    store.profilePasses = Array.isArray(store.profilePasses) ? store.profilePasses : [];
    const likeIndex = store.profileLikes.findIndex((like) => like.fromId === req.currentProfile.id && like.toId === target.id);
    if (likeIndex !== -1) store.profileLikes.splice(likeIndex, 1);
    let pass = profilePass(store, req.currentProfile.id, target.id);
    if (!pass) {
      pass = { id: makeId('pass'), fromId: req.currentProfile.id, toId: target.id, createdAt: nowIso() };
      store.profilePasses.push(pass);
    } else {
      pass.createdAt = nowIso();
    }
    res.json({ passed: true, profile: publicProfile(target, req.currentProfile.id, store), social: serializeSocialInbox(store, req.currentProfile.id, buildSocialIndex(store)), message: 'Profil masqué de vos coups de cœur.' });
  });

  app.post('/api/profiles/:id/follow', (req, res) => {
    const target = getProfile(store, req.params.id);
    if (!isPubliclyReachableProfile(target, req.currentUser)) return res.status(404).json({ error: 'profile_not_found' });
    if (target.id === req.currentProfile.id) return res.status(400).json({ error: 'cannot_follow_self', message: 'Vous ne pouvez pas vous suivre vous-même.' });
    if (isProfileBlocked(store, req.currentProfile.id, target.id)) return res.status(403).json(blockedResponse('Suivi impossible : profil bloqué.'));
    store.followers = Array.isArray(store.followers) ? store.followers : [];
    const existingIndex = store.followers.findIndex((follow) => follow.followerId === req.currentProfile.id && follow.followingId === target.id);
    const followed = existingIndex === -1;
    if (followed) {
      store.followers.push({ id: makeId('follow'), followerId: req.currentProfile.id, followingId: target.id, createdAt: nowIso() });
      createNotification(store, target.id, 'follow', req.currentProfile.id, 'Nouveau suivi', `${req.currentProfile.pseudo} suit votre profil.`, { profileId: req.currentProfile.id });
    } else {
      store.followers.splice(existingIndex, 1);
    }
    res.json({ followed, profile: publicProfile(target, req.currentProfile.id, store), message: followed ? 'Profil suivi.' : 'Suivi retiré.' });
  });

  app.post('/api/profiles/:id/favorite', (req, res) => {
    const target = getProfile(store, req.params.id);
    if (!isPubliclyReachableProfile(target, req.currentUser)) return res.status(404).json({ error: 'profile_not_found' });
    if (target.id === req.currentProfile.id) return res.status(400).json({ error: 'cannot_favorite_self', message: 'Vous ne pouvez pas vous ajouter en favori.' });
    if (isProfileBlocked(store, req.currentProfile.id, target.id)) return res.status(403).json(blockedResponse('Favori impossible : profil bloqué.'));
    store.profileFavorites = Array.isArray(store.profileFavorites) ? store.profileFavorites : [];
    const index = store.profileFavorites.findIndex((favorite) => favorite.fromId === req.currentProfile.id && favorite.toId === target.id);
    const favorited = index === -1;
    if (favorited) store.profileFavorites.push({ id: makeId('fav'), fromId: req.currentProfile.id, toId: target.id, createdAt: nowIso() });
    else store.profileFavorites.splice(index, 1);
    res.json({ favorited, profile: publicProfile(target, req.currentProfile.id, store), message: favorited ? 'Profil ajouté en favori privé.' : 'Favori retiré.' });
  });

  app.get('/api/favorites', (req, res) => {
    const favorites = (store.profileFavorites || [])
      .filter((favorite) => favorite.fromId === req.currentProfile.id && !isProfileBlocked(store, req.currentProfile.id, favorite.toId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((favorite) => ({ ...favorite, profile: publicProfile(getProfile(store, favorite.toId), req.currentProfile.id, store, { shallow: true }) }))
      .filter((favorite) => favorite.profile);
    res.json({ favorites });
  });

  app.post('/api/profiles/:id/wink', (req, res) => {
    return res.status(410).json({ error: 'wink_removed', message: 'La fonctionnalité clin d’œil a été retirée.' });
  });

  app.post('/api/profiles/:id/icebreaker', (req, res) => {
    const target = getProfile(store, req.params.id);
    if (!isPubliclyReachableProfile(target, req.currentUser)) return res.status(404).json({ error: 'profile_not_found' });
    if (target.id === req.currentProfile.id) return res.status(400).json({ error: 'cannot_message_self' });
    if (!canSendDirectMessage(store, req.currentProfile.id, target.id)) return res.status(403).json({ error: 'message_not_allowed', message: 'Ce profil n’accepte pas ce type de message.' });
    const requested = limitText(req.body?.message || req.body?.question, MAX_TEXT.message);
    const body = ICEBREAKER_MESSAGES.includes(requested) ? requested : (requested || ICEBREAKER_MESSAGES[1]);
    try { assertFreshSocialAction(store, req.currentProfile.id, `icebreaker:${target.id}`, 60 * 60 * 1000, 3, 'Trop de brise-glaces envoyés à ce profil.'); } catch (error) { return res.status(error.statusCode || 429).json({ error: error.code || 'rate_limited', message: error.message }); }
    const result = pushConversationMessage(store, req.currentProfile.id, target.id, body, { kind: 'icebreaker', channel: 'messagerie' });
    createNotification(store, target.id, 'icebreaker', req.currentProfile.id, 'Nouveau brise-glace', `${req.currentProfile.pseudo} vous a envoyé : “${body}”`, { conversationWith: req.currentProfile.id, targetType: 'conversation', targetId: req.currentProfile.id, actionUrl: `/messages?profile=${req.currentProfile.id}` });
    res.status(201).json({ conversation: serializeConversation(store, result.conversation, req.currentProfile.id), message: sanitizeMessageForViewer(result.message, req.currentProfile.id), text: body });
  });

  app.post('/api/profiles/:id/discuss-tonight', (req, res) => {
    const target = getProfile(store, req.params.id);
    if (!isPubliclyReachableProfile(target, req.currentUser)) return res.status(404).json({ error: 'profile_not_found' });
    if (!canSendDirectMessage(store, req.currentProfile.id, target.id)) return res.status(403).json({ error: 'message_not_allowed', message: 'Ce profil n’accepte pas ce type de proposition.' });
    try { assertFreshSocialAction(store, req.currentProfile.id, `discuss-tonight:${target.id}`, 24 * 60 * 60 * 1000, 1, 'Vous avez déjà proposé une discussion ce soir à ce profil.'); } catch (error) { return res.status(error.statusCode || 429).json({ error: error.code || 'rate_limited', message: error.message }); }
    const body = 'Je suis disponible ce soir si tu veux discuter un peu 🙂';
    const result = pushConversationMessage(store, req.currentProfile.id, target.id, body, { kind: 'availability', channel: 'messagerie' });
    createNotification(store, target.id, 'availability', req.currentProfile.id, 'Disponible ce soir', `${req.currentProfile.pseudo} propose une discussion ce soir.`, { conversationWith: req.currentProfile.id, targetType: 'conversation', targetId: req.currentProfile.id, actionUrl: `/messages?profile=${req.currentProfile.id}` });
    res.status(201).json({ conversation: serializeConversation(store, result.conversation, req.currentProfile.id), message: sanitizeMessageForViewer(result.message, req.currentProfile.id) });
  });

  app.get('/api/follows', (req, res) => {
    const viewerId = req.currentProfile.id;
    const following = (store.followers || [])
      .filter((follow) => follow.followerId === viewerId && !isProfileBlocked(store, viewerId, follow.followingId))
      .map((follow) => ({ ...follow, profile: publicProfile(getProfile(store, follow.followingId), viewerId, store) }))
      .filter((item) => item.profile);
    const followers = (store.followers || [])
      .filter((follow) => follow.followingId === viewerId && !isProfileBlocked(store, viewerId, follow.followerId))
      .map((follow) => ({ ...follow, profile: publicProfile(getProfile(store, follow.followerId), viewerId, store) }))
      .filter((item) => item.profile);
    res.json({ following, followers });
  });

  app.get('/api/videos/feed', (req, res) => {
    res.json({ videos: visibleVideoFeed(store, req.currentProfile.id) });
  });

  app.get('/api/subscriptions/plans', (req, res) => {
    res.json({ plans: SUBSCRIPTION_PLANS, subscription: serializeSubscription(store, req.currentProfile.id) });
  });

  app.post('/api/subscriptions/quote', (req, res) => {
    const quote = quoteSubscription(store, req.body?.planId, req.body?.promoCode);
    if (!quote) return res.status(404).json({ error: 'plan_not_found', message: 'Formule introuvable.' });
    res.json({ quote });
  });

  function promoUseLimitForProfile(promo, profileId) {
    if (!promo || !profileId) return { allowed: true, limit: Infinity, used: 0 };
    const limit = Number.isFinite(Number(promo.maxUsesPerProfile)) ? Math.max(0, Number(promo.maxUsesPerProfile)) : (promo.type === 'free_month' ? 1 : Infinity);
    const uses = Array.isArray(promo.uses) ? promo.uses : [];
    const used = uses.filter((use) => use.profileId === profileId).length;
    return { allowed: used < limit, limit, used };
  }

  function grantSubscriptionFromQuote(profileId, quote, source = 'free_month_promo') {
    const promoLimit = promoUseLimitForProfile(quote.promo, profileId);
    if (!promoLimit.allowed) {
      const error = new Error('Ce code a déjà été utilisé par ce compte.');
      error.statusCode = 409;
      error.code = 'promo_already_used';
      throw error;
    }
    const startFrom = getActiveSubscription(store, profileId)?.expiresAt || nowIso();
    const startsAt = new Date(Math.max(Date.now(), new Date(startFrom).getTime())).toISOString();
    const totalDays = quote.free ? Number(quote.accessDays || quote.bonusDays || 30) : Number(quote.plan.durationDays || 0);
    const expiresAt = new Date(new Date(startsAt).getTime() + totalDays * 24 * 60 * 60 * 1000).toISOString();
    const subscription = {
      id: makeId('sub'),
      profileId,
      planId: quote.free ? 'free_month_code' : quote.plan.id,
      promoCode: quote.promo?.code || '',
      amountCents: quote.amountDueCents,
      startedAt: startsAt,
      expiresAt,
      source,
    };
    store.subscriptions.push(subscription);
    const purchase = { id: makeId('purchase'), profileId, planId: quote.plan.id, promoCode: quote.promo?.code || '', amountCents: quote.amountDueCents, commissionCents: quote.commissionCents, createdAt: nowIso(), source };
    store.purchases.push(purchase);
    if (quote.promo) {
      quote.promo.uses = Array.isArray(quote.promo.uses) ? quote.promo.uses : [];
      quote.promo.uses.push({ id: makeId('use'), profileId, planId: quote.plan.id, amountCents: quote.amountDueCents, commissionCents: quote.commissionCents, createdAt: nowIso(), source });
    }
    // Email de confirmation + reçu (remerciement) — envoi best-effort, n'interrompt pas l'activation.
    try {
      const user = (store.authUsers || []).find((u) => u.profileId === profileId);
      const profile = getProfile(store, profileId);
      if (user?.email) {
        sendSubscriptionEmail(user.email, {
          pseudo: profile?.pseudo || '',
          planName: quote.free ? 'Mois offert' : (quote.plan?.label || quote.plan?.name || quote.plan?.title || 'Abonnement'),
          amountLabel: quote.amountLabel || `${(Number(quote.amountDueCents || 0) / 100).toFixed(2).replace('.', ',')} €`,
          startedAt: startsAt,
          expiresAt,
          reference: purchase.id,
          promoCode: quote.promo?.code || '',
          free: Boolean(quote.free),
        }).catch((err) => console.error('Envoi email abonnement:', err.message));
      }
    } catch (err) { console.error('Préparation email abonnement:', err.message); }
    return { subscription, purchase, totalDays };
  }

  app.post('/api/subscriptions/activate', (req, res) => {
    const quote = quoteSubscription(store, req.body?.planId, req.body?.promoCode);
    if (!quote) return res.status(404).json({ error: 'plan_not_found', message: 'Formule introuvable.' });

    if (!quote.free && !isDemoPaidActivationAllowed()) {
      return res.status(402).json({
        error: 'payment_provider_required',
        message: 'Paiement réel requis. En production, l’abonnement payant doit être activé uniquement après confirmation serveur du prestataire de paiement.',
        quote: { amountDueCents: quote.amountDueCents, amountLabel: quote.amountLabel, planId: quote.plan.id, promoCode: quote.promo?.code || '' },
      });
    }

    const source = quote.free ? 'free_month_promo' : 'demo_paid_activation_enabled';
    let purchase;
    let totalDays;
    try {
      ({ purchase, totalDays } = grantSubscriptionFromQuote(req.currentProfile.id, quote, source));
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.code || 'subscription_activation_failed', message: error.message || 'Activation impossible.' });
    }
    res.status(201).json({
      subscription: serializeSubscription(store, req.currentProfile.id),
      purchase,
      message: quote.free
        ? `Code gratuit validé : accès ${totalDays} jours activé sans paiement.`
        : 'Abonnement payant activé uniquement parce que ENABLE_DEMO_PAID_ACTIVATION=true.',
    });
  });

  app.post('/api/payments/create-checkout-session', async (req, res) => {
    const quote = quoteSubscription(store, req.body?.planId, req.body?.promoCode);
    if (!quote) return res.status(404).json({ error: 'plan_not_found', message: 'Formule introuvable.' });
    if (quote.free) return res.status(400).json({ error: 'free_code_no_checkout', message: 'Ce code offre un accès gratuit. Utilisez l’activation gratuite, sans paiement.' });
    if (!paymentProviderConfigured()) {
      return res.status(501).json({
        error: 'payment_provider_not_configured',
        message: 'Prestataire de paiement non configuré. Brancher Stripe Checkout ou équivalent avec webhooks signés avant la production.',
        quote: { amountDueCents: quote.amountDueCents, amountLabel: quote.amountLabel, planId: quote.plan.id, promoCode: quote.promo?.code || '' },
      });
    }
    if (!isStripeProvider()) {
      return res.status(501).json({ error: 'payment_provider_unsupported', message: `Le prestataire « ${process.env.PAYMENT_PROVIDER} » n'a pas d'intégration checkout. Seul Stripe est branché.` });
    }

    const returnUrls = paymentReturnUrls();
    if (!returnUrls.success || !returnUrls.cancel) {
      return res.status(500).json({ error: 'payment_return_urls_missing', message: 'PUBLIC_BASE_URL ou PAYMENT_SUCCESS_URL/PAYMENT_CANCEL_URL doivent être configurés pour les redirections de paiement.' });
    }

    try {
      const session = await createStripeCheckoutSession({
        quote,
        profileId: req.currentProfile.id,
        profileEmail: req.currentUser?.email || '',
        returnUrls,
      });
      // On ne crée l'abonnement QUE depuis le webhook signé, jamais ici :
      // créer l'accès avant confirmation de paiement serait une faille.
      return res.status(201).json({
        sessionId: session.id,
        checkoutUrl: session.url,
        quote: { amountDueCents: quote.amountDueCents, amountLabel: quote.amountLabel, planId: quote.plan.id, promoCode: quote.promo?.code || '' },
        message: 'Session de paiement créée. Redirigez l’utilisateur vers checkoutUrl.',
      });
    } catch (error) {
      return res.status(error.statusCode || 502).json({ error: error.code || 'checkout_failed', message: error.message || 'Création de la session de paiement impossible.' });
    }
  });

  app.get('/api/influencer/:token', (req, res) => {
    const promo = (store.promoCodes || []).find((item) => item.token && item.token === req.params.token);
    if (!promo) return res.status(404).json({ error: 'influencer_link_not_found', message: 'Lien influenceur introuvable.' });
    const safe = serializePromo(store, promo);
    res.json({ influencer: { name: promo.influencerName, code: promo.code }, stats: { useCount: safe.useCount, revenueCents: safe.revenueCents, commissionCents: safe.commissionCents, revenueLabel: safe.revenueLabel, commissionLabel: safe.commissionLabel }, uses: (promo.uses || []).map((use) => ({ planId: use.planId, amountCents: use.amountCents, commissionCents: use.commissionCents, createdAt: use.createdAt })) });
  });


  function makeAdminManagedProfile({ pseudo, role = 'member', type = 'Homme', city = 'Paris', age = 30, hidden = false, verified = false }) {
    const cleanPseudo = limitText(pseudo || (role === 'admin' ? 'Administrateur' : 'Nouveau membre'), MAX_TEXT.pseudo) || (role === 'admin' ? 'Administrateur' : 'Nouveau membre');
    const cleanType = limitText(type || (role === 'admin' ? 'Admin' : 'Homme'), 60) || 'Homme';
    const cleanCity = limitText(city || 'Paris', MAX_TEXT.city) || 'Paris';
    const cleanAge = Math.max(VALIDATION.minAge, Math.min(VALIDATION.maxAge, Number(age || 30)));
    const details = makeDetails({ relationshipStatus: role === 'admin' ? 'Administration' : 'Non renseigné' });
    const members = sanitizeProfileMembers([], cleanType, cleanAge, details);
    const profile = {
      id: role === 'admin' && !(store.profiles || []).some((item) => item.id === 'admin') ? 'admin' : makeId('profile'),
      pseudo: cleanPseudo,
      type: cleanType,
      age: cleanAge,
      city: cleanCity,
      distanceKm: 0,
      location: { ...getCityCoords(cleanCity), precision: 'approximate_city' },
      verified: Boolean(verified || role === 'admin'),
      hidden: Boolean(hidden || role === 'admin'),
      online: false,
      role,
      avatarTone: role === 'admin' ? 'gold' : pickAvatarTone(cleanType),
      profilePhotoUrl: defaultProfilePhoto(cleanPseudo || 'AS'),
      category: cleanType,
      genderCategory: cleanType,
      orientation: role === 'admin' ? 'Administration' : cleanType,
      details,
      members,
      memberCount: members.length,
      ageDisplay: `${cleanAge} ans`,
      headline: role === 'admin' ? 'Compte administrateur de la plateforme.' : 'Profil créé depuis l’administration.',
      bio: role === 'admin' ? 'Compte réservé à la gestion, la modération et la conformité.' : 'Profil créé par un administrateur. À compléter par l’utilisateur.',
      interests: role === 'admin' ? ['Administration', 'Modération', 'Sécurité'] : ['Discrétion', 'Respect', 'Dialogue'],
      lookingFor: ['Profils respectueux'],
      limits: ['Consentement clair', 'Pas d’insistance'],
      publicPhotos: role === 'admin' ? [] : ['Photo publique à ajouter'],
      privateAlbum: { count: 0, label: 'Album privé', description: 'Galerie privée à compléter.' },
      privacy: { approximateLocation: true, blurredByDefault: true, screenshotsWarning: true },
      lastSeen: 'Jamais connecté',
      createdAt: nowIso(),
    };
    ensureLocation(profile);
    ensureAlbums(profile);
    return profile;
  }

  function findAdminManagedUser(identifier) {
    const id = String(identifier || '').trim();
    if (!id) return null;
    return (store.authUsers || []).find((user) => user.id === id || user.profileId === id || normalizeEmail(user.email) === normalizeEmail(id)) || null;
  }

  function serializeAdminManagedUser(user, currentAdminUserId = '', viewerProfileId = '') {
    if (!user) return null;
    const profile = getProfile(store, user.profileId);
    const activeSub = getActiveSubscription(store, user.profileId);
    const userSubscriptions = (store.subscriptions || []).filter((sub) => sub.profileId === user.profileId);
    const userSessions = (store.sessions || []).filter((session) => session.userId === user.id && new Date(session.expiresAt).getTime() > Date.now());
    const relatedReports = (store.reports || []).filter((report) => report.reporterId === user.profileId || report.targetId === user.profileId);
    const userWarnings = moderationWarningsFor(store, user.profileId);
    const messages = (store.conversations || [])
      .filter((conversation) => (conversation.participantIds || []).includes(user.profileId))
      .flatMap((conversation) => conversation.messages || []);
    return {
      id: user.id,
      email: user.email,
      profileId: user.profileId,
      role: user.role || 'member',
      createdAt: user.createdAt,
      createdBy: user.createdBy || '',
      profile: publicProfile(profile, viewerProfileId, store, { shallow: true }),
      hidden: Boolean(profile?.hidden),
      verified: Boolean(profile?.verified),
      isInfluencer: Boolean(profile?.influencer?.enabled),
      suspended: Boolean(profile?.suspendedUntil && new Date(profile.suspendedUntil).getTime() > Date.now()),
      suspendedUntil: profile?.suspendedUntil || null,
      suspendedReason: profile?.suspendedReason || '',
      online: Boolean(profile?.online),
      lastSeen: profile?.lastSeen || 'Jamais connecté',
      city: profile?.city || '',
      type: profile?.type || '',
      subscription: activeSub ? { ...activeSub, plan: getPlan(activeSub.planId) || null } : null,
      subscriptionActive: Boolean(activeSub),
      subscriptionCount: userSubscriptions.length,
      notificationPreferences: notificationPreferencesFor(profile),
      clientStatus: clientStatusFor(profile),
      notificationsEnabled: Boolean(clientStatusFor(profile).notificationsEnabled),
      appInstalled: Boolean(clientStatusFor(profile).appInstalled),
      reportCount: relatedReports.length,
      openReportCount: relatedReports.filter((report) => report.status === 'new' || report.status === 'reviewing').length,
      warningCount: userWarnings.length,
      activeWarningCount: userWarnings.filter((warning) => !warning.acknowledgedAt).length,
      lastWarning: userWarnings[0] || null,
      sessionCount: userSessions.length,
      messageCount: messages.length,
      status: profile?.hidden ? 'masqué' : activeSub ? 'abonné' : 'gratuit',
      canChangeRole: user.id !== currentAdminUserId,
      canDelete: user.id !== currentAdminUserId,
    };
  }

  function grantManualSubscription(profileId, planId = '30d', days = 30, grantedBy = 'admin') {
    const plan = getPlan(planId) || SUBSCRIPTION_PLANS[0];
    const safeDays = Math.max(1, Math.min(3650, Number(days || plan?.durationDays || 30)));
    const active = getActiveSubscription(store, profileId);
    const startsAt = new Date(Math.max(Date.now(), new Date(active?.expiresAt || nowIso()).getTime())).toISOString();
    const expiresAt = new Date(new Date(startsAt).getTime() + safeDays * 24 * 60 * 60 * 1000).toISOString();
    const subscription = {
      id: makeId('sub'),
      profileId,
      planId: plan?.id || planId || 'manual_admin',
      promoCode: '',
      amountCents: 0,
      startedAt: startsAt,
      expiresAt,
      source: 'admin_manual_grant',
      grantedBy,
    };
    store.subscriptions.push(subscription);
    store.purchases.push({ id: makeId('purchase'), profileId, planId: subscription.planId, promoCode: '', amountCents: 0, commissionCents: 0, createdAt: nowIso(), source: 'admin_manual_grant' });
    return subscription;
  }


  function serializeInfluencerForAdmin(profileId, viewerProfileId = '') {
    const profile = getProfile(store, profileId);
    if (!profile) return null;
    const user = (store.authUsers || []).find((item) => item.profileId === profileId) || null;
    const settings = profile.influencer || {};
    const codes = (store.promoCodes || []).filter((promo) => promo.influencerProfileId === profileId);
    const uses = codes.flatMap((promo) => (promo.uses || []).map((use) => ({ ...use, code: promo.code, promoId: promo.id })));
    const revenueCents = uses.reduce((sum, use) => sum + Number(use.amountCents || 0), 0);
    const commissionCents = uses.reduce((sum, use) => sum + Number(use.commissionCents || 0), 0);
    const lastUseAt = uses.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]?.createdAt || '';
    return {
      profileId,
      userId: user?.id || '',
      email: settings.email || user?.email || '',
      pseudo: settings.displayName || profile.pseudo || 'Influenceur',
      profile: publicProfile(profile, viewerProfileId, store, { shallow: true }),
      active: settings.enabled !== false,
      createdAt: settings.createdAt || codes[0]?.createdAt || profile.createdAt || '',
      updatedAt: settings.updatedAt || '',
      notes: settings.notes || '',
      commissionRate: Number(settings.commissionRate ?? codes[0]?.commissionRate ?? 20),
      codesCount: codes.length,
      activeCodes: codes.filter((promo) => promo.active).length,
      useCount: uses.length,
      revenueCents,
      revenueLabel: formatEuroCents(revenueCents),
      commissionCents,
      commissionLabel: formatEuroCents(commissionCents),
      netRevenueCents: Math.max(0, revenueCents - commissionCents),
      netRevenueLabel: formatEuroCents(Math.max(0, revenueCents - commissionCents)),
      lastUseAt,
      codes: codes.map((promo) => serializePromo(store, promo)),
    };
  }

  app.get('/api/admin/overview', requireAdmin, (req, res) => {
    const now = Date.now();
    const profiles = store.profiles || [];
    const publicProfiles = profiles.filter((profile) => !profile.hidden);
    const users = store.authUsers || [];
    const sessions = store.sessions || [];
    const subscriptions = store.subscriptions || [];
    const purchases = store.purchases || [];
    const promoCodes = store.promoCodes || [];
    const reports = store.reports || [];
    const moderationWarnings = store.moderationWarnings || [];
    const moderationActions = store.moderationActions || [];
    const conversations = store.conversations || [];
    const notifications = store.notifications || [];
    const albumAccess = store.albumAccess || [];
    const profileLikes = store.profileLikes || [];
    const profilePasses = store.profilePasses || [];
    const profileViews = store.profileViews || [];
    const blockedProfiles = store.blockedProfiles || [];
    const ageVerifications = store.ageVerifications || [];
    const legalAcceptances = store.legalAcceptances || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last7 = now - 7 * 24 * 60 * 60 * 1000;
    const last30 = now - 30 * 24 * 60 * 60 * 1000;
    const isAfter = (date, limit) => date && new Date(date).getTime() >= limit;
    const activeSubscriptions = subscriptions.filter((sub) => new Date(sub.expiresAt).getTime() > now);
    const expiredSubscriptions = subscriptions.filter((sub) => new Date(sub.expiresAt).getTime() <= now);
    const activeSessions = sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
    const notificationEnabledProfiles = profiles.filter((profile) => clientStatusFor(profile).notificationsEnabled).length;
    const installedAppProfiles = profiles.filter((profile) => clientStatusFor(profile).appInstalled).length;
    const allMessages = conversations.flatMap((conversation) => conversation.messages || []);
    const unreadMessages = allMessages.filter((message) => !message.read).length;
    const albums = profiles.flatMap((profile) => ensureAlbums(profile).map((album) => ({ ...album, ownerId: profile.id })));
    const mediaItems = albums.flatMap((album) => (album.items || []).map((media) => ({ ...media, albumId: album.id, ownerId: album.ownerId })));
    const deletedMedia = store.deletedMedia || [];
    const purchaseRevenueCents = purchases.reduce((sum, purchase) => sum + Number(purchase.amountCents || 0), 0);
    const purchaseCommissionCents = purchases.reduce((sum, purchase) => sum + Number(purchase.commissionCents || 0), 0);
    const promoUseRevenueCents = promoCodes.reduce((sum, promo) => sum + (promo.uses || []).reduce((inner, use) => inner + Number(use.amountCents || 0), 0), 0);
    const promoUseCommissionCents = promoCodes.reduce((sum, promo) => sum + (promo.uses || []).reduce((inner, use) => inner + Number(use.commissionCents || 0), 0), 0);
    const revenueCents = purchaseRevenueCents || promoUseRevenueCents;
    const commissionCents = purchaseCommissionCents || promoUseCommissionCents;
    const todayRevenueCents = purchases.filter((purchase) => isAfter(purchase.createdAt, today.getTime())).reduce((sum, purchase) => sum + Number(purchase.amountCents || 0), 0);
    const last30RevenueCents = purchases.filter((purchase) => isAfter(purchase.createdAt, last30)).reduce((sum, purchase) => sum + Number(purchase.amountCents || 0), 0) || promoCodes.reduce((sum, promo) => sum + (promo.uses || []).filter((use) => isAfter(use.createdAt, last30)).reduce((inner, use) => inner + Number(use.amountCents || 0), 0), 0);
    const expectedActiveRevenueCents = activeSubscriptions.reduce((sum, sub) => sum + Number(getPlan(sub.planId)?.priceCents || 0), 0);
    const conversionRate = users.length ? Math.round((activeSubscriptions.length / users.length) * 1000) / 10 : 0;
    const planDistribution = SUBSCRIPTION_PLANS.map((plan) => {
      const activeCount = activeSubscriptions.filter((sub) => sub.planId === plan.id).length;
      const totalCount = subscriptions.filter((sub) => sub.planId === plan.id).length;
      const purchaseCount = purchases.filter((purchase) => purchase.planId === plan.id).length;
      const revenue = purchases.filter((purchase) => purchase.planId === plan.id).reduce((sum, purchase) => sum + Number(purchase.amountCents || 0), 0);
      return { id: plan.id, label: plan.label, priceCents: plan.priceCents, activeCount, totalCount, purchaseCount, revenueCents: revenue, revenueLabel: formatEuroCents(revenue) };
    });
    const revenueByPlan = planDistribution.filter((plan) => plan.totalCount || plan.purchaseCount || plan.activeCount);
    const revenueByCode = promoCodes.map((promo) => serializePromo(store, promo)).sort((a, b) => Number(b.revenueCents || 0) - Number(a.revenueCents || 0));
    const typeBreakdown = PROFILE_CATEGORIES.map((type) => ({ type, count: publicProfiles.filter((profile) => profile.type === type || profile.category === type).length })).filter((item) => item.count > 0);
    const cityBreakdown = Object.entries(publicProfiles.reduce((acc, profile) => {
      const city = profile.city || 'Non renseignée';
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {})).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count).slice(0, 8);
    const topProfiles = publicProfiles.map((profile) => {
      const counters = socialCountersFor(store, profile.id);
      return {
        id: profile.id,
        pseudo: profile.pseudo,
        type: profile.type,
        city: profile.city,
        verified: Boolean(profile.verified),
        online: Boolean(profile.online),
        followerCount: counters.followerCount,
        followingCount: counters.followingCount,
        receivedHearts: counters.receivedHearts,
        sentHearts: counters.sentHearts,
        viewCount: (store.profileViews || []).filter((view) => view.profileId === profile.id || view.targetId === profile.id).length,
      };
    }).sort((a, b) => (b.receivedHearts + b.followerCount + b.viewCount) - (a.receivedHearts + a.followerCount + a.viewCount)).slice(0, 10);
    const recentPurchases = purchases.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 12).map((purchase) => ({
      ...purchase,
      amountLabel: formatEuroCents(purchase.amountCents || 0),
      commissionLabel: formatEuroCents(purchase.commissionCents || 0),
      profile: publicProfile(getProfile(store, purchase.profileId), req.currentProfile?.id, store, { shallow: true }),
      plan: getPlan(purchase.planId) || null,
    }));
    const recentPromoUses = promoCodes.flatMap((promo) => (promo.uses || []).map((use) => ({
      ...use,
      code: promo.code,
      influencerName: promo.influencerName || '',
      amountLabel: formatEuroCents(use.amountCents || 0),
      commissionLabel: formatEuroCents(use.commissionCents || 0),
      profile: publicProfile(getProfile(store, use.profileId), req.currentProfile?.id, store, { shallow: true }),
      plan: getPlan(use.planId) || null,
    }))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 12);
    const enrichedReports = reports.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((report) => serializeReportForAdmin(store, report, req.currentProfile?.id));
    const recentWarnings = moderationWarnings.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 50).map((warning) => ({
      ...warning,
      profile: publicProfile(getProfile(store, warning.profileId), req.currentProfile?.id, store, { shallow: true }),
      admin: publicProfile(getProfile(store, warning.adminId), req.currentProfile?.id, store, { shallow: true }),
    }));
    const recentModerationActions = moderationActions.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 50).map((action) => ({
      ...action,
      profile: publicProfile(getProfile(store, action.profileId || action.targetId), req.currentProfile?.id, store, { shallow: true }),
      admin: publicProfile(getProfile(store, action.adminId), req.currentProfile?.id, store, { shallow: true }),
    }));
    const adminUsers = users
      .map((user) => serializeAdminManagedUser(user, req.currentUser?.id, req.currentProfile?.id))
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const influencerProfileIds = Array.from(new Set([
      ...profiles.filter((profile) => profile.influencer?.enabled || profile.influencer?.createdAt).map((profile) => profile.id),
      ...promoCodes.map((promo) => promo.influencerProfileId).filter(Boolean),
    ]));
    const influencers = influencerProfileIds
      .map((profileId) => serializeInfluencerForAdmin(profileId, req.currentProfile?.id))
      .filter(Boolean)
      .sort((a, b) => Number(b.revenueCents || 0) - Number(a.revenueCents || 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      stats: {
        users: users.length,
        newUsers7d: users.filter((user) => isAfter(user.createdAt, last7)).length,
        newUsers30d: users.filter((user) => isAfter(user.createdAt, last30)).length,
        profiles: profiles.length,
        visibleProfiles: publicProfiles.length,
        hiddenProfiles: profiles.filter((profile) => profile.hidden).length,
        verifiedProfiles: publicProfiles.filter((profile) => profile.verified).length,
        onlineProfiles: publicProfiles.filter((profile) => profile.online).length,
        reports: reports.length,
        openReports: reports.filter((report) => report.status === 'new' || report.status === 'reviewing').length,
        urgentReports: reports.filter((report) => (report.priority || reportPriority(report.category || 'Autre', report.reason || '')) === 'urgent' && report.status !== 'resolved' && report.status !== 'dismissed').length,
        resolvedReports: reports.filter((report) => report.status === 'resolved').length,
        moderationWarnings: moderationWarnings.length,
        activeSessions: activeSessions.length,
        notificationEnabledProfiles,
        installedAppProfiles,
        ageVerifications: ageVerifications.length,
        legalAcceptances: legalAcceptances.length,
        subscriptions: subscriptions.length,
        activeSubscriptions: activeSubscriptions.length,
        expiredSubscriptions: expiredSubscriptions.length,
        promoCodes: promoCodes.length,
        activePromoCodes: promoCodes.filter((promo) => promo.active).length,
        promoRevenueCents: revenueCents,
      },
      finance: {
        revenueCents,
        revenueLabel: formatEuroCents(revenueCents),
        todayRevenueCents,
        todayRevenueLabel: formatEuroCents(todayRevenueCents),
        last30RevenueCents,
        last30RevenueLabel: formatEuroCents(last30RevenueCents),
        commissionCents,
        commissionLabel: formatEuroCents(commissionCents),
        netRevenueCents: Math.max(0, revenueCents - commissionCents),
        netRevenueLabel: formatEuroCents(Math.max(0, revenueCents - commissionCents)),
        expectedActiveRevenueCents,
        expectedActiveRevenueLabel: formatEuroCents(expectedActiveRevenueCents),
        purchaseCount: purchases.length,
        paidPurchaseCount: purchases.filter((purchase) => Number(purchase.amountCents || 0) > 0).length,
        freeActivationCount: subscriptions.filter((sub) => String(sub.source || '').includes('free') || String(sub.planId || '').includes('free')).length,
        conversionRate,
        averageOrderCents: purchases.length ? Math.round(purchaseRevenueCents / purchases.length) : 0,
        averageOrderLabel: formatEuroCents(purchases.length ? Math.round(purchaseRevenueCents / purchases.length) : 0),
        planDistribution,
        revenueByPlan,
        revenueByCode,
      },
      community: {
        typeBreakdown,
        cityBreakdown,
        topProfiles,
        followers: (store.followers || []).length,
        profileLikes: profileLikes.length,
        profilePasses: profilePasses.length,
        profileViews: profileViews.length,
        blockedProfiles: blockedProfiles.length,
        pendingVerificationRequests: (store.verificationRequests || []).filter((request) => request.status === 'pending').length,
      },
      activity: {
        conversations: conversations.length,
        messages: allMessages.length,
        unreadMessages,
        notifications: notifications.length,
        unreadNotifications: notifications.filter((notification) => !notification.read).length,
        albumRequests: albumAccess.length,
        pendingAlbumRequests: albumAccess.filter((access) => access.status === 'requested').length,
        grantedAlbumRequests: albumAccess.filter((access) => access.status === 'granted').length,
        albums: albums.length,
        publicAlbums: albums.filter((album) => album.visibility === 'public').length,
        privateAlbums: albums.filter((album) => album.visibility === 'private').length,
        media: mediaItems.length,
        photos: mediaItems.filter((media) => media.type !== 'video').length,
        videos: mediaItems.filter((media) => media.type === 'video').length,
      },
      moderation: {
        reports: reports.length,
        openReports: reports.filter((report) => report.status === 'new' || report.status === 'reviewing').length,
        newReports: reports.filter((report) => report.status === 'new').length,
        reviewingReports: reports.filter((report) => report.status === 'reviewing').length,
        urgentReports: reports.filter((report) => (report.priority || reportPriority(report.category || 'Autre', report.reason || '')) === 'urgent' && report.status !== 'resolved' && report.status !== 'dismissed').length,
        resolvedReports: reports.filter((report) => report.status === 'resolved').length,
        dismissedReports: reports.filter((report) => report.status === 'dismissed').length,
        warnings: moderationWarnings.length,
        activeWarnings: moderationWarnings.filter((warning) => !warning.acknowledgedAt).length,
        actions: moderationActions.length,
        blockedProfiles: blockedProfiles.length,
      },
      subscriptionPlans: SUBSCRIPTION_PLANS,
      legalChecklist: store.legalChecklist,
      legalDocuments: LEGAL_DOCUMENTS,
      legalVersion: LEGAL_VERSION,
      mediaRetention: mediaRetentionSummary(store),
      database: { type: persistence.type, path: persistence.path, warning: persistence.warning || null },
      admin: {
        email: adminEmailFromEnv(),
        configured: hasSafeConfiguredAdmin(),
        bootstrap: shouldUseBootstrapAdmin(),
        warnings: productionConfigWarnings(),
      },
      security: {
        productionWarnings: productionConfigWarnings(),
        ageVerificationProvider: ageVerificationProvider(),
        ageVerificationMode: requiresServerAgeVerification() ? 'provider' : 'declaration_only',
        demoPaidActivation: isDemoPaidActivationAllowed(),
      },
      promoCodes: revenueByCode,
      influencers,
      purchases: recentPurchases,
      promoUses: recentPromoUses,
      reports: enrichedReports,
      verificationRequests: (store.verificationRequests || []).slice().sort((a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0)).map((request) => serializeVerificationRequestForAdmin(store, request, req.currentProfile.id)),
      moderationWarnings: recentWarnings,
      moderationActions: recentModerationActions,
      reportCategories: REPORT_CATEGORIES,
      users: adminUsers,
    });
  });

  app.post('/api/admin/media-retention/purge', requireAdmin, (req, res) => {
    const result = pruneExpiredRemovedMedia(store);
    if (result.changed) persistence.persist(store);
    res.json({
      ok: true,
      ...result,
      message: result.purgedNow
        ? `${result.purgedNow} média(s) supprimé(s) définitivement.`
        : result.failedNow
          ? 'Aucun média supprimé définitivement. Certains fichiers n’ont pas pu être purgés.'
          : 'Aucun média éligible à la purge pour le moment.',
    });
  });


  app.post('/api/admin/users', requireAdmin, (req, res) => {
    const role = req.body?.role === 'admin' ? 'admin' : 'member';
    const email = normalizeEmail(req.body?.email);
    const suppliedPassword = String(req.body?.password || '');
    const generatedPassword = suppliedPassword ? '' : crypto.randomBytes(12).toString('base64url');
    const password = suppliedPassword || generatedPassword;
    const pseudo = limitText(req.body?.pseudo || (role === 'admin' ? 'Administrateur' : ''), MAX_TEXT.pseudo);
    const type = role === 'admin' ? limitText(req.body?.type || 'Admin', 60) : limitText(req.body?.type || 'Homme', 60);
    const city = limitText(req.body?.city || 'Paris', MAX_TEXT.city);
    const age = Number(req.body?.age || 30);
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'invalid_email', message: 'Adresse email admin/utilisateur invalide.' });
    if (!pseudo) return res.status(400).json({ error: 'pseudo_required', message: 'Pseudo obligatoire.' });
    if (password.length < VALIDATION.minPasswordLength) return res.status(400).json({ error: 'password_too_short', message: `Mot de passe minimum ${VALIDATION.minPasswordLength} caractères.` });
    if (role === 'admin' && !isStrongAdminPassword(password)) return res.status(400).json({ error: 'admin_password_too_weak', message: `Mot de passe admin minimum ${ADMIN_PASSWORD_MIN_LENGTH} caractères, non générique.` });
    if ((store.authUsers || []).some((user) => normalizeEmail(user.email) === email)) return res.status(409).json({ error: 'email_exists', message: 'Un compte existe déjà avec cet email.' });
    if (process.env.NODE_ENV === 'production' && role === 'admin' && password === DEFAULT_ADMIN_PASSWORD) {
      return res.status(400).json({ error: 'unsafe_admin_password', message: 'Mot de passe admin historique interdit en production.' });
    }
    const profile = makeAdminManagedProfile({
      pseudo,
      role,
      type,
      city,
      age,
      hidden: role === 'admin' ? true : Boolean(req.body?.hidden),
      verified: Boolean(req.body?.verified || role === 'admin'),
    });
    store.profiles.push(profile);
    const user = {
      id: role === 'admin' && profile.id === 'admin' && !(store.authUsers || []).some((item) => item.id === 'auth_admin') ? 'auth_admin' : makeId('auth'),
      profileId: profile.id,
      email,
      passwordHash: hashPassword(password),
      role,
      createdAt: nowIso(),
      createdBy: req.currentProfile?.id || '',
    };
    store.authUsers.push(user);
    if (Boolean(req.body?.grantPremium)) {
      grantManualSubscription(profile.id, req.body?.planId || '30d', Number(req.body?.premiumDays || 30), req.currentProfile?.id || 'admin');
    }
    res.status(201).json({
      user: serializeAdminManagedUser(user, req.currentUser?.id, req.currentProfile?.id),
      temporaryPassword: generatedPassword || undefined,
      message: role === 'admin' ? 'Compte administrateur créé.' : 'Compte utilisateur créé.',
    });
  });

  app.patch('/api/admin/users/:userId', requireAdmin, (req, res) => {
    const user = findAdminManagedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'user_not_found', message: 'Utilisateur introuvable.' });
    const profile = getProfile(store, user.profileId);
    if (!profile) return res.status(404).json({ error: 'profile_not_found', message: 'Profil introuvable.' });
    if (req.body?.email !== undefined) {
      const email = normalizeEmail(req.body.email);
      if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'invalid_email', message: 'Adresse email invalide.' });
      if ((store.authUsers || []).some((item) => item.id !== user.id && normalizeEmail(item.email) === email)) return res.status(409).json({ error: 'email_exists', message: 'Un autre compte utilise déjà cet email.' });
      user.email = email;
    }
    if (req.body?.role !== undefined) {
      const role = req.body.role === 'admin' ? 'admin' : 'member';
      if (user.id === req.currentUser?.id && role !== 'admin') return res.status(400).json({ error: 'cannot_demote_self', message: 'Impossible de retirer ton propre rôle admin.' });
      user.role = role;
      profile.role = role;
      if (role === 'admin') profile.hidden = true;
    }
    if (req.body?.pseudo !== undefined) profile.pseudo = limitText(req.body.pseudo, MAX_TEXT.pseudo) || profile.pseudo;
    if (req.body?.city !== undefined) {
      profile.city = limitText(req.body.city, MAX_TEXT.city) || profile.city;
      profile.location = { ...getCityCoords(profile.city), precision: 'approximate_city' };
    }
    if (req.body?.type !== undefined) {
      const type = limitText(req.body.type, 60) || profile.type;
      profile.type = type;
      profile.category = type;
      profile.genderCategory = type;
      profile.members = sanitizeProfileMembers(profile.members, type, profile.age || 30, profile.details || {});
      profile.memberCount = profile.members.length;
      profile.ageDisplay = memberAgeSummary(profile);
    }
    if (req.body?.verified !== undefined) profile.verified = Boolean(req.body.verified);
    if (req.body?.hidden !== undefined) {
      if (user.role === 'admin' && Boolean(req.body.hidden) === false) return res.status(400).json({ error: 'admin_profile_must_stay_hidden', message: 'Un profil administrateur reste masqué de la découverte.' });
      profile.hidden = Boolean(req.body.hidden);
    }
    res.json({ user: serializeAdminManagedUser(user, req.currentUser?.id, req.currentProfile?.id), message: 'Compte mis à jour.' });
  });

  app.post('/api/admin/users/:userId/password', requireAdmin, (req, res) => {
    const user = findAdminManagedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'user_not_found', message: 'Utilisateur introuvable.' });
    const suppliedPassword = String(req.body?.password || '');
    const generatedPassword = suppliedPassword ? '' : crypto.randomBytes(12).toString('base64url');
    const password = suppliedPassword || generatedPassword;
    if (password.length < VALIDATION.minPasswordLength) return res.status(400).json({ error: 'password_too_short', message: `Mot de passe minimum ${VALIDATION.minPasswordLength} caractères.` });
    if (user.role === 'admin' && !isStrongAdminPassword(password)) return res.status(400).json({ error: 'admin_password_too_weak', message: `Mot de passe admin minimum ${ADMIN_PASSWORD_MIN_LENGTH} caractères, non générique.` });
    if (process.env.NODE_ENV === 'production' && user.role === 'admin' && password === DEFAULT_ADMIN_PASSWORD) {
      return res.status(400).json({ error: 'unsafe_admin_password', message: 'Mot de passe admin historique interdit en production.' });
    }
    user.passwordHash = hashPassword(password);
    delete user.password;
    store.sessions = (store.sessions || []).filter((session) => session.userId !== user.id);
    res.json({ temporaryPassword: generatedPassword || undefined, message: generatedPassword ? 'Mot de passe temporaire généré et sessions révoquées.' : 'Mot de passe changé et sessions révoquées.' });
  });

  app.post('/api/admin/users/:userId/message', requireAdmin, (req, res) => {
    const user = findAdminManagedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'user_not_found', message: 'Utilisateur introuvable.' });
    const target = getProfile(store, user.profileId);
    const body = limitText(req.body?.message || req.body?.body, MAX_TEXT.message);
    if (!target) return res.status(404).json({ error: 'profile_not_found', message: 'Profil introuvable.' });
    if (!body) return res.status(400).json({ error: 'message_required', message: 'Message obligatoire.' });
    const result = pushConversationMessage(store, req.currentProfile.id, target.id, body, { kind: 'support', support: true, fromAdmin: true });
    createNotification(store, target.id, 'support_reply', req.currentProfile.id, 'Réponse du support', 'Le support vous a envoyé un message.', { conversationWith: req.currentProfile.id, support: true });
    res.status(201).json({ conversation: serializeConversation(store, result.conversation, req.currentProfile.id), user: serializeAdminManagedUser(user, req.currentUser?.id, req.currentProfile?.id), message: 'Message support envoyé.' });
  });

  app.post('/api/admin/users/:userId/subscription', requireAdmin, (req, res) => {
    const user = findAdminManagedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'user_not_found', message: 'Utilisateur introuvable.' });
    if (req.body?.action === 'revoke') {
      const now = nowIso();
      for (const sub of store.subscriptions || []) {
        if (sub.profileId === user.profileId && new Date(sub.expiresAt).getTime() > Date.now()) {
          sub.expiresAt = now;
          sub.revokedAt = now;
          sub.revokedBy = req.currentProfile?.id || 'admin';
        }
      }
      return res.json({ user: serializeAdminManagedUser(user, req.currentUser?.id, req.currentProfile?.id), message: 'Abonnement actif révoqué.' });
    }
    const subscription = grantManualSubscription(user.profileId, req.body?.planId || '30d', Number(req.body?.days || 30), req.currentProfile?.id || 'admin');
    res.status(201).json({ subscription, user: serializeAdminManagedUser(user, req.currentUser?.id, req.currentProfile?.id), message: 'Accès premium accordé.' });
  });

  // Suspendre / bannir temporairement un compte, ou lever la suspension.
  app.post('/api/admin/users/:userId/suspend', requireAdmin, (req, res) => {
    const user = findAdminManagedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'user_not_found', message: 'Utilisateur introuvable.' });
    const profile = getProfile(store, user.profileId);
    if (!profile) return res.status(404).json({ error: 'profile_not_found', message: 'Profil introuvable.' });
    if (user.id === req.currentUser?.id) return res.status(400).json({ error: 'cannot_suspend_self', message: 'Impossible de te suspendre toi-même.' });
    if (user.role === 'admin') return res.status(400).json({ error: 'cannot_suspend_admin', message: 'Un compte administrateur ne peut pas être suspendu.' });
    if (req.body?.action === 'lift') {
      profile.suspendedUntil = null;
      profile.suspendedReason = '';
      profile.suspendedBy = '';
      return res.json({ user: serializeAdminManagedUser(user, req.currentUser?.id, req.currentProfile?.id), message: 'Suspension levée.' });
    }
    const days = Math.max(1, Math.min(3650, Number(req.body?.days || 7)));
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    profile.suspendedUntil = until;
    profile.suspendedReason = limitText(req.body?.reason || '', 200);
    profile.suspendedBy = req.currentProfile?.id || 'admin';
    profile.online = false;
    // Déconnexion immédiate du compte suspendu.
    store.sessions = (store.sessions || []).filter((session) => session.userId !== user.id);
    createNotification(store, profile.id, 'system', req.currentProfile.id, 'Compte suspendu', `Votre compte est suspendu jusqu'au ${new Date(until).toLocaleString('fr-FR')}.${profile.suspendedReason ? ' Motif : ' + profile.suspendedReason : ''}`, {});
    res.json({ user: serializeAdminManagedUser(user, req.currentUser?.id, req.currentProfile?.id), message: `Compte suspendu ${days} jour(s) et déconnecté.` });
  });

  app.delete('/api/admin/users/:userId/sessions', requireAdmin, (req, res) => {
    const user = findAdminManagedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'user_not_found', message: 'Utilisateur introuvable.' });
    if (user.id === req.currentUser?.id) return res.status(400).json({ error: 'cannot_revoke_self', message: 'Impossible de fermer ta session depuis cette action.' });
    const before = (store.sessions || []).length;
    store.sessions = (store.sessions || []).filter((session) => session.userId !== user.id);
    res.json({ revoked: before - store.sessions.length, message: 'Sessions utilisateur fermées.' });
  });

  // Suppression complète d'un utilisateur (RGPD admin ou modération)
  app.delete('/api/admin/users/:userId', requireAdmin, (req, res) => {
    const user = findAdminManagedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'user_not_found', message: 'Utilisateur introuvable.' });
    if (user.id === req.currentUser?.id) return res.status(400).json({ error: 'cannot_delete_self', message: 'Impossible de supprimer ton propre compte admin.' });
    const profileId = user.profileId;
    // Révoquer sessions
    store.sessions = (store.sessions || []).filter((s) => s.userId !== user.id);
    // Marquer médias pour rétention
    for (const profile of store.profiles || []) {
      for (const album of profile.albums || []) {
        const toRemove = (album.items || []).filter((m) => m.ownerId === profileId);
        for (const media of toRemove) trackRemovedMediaForRetention(store, media, { ownerId: profileId, albumId: album.id, reason: 'admin_account_deletion' });
        album.items = (album.items || []).filter((m) => m.ownerId !== profileId);
      }
    }
    // Anonymiser messages
    for (const conv of store.conversations || []) {
      for (const msg of conv.messages || []) {
        if (msg.fromId === profileId) { msg.fromId = '[supprimé]'; msg.body = '[Message d\'un compte supprimé]'; msg.deletedByAdmin = true; }
      }
    }
    // Nettoyer données sociales
    store.profileLikes = (store.profileLikes || []).filter((l) => l.fromId !== profileId && l.toId !== profileId);
    store.profilePasses = (store.profilePasses || []).filter((p) => p.fromId !== profileId && p.toId !== profileId);
    store.profileViews = (store.profileViews || []).filter((v) => v.viewerId !== profileId && v.profileId !== profileId);
    store.followers = (store.followers || []).filter((f) => f.followerId !== profileId && f.followingId !== profileId);
    store.blockedProfiles = (store.blockedProfiles || []).filter((b) => b.blockerId !== profileId && b.blockedId !== profileId);
    store.albumAccess = (store.albumAccess || []).filter((a) => a.viewerId !== profileId && a.ownerId !== profileId);
    store.notifications = (store.notifications || []).filter((n) => n.profileId !== profileId);
    // Supprimer profil + user
    store.profiles = (store.profiles || []).filter((p) => p.id !== profileId);
    store.authUsers = (store.authUsers || []).filter((u) => u.id !== user.id);
    persistence.persist(store);
    res.json({ ok: true, message: `Compte supprimé (${user.email}). Médias en rétention 6 mois.` });
  });

  // Liste paginée des membres avec filtres
  app.get('/api/admin/members', requireAdmin, (req, res) => {
    const page = Math.max(1, Number(req.query?.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query?.limit || 30)));
    const search = String(req.query?.search || '').trim().toLowerCase();
    const role = String(req.query?.role || '').trim();
    const status = String(req.query?.status || '').trim();
    const now = Date.now();
    let users = (store.authUsers || []).slice();
    if (search) users = users.filter((u) => u.email?.toLowerCase().includes(search) || getProfile(store, u.profileId)?.pseudo?.toLowerCase().includes(search));
    if (role) users = users.filter((u) => u.role === role);
    if (status === 'active') users = users.filter((u) => (store.subscriptions || []).some((s) => s.profileId === u.profileId && new Date(s.expiresAt).getTime() > now));
    if (status === 'free') users = users.filter((u) => !(store.subscriptions || []).some((s) => s.profileId === u.profileId && new Date(s.expiresAt).getTime() > now));
    users.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const total = users.length;
    const paged = users.slice((page - 1) * limit, page * limit);
    res.json({
      members: paged.map((u) => serializeAdminManagedUser(u, req.currentUser?.id, req.currentProfile?.id)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  });

  // Basculer visibilité d'un profil (masqué / visible)
  app.post('/api/admin/users/:userId/toggle-visibility', requireAdmin, (req, res) => {
    const user = findAdminManagedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'user_not_found', message: 'Utilisateur introuvable.' });
    const profile = getProfile(store, user.profileId);
    if (!profile) return res.status(404).json({ error: 'profile_not_found', message: 'Profil introuvable.' });
    if (user.role === 'admin') return res.status(400).json({ error: 'admin_always_hidden', message: 'Les profils admin restent toujours masqués.' });
    profile.hidden = !profile.hidden;
    persistence.persist(store);
    res.json({ hidden: profile.hidden, message: profile.hidden ? 'Profil masqué de la découverte.' : 'Profil rendu visible.' });
  });

  // Lire / modifier la configuration admin (vérification d'âge, paiements, promos)
  app.get('/api/admin/config', requireAdmin, (req, res) => {
    res.json({
      ageVerification: {
        enabled: envFlag('AGE_VERIFICATION_ENABLED', false),
        provider: ageVerificationProvider(),
        hasRealProvider: hasRealAgeVerificationProvider(),
        mode: requiresServerAgeVerification() ? 'provider' : 'declaration_only',
        note: 'Pour activer : ajouter AGE_VERIFICATION_ENABLED=true + AGE_VERIFICATION_PROVIDER=veriff dans les variables d\'environnement Render.',
      },
      payment: {
        configured: paymentProviderConfigured(),
        provider: String(process.env.PAYMENT_PROVIDER || 'non configuré'),
        demoActivationAllowed: isDemoPaidActivationAllowed(),
        note: 'Pour activer : PAYMENT_PROVIDER=stripe + STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET dans Render.',
      },
      subscriptions: {
        plans: SUBSCRIPTION_PLANS,
        seedPromoEnabled: seedWelcomePromoEnabled(),
        activePromos: (store.promoCodes || []).filter((p) => p.active).length,
      },
      security: {
        adminConfigured: hasSafeConfiguredAdmin(),
        bootstrapActive: shouldUseBootstrapAdmin(),
        productionWarnings: productionConfigWarnings(),
      },
    });
  });


app.post('/api/admin/profile-verifications/:requestId/approve', requireAdmin, (req, res) => {
  const request = (store.verificationRequests || []).find((item) => item.id === req.params.requestId);
  if (!request) return res.status(404).json({ error: 'verification_request_not_found', message: 'Demande de vérification introuvable.' });
  const profile = getProfile(store, request.profileId);
  if (!profile) return res.status(404).json({ error: 'profile_not_found', message: 'Profil introuvable.' });
  request.status = 'approved';
  request.reviewedAt = nowIso();
  request.reviewedBy = req.currentProfile.id;
  request.adminNote = limitText(req.body?.adminNote || '', 300);
  request.reason = '';
  profile.verified = true;
  profile.verifiedAt = nowIso();
  createNotification(store, profile.id, 'profile_verification', req.currentProfile.id, 'Profil vérifié', 'Votre profil a été validé par l’administration. Le badge de vérification est maintenant visible.', { requestId: request.id, status: 'approved' });
  persistence.persist(store);
  res.json({ request: serializeVerificationRequestForAdmin(store, request, req.currentProfile.id), message: 'Profil vérifié.' });
});

app.post('/api/admin/profile-verifications/:requestId/reject', requireAdmin, (req, res) => {
  const request = (store.verificationRequests || []).find((item) => item.id === req.params.requestId);
  if (!request) return res.status(404).json({ error: 'verification_request_not_found', message: 'Demande de vérification introuvable.' });
  const profile = getProfile(store, request.profileId);
  if (!profile) return res.status(404).json({ error: 'profile_not_found', message: 'Profil introuvable.' });
  request.status = 'rejected';
  request.reviewedAt = nowIso();
  request.reviewedBy = req.currentProfile.id;
  request.reason = limitText(req.body?.reason || req.body?.adminNote || 'Photo non conforme. Merci de renvoyer une photo claire.', 300);
  request.adminNote = request.reason;
  if (!profile.verifiedAt) profile.verified = false;
  createNotification(store, profile.id, 'profile_verification', req.currentProfile.id, 'Vérification refusée', request.reason || 'Votre demande a été refusée. Vous pouvez envoyer une nouvelle photo.', { requestId: request.id, status: 'rejected' });
  persistence.persist(store);
  res.json({ request: serializeVerificationRequestForAdmin(store, request, req.currentProfile.id), message: 'Demande refusée.' });
});

  app.post('/api/admin/reports/:reportId/dismiss', requireAdmin, (req, res) => {
    const report = store.reports.find((item) => item.id === req.params.reportId);
    if (!report) return res.status(404).json({ error: 'report_not_found' });
    report.status = 'dismissed';
    report.resolvedAt = nowIso();
    report.resolvedBy = req.currentProfile.id;
    res.json({ report, message: 'Signalement ignoré/clôturé.' });
  });





  app.post('/api/admin/influencers', requireAdmin, (req, res) => {
    const identifier = req.body?.profileId || req.body?.userId || req.body?.email;
    const user = findAdminManagedUser(identifier);
    if (!user) return res.status(404).json({ error: 'user_not_found', message: 'Compte membre introuvable.' });
    const profile = getProfile(store, user.profileId);
    if (!profile) return res.status(404).json({ error: 'profile_not_found', message: 'Profil introuvable.' });
    const commissionRate = Math.max(0, Math.min(80, Number(req.body?.commissionRate ?? profile.influencer?.commissionRate ?? 20)));
    profile.influencer = {
      ...(profile.influencer || {}),
      enabled: req.body?.active === false ? false : true,
      displayName: limitText(req.body?.displayName || profile.pseudo || 'Influenceur', 80),
      email: normalizeEmail(req.body?.email || user.email || ''),
      commissionRate,
      notes: limitText(req.body?.notes || '', 400),
      createdAt: profile.influencer?.createdAt || nowIso(),
      updatedAt: nowIso(),
      createdBy: profile.influencer?.createdBy || req.currentProfile.id,
    };
    res.status(201).json({ influencer: serializeInfluencerForAdmin(profile.id, req.currentProfile?.id), message: 'Influenceur ajouté au tableau admin.' });
  });

  app.patch('/api/admin/influencers/:profileId', requireAdmin, (req, res) => {
    const profile = getProfile(store, req.params.profileId);
    if (!profile) return res.status(404).json({ error: 'profile_not_found', message: 'Influenceur introuvable.' });
    const user = (store.authUsers || []).find((item) => item.profileId === profile.id) || null;
    profile.influencer = {
      ...(profile.influencer || {}),
      enabled: req.body?.active !== undefined ? Boolean(req.body.active) : (profile.influencer?.enabled !== false),
      displayName: req.body?.displayName !== undefined ? limitText(req.body.displayName || profile.pseudo || 'Influenceur', 80) : (profile.influencer?.displayName || profile.pseudo || 'Influenceur'),
      email: req.body?.email !== undefined ? normalizeEmail(req.body.email || user?.email || '') : (profile.influencer?.email || user?.email || ''),
      commissionRate: req.body?.commissionRate !== undefined ? Math.max(0, Math.min(80, Number(req.body.commissionRate))) : Number(profile.influencer?.commissionRate ?? 20),
      notes: req.body?.notes !== undefined ? limitText(req.body.notes || '', 400) : (profile.influencer?.notes || ''),
      createdAt: profile.influencer?.createdAt || nowIso(),
      updatedAt: nowIso(),
      createdBy: profile.influencer?.createdBy || req.currentProfile.id,
    };
    // Met à jour les codes liés si le pourcentage par défaut change et que l'admin le demande explicitement.
    if (req.body?.syncCodes === true && req.body?.commissionRate !== undefined) {
      (store.promoCodes || []).forEach((promo) => {
        if (promo.influencerProfileId === profile.id) promo.commissionRate = profile.influencer.commissionRate;
      });
    }
    res.json({ influencer: serializeInfluencerForAdmin(profile.id, req.currentProfile?.id), message: 'Influenceur mis à jour.' });
  });

  app.post('/api/admin/promo-codes', requireAdmin, (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
    const type = req.body?.type === 'free_month' ? 'free_month' : 'percent';
    const discountPercent = type === 'free_month' ? 100 : Math.min(90, Math.max(0, Number(req.body?.discountPercent || 0)));
    const freeDays = type === 'free_month' ? Math.max(1, Math.min(365, Number(req.body?.freeDays || 30))) : 0;
    const influencerProfileId = String(req.body?.influencerProfileId || '').trim() || null;
    const influencerProfile = influencerProfileId ? getProfile(store, influencerProfileId) : null;
    const influencerUser = influencerProfileId ? (store.authUsers || []).find((user) => user.profileId === influencerProfileId) : null;
    const influencerName = limitText(req.body?.influencerName || influencerProfile?.influencer?.displayName || influencerProfile?.pseudo || 'Influenceur', 80);
    const influencerEmail = normalizeEmail(req.body?.influencerEmail || influencerProfile?.influencer?.email || influencerUser?.email || '');
    const defaultCommission = influencerProfileId ? Number(influencerProfile?.influencer?.commissionRate ?? 20) : 0;
    const commissionRate = Math.max(0, Math.min(80, Number(req.body?.commissionRate ?? defaultCommission)));
    if (!code) return res.status(400).json({ error: 'code_required', message: 'Code promo obligatoire.' });
    if ((store.promoCodes || []).some((promo) => promo.code === code)) return res.status(409).json({ error: 'code_exists', message: 'Ce code existe déjà.' });
    if (influencerProfileId && !influencerProfile) return res.status(404).json({ error: 'influencer_profile_not_found', message: 'Profil influenceur introuvable.' });
    if (type === 'percent' && discountPercent <= 0) return res.status(400).json({ error: 'discount_required', message: 'Réduction obligatoire.' });
    const maxUsesPerProfile = Number.isFinite(Number(req.body?.maxUsesPerProfile)) ? Math.max(1, Math.min(100, Number(req.body.maxUsesPerProfile))) : (type === 'free_month' ? 1 : 999999);
    const maxUsesTotal = req.body?.maxUsesTotal ? Math.max(1, Number(req.body.maxUsesTotal)) : null;
    const validFrom = req.body?.validFrom ? new Date(req.body.validFrom).toISOString() : null;
    const validUntil = req.body?.validUntil ? new Date(req.body.validUntil).toISOString() : null;
    if (influencerProfile) {
      influencerProfile.influencer = {
        ...(influencerProfile.influencer || {}),
        enabled: influencerProfile.influencer?.enabled !== false,
        displayName: influencerProfile.influencer?.displayName || influencerName,
        email: influencerProfile.influencer?.email || influencerEmail,
        commissionRate: Number(influencerProfile.influencer?.commissionRate ?? commissionRate),
        createdAt: influencerProfile.influencer?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    }
    const promo = { id: makeId('promo'), code, type, discountPercent, freeDays, active: true, influencerProfileId, influencerName, influencerEmail, commissionRate, maxUsesPerProfile, maxUsesTotal, validFrom, validUntil, token: influencerProfileId ? makeInfluencerToken(code) : '', createdAt: nowIso(), uses: [] };
    store.promoCodes.push(promo);
    res.status(201).json({ promo: serializePromo(store, promo), message: 'Code promo créé.' });
  });

  app.post('/api/admin/promo-codes/:code/toggle', requireAdmin, (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const promo = (store.promoCodes || []).find((item) => item.code === code);
    if (!promo) return res.status(404).json({ error: 'promo_not_found' });
    promo.active = !promo.active;
    res.json({ promo: serializePromo(store, promo), message: promo.active ? 'Code réactivé.' : 'Code désactivé.' });
  });

  // --- Commerces / lieux (admin) ---
  app.get('/api/admin/venues', requireAdmin, (req, res) => {
    const venues = (store.venues || []).map(serializeVenue);
    res.json({ venues, types: VENUE_TYPES });
  });

  app.post('/api/admin/venues', requireAdmin, async (req, res) => {
    const name = limitText(req.body?.name || '', 120).trim();
    const type = normalizeVenueType(req.body?.type);
    const address = limitText(req.body?.address || '', 240).trim();
    const description = limitText(req.body?.description || '', 600).trim();
    const phone = limitText(req.body?.phone || '', 40).trim();
    const website = limitText(req.body?.website || '', 200).trim();
    if (!name) return res.status(400).json({ error: 'name_required', message: 'Nom du commerce obligatoire.' });
    if (!type) return res.status(400).json({ error: 'type_invalid', message: `Type invalide. Choisir parmi : ${VENUE_TYPES.join(', ')}.` });
    if (!address) return res.status(400).json({ error: 'address_required', message: 'Adresse obligatoire pour la géolocalisation.' });

    const geo = await geocodeAddress(store, address);
    const venue = {
      id: makeId('venue'),
      name, type, address, description, phone, website,
      city: geo?.city || '',
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      geoSource: geo?.source || 'none',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.venues.push(venue);
    const message = geo ? 'Commerce ajouté et localisé sur la carte.' : 'Commerce ajouté, mais l’adresse n’a pas pu être localisée. Vérifiez l’adresse.';
    res.status(201).json({ venue: serializeVenue(venue), located: Boolean(geo), message });
  });

  app.patch('/api/admin/venues/:venueId', requireAdmin, async (req, res) => {
    const venue = (store.venues || []).find((v) => v.id === req.params.venueId);
    if (!venue) return res.status(404).json({ error: 'venue_not_found', message: 'Commerce introuvable.' });
    if (req.body?.name !== undefined) venue.name = limitText(req.body.name, 120).trim() || venue.name;
    if (req.body?.type !== undefined) { const t = normalizeVenueType(req.body.type); if (t) venue.type = t; }
    if (req.body?.description !== undefined) venue.description = limitText(req.body.description, 600).trim();
    if (req.body?.phone !== undefined) venue.phone = limitText(req.body.phone, 40).trim();
    if (req.body?.website !== undefined) venue.website = limitText(req.body.website, 200).trim();
    // Re-géocoder uniquement si l'adresse change.
    if (req.body?.address !== undefined) {
      const address = limitText(req.body.address, 240).trim();
      if (address && address !== venue.address) {
        venue.address = address;
        const geo = await geocodeAddress(store, address);
        if (geo) { venue.lat = geo.lat; venue.lng = geo.lng; venue.city = geo.city || venue.city; venue.geoSource = geo.source; }
      }
    }
    venue.updatedAt = nowIso();
    res.json({ venue: serializeVenue(venue), message: 'Commerce mis à jour.' });
  });

  app.delete('/api/admin/venues/:venueId', requireAdmin, (req, res) => {
    const before = (store.venues || []).length;
    store.venues = (store.venues || []).filter((v) => v.id !== req.params.venueId);
    if (store.venues.length === before) return res.status(404).json({ error: 'venue_not_found', message: 'Commerce introuvable.' });
    res.json({ message: 'Commerce supprimé.' });
  });


  // AMÉLIORATION : Modifier un code promo existant (discount, freeDays, limites, dates)
  app.patch('/api/admin/promo-codes/:code', requireAdmin, (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const promo = (store.promoCodes || []).find((item) => item.code === code);
    if (!promo) return res.status(404).json({ error: 'promo_not_found', message: 'Code promo introuvable.' });
    if (req.body?.discountPercent !== undefined && promo.type === 'percent') {
      promo.discountPercent = Math.min(90, Math.max(1, Number(req.body.discountPercent)));
    }
    if (req.body?.freeDays !== undefined && promo.type === 'free_month') {
      promo.freeDays = Math.max(1, Math.min(365, Number(req.body.freeDays)));
    }
    if (req.body?.maxUsesPerProfile !== undefined) {
      promo.maxUsesPerProfile = Math.max(1, Math.min(100, Number(req.body.maxUsesPerProfile)));
    }
    if (req.body?.maxUsesTotal !== undefined) {
      promo.maxUsesTotal = req.body.maxUsesTotal === null ? null : Math.max(1, Number(req.body.maxUsesTotal));
    }
    if (req.body?.validFrom !== undefined) {
      promo.validFrom = req.body.validFrom ? new Date(req.body.validFrom).toISOString() : null;
    }
    if (req.body?.validUntil !== undefined) {
      promo.validUntil = req.body.validUntil ? new Date(req.body.validUntil).toISOString() : null;
    }
    if (req.body?.influencerProfileId !== undefined) {
      const nextProfileId = String(req.body.influencerProfileId || '').trim() || null;
      if (nextProfileId && !getProfile(store, nextProfileId)) return res.status(404).json({ error: 'influencer_profile_not_found', message: 'Profil influenceur introuvable.' });
      promo.influencerProfileId = nextProfileId;
      promo.token = nextProfileId ? (promo.token || makeInfluencerToken(promo.code)) : '';
      const nextProfile = nextProfileId ? getProfile(store, nextProfileId) : null;
      const nextUser = nextProfileId ? (store.authUsers || []).find((user) => user.profileId === nextProfileId) : null;
      if (nextProfile && !promo.influencerName) promo.influencerName = nextProfile.influencer?.displayName || nextProfile.pseudo || 'Influenceur';
      if (nextUser && !promo.influencerEmail) promo.influencerEmail = nextProfile?.influencer?.email || nextUser.email || '';
    }
    if (req.body?.influencerName !== undefined) {
      promo.influencerName = limitText(req.body.influencerName, 80);
    }
    if (req.body?.influencerEmail !== undefined) {
      promo.influencerEmail = normalizeEmail(req.body.influencerEmail || '');
    }
    if (req.body?.commissionRate !== undefined) {
      promo.commissionRate = Math.max(0, Math.min(80, Number(req.body.commissionRate)));
    }
    promo.updatedAt = nowIso();
    persistence.persist(store);
    res.json({ promo: serializePromo(store, promo), message: 'Code promo mis à jour.' });
  });

  // AMÉLIORATION : Supprimer un code promo (désactivé ou vide)
  app.delete('/api/admin/promo-codes/:code', requireAdmin, (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const idx = (store.promoCodes || []).findIndex((p) => p.code === code);
    if (idx === -1) return res.status(404).json({ error: 'promo_not_found', message: 'Code promo introuvable.' });
    const promo = store.promoCodes[idx];
    if ((promo.uses || []).length > 0) {
      return res.status(409).json({ error: 'promo_has_uses', message: 'Ce code a déjà été utilisé. Désactivez-le plutôt que de le supprimer.' });
    }
    store.promoCodes.splice(idx, 1);
    persistence.persist(store);
    res.json({ deleted: true, code, message: 'Code promo supprimé.' });
  });

  // AMÉLIORATION : Export CSV admin (purchases, users, promoCodes)
  app.get('/api/admin/export', requireAdmin, (req, res) => {
    const type = String(req.query?.type || 'purchases').toLowerCase();
    const now = new Date().toISOString().slice(0, 10);
    if (type === 'purchases') {
      const rows = (store.purchases || []).map((p) => ({
        id: p.id,
        profileId: p.profileId,
        pseudo: getProfile(store, p.profileId)?.pseudo || '',
        planId: p.planId,
        promoCode: p.promoCode || '',
        amountCents: p.amountCents,
        amountEur: (Number(p.amountCents || 0) / 100).toFixed(2),
        commissionCents: p.commissionCents || 0,
        source: p.source || '',
        createdAt: p.createdAt,
      }));
      const headers = ['id', 'profileId', 'pseudo', 'planId', 'promoCode', 'amountCents', 'amountEur', 'commissionCents', 'source', 'createdAt'];
      const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="voluptia-purchases-${now}.csv"`);
      return res.send('\uFEFF' + csv);
    }
    if (type === 'users') {
      const rows = (store.authUsers || []).map((u) => {
        const profile = getProfile(store, u.profileId);
        const sub = serializeSubscription(store, u.profileId);
        return {
          id: u.id,
          profileId: u.profileId,
          email: u.email,
          pseudo: profile?.pseudo || '',
          role: u.role,
          city: profile?.city || '',
          type: profile?.type || '',
          age: profile?.age || '',
          subscriptionActive: sub?.active ? 'oui' : 'non',
          subscriptionPlan: sub?.planId || '',
          subscriptionExpires: sub?.expiresAt || '',
          createdAt: u.createdAt,
        };
      });
      const headers = ['id', 'profileId', 'email', 'pseudo', 'role', 'city', 'type', 'age', 'subscriptionActive', 'subscriptionPlan', 'subscriptionExpires', 'createdAt'];
      const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="voluptia-users-${now}.csv"`);
      return res.send('\uFEFF' + csv);
    }
    if (type === 'promo') {
      const rows = (store.promoCodes || []).map((p) => {
        const s = serializePromo(store, p);
        return {
          id: p.id,
          code: p.code,
          type: p.type,
          discountPercent: p.discountPercent || '',
          freeDays: p.freeDays || '',
          active: p.active ? 'oui' : 'non',
          useCount: s.useCount,
          revenueCents: s.revenueCents,
          revenueEur: (Number(s.revenueCents || 0) / 100).toFixed(2),
          commissionCents: s.commissionCents,
          influencerName: p.influencerName || '',
          influencerEmail: p.influencerEmail || '',
          commissionRate: p.commissionRate || 0,
          maxUsesPerProfile: p.maxUsesPerProfile || '',
          maxUsesTotal: p.maxUsesTotal || '',
          validFrom: p.validFrom || '',
          validUntil: p.validUntil || '',
          createdAt: p.createdAt,
        };
      });
      const headers = ['id', 'code', 'type', 'discountPercent', 'freeDays', 'active', 'useCount', 'revenueCents', 'revenueEur', 'commissionCents', 'influencerName', 'influencerEmail', 'commissionRate', 'maxUsesPerProfile', 'maxUsesTotal', 'validFrom', 'validUntil', 'createdAt'];
      const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="voluptia-promo-${now}.csv"`);
      return res.send('\uFEFF' + csv);
    }
    res.status(400).json({ error: 'invalid_type', message: 'Type invalide. Valeurs: purchases, users, promo.' });
  });

  // AMÉLIORATION : Lecture des audit logs depuis le dashboard
  app.get('/api/admin/2fa/status', requireAdmin, (req, res) => {
    const user = req.currentUser;
    res.json({
      enabled: Boolean(user.twoFactorEnabled),
      pending: Boolean(user.twoFactorPendingSecret && !user.twoFactorEnabled),
      backupCodesRemaining: Array.isArray(user.twoFactorBackupCodes) ? user.twoFactorBackupCodes.length : 0,
    });
  });

  app.post('/api/admin/2fa/setup', requireAdmin, async (req, res) => {
    const user = req.currentUser;
    if (user.twoFactorEnabled) return res.status(400).json({ error: 'already_enabled', message: 'La double authentification est déjà activée.' });
    const secret = authenticator.generateSecret();
    user.twoFactorPendingSecret = secret;
    try { persistence.persist(store); } catch {}
    const label = req.currentProfile?.pseudo || user.email || 'admin';
    const otpauthUrl = authenticator.keyuri(label, TWO_FACTOR_ISSUER, secret);
    let qrDataUrl = '';
    try { qrDataUrl = await QRCode.toDataURL(otpauthUrl); } catch {}
    res.json({ secret, otpauthUrl, qrDataUrl, message: 'Scannez le QR code dans votre application d’authentification, puis confirmez avec un code à 6 chiffres.' });
  });

  app.post('/api/admin/2fa/enable', requireAdmin, (req, res) => {
    const user = req.currentUser;
    const code = String(req.body?.code || '');
    if (user.twoFactorEnabled) return res.status(400).json({ error: 'already_enabled', message: 'La double authentification est déjà activée.' });
    if (!user.twoFactorPendingSecret) return res.status(400).json({ error: 'no_pending_setup', message: 'Démarrez d’abord la configuration de la double authentification.' });
    if (!verifyTotp(user.twoFactorPendingSecret, code)) return res.status(401).json({ error: 'invalid_2fa_code', message: 'Code incorrect. Vérifiez l’heure de votre téléphone et réessayez.' });
    user.twoFactorSecret = user.twoFactorPendingSecret;
    user.twoFactorPendingSecret = null;
    user.twoFactorEnabled = true;
    user.twoFactorEnabledAt = nowIso();
    const backupCodes = generateBackupCodes();
    user.twoFactorBackupCodes = backupCodes.map((c) => hashPassword(normalizeBackupCode(c)));
    try { persistence.persist(store); } catch {}
    res.json({ enabled: true, backupCodes, message: 'Double authentification activée. Conservez ces codes de secours en lieu sûr : ils ne seront plus affichés.' });
  });

  app.post('/api/admin/2fa/disable', requireAdmin, (req, res) => {
    const user = req.currentUser;
    const code = String(req.body?.code || '');
    if (!user.twoFactorEnabled) return res.status(400).json({ error: 'not_enabled', message: 'La double authentification n’est pas activée.' });
    const ok = verifyTotp(user.twoFactorSecret, code) || consumeBackupCode(user, code);
    if (!ok) return res.status(401).json({ error: 'invalid_2fa_code', message: 'Code incorrect. Désactivation refusée.' });
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorPendingSecret = null;
    user.twoFactorBackupCodes = [];
    user.twoFactorEnabledAt = null;
    try { persistence.persist(store); } catch {}
    res.json({ enabled: false, message: 'Double authentification désactivée.' });
  });

  app.post('/api/admin/2fa/backup-codes', requireAdmin, (req, res) => {
    const user = req.currentUser;
    const code = String(req.body?.code || '');
    if (!user.twoFactorEnabled) return res.status(400).json({ error: 'not_enabled', message: 'La double authentification n’est pas activée.' });
    if (!verifyTotp(user.twoFactorSecret, code)) return res.status(401).json({ error: 'invalid_2fa_code', message: 'Code incorrect.' });
    const backupCodes = generateBackupCodes();
    user.twoFactorBackupCodes = backupCodes.map((c) => hashPassword(normalizeBackupCode(c)));
    try { persistence.persist(store); } catch {}
    res.json({ backupCodes, message: 'Nouveaux codes de secours générés. Les anciens ne sont plus valides.' });
  });

  app.get('/api/admin/audit-logs', requireAdmin, (req, res) => {
    const page = Math.max(1, Number(req.query?.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query?.limit || 50)));
    const actorId = String(req.query?.actor || '').trim();
    const pathFilter = String(req.query?.path || '').trim();
    if (persistence.type !== 'sqlite') {
      return res.json({ logs: [], pagination: { page: 1, limit, total: 0, pages: 0 }, note: 'Audit logs SQLite non disponible (mode fallback JSON actif).' });
    }
    try {
      const db = persistence._db;
      if (!db) return res.json({ logs: [], pagination: { page: 1, limit, total: 0, pages: 0 } });
      let where = 'WHERE 1=1';
      const params = [];
      if (actorId) { where += ' AND actor_profile_id = ?'; params.push(actorId); }
      if (pathFilter) { where += ' AND path LIKE ?'; params.push(`%${pathFilter}%`); }
      const total = db.prepare(`SELECT COUNT(*) as n FROM audit_logs ${where}`).get(...params)?.n || 0;
      const logs = db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
      res.json({ logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch {
      res.json({ logs: [], pagination: { page: 1, limit, total: 0, pages: 0 }, note: 'Lecture audit logs impossible.' });
    }
  });

  app.post('/api/admin/reports/:reportId/status', requireAdmin, (req, res) => {
    const report = store.reports.find((item) => item.id === req.params.reportId);
    if (!report) return res.status(404).json({ error: 'report_not_found', message: 'Signalement introuvable.' });
    const status = String(req.body?.status || 'reviewing');
    if (!['new', 'reviewing'].includes(status)) return res.status(400).json({ error: 'invalid_status', message: 'Statut invalide.' });
    report.status = status;
    report.assignedTo = req.currentProfile.id;
    report.assignedAt = report.assignedAt || nowIso();
    report.updatedAt = nowIso();
    store.moderationActions.push({ id: makeId('modact'), type: 'report_status', reportId: report.id, profileId: report.targetId, targetId: report.targetId, adminId: req.currentProfile.id, status, createdAt: nowIso() });
    persistence.persist(store);
    res.json({ report: serializeReportForAdmin(store, report, req.currentProfile.id), message: status === 'reviewing' ? 'Signalement pris en charge.' : 'Signalement remis en nouveau.' });
  });

  app.post('/api/admin/users/:userId/warn', requireAdmin, (req, res) => {
    const user = findAdminUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'user_not_found', message: 'Utilisateur introuvable.' });
    const profile = getProfile(store, user.profileId);
    if (!profile) return res.status(404).json({ error: 'profile_not_found', message: 'Profil introuvable.' });
    if (user.role === 'admin' && user.id !== req.currentUser?.id) return res.status(403).json({ error: 'cannot_warn_admin', message: 'Impossible d’avertir un autre administrateur depuis ce panneau.' });
    const message = limitText(req.body?.message || req.body?.body, 600);
    if (!message) return res.status(400).json({ error: 'message_required', message: 'Message d’avertissement obligatoire.' });
    const warning = createModerationWarning(store, profile.id, req.currentProfile.id, message, { severity: req.body?.severity });
    if (req.body?.hideProfile === true && user.role !== 'admin') profile.hidden = true;
    if (req.body?.revokeSessions === true && user.role !== 'admin') store.sessions = (store.sessions || []).filter((session) => session.userId !== user.id);
    persistence.persist(store);
    res.status(201).json({ warning, user: serializeAdminManagedUser(user, req.currentUser?.id, req.currentProfile?.id), message: 'Avertissement écrit envoyé.' });
  });

  app.post('/api/admin/reports/:reportId/resolve', requireAdmin, (req, res) => {
    const report = store.reports.find((item) => item.id === req.params.reportId);
    if (!report) return res.status(404).json({ error: 'report_not_found', message: 'Signalement introuvable.' });
    const action = String(req.body?.action || 'resolve'); // resolve | ban | warn | hide_profile
    const targetProfile = getProfile(store, report.targetId);
    const targetUser = targetProfile ? (store.authUsers || []).find((u) => u.profileId === targetProfile.id) : null;
    let actionMessage = 'Signalement clôturé.';
    report.assignedTo = report.assignedTo || req.currentProfile.id;
    report.assignedAt = report.assignedAt || nowIso();
    if (action === 'ban' && targetUser && targetUser.role !== 'admin') {
      store.sessions = (store.sessions || []).filter((s) => s.userId !== targetUser.id);
      if (targetProfile) { targetProfile.hidden = true; targetProfile.bannedAt = nowIso(); targetProfile.bannedBy = req.currentProfile.id; }
      targetUser.banned = true; targetUser.bannedAt = nowIso(); targetUser.bannedBy = req.currentProfile.id;
      createModerationWarning(store, targetProfile.id, req.currentProfile.id, req.body?.warnMessage || 'Votre compte est suspendu suite à un signalement validé par la modération.', { reportId: report.id, severity: 'final' });
      actionMessage = 'Signalement clôturé + compte suspendu (sessions révoquées, profil masqué).';
    } else if (action === 'warn' && targetProfile) {
      const warning = createModerationWarning(store, targetProfile.id, req.currentProfile.id, req.body?.warnMessage || 'Votre comportement ne respecte pas les règles de la communauté. En cas de récidive, votre compte pourra être suspendu.', { reportId: report.id, severity: req.body?.severity || 'warning' });
      actionMessage = warning ? 'Signalement clôturé + avertissement écrit envoyé.' : 'Signalement clôturé.';
    } else if (action === 'hide_profile' && targetProfile && targetUser?.role !== 'admin') {
      targetProfile.hidden = true;
      store.moderationActions.push({ id: makeId('modact'), type: 'hide_profile', reportId: report.id, profileId: targetProfile.id, targetId: targetProfile.id, adminId: req.currentProfile.id, createdAt: nowIso() });
      actionMessage = 'Signalement clôturé + profil masqué de la découverte.';
    } else {
      store.moderationActions.push({ id: makeId('modact'), type: 'resolve_report', reportId: report.id, profileId: report.targetId, targetId: report.targetId, adminId: req.currentProfile.id, createdAt: nowIso() });
    }
    report.status = 'resolved';
    report.resolvedAt = nowIso();
    report.resolvedBy = req.currentProfile.id;
    report.resolvedAction = action;
    report.resolutionNote = limitText(req.body?.resolutionNote || '', 400);
    persistence.persist(store);
    res.json({ report: serializeReportForAdmin(store, report, req.currentProfile.id), message: actionMessage });
  });

  function findOwnedEvent(req, res) {
    const event = (store.events || []).find((item) => item.id === req.params.eventId);
    if (!event) { res.status(404).json({ error: 'event_not_found', message: 'Événement introuvable.' }); return null; }
    if (event.ownerId !== req.currentProfile.id && req.currentUser?.role !== 'admin') {
      res.status(403).json({ error: 'not_owner', message: 'Seul l’organisateur peut modifier cet événement.' });
      return null;
    }
    return event;
  }

  function parseEventDates(body) {
    const startAt = body?.startAt ? new Date(body.startAt) : null;
    const endRaw = body?.endAt ? new Date(body.endAt) : null;
    if (!startAt || Number.isNaN(startAt.getTime())) return { error: 'Date de début invalide.' };
    let endAt = endRaw && !Number.isNaN(endRaw.getTime()) ? endRaw : startAt;
    if (endAt.getTime() < startAt.getTime()) endAt = startAt;
    return { startAt: startAt.toISOString(), endAt: endAt.toISOString() };
  }

  function parsePrice(value) {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.round(num * 100) / 100;
  }

  // Liste des événements à venir / en cours (suppression auto 24h après la fin).
  app.get('/api/events', (req, res) => {
    if (pruneExpiredEvents(store)) { try { persistence.persist(store); } catch {} }
    const events = (store.events || [])
      .slice()
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .map((event) => serializeEvent(store, event, req.currentProfile.id));
    res.json({ events, audiences: EVENT_AUDIENCES });
  });

  // Détail d'un événement (incrémente le compteur de visites).
  app.get('/api/events/:eventId', (req, res) => {
    if (pruneExpiredEvents(store)) { try { persistence.persist(store); } catch {} }
    const event = (store.events || []).find((item) => item.id === req.params.eventId);
    if (!event) return res.status(404).json({ error: 'event_not_found', message: 'Événement introuvable.' });
    if (event.ownerId !== req.currentProfile.id) {
      event.visits = Number(event.visits || 0) + 1;
      try { persistence.persist(store); } catch {}
    }
    res.json({ event: serializeEvent(store, event, req.currentProfile.id, { includePhotos: true }) });
  });

  // Création d'un événement (ouvert à tous les membres).
  app.post('/api/events', async (req, res) => {
    const title = limitText(req.body?.title || '', 120).trim();
    if (!title) return res.status(400).json({ error: 'title_required', message: 'Titre de l’événement obligatoire.' });
    const dates = parseEventDates(req.body);
    if (dates.error) return res.status(400).json({ error: 'invalid_dates', message: dates.error });
    const address = limitText(req.body?.address || '', 240).trim();
    let location = { label: limitText(req.body?.locationLabel || '', 120).trim(), address, city: '', lat: null, lng: null };
    if (address) {
      const geo = await geocodeAddress(store, address);
      if (geo) location = { label: location.label || geo.city || '', address, city: geo.city || '', lat: geo.lat ?? null, lng: geo.lng ?? null };
    }
    let banner = null;
    if (req.body?.banner?.dataUrl) {
      try { banner = persistEventMedia({ dataUrl: req.body.banner.dataUrl, mimeType: req.body.banner.mimeType }); }
      catch (error) { return res.status(400).json({ error: 'banner_invalid', message: error.message || 'Image de bannière invalide.' }); }
    }
    const event = {
      id: makeId('event'),
      ownerId: req.currentProfile.id,
      title,
      description: limitText(req.body?.description || '', 2000).trim(),
      startAt: dates.startAt,
      endAt: dates.endAt,
      location,
      priceCouple: parsePrice(req.body?.priceCouple),
      priceWoman: parsePrice(req.body?.priceWoman),
      audience: normalizeEventAudience(req.body?.audience),
      visibility: req.body?.visibility === 'private' ? 'private' : 'public',
      banner,
      photos: [],
      participantIds: [req.currentProfile.id],
      visits: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.events = store.events || [];
    store.events.push(event);
    res.status(201).json({ event: serializeEvent(store, event, req.currentProfile.id, { includePhotos: true }), message: 'Événement créé.' });
  });

  // Mise à jour d'un événement par son organisateur.
  app.patch('/api/events/:eventId', async (req, res) => {
    const event = findOwnedEvent(req, res);
    if (!event) return;
    if (req.body?.title !== undefined) { const t = limitText(req.body.title, 120).trim(); if (t) event.title = t; }
    if (req.body?.description !== undefined) event.description = limitText(req.body.description, 2000).trim();
    if (req.body?.startAt !== undefined || req.body?.endAt !== undefined) {
      const dates = parseEventDates({ startAt: req.body.startAt || event.startAt, endAt: req.body.endAt || event.endAt });
      if (dates.error) return res.status(400).json({ error: 'invalid_dates', message: dates.error });
      event.startAt = dates.startAt; event.endAt = dates.endAt;
    }
    if (req.body?.priceCouple !== undefined) event.priceCouple = parsePrice(req.body.priceCouple);
    if (req.body?.priceWoman !== undefined) event.priceWoman = parsePrice(req.body.priceWoman);
    if (req.body?.audience !== undefined) event.audience = normalizeEventAudience(req.body.audience);
    if (req.body?.visibility !== undefined) event.visibility = req.body.visibility === 'private' ? 'private' : 'public';
    if (req.body?.locationLabel !== undefined) event.location = { ...event.location, label: limitText(req.body.locationLabel, 120).trim() };
    if (req.body?.address !== undefined) {
      const address = limitText(req.body.address, 240).trim();
      if (address && address !== event.location?.address) {
        const geo = await geocodeAddress(store, address);
        event.location = { label: event.location?.label || (geo?.city || ''), address, city: geo?.city || '', lat: geo?.lat ?? null, lng: geo?.lng ?? null };
      } else if (!address) {
        event.location = { ...event.location, address: '' };
      }
    }
    if (req.body?.banner?.dataUrl) {
      try {
        const next = persistEventMedia({ dataUrl: req.body.banner.dataUrl, mimeType: req.body.banner.mimeType });
        if (event.banner?.filename) { try { fs.unlinkSync(path.join(eventMediaRoot, event.banner.filename)); } catch {} }
        event.banner = next;
      } catch (error) { return res.status(400).json({ error: 'banner_invalid', message: error.message || 'Image invalide.' }); }
    }
    event.updatedAt = nowIso();
    res.json({ event: serializeEvent(store, event, req.currentProfile.id, { includePhotos: true }), message: 'Événement mis à jour.' });
  });

  // Suppression d'un événement par son organisateur.
  app.delete('/api/events/:eventId', (req, res) => {
    const event = findOwnedEvent(req, res);
    if (!event) return;
    deleteEventMediaFiles(event);
    store.events = (store.events || []).filter((item) => item.id !== event.id);
    res.json({ message: 'Événement supprimé.' });
  });

  // Participer / ne plus participer (bascule).
  app.post('/api/events/:eventId/participate', (req, res) => {
    const event = (store.events || []).find((item) => item.id === req.params.eventId);
    if (!event) return res.status(404).json({ error: 'event_not_found', message: 'Événement introuvable.' });
    event.participantIds = Array.isArray(event.participantIds) ? event.participantIds : [];
    const id = req.currentProfile.id;
    const joining = !event.participantIds.includes(id);
    event.participantIds = joining ? [...event.participantIds, id] : event.participantIds.filter((p) => p !== id);
    event.updatedAt = nowIso();
    res.json({ event: serializeEvent(store, event, id, { includePhotos: true }), participating: joining, message: joining ? 'Participation enregistrée.' : 'Participation retirée.' });
  });

  // L'organisateur ajoute des photos à son événement.
  app.post('/api/events/:eventId/photos', (req, res) => {
    const event = findOwnedEvent(req, res);
    if (!event) return;
    const incoming = Array.isArray(req.body?.photos) ? req.body.photos : (req.body?.dataUrl ? [{ dataUrl: req.body.dataUrl, mimeType: req.body.mimeType }] : []);
    if (!incoming.length) return res.status(400).json({ error: 'no_photo', message: 'Aucune photo fournie.' });
    event.photos = Array.isArray(event.photos) ? event.photos : [];
    if (event.photos.length + incoming.length > 40) return res.status(400).json({ error: 'too_many_photos', message: '40 photos maximum par événement.' });
    const added = [];
    for (const item of incoming.slice(0, 40)) {
      if (!item?.dataUrl) continue;
      try {
        const media = persistEventMedia({ dataUrl: item.dataUrl, mimeType: item.mimeType });
        const photo = { fileId: media.fileId, filename: media.filename, url: media.url, mimeType: media.mimeType, addedAt: nowIso() };
        event.photos.push(photo);
        added.push({ fileId: photo.fileId, url: photo.url, addedAt: photo.addedAt });
      } catch (error) { return res.status(400).json({ error: 'photo_invalid', message: error.message || 'Photo invalide.' }); }
    }
    event.updatedAt = nowIso();
    res.status(201).json({ photos: added, event: serializeEvent(store, event, req.currentProfile.id, { includePhotos: true }), message: 'Photos ajoutées.' });
  });

  // L'organisateur retire une photo.
  app.delete('/api/events/:eventId/photos/:fileId', (req, res) => {
    const event = findOwnedEvent(req, res);
    if (!event) return;
    const fileId = String(req.params.fileId || '');
    const photo = (event.photos || []).find((p) => p.fileId === fileId);
    if (!photo) return res.status(404).json({ error: 'photo_not_found', message: 'Photo introuvable.' });
    if (photo.filename) { try { fs.unlinkSync(path.join(eventMediaRoot, photo.filename)); } catch {} }
    event.photos = (event.photos || []).filter((p) => p.fileId !== fileId);
    event.updatedAt = nowIso();
    res.json({ event: serializeEvent(store, event, req.currentProfile.id, { includePhotos: true }), message: 'Photo retirée.' });
  });

  app.post('/api/reports', (req, res) => {
    const targetId = String(req.body?.targetId || '').trim();
    const category = normalizeReportCategory(req.body?.category || req.body?.type);
    const reason = limitText(req.body?.reason || req.body?.details || '', MAX_TEXT.reason);
    if (!targetId || !reason) return res.status(400).json({ error: 'target_and_reason_required', message: 'Profil et détail du signalement obligatoires.' });
    const target = getProfile(store, targetId);
    if (!isPubliclyReachableProfile(target, req.currentUser)) return res.status(404).json({ error: 'profile_not_found', message: 'Profil introuvable.' });
    if (target.id === req.currentProfile.id) return res.status(400).json({ error: 'cannot_report_self', message: 'Vous ne pouvez pas signaler votre propre profil.' });
    const duplicate = (store.reports || []).find((item) => item.reporterId === req.currentProfile.id && item.targetId === targetId && item.status !== 'resolved' && item.status !== 'dismissed');
    if (duplicate) return res.status(409).json({ error: 'duplicate_report', message: 'Un signalement est déjà ouvert pour ce profil.', report: duplicate });
    const priority = reportPriority(category, reason);
    const report = {
      id: makeId('report'),
      reporterId: req.currentProfile.id,
      targetId,
      category,
      reason,
      source: limitText(req.body?.source || 'profile', 40),
      context: limitText(req.body?.context || '', 400),
      priority,
      createdAt: nowIso(),
      status: 'new',
    };
    store.reports.push(report);
    notifyAdmins(store, priority === 'urgent' ? 'Signalement urgent' : 'Nouveau signalement', `${req.currentProfile.pseudo} a signalé ${target.pseudo} : ${category}.`, { reportId: report.id, targetId, actorId: req.currentProfile.id, priority });
    persistence.persist(store);
    res.status(201).json({ report, message: `Signalement reçu, merci. Notre équipe de modération l’examinera.` });
  });

  const distPath = path.resolve(projectRoot, 'frontend/dist');
  app.use(express.static(distPath, {
    dotfiles: 'ignore',
    index: false,
    maxAge: 0,
    setHeaders(res, filePath) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      const normalizedPath = String(filePath || '').replace(/\\/g, '/');
      const isHashedAsset = /\/assets\/.+[-_][A-Za-z0-9]{6,}\.(?:js|css|png|jpg|jpeg|gif|webp|svg|woff2?)$/i.test(normalizedPath);
      const isShellFile = /\/(?:index\.html|sw\.js|manifest\.webmanifest)$/i.test(normalizedPath);
      if (isShellFile) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      } else if (isProduction() && isHashedAsset) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', isProduction() ? 'public, max-age=300' : 'no-store');
      }
    },
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(path.join(distPath, 'index.html'), (error) => {
      if (error) {
        res.status(200).send('Voluptia API est actif. Lancez le frontend en développement avec npm run dev:frontend.');
      }
    });
  });

  app.use((error, req, res, next) => {
    const status = Number(error?.statusCode || error?.status || 500);
    if (status >= 500 || !isProduction()) console.error(error);
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'payload_too_large', message: 'Requête trop volumineuse.' });
    }
    if (error?.type === 'entity.parse.failed' || error instanceof SyntaxError) {
      return res.status(400).json({ error: 'invalid_json', message: 'JSON invalide.' });
    }
    const code = status >= 500 ? 'server_error' : (error?.code || 'request_error');
    res.status(status || 500).json({ error: code, message: safeClientError(error) });
  });

  // Démarrer le nettoyage périodique
  scheduleMaintenanceTasks(store);

  return app;
}
