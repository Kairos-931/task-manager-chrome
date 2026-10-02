// TaskMaster API — Cloudflare Worker
// Handles: mobile web page, task CRUD, Telegram bot webhook
import {
  MAX_ACCOUNT_SYNC_CHANGES,
  applyAccountSyncRecord,
  createAccountTaskRecord,
  listAccountCategories,
  normalizeAccountSyncRecord,
} from './account-sync.js'
import { renderAccountMobilePage } from './account-mobile.js'
import {
  authErrorResponse,
  authorizeGoogleExtension,
  cancelGoogleExtensionAuthCode,
  completeGoogleOAuthCallback,
  createMobileGoogleSession,
  exchangeGoogleExtensionAuthCode,
  getTaskmasterSessionFromRequest,
  logoutTaskmasterSession,
  readGoogleExtensionAuthPending,
  startGoogleExtensionAuth,
  startMobileGoogleAuth,
} from './google-auth.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // Google-account mobile entry point. Old mobile page URLs now return here;
    // legacy API endpoints remain routed below.
    if (url.pathname === '/' && method === 'GET') {
      return new Response(renderAccountMobilePage(env), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
        },
      })
    }
    if (url.pathname === '/legacy' || url.pathname === '/index.html') {
      return new Response(null, {
        status: 302,
        headers: {
          Location: new URL('/', url.origin).toString(),
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
        },
      });
    }
    if (url.pathname === '/manifest.json') {
      return serveStatic('manifest.json');
    }
    if (url.pathname === '/icon.svg') {
      return serveStatic('icon.svg');
    }

    // Telegram webhook (auth via bot token in URL path)
    if (url.pathname === '/api/telegram/webhook' && method === 'POST') {
      return handleTelegramWebhook(request, env);
    }

    // OAuth callbacks are pinned to the configured Worker and extension URIs.
    if (url.pathname === '/api/google/extension-auth/start' && method === 'POST') {
      return startGoogleExtensionAuth(request, env)
    }
    if (url.pathname === '/api/google/extension-auth/authorize' && method === 'GET') {
      return authorizeGoogleExtension(request, env)
    }
    if (url.pathname === '/api/google/callback' && method === 'GET') {
      return completeGoogleOAuthCallback(request, env)
    }
    if (url.pathname === '/api/google/extension-auth/pending' && method === 'POST') {
      return readGoogleExtensionAuthPending(request, env)
    }
    if (url.pathname === '/api/google/extension-auth/exchange' && method === 'POST') {
      return exchangeGoogleExtensionAuthCode(request, env)
    }
    if (url.pathname === '/api/google/extension-auth/cancel' && method === 'POST') {
      return cancelGoogleExtensionAuthCode(request, env)
    }
    if (url.pathname === '/api/google/mobile-auth/start' && method === 'POST') {
      return startMobileGoogleAuth(request, env)
    }
    if (url.pathname === '/api/google/identity' && method === 'POST') {
      return handleGoogleIdentity(request, env)
    }
    if (url.pathname === '/api/google/session/logout' && method === 'POST') {
      return logoutTaskmasterSession(request, env)
    }

    // Account routes accept only finite TaskMaster sessions. Google tokens and
    // the legacy API_TOKEN never authorize this isolated account namespace.
    if (url.pathname.startsWith('/api/account/') &&
        ((url.pathname === '/api/account/sync/incremental' && method === 'POST') ||
         (url.pathname === '/api/account/tasks' && method === 'POST') ||
         (url.pathname === '/api/account/categories' && method === 'GET'))) {
      return handleGoogleAccountApi(request, env, url.pathname)
    }

    // API routes — require auth
    const authError = checkAuth(request, env);
    if (authError) return authError;

    if (url.pathname === '/api/tasks' && method === 'POST') {
      return handleCreateTask(request, env);
    }
    if (url.pathname === '/api/tasks' && method === 'GET') {
      return handleGetTasks(env);
    }
    if (url.pathname === '/api/tasks/sync' && method === 'POST') {
      return handleSyncTasks(request, env);
    }
    if (url.pathname === '/api/categories' && method === 'POST') {
      return handleSaveCategories(request, env);
    }
    if (url.pathname === '/api/categories' && method === 'GET') {
      return handleGetCategories(env);
    }

    // Incremental sync is the only writer for current extension versions.
    if (url.pathname === '/api/sync/incremental' && method === 'POST') {
      return handleIncrementalSync(request, env);
    }

    // Legacy snapshot routes remain readable only until incremental sync starts.
    if (url.pathname === '/api/fullsync' && method === 'GET') {
      return handleFullSyncGet(env);
    }
    if (url.pathname === '/api/fullsync' && method === 'POST') {
      return handleFullSyncSet(request, env);
    }

    return jsonResp({ error: 'Not Found' }, 404);
  }
};

async function handleGoogleIdentity(request, env) {
  return createMobileGoogleSession(request, env)
}

async function handleGoogleAccountApi(request, env, pathname) {
  let user
  try {
    user = await getTaskmasterSessionFromRequest(request, env)
  } catch (error) {
    return authErrorResponse(error)
  }

  try {
    if (!env.DB) return accountJson({ error: 'Account sync storage is not configured' }, 503)
    if (pathname === '/api/account/sync/incremental') {
      return await handleAccountIncrementalSync(request, env.DB, user.sub)
    }
    if (pathname === '/api/account/tasks') {
      let body
      try { body = await request.json() } catch { return accountJson({ error: 'invalid JSON body' }, 400) }
      const result = await createAccountTaskRecord(env.DB, user.sub, body)
      if (result.error) return accountJson({ error: result.error }, result.status)
      if (result.previouslyDeleted) {
        return accountJson({ ok: true, previouslyDeleted: true, taskId: result.taskId }, 200)
      }
      return accountJson({ ok: true, task: result.task, alreadyProcessed: result.alreadyProcessed === true }, result.alreadyProcessed ? 200 : 201)
    }
    if (pathname === '/api/account/categories') {
      return accountJson({ categories: await listAccountCategories(env.DB, user.sub) })
    }
    return accountJson({ error: 'Not Found' }, 404)
  } catch (error) {
    console.error('Google account API failed:', error?.name || 'Error')
    return accountJson({ error: 'Account sync is temporarily unavailable' }, 503)
  }
}

async function handleAccountIncrementalSync(request, db, userSub) {
  let body
  try {
    const raw = await request.text()
    if (raw.length > 2_000_000) return accountJson({ error: 'request body is too large' }, 413)
    body = JSON.parse(raw)
  } catch { return accountJson({ error: 'invalid JSON body' }, 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return accountJson({ error: 'JSON object required' }, 400)
  const sourceDevice = typeof body.deviceId === 'string' && body.deviceId.length > 0 && body.deviceId.length <= 128
    ? body.deviceId
    : ''
  if (!sourceDevice) return accountJson({ error: 'deviceId is required' }, 400)
  const cursor = Number.isSafeInteger(body.cursor) && body.cursor >= 0 ? body.cursor : 0
  if (!Array.isArray(body.changes) || body.changes.length > MAX_ACCOUNT_SYNC_CHANGES) {
    return accountJson({ error: `changes must be an array of at most ${MAX_ACCOUNT_SYNC_CHANGES}` }, 400)
  }

  const rejectedChanges = []
  for (const raw of body.changes) {
    const record = normalizeAccountSyncRecord(raw, sourceDevice)
    if (!record) return accountJson({ error: 'invalid sync record' }, 400)
    const outcome = await applyAccountSyncRecord(db, userSub, record)
    if (!outcome.accepted && outcome.canonical) rejectedChanges.push(outcome.canonical)
  }

  const { results } = await db.prepare(
    `SELECT revision, record_type, record_id, payload, deleted, updated_at, source_device
     FROM account_sync_changes WHERE user_sub = ? AND revision > ? ORDER BY revision ASC LIMIT ?`
  ).bind(userSub, cursor, MAX_ACCOUNT_SYNC_CHANGES + 1).all()
  const hasMore = results.length > MAX_ACCOUNT_SYNC_CHANGES
  const page = hasMore ? results.slice(0, MAX_ACCOUNT_SYNC_CHANGES) : results
  const nextCursor = page.length > 0 ? Number(page[page.length - 1].revision) : cursor
  const changes = page.map(row => ({
    type: row.record_type,
    id: row.record_id,
    payload: row.payload ? JSON.parse(row.payload) : null,
    deleted: row.deleted === 1,
    updatedAt: Number(row.updated_at),
    sourceDevice: row.source_device,
  }))
  return accountJson({ changes, rejectedChanges, cursor: nextCursor, hasMore })
}

function accountJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// ── Auth ──────────────────────────────────────────────

function checkAuth(request, env) {
  if (!env.API_TOKEN) {
    return jsonResp({ error: 'Server is missing API_TOKEN configuration' }, 503);
  }
  const auth = request.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${env.API_TOKEN}`) {
    return jsonResp({ error: 'Unauthorized' }, 401);
  }
  return null;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-TaskMaster-Client',
  };
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// ── Static file serving (embedded) ────────────────────

function serveStatic(filename) {
  // PWA metadata and icon are served inline; legacy page URLs redirect above.
  if (filename === 'manifest.json') {
    return new Response(PWA_MANIFEST, {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (filename === 'icon.svg') {
    return new Response(PWA_ICON, {
      headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
    });
  }
  return new Response('Not Found', { status: 404 });
}

// ── Task CRUD ─────────────────────────────────────────

async function handleCreateTask(request, env) {
  const body = await request.json();
  const title = (body.title || '').trim();
  if (!title) return jsonResp({ error: 'title is required' }, 400);

  const id = crypto.randomUUID();
  const completed = body.completed === true;
  const completedAt = completed ? new Date().toISOString() : null;
  await env.DB.prepare(
    `INSERT INTO pending_tasks (id, title, description, priority, category, due_date, duration, no_time_limit, completed, completed_at, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, title,
    body.description || '',
    body.priority || 'medium',
    body.category || '',
    body.dueDate || '',
    body.duration || 60,
    body.noTimeLimit ? 1 : 0,
    completed ? 1 : 0,
    completedAt,
    body.source || 'web'
  ).run();

  return jsonResp({ id, ok: true }, 201);
}

async function handleGetTasks(env) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM pending_tasks WHERE synced = 0 ORDER BY created_at ASC`
  ).all();

  const tasks = results.map(formatTask);
  return jsonResp({ tasks });
}

async function handleSyncTasks(request, env) {
  const body = await request.json();
  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return jsonResp({ error: 'ids array required' }, 400);
  }

  const placeholders = ids.map(() => '?').join(',');
  await env.DB.prepare(
    `UPDATE pending_tasks SET synced = 1 WHERE id IN (${placeholders})`
  ).bind(...ids).run();

  return jsonResp({ ok: true, synced: ids.length });
}

function formatTask(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    category: row.category,
    dueDate: row.due_date,
    duration: row.duration,
    noTimeLimit: row.no_time_limit === 1,
    completed: row.completed === 1,
    completedAt: row.completed_at ? Date.parse(row.completed_at) : undefined,
    source: row.source,
    createdAt: Date.parse(row.created_at) || Date.now(),
  };
}

// ── Categories sync ───────────────────────────────────

async function handleGetCategories(env) {
  const syncedRows = await env.DB.prepare(
    `SELECT payload FROM sync_records WHERE record_type = 'category' AND deleted = 0 ORDER BY updated_at ASC`
  ).all();
  let categories = (syncedRows.results || []).flatMap(row => {
    try {
      const category = JSON.parse(row.payload || 'null');
      return category?.id && category?.name ? [category] : [];
    } catch {
      return [];
    }
  });

  // Existing installations may still have categories saved by the mobile page
  // before incremental sync was introduced.
  if (categories.length === 0) {
    const row = await env.DB.prepare(
      `SELECT value FROM user_data WHERE key = 'categories'`
    ).first();
    categories = row ? JSON.parse(row.value) : [];
  }
  categories = categories.filter(category => category?.id !== 'default-starred');
  const defaults = [
    { id: 'default-work', name: '工作', color: '#3b82f6' },
    { id: 'default-life', name: '生活', color: '#10b981' },
    { id: 'default-learning', name: '学习', color: '#8b5cf6' },
  ];
  for (const category of defaults.reverse()) {
    if (!categories.some(current => current && current.name === category.name)) {
      categories.unshift(category);
    }
  }
  const settingsRow = await env.DB.prepare(
    `SELECT payload FROM sync_records
     WHERE record_type = 'settings' AND record_id = 'app' AND deleted = 0`
  ).first();
  let defaultCategory = '';
  try {
    defaultCategory = JSON.parse(settingsRow?.payload || '{}').defaultCategory || '';
  } catch {}
  if (!categories.some(category => category.id === defaultCategory)) {
    defaultCategory = categories[0]?.id || '';
  }
  return jsonResp({ categories, defaultCategory });
}

async function handleSaveCategories(request, env) {
  const body = await request.json();
  if (!Array.isArray(body.categories)) {
    return jsonResp({ error: 'categories array required' }, 400);
  }
  await env.DB.prepare(
    `INSERT OR REPLACE INTO user_data (key, value, updated_at) VALUES ('categories', ?, datetime('now'))`
  ).bind(JSON.stringify(body.categories)).run();
  return jsonResp({ ok: true });
}

// ── Telegram Bot ──────────────────────────────────────

async function handleTelegramWebhook(request, env) {
  // Verify webhook secret (bot token as path suffix or shared secret)
  const url = new URL(request.url);
  const webhookSecret = url.searchParams.get('secret');
  if (webhookSecret !== env.TELEGRAM_BOT_TOKEN) {
    return jsonResp({ error: 'Invalid webhook secret' }, 403);
  }

  const body = await request.json();

  // Handle only text messages
  const message = body.message;
  if (!message || !message.text) {
    return jsonResp({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();
  const userId = message.from.id;

  // /start command
  if (text === '/start') {
    await sendTelegram(chatId, env,
      'TaskMaster 快速添加任务\n\n' +
      '使用方法：\n' +
      '1. 发送 /token <你的API密钥> 绑定账号\n' +
      '2. 直接发消息即可添加任务\n\n' +
      '示例：\n' +
      '买牛奶\n' +
      '明天 高 完成报告\n' +
      '#工作 后天 低 准备演示'
    );
    return jsonResp({ ok: true });
  }

  // /token command — bind user
  if (text.startsWith('/token ')) {
    const token = text.slice(7).trim();
    if (!token) {
      await sendTelegram(chatId, env, '请提供 API Token，格式：/token <你的API密钥>');
      return jsonResp({ ok: true });
    }

    // Verify token is valid by comparing with env
    if (token !== env.API_TOKEN) {
      await sendTelegram(chatId, env, 'API Token 无效，请检查后重试');
      return jsonResp({ ok: true });
    }

    await env.DB.prepare(
      `INSERT OR REPLACE INTO telegram_users (telegram_user_id, api_token) VALUES (?, ?)`
    ).bind(userId, token).run();

    await sendTelegram(chatId, env, '绑定成功！现在可以直接发消息添加任务了。\n\n示例：买牛奶\n明天 高 完成报告');
    return jsonResp({ ok: true });
  }

  // Regular message — parse as task
  const user = await env.DB.prepare(
    `SELECT api_token FROM telegram_users WHERE telegram_user_id = ?`
  ).bind(userId).first();

  if (!user) {
    await sendTelegram(chatId, env, '请先发送 /token <你的API密钥> 绑定账号');
    return jsonResp({ ok: true });
  }

  const parsed = parseTelegramMessage(text);
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO pending_tasks (id, title, description, priority, category, due_date, duration, no_time_limit, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, parsed.title, '',
    parsed.priority, parsed.category, parsed.dueDate,
    60, 0, 'telegram'
  ).run();

  const priorityLabel = { high: '高', medium: '中', low: '低' }[parsed.priority];
  const dateLabel = parsed.dueDate || '无期限';
  await sendTelegram(chatId, env,
    `已添加: ${parsed.title}\n优先级: ${priorityLabel} | 日期: ${dateLabel}${parsed.category ? ' | 分类: ' + parsed.category : ''}`
  );

  return jsonResp({ ok: true });
}

async function sendTelegram(chatId, env, text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

function parseTelegramMessage(text) {
  let remaining = text;
  let category = '';
  let priority = 'medium';
  let dueDate = '';

  // Extract #category tags
  const categoryMatch = remaining.match(/#(\S+)/);
  if (categoryMatch) {
    const catName = categoryMatch[1];
    const knownCategories = ['工作', '生活', '学习', 'work', 'life', 'study'];
    if (knownCategories.some(c => catName.toLowerCase().includes(c.toLowerCase()))) {
      category = catName;
      remaining = remaining.replace(categoryMatch[0], '').trim();
    }
  }

  // Extract priority: 高优先级/高/中优先级/中/低优先级/低
  const priorityMap = { '高优先级': 'high', '高': 'high', '中优先级': 'medium', '中': 'medium', '低优先级': 'low', '低': 'low' };
  for (const [keyword, value] of Object.entries(priorityMap)) {
    if (remaining.includes(keyword)) {
      priority = value;
      remaining = remaining.replace(keyword, '').trim();
      break;
    }
  }

  // Extract date keywords
  const now = new Date();
  const today = formatDate(now);
  const tomorrow = formatDate(new Date(now.getTime() + 86400000));
  const dayAfter = formatDate(new Date(now.getTime() + 2 * 86400000));

  const dateKeywords = { '后天': dayAfter, '明天': tomorrow, '今天': today };
  for (const [keyword, date] of Object.entries(dateKeywords)) {
    if (remaining.includes(keyword)) {
      dueDate = date;
      remaining = remaining.replace(keyword, '').trim();
      break;
    }
  }

  // Extract specific date: M月D日 or MM月DD日
  const datePattern = remaining.match(/(\d{1,2})月(\d{1,2})日/);
  if (datePattern) {
    const month = parseInt(datePattern[1]);
    const day = parseInt(datePattern[2]);
    const year = now.getFullYear();
    // If the date has passed this year, use next year
    const candidate = new Date(year, month - 1, day);
    if (candidate < now) candidate.setFullYear(year + 1);
    dueDate = formatDate(candidate);
    remaining = remaining.replace(datePattern[0], '').trim();
  }

  // Extract weekday: 周X or 星期X
  if (!dueDate) {
    const weekdayMap = { '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
    const weekdayMatch = remaining.match(/(?:周|星期)([一二三四五六日])/);
    if (weekdayMatch) {
      const targetDay = weekdayMap[weekdayMatch[1]];
      const currentDay = now.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      dueDate = formatDate(new Date(now.getTime() + daysUntil * 86400000));
      remaining = remaining.replace(weekdayMatch[0], '').trim();
    }
  }

  // Default to today if no date extracted
  if (!dueDate) {
    dueDate = today;
  }

  // Everything remaining is the title
  let title = remaining.replace(/\s+/g, ' ').trim();
  if (!title) title = text; // Fallback to original message

  return { title, priority, category, dueDate };
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Incremental data sync ─────────────────────────────

const SYNC_RECORD_TYPES = new Set(['task', 'category', 'settings']);
const MAX_SYNC_CHANGES = 500;

const syncRecordKey = (type, id) => `${type}:${id}`;

function normalizeSyncRecord(raw, sourceDevice) {
  if (!raw || !SYNC_RECORD_TYPES.has(raw.type) || typeof raw.id !== 'string' || !raw.id) {
    return null;
  }
  const updatedAt = Number(raw.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;
  if (raw.deleted !== true && (!raw.payload || typeof raw.payload !== 'object')) return null;

  return {
    key: syncRecordKey(raw.type, raw.id),
    type: raw.type,
    id: raw.id,
    payload: raw.deleted === true ? null : JSON.stringify(raw.payload),
    deleted: raw.deleted === true ? 1 : 0,
    updatedAt: Math.floor(updatedAt),
    sourceDevice,
  };
}

async function applySyncRecord(env, record) {
  const existing = await env.DB.prepare(
    `SELECT record_type, record_id, payload, deleted, updated_at, source_device
     FROM sync_records WHERE record_key = ?`
  ).bind(record.key).first();

  // Last-write-wins is deterministic for the same record. Different records
  // are independent, so edits made on separate tasks always coexist.
  if (existing) {
    const existingUpdatedAt = Number(existing.updated_at);
    const existingDevice = existing.source_device || '';
    if (existingUpdatedAt > record.updatedAt ||
        (existingUpdatedAt === record.updatedAt && existingDevice >= record.sourceDevice)) {
      return {
        accepted: false,
        canonical: {
          type: existing.record_type,
          id: existing.record_id,
          payload: existing.payload ? JSON.parse(existing.payload) : null,
          deleted: existing.deleted === 1,
          updatedAt: existingUpdatedAt,
          sourceDevice: existingDevice,
        },
      };
    }
  }

  await env.DB.prepare(
    `INSERT INTO sync_records (record_key, record_type, record_id, payload, deleted, updated_at, source_device)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(record_key) DO UPDATE SET
       record_type = excluded.record_type,
       record_id = excluded.record_id,
       payload = excluded.payload,
       deleted = excluded.deleted,
       updated_at = excluded.updated_at,
       source_device = excluded.source_device`
  ).bind(
    record.key, record.type, record.id, record.payload, record.deleted,
    record.updatedAt, record.sourceDevice
  ).run();

  const change = await env.DB.prepare(
    `INSERT INTO sync_changes (record_key, record_type, record_id, payload, deleted, updated_at, source_device)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    record.key, record.type, record.id, record.payload, record.deleted,
    record.updatedAt, record.sourceDevice
  ).run();
  const revision = Number(change.meta?.last_row_id || 0);
  if (revision) {
    await env.DB.prepare('UPDATE sync_records SET revision = ? WHERE record_key = ?')
      .bind(revision, record.key).run();
  }
  return { accepted: true };
}

async function migrateLegacyFullSync(env) {
  const existing = await env.DB.prepare('SELECT 1 FROM sync_records LIMIT 1').first();
  if (existing) return;

  const legacy = await env.DB.prepare(
    "SELECT value, updated_at FROM user_data WHERE key = 'full_sync'"
  ).first();
  if (!legacy) return;

  try {
    const data = JSON.parse(legacy.value);
    const fallbackUpdatedAt = Date.parse(legacy.updated_at || '') || Date.now();
    const sourceDevice = 'legacy-full-sync';
    const records = [];
    for (const task of Array.isArray(data.tasks) ? data.tasks : []) {
      if (!task?.id) continue;
      records.push({ type: 'task', id: String(task.id), payload: task, updatedAt: task.updatedAt || fallbackUpdatedAt });
    }
    for (const category of Array.isArray(data.categories) ? data.categories : []) {
      if (!category?.id) continue;
      records.push({ type: 'category', id: String(category.id), payload: category, updatedAt: category.updatedAt || fallbackUpdatedAt });
    }
    records.push({
      type: 'settings',
      id: 'app',
      payload: {
        defaultCategory: data.defaultCategory || '',
        hideCompleted: !!data.hideCompleted,
        hideOverdue: !!data.hideOverdue,
        showNoTimeLimitOnly: !!data.showNoTimeLimitOnly,
        darkMode: !!data.darkMode,
        weeklyGoalMinutes: data.weeklyGoalMinutes,
        weeklyGoalAnchor: data.weeklyGoalAnchor,
      },
      updatedAt: data.syncSettingsUpdatedAt || fallbackUpdatedAt,
    });
    for (const raw of records) {
      const record = normalizeSyncRecord(raw, sourceDevice);
      if (record) await applySyncRecord(env, record);
    }
  } catch {
    // A malformed legacy snapshot must not make the new sync endpoint fail.
  }
}

async function handleIncrementalSync(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResp({ error: 'invalid JSON body' }, 400);
  }
  const sourceDevice = typeof body.deviceId === 'string' && body.deviceId.length <= 128
    ? body.deviceId
    : '';
  if (!sourceDevice) return jsonResp({ error: 'deviceId is required' }, 400);
  const cursor = Number.isInteger(body.cursor) && body.cursor >= 0 ? body.cursor : 0;
  if (!Array.isArray(body.changes) || body.changes.length > MAX_SYNC_CHANGES) {
    return jsonResp({ error: `changes must be an array of at most ${MAX_SYNC_CHANGES}` }, 400);
  }

  await migrateLegacyFullSync(env);
  const rejectedChanges = [];
  for (const raw of body.changes) {
    const record = normalizeSyncRecord(raw, sourceDevice);
    if (!record) return jsonResp({ error: 'invalid sync record' }, 400);
    const outcome = await applySyncRecord(env, record);
    if (!outcome.accepted && outcome.canonical) rejectedChanges.push(outcome.canonical);
  }

  const { results } = await env.DB.prepare(
    `SELECT revision, record_type, record_id, payload, deleted, updated_at, source_device
     FROM sync_changes WHERE revision > ? ORDER BY revision ASC LIMIT ?`
  ).bind(cursor, MAX_SYNC_CHANGES + 1).all();
  const hasMore = results.length > MAX_SYNC_CHANGES;
  const page = hasMore ? results.slice(0, MAX_SYNC_CHANGES) : results;
  const nextCursor = page.length > 0 ? Number(page[page.length - 1].revision) : cursor;
  const changes = page.map(row => ({
    type: row.record_type,
    id: row.record_id,
    payload: row.payload ? JSON.parse(row.payload) : null,
    deleted: row.deleted === 1,
    updatedAt: Number(row.updated_at),
    sourceDevice: row.source_device,
  }));
  return jsonResp({ changes, rejectedChanges, cursor: nextCursor, hasMore });
}

// ── Full Data Sync ─────────────────────────────────────

async function hasIncrementalRecords(env) {
  const row = await env.DB.prepare('SELECT 1 FROM sync_records LIMIT 1').first();
  return !!row;
}

const legacyUpgradeRequired = () => jsonResp({
  error: 'upgrade_required',
  hint: 'Please reload the current TaskMaster extension before syncing.'
}, 409);

async function handleFullSyncGet(env) {
  if (await hasIncrementalRecords(env)) return legacyUpgradeRequired();
  const row = await env.DB.prepare(
    `SELECT value, updated_at FROM user_data WHERE key = 'full_sync'`
  ).first();
  if (!row) {
    return jsonResp({ data: null, updatedAt: null });
  }
  const data = JSON.parse(row.value);
  return jsonResp({ data, updatedAt: row.updated_at });
}

async function handleFullSyncSet(request, env) {
  if (await hasIncrementalRecords(env)) return legacyUpgradeRequired();
  const body = await request.json();
  if (!body.data || typeof body.data !== 'object') {
    return jsonResp({ error: 'data object required' }, 400);
  }
  // Validate basic structure
  if (!Array.isArray(body.data.tasks)) {
    return jsonResp({ error: 'data.tasks must be an array' }, 400);
  }
  const force = body.force === true;

  // Read current cloud state once (feeds both empty-guard and optimistic lock)
  const existing = await env.DB.prepare(
    `SELECT value, updated_at FROM user_data WHERE key = 'full_sync'`
  ).first();
  let existingTaskCount = 0;
  let currentUpdatedAt = null;
  if (existing) {
    currentUpdatedAt = existing.updated_at;
    try {
      const parsed = JSON.parse(existing.value);
      existingTaskCount = Array.isArray(parsed.tasks) ? parsed.tasks.length : 0;
    } catch {}
  }

  // Guard 1: refuse empty data overwriting non-empty cloud (reinstall wipe protection)
  if (!force && body.data.tasks.length === 0 && existingTaskCount > 0) {
    return jsonResp({
      error: 'refused: empty overwrite',
      existingTaskCount,
      hint: 'send force:true to confirm intentional wipe'
    }, 409);
  }

  // Guard 2: optimistic lock — reject stale base version to prevent partial overwrite
  if (!force && body.baseUpdatedAt && currentUpdatedAt && body.baseUpdatedAt !== currentUpdatedAt) {
    return jsonResp({
      error: 'conflict',
      currentUpdatedAt,
      existingTaskCount
    }, 409);
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO user_data (key, value, updated_at) VALUES ('full_sync', ?, ?)`
  ).bind(JSON.stringify(body.data), now).run();
  return jsonResp({ ok: true, updatedAt: now });
}

// ── Embedded static files ─────────────────────────────

const PWA_MANIFEST = JSON.stringify({
  name: "TaskMaster Quick Add",
  short_name: "Add Task",
  start_url: "/",
  display: "standalone",
  background_color: "#ffffff",
  theme_color: "#3b82f6",
  icons: [
    { src: "/icon.svg", sizes: "any", type: "image/svg+xml" }
  ]
});

const PWA_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#2563eb"/><path fill="#fff" d="M37 30h54v68H37z" opacity=".2"/><path fill="#fff" d="M45 32h38v8H45zm0 17h38v8H45zm0 17h25v8H45zm0 17h25v8H45z"/><path fill="#86efac" d="m92 78 6 6 14-16 6 5-20 23-12-12z"/></svg>`;
