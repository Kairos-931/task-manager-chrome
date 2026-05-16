// TaskMaster API — Cloudflare Worker
// Handles: mobile web page, task CRUD, Telegram bot webhook

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // Serve mobile web page (no auth)
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return serveStatic('index.html', 'text/html');
    }
    if (url.pathname === '/manifest.json') {
      return serveStatic('manifest.json', 'application/json');
    }
    if (url.pathname === '/icon.png') {
      return serveStatic('icon.png', 'image/png');
    }

    // Telegram webhook (auth via bot token in URL path)
    if (url.pathname === '/api/telegram/webhook' && method === 'POST') {
      return handleTelegramWebhook(request, env);
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

    return jsonResp({ error: 'Not Found' }, 404);
  }
};

// ── Auth ──────────────────────────────────────────────

function checkAuth(request, env) {
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// ── Static file serving (embedded) ────────────────────

async function serveStatic(filename, contentType) {
  // These are served from the Worker's static assets or inline
  // For simplicity, the HTML is served inline; assets can be added later
  if (filename === 'index.html') {
    return new Response(MOBILE_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  if (filename === 'manifest.json') {
    return new Response(PWA_MANIFEST, {
      headers: { 'Content-Type': 'application/json' },
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
  await env.DB.prepare(
    `INSERT INTO pending_tasks (id, title, description, priority, category, due_date, duration, no_time_limit, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, title,
    body.description || '',
    body.priority || 'medium',
    body.category || '',
    body.dueDate || '',
    body.duration || 60,
    body.noTimeLimit ? 1 : 0,
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
    source: row.source,
    createdAt: row.created_at,
  };
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

// ── Embedded static files ─────────────────────────────

const PWA_MANIFEST = JSON.stringify({
  name: "TaskMaster Quick Add",
  short_name: "Add Task",
  start_url: "/",
  display: "standalone",
  background_color: "#ffffff",
  theme_color: "#3b82f6",
  icons: [
    { src: "/icon.png", sizes: "128x128", type: "image/png" }
  ]
});

const MOBILE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>TaskMaster 添加任务</title>
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#3b82f6">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f8fafc;
    color: #1e293b;
    min-height: 100vh;
    padding: 16px;
  }
  .header {
    text-align: center;
    padding: 20px 0 16px;
  }
  .header h1 {
    font-size: 20px;
    font-weight: 600;
    color: #3b82f6;
  }
  .header p {
    font-size: 13px;
    color: #94a3b8;
    margin-top: 4px;
  }
  .card {
    background: #fff;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    margin-bottom: 16px;
  }
  .card-title {
    font-size: 14px;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 12px;
  }
  .input-group { margin-bottom: 14px; }
  .input-group label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #475569;
    margin-bottom: 6px;
  }
  input, select, textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    font-size: 15px;
    color: #1e293b;
    background: #fff;
    transition: border-color 0.2s;
    -webkit-appearance: none;
  }
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: #3b82f6;
  }
  textarea { resize: vertical; min-height: 60px; }
  .row {
    display: flex;
    gap: 12px;
  }
  .row > * { flex: 1; }
  .btn {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
  }
  .btn:active { transform: scale(0.98); }
  .btn-primary {
    background: #3b82f6;
    color: #fff;
  }
  .btn-primary:hover { background: #2563eb; }
  .btn-primary:disabled {
    background: #93c5fd;
    cursor: not-allowed;
  }
  .btn-secondary {
    background: #f1f5f9;
    color: #475569;
  }
  .btn-secondary:hover { background: #e2e8f0; }
  .settings-toggle {
    text-align: center;
    margin-bottom: 12px;
  }
  .settings-toggle button {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 13px;
    cursor: pointer;
    padding: 4px 8px;
  }
  .settings-toggle button:hover { color: #64748b; }
  .settings-panel { display: none; }
  .settings-panel.active { display: block; }
  .toast {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(-100px);
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    transition: transform 0.3s ease;
    z-index: 1000;
  }
  .toast.show { transform: translateX(-50%) translateY(0); }
  .toast.success { background: #dcfce7; color: #166534; }
  .toast.error { background: #fee2e2; color: #991b1b; }
  .no-date { display: none; }
  .no-date.active { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
  .no-date label { margin: 0; font-size: 13px; color: #475569; }
  .date-group { transition: opacity 0.2s; }
  .date-group.hidden { opacity: 0.3; pointer-events: none; }
</style>
</head>
<body>

<div class="header">
  <h1>TaskMaster</h1>
  <p>快速添加任务</p>
</div>

<div class="settings-toggle">
  <button id="settingsBtn">设置</button>
</div>

<div class="card settings-panel" id="settingsPanel">
  <div class="card-title">连接设置</div>
  <div class="input-group">
    <label>API 地址</label>
    <input type="url" id="apiUrl" placeholder="https://your-worker.workers.dev">
  </div>
  <div class="input-group">
    <label>API 密钥</label>
    <input type="text" id="apiToken" placeholder="粘贴你的 API Token" autocomplete="off">
  </div>
  <button class="btn btn-secondary" id="saveSettings">保存设置</button>
</div>

<div class="card" id="taskForm">
  <div class="input-group">
    <label>任务名称 *</label>
    <input type="text" id="title" placeholder="输入任务..." autofocus>
  </div>
  <div class="row">
    <div class="input-group">
      <label>优先级</label>
      <select id="priority">
        <option value="medium">中</option>
        <option value="high">高</option>
        <option value="low">低</option>
      </select>
    </div>
    <div class="input-group">
      <label>分类</label>
      <select id="category">
        <option value="">不指定</option>
        <option value="工作">工作</option>
        <option value="生活">生活</option>
        <option value="学习">学习</option>
      </select>
    </div>
  </div>
  <div class="no-date" id="noDateWrap">
    <input type="checkbox" id="noDate">
    <label for="noDate">无期限（进入任务池）</label>
  </div>
  <div class="input-group date-group" id="dateGroup">
    <label>截止日期</label>
    <input type="date" id="dueDate">
  </div>
  <div class="input-group">
    <label>备注</label>
    <textarea id="description" placeholder="可选..." rows="2"></textarea>
  </div>
  <button class="btn btn-primary" id="submitBtn">添加任务</button>
</div>

<div class="toast" id="toast"></div>

<script>
(function() {
  var SETTINGS_KEY = 'taskmaster_settings';

  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      document.getElementById('apiUrl').value = s.apiUrl || '';
      document.getElementById('apiToken').value = s.apiToken || '';
      if (s.apiUrl) {
        document.getElementById('settingsPanel').classList.remove('active');
      } else {
        document.getElementById('settingsPanel').classList.add('active');
      }
    } catch(e) {}
  }

  function saveSettings() {
    var settings = {
      apiUrl: document.getElementById('apiUrl').value.replace(/\\/+$/, ''),
      apiToken: document.getElementById('apiToken').value.trim()
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    showToast('设置已保存', 'success');
    document.getElementById('settingsPanel').classList.remove('active');
  }

  function showToast(msg, type) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + type + ' show';
    setTimeout(function() { t.classList.remove('show'); }, 2500);
  }

  function getToday() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function initDate() {
    document.getElementById('dueDate').value = getToday();
  }

  function toggleNoDate() {
    var checked = document.getElementById('noDate').checked;
    document.getElementById('dateGroup').classList.toggle('hidden', checked);
  }

  function toggleSettings() {
    document.getElementById('settingsPanel').classList.toggle('active');
  }

  async function submitTask() {
    var settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (!settings.apiUrl || !settings.apiToken) {
      showToast('请先完成设置', 'error');
      document.getElementById('settingsPanel').classList.add('active');
      return;
    }

    var title = document.getElementById('title').value.trim();
    if (!title) {
      showToast('请输入任务名称', 'error');
      return;
    }

    var noDate = document.getElementById('noDate').checked;
    var body = {
      title: title,
      description: document.getElementById('description').value.trim(),
      priority: document.getElementById('priority').value,
      category: document.getElementById('category').value,
      dueDate: noDate ? '' : document.getElementById('dueDate').value,
      noTimeLimit: noDate,
      duration: 60,
      source: 'web'
    };

    var btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '添加中...';

    try {
      var res = await fetch(settings.apiUrl + '/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + settings.apiToken
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        showToast('任务已添加', 'success');
        document.getElementById('title').value = '';
        document.getElementById('description').value = '';
        document.getElementById('title').focus();
      } else {
        var err = await res.json().catch(function() { return {}; });
        showToast('添加失败: ' + (err.error || res.status), 'error');
      }
    } catch(e) {
      showToast('网络错误，请检查设置', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '添加任务';
    }
  }

  // Event listeners (no inline handlers — CSP safe)
  document.getElementById('settingsBtn').addEventListener('click', toggleSettings);
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('noDate').addEventListener('change', toggleNoDate);
  document.getElementById('submitBtn').addEventListener('click', submitTask);

  // Submit on Enter in title field
  document.getElementById('title').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      submitTask();
    }
  });

  loadSettings();
  initDate();
})();
</script>
</body>
</html>`;