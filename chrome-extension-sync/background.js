"use strict";
var Background = (() => {
  // shared/config.ts
  var TASKMASTER_API_BASE_URL = "https://taskmaster-api.yx9391.workers.dev";

  // shared/storage.ts
  var LOCAL_BACKUP_KEY = "tm_local_backup";
  var syncQueue = Promise.resolve();
  var localMutationQueue = Promise.resolve();
  var DEFAULT_CATEGORY_DEFINITIONS = [
    { id: "default-work", name: "\u5DE5\u4F5C", color: "#3b82f6" },
    { id: "default-life", name: "\u751F\u6D3B", color: "#10b981" },
    { id: "default-learning", name: "\u5B66\u4E60", color: "#8b5cf6" }
  ];
  var LEGACY_STARRED_CATEGORY_ID = "default-starred";
  var defaultCategoryByName = new Map(
    DEFAULT_CATEGORY_DEFINITIONS.map((category) => [category.name, category])
  );
  var createDefaultCategories = () => {
    const updatedAt = Date.now();
    return DEFAULT_CATEGORY_DEFINITIONS.map((category) => ({ ...category, updatedAt }));
  };
  var defaultCategories = createDefaultCategories();
  var getDefaultData = () => ({
    tasks: [],
    categories: createDefaultCategories(),
    defaultCategory: "",
    hideCompleted: false,
    hideOverdue: false,
    showNoTimeLimitOnly: false,
    darkMode: false
  });
  var loadFromLocal = () => {
    return new Promise((resolve) => {
      chrome.storage.local.get([LOCAL_BACKUP_KEY], (result) => {
        if (result[LOCAL_BACKUP_KEY]) {
          try {
            const data = JSON.parse(result[LOCAL_BACKUP_KEY]);
            if (data && Array.isArray(data.tasks)) {
              console.log("[TaskMaster] loadData: got", data.tasks.length, "tasks from local backup");
              resolve(data);
              return;
            }
          } catch (e) {
            console.error("[TaskMaster] loadData local parse error:", e);
          }
        }
        resolve(null);
      });
    });
  };
  var dedupeCategories = (cats) => {
    const map = /* @__PURE__ */ new Map();
    for (const c of cats) {
      if (map.has(c.name)) {
        const existing = map.get(c.name);
        map.set(c.name, { ...existing, color: c.color });
      } else {
        map.set(c.name, { ...c });
      }
    }
    return [...map.values()];
  };
  var isValidDateOnly = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      return false;
    const date = /* @__PURE__ */ new Date(`${value}T00:00:00`);
    if (!Number.isFinite(date.getTime()))
      return false;
    const normalized = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return normalized === value;
  };
  var ACCOUNT_SWITCH_BACKUP_PREFIX = "tm_account_switch_backup_";
  var normalizeStorageData = (data) => {
    const categoryIdMap = /* @__PURE__ */ new Map();
    const categoriesByName = /* @__PURE__ */ new Map();
    const sourceCategories = Array.isArray(data.categories) ? data.categories : createDefaultCategories();
    for (const category of sourceCategories) {
      if (!category?.id || !category.name)
        continue;
      if (category.id === LEGACY_STARRED_CATEGORY_ID)
        continue;
      const definition = defaultCategoryByName.get(category.name);
      const normalized = definition ? { ...category, id: definition.id, name: definition.name } : { ...category };
      if (normalized.id !== category.id)
        categoryIdMap.set(category.id, normalized.id);
      const existing = categoriesByName.get(normalized.name);
      if (!existing || (normalized.updatedAt || 0) >= (existing.updatedAt || 0)) {
        categoriesByName.set(normalized.name, normalized);
      }
    }
    const categories = dedupeCategories([...categoriesByName.values()]);
    const categoryNameToId = new Map(categories.map((category) => [category.name, category.id]));
    const resolveCategoryId = (id) => categoryIdMap.get(id) || categoryNameToId.get(id) || id;
    const requestedDefault = resolveCategoryId(data.defaultCategory || "");
    const defaultCategory = requestedDefault !== LEGACY_STARRED_CATEGORY_ID && categories.some((category) => category.id === requestedDefault) ? requestedDefault : categories[0]?.id || "";
    const resolveTaskCategory = (id) => {
      const resolved = resolveCategoryId(id);
      return resolved === LEGACY_STARRED_CATEGORY_ID ? defaultCategory : resolved;
    };
    return {
      ...data,
      tasks: Array.isArray(data.tasks) ? data.tasks.map((task) => ({
        ...task,
        category: resolveTaskCategory(task.category || ""),
        hardDeadline: typeof task.hardDeadline === "string" && task.hardDeadline ? task.hardDeadline : void 0,
        focusDate: typeof task.focusDate === "string" && task.focusDate ? task.focusDate : void 0,
        repeatEndDate: isValidDateOnly(task.repeatEndDate) ? task.repeatEndDate : void 0,
        parentId: typeof task.parentId === "string" && task.parentId ? task.parentId : void 0,
        isParent: task.isParent === true || void 0,
        duration: task.isParent === true ? 0 : task.duration,
        noTimeLimit: task.isParent === true ? true : task.noTimeLimit
      })) : [],
      categories,
      defaultCategory
    };
  };
  var loadData = async () => {
    const localBackup = await loadFromLocal();
    if (localBackup) {
      const normalized = normalizeStorageData(localBackup);
      normalized.tasks = normalized.tasks.map((t) => ({
        ...t,
        updatedAt: t.updatedAt || t.createdAt || Date.now()
      }));
      return normalized;
    }
    return getDefaultData();
  };
  var BACKUP_PREFIX = "tm_auto_backup_";
  var MAX_BACKUPS = 3;
  var formatDateKey = (ts) => {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}${m}${day}_${h}${min}`;
  };
  var createAutoBackup = async () => {
    try {
      const data = await loadData();
      const now = Date.now();
      const key = BACKUP_PREFIX + formatDateKey(now);
      const payload = JSON.stringify({ timestamp: now, data });
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ [key]: payload }, () => {
          if (chrome.runtime.lastError)
            reject(chrome.runtime.lastError);
          else
            resolve();
        });
      });
      await cleanOldBackups();
      console.log("[TaskMaster] auto backup created:", key);
      return { success: true };
    } catch (e) {
      console.error("[TaskMaster] auto backup failed:", e);
      return { success: false, error: String(e) };
    }
  };
  var listBackups = async () => {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (all) => {
        if (chrome.runtime.lastError) {
          resolve([]);
          return;
        }
        const backups = [];
        for (const key of Object.keys(all)) {
          const isAutomatic = key.startsWith(BACKUP_PREFIX);
          const isAccountSwitch = key.startsWith(ACCOUNT_SWITCH_BACKUP_PREFIX);
          if (!isAutomatic && !isAccountSwitch)
            continue;
          try {
            const parsed = typeof all[key] === "string" ? JSON.parse(all[key]) : all[key];
            const d = parsed.data;
            const ts = parsed.timestamp || parsed.createdAt || 0;
            const dd = new Date(ts);
            const dateStr = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")} ${String(dd.getHours()).padStart(2, "0")}:${String(dd.getMinutes()).padStart(2, "0")}`;
            backups.push({
              key,
              timestamp: ts,
              dateStr,
              taskCount: d?.tasks?.length || 0,
              categoryCount: d?.categories?.length || 0,
              kind: isAccountSwitch ? "account-switch" : "automatic"
            });
          } catch {
          }
        }
        backups.sort((a, b) => b.timestamp - a.timestamp);
        resolve(backups);
      });
    });
  };
  var cleanOldBackups = async () => {
    const backups = (await listBackups()).filter((backup) => backup.kind === "automatic");
    if (backups.length <= MAX_BACKUPS)
      return;
    const toRemove = backups.slice(MAX_BACKUPS).map((b) => b.key);
    if (toRemove.length === 0)
      return;
    await new Promise((resolve) => {
      chrome.storage.local.remove(toRemove, () => resolve());
    });
    console.log("[TaskMaster] cleaned", toRemove.length, "old backups");
  };

  // shared/background.ts
  var ALARM_NAME = "tm_daily_backup";
  var ALARM_PERIOD_MINUTES = 24 * 60;
  chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
    console.log("[TaskMaster BG] daily backup alarm registered");
    triggerBackup();
  });
  chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.get(ALARM_NAME, (alarm) => {
      if (!alarm) {
        chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
      }
    });
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      triggerBackup();
    }
  });
  async function triggerBackup() {
    try {
      const result = await createAutoBackup();
      if (result.success) {
        console.log("[TaskMaster BG] auto backup completed");
      } else {
        console.error("[TaskMaster BG] auto backup failed:", result.error);
      }
    } catch (e) {
      console.error("[TaskMaster BG] backup error:", e);
    }
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "openNewTab") {
      chrome.tabs.create({ url: chrome.runtime.getURL("newtab/newtab.html") });
      sendResponse({});
      return false;
    }
    if (message.action === "googleLogin") {
      authenticateWithGoogle().then(sendResponse).catch((error) => {
        sendResponse({ error: error instanceof Error ? error.message : String(error) });
      });
      return true;
    }
    sendResponse({});
    return false;
  });
  var randomBase64Url = (byteLength) => {
    const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };
  var base64Url = (bytes) => {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };
  var authenticateWithGoogle = async () => {
    const configResponse = await fetch(`${TASKMASTER_API_BASE_URL}/api/auth/config`, { cache: "no-store" });
    const config = await configResponse.json().catch(() => ({}));
    if (!configResponse.ok || !config.clientId) {
      throw new Error(config.error || "Google \u767B\u5F55\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    }
    const state = randomBase64Url(32);
    const nonce = randomBase64Url(32);
    const codeVerifier = randomBase64Url(48);
    const codeChallenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier))));
    const redirectUri = chrome.identity.getRedirectURL();
    const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizeUrl.search = new URLSearchParams({
      client_id: config.clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "select_account"
    }).toString();
    const callbackUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url: authorizeUrl.toString(), interactive: true }, (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || "Google \u6388\u6743\u672A\u5B8C\u6210"));
          return;
        }
        if (!responseUrl) {
          reject(new Error("Google \u6388\u6743\u672A\u8FD4\u56DE\u7ED3\u679C"));
          return;
        }
        resolve(responseUrl);
      });
    });
    const callback = new URL(callbackUrl);
    if (callback.origin !== new URL(redirectUri).origin || callback.pathname !== new URL(redirectUri).pathname) {
      throw new Error("Google \u6388\u6743\u56DE\u8C03\u5730\u5740\u65E0\u6548");
    }
    if (callback.searchParams.get("state") !== state)
      throw new Error("Google \u6388\u6743\u6821\u9A8C\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
    const providerError = callback.searchParams.get("error");
    if (providerError)
      throw new Error(providerError === "access_denied" ? "\u5DF2\u53D6\u6D88 Google \u767B\u5F55" : "Google \u6388\u6743\u5931\u8D25");
    const code = callback.searchParams.get("code");
    if (!code)
      throw new Error("Google \u6388\u6743\u672A\u8FD4\u56DE\u767B\u5F55\u4EE3\u7801");
    const exchangeResponse = await fetch(`${TASKMASTER_API_BASE_URL}/api/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, codeVerifier, redirectUri, nonce })
    });
    const exchangeResult = await exchangeResponse.json().catch(() => ({}));
    if (!exchangeResponse.ok || !exchangeResult.session) {
      throw new Error(exchangeResult.error || "Google \u767B\u5F55\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
    }
    return { session: exchangeResult.session };
  };
})();
