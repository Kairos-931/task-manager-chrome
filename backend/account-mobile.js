const DEFAULT_CATEGORIES = [
  { id: 'default-work', name: '工作', color: '#3b82f6' },
  { id: 'default-life', name: '生活', color: '#10b981' },
  { id: 'default-learning', name: '学习', color: '#8b5cf6' },
]

export const renderAccountMobilePage = (env) => {
  const webClientId = typeof env.GOOGLE_WEB_CLIENT_ID === 'string' ? env.GOOGLE_WEB_CLIENT_ID : ''
  const safeClientId = JSON.stringify(webClientId).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#2563eb">
  <title>TaskMaster · 添加任务</title>
  <link rel="manifest" href="/manifest.json">
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; padding: 22px 16px 32px; color: #1e293b; background: #f1f5f9; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
    main { max-width: 460px; margin: 0 auto; }
    header { padding: 16px 4px 18px; }
    h1 { margin: 0; color: #2563eb; font-size: 22px; }
    header p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
    .card { margin-bottom: 14px; padding: 18px; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; box-shadow: 0 3px 12px #0f172a0a; }
    .account-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .account-copy { min-width: 0; }
    .account-copy strong { display: block; font-size: 14px; }
    .account-copy span { display: block; overflow-wrap: anywhere; color: #64748b; font-size: 12px; }
    #googleButton { margin-top: 14px; }
    #loginHelp, #status { min-height: 20px; margin: 9px 0 0; color: #64748b; font-size: 12px; }
    .error { color: #b91c1c !important; }
    label { display: block; margin: 0 0 6px; color: #475569; font-size: 13px; font-weight: 600; }
    input, select, textarea { width: 100%; margin-bottom: 14px; padding: 11px 12px; border: 1px solid #cbd5e1; border-radius: 9px; color: #0f172a; background: #fff; font: inherit; }
    .check-row { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; color: #475569; font-weight: 500; cursor: pointer; }
    .check-row input { width: 18px; height: 18px; flex: 0 0 auto; margin: 0; accent-color: #2563eb; }
    textarea { min-height: 76px; resize: vertical; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .row > div { min-width: 0; }
    button { border: 0; border-radius: 9px; cursor: pointer; font: inherit; }
    button:disabled { opacity: .55; cursor: wait; }
    .primary { width: 100%; padding: 13px; color: #fff; background: #2563eb; font-weight: 650; }
    .secondary { padding: 7px 10px; color: #475569; background: #f1f5f9; font-size: 12px; white-space: nowrap; }
    #taskCard[hidden], #loggedIn[hidden], #setupNotice[hidden] { display: none; }
    @media (prefers-color-scheme: dark) {
      body { color: #e2e8f0; background: #0f172a; }
      .card { border-color: #334155; background: #1e293b; }
      .account-copy span, header p, #loginHelp, #status, label { color: #94a3b8; }
      input, select, textarea { border-color: #475569; color: #e2e8f0; background: #0f172a; }
      .secondary { color: #cbd5e1; background: #334155; }
    }
  </style>
</head>
<body>
  <main>
    <header><h1>TaskMaster</h1><p>用 Google 登录，把任务安全同步到你的账号</p></header>
    <section class="card" aria-label="账号">
      <div class="account-row">
        <div class="account-copy"><strong id="accountTitle">尚未登录</strong><span id="accountEmail">任务会保存到你自己的账号</span></div>
        <button id="signOutBtn" class="secondary" type="button" hidden>退出</button>
      </div>
      <div id="googleButton"></div>
      <p id="setupNotice" class="error" hidden>Google 登录服务尚未配置，请稍后再试。</p>
      <p id="loginHelp">登录后，这台手机只会访问当前 Google 账号的任务。</p>
    </section>
    <section id="taskCard" class="card" hidden>
      <label for="title">任务名称</label>
      <input id="title" maxlength="500" autocomplete="off" placeholder="输入要添加的任务" required>
      <div class="row">
        <div><label for="priority">优先级</label><select id="priority"><option value="medium">中</option><option value="high">高</option><option value="low">低</option></select></div>
        <div><label for="category">分类</label><select id="category"></select></div>
      </div>
      <label for="dueDate">计划日期</label>
      <input id="dueDate" type="date" required>
      <label class="check-row" for="noTimeLimit"><input id="noTimeLimit" type="checkbox"><span>放入任务池，不设置计划日期</span></label>
      <label for="duration">预计时长（分钟）</label>
      <input id="duration" type="number" min="0" max="1440" step="15" value="60" inputmode="numeric">
      <label class="check-row" for="completed"><input id="completed" type="checkbox"><span>添加时标记为已完成</span></label>
      <label for="description">备注</label>
      <textarea id="description" maxlength="5000" placeholder="可选"></textarea>
      <button id="submitBtn" class="primary" type="button">添加任务</button>
      <p id="status" role="status" aria-live="polite"></p>
    </section>
    <footer style="padding:2px 4px;color:#94a3b8;font-size:11px;">
      管理员旧版入口：<a href="/legacy" style="color:#64748b;text-decoration:underline;">旧版连接页面</a>
    </footer>
  </main>
  <script>
    (() => {
      const GOOGLE_WEB_CLIENT_ID = ${safeClientId};
      const accountTitle = document.getElementById('accountTitle');
      const accountEmail = document.getElementById('accountEmail');
      const taskCard = document.getElementById('taskCard');
      const loginHelp = document.getElementById('loginHelp');
      const status = document.getElementById('status');
      const signOutBtn = document.getElementById('signOutBtn');
      const today = new Date();
      document.getElementById('dueDate').value = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
      document.getElementById('noTimeLimit').addEventListener('change', (event) => {
        const noTimeLimit = event.currentTarget.checked;
        const dueDate = document.getElementById('dueDate');
        dueDate.disabled = noTimeLimit;
        dueDate.required = !noTimeLimit;
      });
      let googleCredential = '';
      let accountSub = '';
      let categories = ${JSON.stringify(DEFAULT_CATEGORIES)};
      let deviceId = localStorage.getItem('tm_mobile_device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('tm_mobile_device_id', deviceId);
      }

      const showError = (message) => {
        loginHelp.textContent = message;
        loginHelp.classList.add('error');
      };
      const authorizationHeaders = () => ({ Authorization: 'Bearer ' + googleCredential });
      const expireSession = () => {
        googleCredential = '';
        accountSub = '';
        taskCard.hidden = true;
        signOutBtn.hidden = true;
        accountTitle.textContent = '需要重新登录';
        accountEmail.textContent = '';
        showError('Google 登录已失效，请重新登录后继续。');
      };

      const loadCategories = async () => {
        const select = document.getElementById('category');
        try {
          const response = await fetch('/api/account/categories', { headers: authorizationHeaders() });
          if (response.status === 401) throw new Error('Google 登录已失效，请重新登录。');
          if (!response.ok) throw new Error('分类暂时无法加载；仍可使用默认分类添加任务。');
          const data = await response.json();
          if (Array.isArray(data.categories) && data.categories.length) categories = data.categories;
        } catch (error) {
          if (error.message.includes('登录已失效')) {
            expireSession();
            showError(error.message);
            return;
          }
          status.textContent = error.message;
        }
        select.replaceChildren(...categories.map(category => {
          const option = document.createElement('option');
          option.value = category.id;
          option.textContent = category.name;
          return option;
        }));
      };

      const onGoogleCredential = async (response) => {
        status.textContent = '正在验证 Google 账号…';
        status.classList.remove('error');
        try {
          const identity = await fetch('/api/google/identity', {
            headers: { Authorization: 'Bearer ' + response.credential }
          });
          if (!identity.ok) throw new Error(identity.status === 503 ? '登录服务暂不可用，请稍后重试。' : 'Google 登录验证失败，请重试。');
          const data = await identity.json();
          if (!data.user || typeof data.user.sub !== 'string') throw new Error('无法确认 Google 账号，请重试。');
          googleCredential = response.credential;
          accountSub = data.user.sub;
          accountTitle.textContent = '已连接 Google 账号';
          accountEmail.textContent = data.user.email || '账号已验证';
          taskCard.hidden = false;
          signOutBtn.hidden = false;
          loginHelp.textContent = '任务会自动保存到当前账号的数据空间。';
          loginHelp.classList.remove('error');
          status.textContent = '';
          await loadCategories();
          document.getElementById('title').focus();
        } catch (error) {
          status.textContent = error.message || '登录失败，请重试。';
          status.classList.add('error');
        }
      };

      let googleScriptAttempts = 0;
      const initializeGoogle = () => {
        if (!GOOGLE_WEB_CLIENT_ID) {
          document.getElementById('setupNotice').hidden = false;
          document.getElementById('googleButton').hidden = true;
          loginHelp.textContent = '当前手机端还没有 Google 登录配置。';
          return;
        }
        if (!window.google || !window.google.accounts || !window.google.accounts.id) {
          googleScriptAttempts += 1;
          if (googleScriptAttempts < 120) setTimeout(initializeGoogle, 250);
          else showError('Google 登录暂时无法加载，请检查网络后刷新页面。');
          return;
        }
        window.google.accounts.id.initialize({ client_id: GOOGLE_WEB_CLIENT_ID, callback: onGoogleCredential, auto_select: false });
        window.google.accounts.id.renderButton(document.getElementById('googleButton'), {
          type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 320
        });
      };

      signOutBtn.addEventListener('click', () => {
        googleCredential = '';
        accountSub = '';
        taskCard.hidden = true;
        signOutBtn.hidden = true;
        accountTitle.textContent = '尚未登录';
        accountEmail.textContent = '本机未保存账号凭证';
        status.textContent = '';
        showError('已退出。手机任务仍保存在所属账号的云端，需要再次登录后才能添加。');
        if (window.google && window.google.accounts && window.google.accounts.id) window.google.accounts.id.disableAutoSelect();
      });

      document.getElementById('submitBtn').addEventListener('click', async () => {
        const titleInput = document.getElementById('title');
        const title = titleInput.value.trim();
        if (!googleCredential || !accountSub) return showError('请先登录 Google 账号。');
        if (!title) return showError('请先填写任务名称。');
        const button = document.getElementById('submitBtn');
        button.disabled = true;
        button.textContent = '添加中…';
        status.classList.remove('error');
        status.textContent = '正在保存到当前账号…';
        try {
          const response = await fetch('/api/account/tasks', {
            method: 'POST',
            headers: { ...authorizationHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title,
              description: document.getElementById('description').value.trim(),
              priority: document.getElementById('priority').value,
              category: document.getElementById('category').value,
              dueDate: document.getElementById('noTimeLimit').checked ? '' : document.getElementById('dueDate').value,
              noTimeLimit: document.getElementById('noTimeLimit').checked,
              duration: Number(document.getElementById('duration').value),
              completed: document.getElementById('completed').checked,
              deviceId,
            }),
          });
          if (response.status === 401) {
            expireSession();
            throw new Error('Google 登录已失效，请重新登录后再添加。');
          }
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error || '添加失败，请重试。');
          titleInput.value = '';
          document.getElementById('description').value = '';
          document.getElementById('noTimeLimit').checked = false;
          document.getElementById('dueDate').disabled = false;
          document.getElementById('dueDate').required = true;
          document.getElementById('completed').checked = false;
          status.textContent = '已保存到账号，电脑联网后会自动同步。';
          titleInput.focus();
        } catch (error) {
          status.textContent = error.message || '网络暂不可用，内容仍在输入框中；恢复连接后可重试。';
          status.classList.add('error');
          if (String(error.message).includes('登录已失效')) showError(error.message);
        } finally {
          button.disabled = false;
          button.textContent = '添加任务';
        }
      });

      initializeGoogle();
    })();
  </script>
</body>
</html>`
}
