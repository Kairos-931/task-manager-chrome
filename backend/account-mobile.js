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
    #status.uncertain { color: #92400e; }
    #saveFeedback[hidden], #saveFeedbackRetry[hidden], #saveFeedbackDismiss[hidden] { display: none; }
    #saveFeedback { position: fixed; z-index: 20; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(360px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; padding: 20px; border: 1px solid #cbd5e1; border-radius: 16px; background: #fff; box-shadow: 0 18px 48px #0f172a38; text-align: center; }
    #saveFeedback.saving { border-color: #93c5fd; }
    #saveFeedback.success { border-color: #86efac; }
    #saveFeedback.error { border-color: #fca5a5; }
    #saveFeedback.uncertain, #saveFeedback.warning { border-color: #fcd34d; }
    #saveFeedbackIcon { color: #2563eb; font-size: 24px; font-weight: 700; }
    #saveFeedback.success #saveFeedbackIcon { color: #16a34a; }
    #saveFeedback.error #saveFeedbackIcon { color: #dc2626; }
    #saveFeedback.uncertain #saveFeedbackIcon, #saveFeedback.warning #saveFeedbackIcon { color: #b45309; }
    #saveFeedbackMessage { margin: 8px 0 0; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
    .feedback-actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .feedback-retry { padding: 8px 12px; color: #fff; background: #2563eb; font-size: 13px; }
    .feedback-actions button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
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
      #status.uncertain { color: #fbbf24; }
      input, select, textarea { border-color: #475569; color: #e2e8f0; background: #0f172a; }
      .secondary { color: #cbd5e1; background: #334155; }
      #saveFeedback { color: #e2e8f0; background: #1e293b; }
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
      <button id="restartLoginBtn" class="secondary" type="button" hidden>刷新后重新登录</button>
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
      <p id="status"></p>
    </section>
  </main>
  <aside id="saveFeedback" role="status" aria-live="polite" aria-atomic="true" hidden>
    <div id="saveFeedbackIcon" aria-hidden="true"></div>
    <p id="saveFeedbackMessage"></p>
    <div class="feedback-actions">
      <button id="saveFeedbackRetry" class="feedback-retry" type="button" hidden>重试添加</button>
      <button id="saveFeedbackDismiss" class="secondary" type="button" hidden>关闭</button>
    </div>
  </aside>
  <script>
    (() => {
      const GOOGLE_WEB_CLIENT_ID = ${safeClientId};
      const accountTitle = document.getElementById('accountTitle');
      const accountEmail = document.getElementById('accountEmail');
      const taskCard = document.getElementById('taskCard');
      const loginHelp = document.getElementById('loginHelp');
      const status = document.getElementById('status');
      const saveFeedback = document.getElementById('saveFeedback');
      const saveFeedbackIcon = document.getElementById('saveFeedbackIcon');
      const saveFeedbackMessage = document.getElementById('saveFeedbackMessage');
      const saveFeedbackRetry = document.getElementById('saveFeedbackRetry');
      const saveFeedbackDismiss = document.getElementById('saveFeedbackDismiss');
      const signOutBtn = document.getElementById('signOutBtn');
      const restartLoginBtn = document.getElementById('restartLoginBtn');
      const today = new Date();
      document.getElementById('dueDate').value = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
      document.getElementById('noTimeLimit').addEventListener('change', (event) => {
        const noTimeLimit = event.currentTarget.checked;
        const dueDate = document.getElementById('dueDate');
        dueDate.disabled = noTimeLimit;
        dueDate.required = !noTimeLimit;
      });
      const MOBILE_SESSION_KEY = 'tm_google_mobile_session_v1';
      const MOBILE_PENDING_TASK_PREFIX = 'tm_mobile_pending_task_v1:';
      const CLIENT_TASK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const TASK_FIELD_IDS = ['title', 'description', 'priority', 'category', 'dueDate', 'noTimeLimit', 'duration', 'completed'];
      const MOBILE_SAVE_TIMEOUT_MS = 15000;
      let googleCredential = '';
      let accountSub = '';
      let googleState = '';
      let googleNonce = '';
      let categories = ${JSON.stringify(DEFAULT_CATEGORIES)};
      let pendingTaskMutation = null;
      let isSavingTask = false;
      let isConfirmingTaskMutation = false;
      let hasUncertainTaskMutation = false;
      let lastSaveWasDefiniteFailure = false;
      let taskWasDeletedAfterSave = false;
      let saveFeedbackTimer = 0;
      let deviceId = localStorage.getItem('tm_mobile_device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('tm_mobile_device_id', deviceId);
      }

      const showError = (message) => {
        loginHelp.textContent = message;
        loginHelp.classList.add('error');
      };
      const authorizationHeaders = () => ({
        Authorization: 'Bearer ' + googleCredential,
        'X-TaskMaster-Client': 'mobile',
      });
      const pendingTaskStorageKey = (sub) => MOBILE_PENDING_TASK_PREFIX + sub;
      const setTaskFieldsLocked = (locked) => {
        const noTimeLimit = document.getElementById('noTimeLimit').checked;
        for (const id of TASK_FIELD_IDS) {
          document.getElementById(id).disabled = locked || (id === 'dueDate' && noTimeLimit);
        }
      };
      const hideSaveFeedback = () => {
        clearTimeout(saveFeedbackTimer);
        saveFeedbackTimer = 0;
        saveFeedback.hidden = true;
      };
      const setSaveStatus = (message, kind) => {
        status.textContent = message;
        status.classList.remove('error', 'uncertain');
        if (kind === 'error' || kind === 'uncertain') status.classList.add(kind);
        hideSaveFeedback();
        saveFeedbackMessage.textContent = message;
        saveFeedback.classList.remove('saving', 'success', 'error', 'uncertain', 'warning');
        saveFeedback.classList.add(kind);
        saveFeedbackIcon.textContent = kind === 'success' ? '✓' : (kind === 'saving' ? '…' : '!');
        saveFeedbackRetry.hidden = !['error', 'uncertain', 'warning'].includes(kind) || !googleCredential || !accountSub;
        saveFeedbackRetry.textContent = kind === 'uncertain' ? '安全重试保存' : (taskWasDeletedAfterSave ? '重新添加' : '重试添加');
        saveFeedbackDismiss.hidden = kind === 'saving';
        saveFeedbackDismiss.textContent = kind === 'success' ? '继续添加' : (!googleCredential ? '去重新登录' : '返回修改');
        saveFeedback.hidden = false;
        if (kind === 'success') saveFeedbackTimer = setTimeout(hideSaveFeedback, 1800);
      };
      const updateSubmitButton = () => {
        const button = document.getElementById('submitBtn');
        button.disabled = isSavingTask;
        button.textContent = isSavingTask
          ? (isConfirmingTaskMutation ? '确认中…' : '添加中…')
          : (pendingTaskMutation ? '安全重试保存' : (taskWasDeletedAfterSave ? '重新添加' : (lastSaveWasDefiniteFailure ? '重试添加' : '添加任务')));
      };
      const showUncertainTaskSave = () => {
        hasUncertainTaskMutation = true;
        setSaveStatus('暂未收到服务器确认。任务可能已保存；点击“安全重试保存”会复用同一编号，不会重复添加。', 'uncertain');
      };
      const savePendingTaskMutation = (mutation) => {
        pendingTaskMutation = mutation;
        hasUncertainTaskMutation = false;
        try {
          sessionStorage.setItem(pendingTaskStorageKey(mutation.accountSub), JSON.stringify(mutation));
        } catch { /* The in-memory request ID still protects retries until this page closes. */ }
      };
      const clearPendingTaskMutation = () => {
        if (!pendingTaskMutation) return;
        try { sessionStorage.removeItem(pendingTaskStorageKey(pendingTaskMutation.accountSub)); } catch { /* Keep the form usable if storage is unavailable. */ }
        pendingTaskMutation = null;
        hasUncertainTaskMutation = false;
      };
      const restoreTaskPayload = (payload) => {
        document.getElementById('title').value = payload.title;
        document.getElementById('description').value = payload.description;
        document.getElementById('priority').value = payload.priority;
        document.getElementById('category').value = payload.category;
        document.getElementById('dueDate').value = payload.dueDate;
        document.getElementById('noTimeLimit').checked = payload.noTimeLimit;
        document.getElementById('dueDate').disabled = payload.noTimeLimit;
        document.getElementById('dueDate').required = !payload.noTimeLimit;
        document.getElementById('duration').value = String(payload.duration);
        document.getElementById('completed').checked = payload.completed;
      };
      const restorePendingTaskMutation = () => {
        pendingTaskMutation = null;
        setTaskFieldsLocked(false);
        let stored;
        try { stored = JSON.parse(sessionStorage.getItem(pendingTaskStorageKey(accountSub)) || 'null'); } catch { stored = null; }
        if (!stored || stored.version !== 1 || stored.accountSub !== accountSub ||
            !CLIENT_TASK_ID_PATTERN.test(stored.id || '') || !stored.payload ||
            typeof stored.payload.title !== 'string' || typeof stored.payload.description !== 'string' ||
            typeof stored.payload.priority !== 'string' || typeof stored.payload.category !== 'string' ||
            typeof stored.payload.dueDate !== 'string' || typeof stored.payload.noTimeLimit !== 'boolean' ||
            !Number.isInteger(stored.payload.duration) || typeof stored.payload.completed !== 'boolean' ||
            typeof stored.payload.deviceId !== 'string') return;
        pendingTaskMutation = stored;
        hasUncertainTaskMutation = true;
        lastSaveWasDefiniteFailure = false;
        taskWasDeletedAfterSave = false;
        restoreTaskPayload(stored.payload);
        setTaskFieldsLocked(true);
        updateSubmitButton();
        setSaveStatus('上次提交没有收到服务器确认。任务可能已保存；点击“安全重试保存”会复用同一编号，不会重复添加。', 'uncertain');
      };
      const clearMobileSession = () => {
        googleCredential = '';
        accountSub = '';
        sessionStorage.removeItem(MOBILE_SESSION_KEY);
      };
      const expireSession = () => {
        clearMobileSession();
        taskCard.hidden = true;
        signOutBtn.hidden = true;
        const canReuseGoogleFlow = !!googleState;
        document.getElementById('googleButton').hidden = !canReuseGoogleFlow;
        restartLoginBtn.hidden = canReuseGoogleFlow;
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

      const showAccount = async (user, sessionToken, expiresAt, persist = true) => {
        googleCredential = sessionToken;
        accountSub = user.sub;
        if (persist) sessionStorage.setItem(MOBILE_SESSION_KEY, JSON.stringify({
          user: { sub: user.sub, email: user.email || '', name: user.name || '' },
          sessionToken,
          expiresAt,
        }));
        document.getElementById('googleButton').hidden = true;
        accountTitle.textContent = '已连接 Google 账号';
        accountEmail.textContent = user.email || '账号已验证';
        taskCard.hidden = false;
        signOutBtn.hidden = false;
        loginHelp.textContent = '任务会自动保存到当前账号的数据空间。';
        loginHelp.classList.remove('error');
        hideSaveFeedback();
        status.textContent = '';
        status.classList.remove('error', 'uncertain');
        await loadCategories();
        restorePendingTaskMutation();
      };

      const onGoogleCredential = async (response) => {
        status.textContent = '正在验证 Google 账号…';
        status.classList.remove('error');
        try {
          const identity = await fetch('/api/google/identity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential, state: googleState }),
          });
          if (!identity.ok) throw new Error(identity.status === 503 ? '登录服务暂不可用，请稍后重试。' : 'Google 登录验证失败，请重试。');
          const data = await identity.json();
          if (!data.user || typeof data.user.sub !== 'string' || typeof data.sessionToken !== 'string') {
            throw new Error('无法确认 Google 账号，请重试。');
          }
          googleState = '';
          googleNonce = '';
          await showAccount(data.user, data.sessionToken, data.expiresAt);
          document.getElementById('title').focus();
        } catch (error) {
          googleState = '';
          googleNonce = '';
          document.getElementById('googleButton').hidden = true;
          restartLoginBtn.hidden = false;
          status.textContent = error.message || '登录失败，请重试。';
          status.classList.add('error');
        }
      };

      let googleScriptAttempts = 0;
      let googleClientInitialized = false;
      const prepareGoogleClient = async () => {
        const flow = await fetch('/api/google/mobile-auth/start', { method: 'POST' });
        const flowData = await flow.json().catch(() => ({}));
        if (!flow.ok || typeof flowData.state !== 'string' || typeof flowData.nonce !== 'string') {
          throw new Error(flow.status === 503 ? '登录服务暂不可用，请稍后重试。' : '无法启动 Google 登录，请刷新页面重试。');
        }
        googleState = flowData.state;
        googleNonce = flowData.nonce;
        document.getElementById('googleButton').replaceChildren();
        window.google.accounts.id.initialize({
          client_id: GOOGLE_WEB_CLIENT_ID,
          callback: onGoogleCredential,
          auto_select: false,
          nonce: googleNonce,
        });
        window.google.accounts.id.renderButton(document.getElementById('googleButton'), {
          type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 320
        });
        googleClientInitialized = true;
        if (!googleCredential) {
          document.getElementById('googleButton').hidden = false;
          restartLoginBtn.hidden = true;
        }
      };
      const initializeGoogle = async () => {
        if (!GOOGLE_WEB_CLIENT_ID) {
          document.getElementById('setupNotice').hidden = false;
          document.getElementById('googleButton').hidden = true;
          loginHelp.textContent = '当前手机端还没有 Google 登录配置。';
          return;
        }
        if (!window.google || !window.google.accounts || !window.google.accounts.id) {
          googleScriptAttempts += 1;
          if (googleScriptAttempts < 120) setTimeout(() => { void initializeGoogle(); }, 250);
          else showError('Google 登录暂时无法加载，请检查网络后刷新页面。');
          return;
        }
        if (googleClientInitialized) return;
        try {
          const stored = JSON.parse(sessionStorage.getItem(MOBILE_SESSION_KEY) || 'null');
          if (stored?.sessionToken && stored?.user?.sub && Number(stored.expiresAt) > Date.now()) {
            await showAccount(stored.user, stored.sessionToken, stored.expiresAt, false);
          } else {
            sessionStorage.removeItem(MOBILE_SESSION_KEY);
          }
          await prepareGoogleClient();
        } catch (error) {
          showError(error.message || '无法启动 Google 登录，请刷新页面重试。');
          return;
        }
      };

      signOutBtn.addEventListener('click', async () => {
        let revoked = false;
        try {
          const response = await fetch('/api/google/session/logout', {
            method: 'POST', headers: authorizationHeaders(),
          });
          revoked = response.ok || response.status === 401;
        } catch { /* Local sign-out still works while offline; the session expires within seven days. */ }
        clearMobileSession();
        googleState = '';
        googleNonce = '';
        taskCard.hidden = true;
        signOutBtn.hidden = true;
        document.getElementById('googleButton').hidden = true;
        restartLoginBtn.hidden = false;
        accountTitle.textContent = '尚未登录';
        accountEmail.textContent = '本机未保存账号凭证';
        hideSaveFeedback();
        status.textContent = '';
        showError(revoked
          ? '已退出。手机任务仍保存在所属账号的云端；刷新页面后可再次登录。'
          : '本机已退出；当前网络未能确认远端撤销，服务端会话最长 7 天后自动到期。刷新页面可再次登录。');
        if (window.google && window.google.accounts && window.google.accounts.id) window.google.accounts.id.disableAutoSelect();
      });

      restartLoginBtn.addEventListener('click', () => window.location.reload());

      const submitTask = async () => {
        if (isSavingTask) return;
        if (!googleCredential || !accountSub) return showError('请先登录 Google 账号。');
        if (!pendingTaskMutation) {
          const title = document.getElementById('title').value.trim();
          if (!title) return showError('请先填写任务名称。');
          savePendingTaskMutation({
            version: 1,
            id: crypto.randomUUID(),
            accountSub,
            payload: {
              title,
              description: document.getElementById('description').value.trim(),
              priority: document.getElementById('priority').value,
              category: document.getElementById('category').value,
              dueDate: document.getElementById('noTimeLimit').checked ? '' : document.getElementById('dueDate').value,
              noTimeLimit: document.getElementById('noTimeLimit').checked,
              duration: Number(document.getElementById('duration').value),
              completed: document.getElementById('completed').checked,
              deviceId,
            },
          });
        }
        const mutation = pendingTaskMutation;
        const isSafeRetry = hasUncertainTaskMutation;
        isSavingTask = true;
        isConfirmingTaskMutation = isSafeRetry;
        hasUncertainTaskMutation = false;
        taskWasDeletedAfterSave = false;
        lastSaveWasDefiniteFailure = false;
        setTaskFieldsLocked(true);
        updateSubmitButton();
        setSaveStatus(isSafeRetry ? '正在确认上次提交是否已保存…' : '正在保存到当前账号…', 'saving');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), MOBILE_SAVE_TIMEOUT_MS);
        try {
          const response = await fetch('/api/account/tasks', {
            method: 'POST',
            headers: { ...authorizationHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...mutation.payload, clientTaskId: mutation.id }),
            signal: controller.signal,
          });
          const body = await response.json().catch(() => null);
          if (response.status === 401) {
            if (isSafeRetry) {
              hasUncertainTaskMutation = true;
              setTaskFieldsLocked(true);
            } else {
              clearPendingTaskMutation();
              setTaskFieldsLocked(false);
              lastSaveWasDefiniteFailure = true;
            }
            expireSession();
            const message = isSafeRetry
              ? 'Google 登录已失效。上次保存结果仍未确认；重新登录后点击“安全重试保存”即可继续确认。'
              : 'Google 登录已失效。本次任务没有保存，内容仍保留；重新登录后可重试。';
            showError(message);
            setSaveStatus(message, 'error');
            return;
          }
          if (!response.ok) {
            if (response.status >= 500 || response.status === 408 || response.status === 425) {
              showUncertainTaskSave();
              return;
            }
            clearPendingTaskMutation();
            setTaskFieldsLocked(false);
            lastSaveWasDefiniteFailure = true;
            setSaveStatus((body?.error || '服务器未接受本次任务。') + ' 内容仍保留，请修正后重试。', 'error');
            return;
          }
          if (body?.ok === true && body.previouslyDeleted === true && body.taskId === mutation.id) {
            clearPendingTaskMutation();
            setTaskFieldsLocked(false);
            lastSaveWasDefiniteFailure = false;
            taskWasDeletedAfterSave = true;
            setSaveStatus('这条任务此前已保存，之后被电脑端删除。内容已保留；如仍要添加，请点击“重新添加”。', 'warning');
            return;
          }
          if (body?.ok !== true || body?.task?.id !== mutation.id) {
            showUncertainTaskSave();
            return;
          }
          clearPendingTaskMutation();
          setTaskFieldsLocked(false);
          lastSaveWasDefiniteFailure = false;
          document.getElementById('title').value = '';
          document.getElementById('description').value = '';
          document.getElementById('noTimeLimit').checked = false;
          document.getElementById('dueDate').disabled = false;
          document.getElementById('dueDate').required = true;
          document.getElementById('completed').checked = false;
          setSaveStatus(body.alreadyProcessed
            ? '已确认此前已保存到账号，电脑联网后会自动同步。'
            : '已保存到账号，电脑联网后会自动同步。', 'success');
          document.getElementById('title').focus();
        } catch {
          showUncertainTaskSave();
        } finally {
          clearTimeout(timeoutId);
          isSavingTask = false;
          isConfirmingTaskMutation = false;
          updateSubmitButton();
        }
      };
      document.getElementById('submitBtn').addEventListener('click', submitTask);
      saveFeedbackRetry.addEventListener('click', async () => { hideSaveFeedback(); await submitTask(); });
      saveFeedbackDismiss.addEventListener('click', hideSaveFeedback);

      initializeGoogle();
    })();
  </script>
</body>
</html>`
}
