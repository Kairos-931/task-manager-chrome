"use strict";
var Background = (() => {
  // shared/storage.ts
  var LOCAL_BACKUP_KEY = "tm_local_backup";
  var generateId = () => {
    return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  };
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
  var saveToLocal = (data) => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [LOCAL_BACKUP_KEY]: JSON.stringify(data) }, () => {
        if (chrome.runtime.lastError)
          reject(chrome.runtime.lastError);
        else
          resolve();
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
  var CLOUD_SYNC_SETTINGS_KEY = "tm_sync_settings";
  var GOOGLE_ACCOUNT_KEY = "tm_google_account";
  var TASKMASTER_API_URL = "https://taskmaster-api.yx9391.workers.dev";
  var getCloudSettings = async () => {
    return new Promise((resolve) => {
      chrome.storage.local.get([CLOUD_SYNC_SETTINGS_KEY], (r) => {
        resolve(r[CLOUD_SYNC_SETTINGS_KEY] || {});
      });
    });
  };
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
  var INCREMENTAL_CURSOR_KEY = "tm_incremental_sync_cursor";
  var INCREMENTAL_DEVICE_KEY = "tm_incremental_sync_device";
  var INCREMENTAL_SHADOW_KEY = "tm_incremental_sync_shadow";
  var INCREMENTAL_CLOCK_KEY = "tm_incremental_sync_clock";
  var OUTGOING_SYNC_BATCH = 400;
  var lastSyncTimestamp = 0;
  var syncQueue = Promise.resolve();
  var recordKey = (type, id) => `${type}:${id}`;
  var nextSyncTimestamp = () => {
    lastSyncTimestamp = Math.max(Date.now(), lastSyncTimestamp + 1);
    return lastSyncTimestamp;
  };
  var cloneStorageData = (data) => JSON.parse(JSON.stringify(data));
  var enqueueSync = (operation) => {
    const next = syncQueue.then(operation, operation);
    syncQueue = next.then(() => void 0, () => void 0);
    return next;
  };
  var getLocalValue = async (key, fallback) => {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => resolve(result[key] || fallback));
    });
  };
  var setLocalValues = async (values) => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(values, () => {
        if (chrome.runtime.lastError)
          reject(chrome.runtime.lastError);
        else
          resolve();
      });
    });
  };
  var getGoogleAccountValue = async () => {
    const account = await getLocalValue(GOOGLE_ACCOUNT_KEY, null);
    if (!account || typeof account.sub !== "string" || !account.sub)
      return null;
    return account;
  };
  var getGoogleAccount = getGoogleAccountValue;
  var getGoogleAccessToken = (interactive) => new Promise((resolve, reject) => {
    const manifest = chrome.runtime.getManifest();
    if (!manifest.oauth2?.client_id || manifest.oauth2.client_id.startsWith("YOUR_")) {
      reject(new Error("Google \u767B\u5F55\u5C1A\u672A\u914D\u7F6E\uFF0C\u8BF7\u7BA1\u7406\u5458\u5148\u8BBE\u7F6E\u6269\u5C55 OAuth \u5BA2\u6237\u7AEF"));
      return;
    }
    const identityApi = chrome.identity;
    if (!identityApi?.getAuthToken) {
      reject(new Error("\u6B64\u6269\u5C55\u672A\u914D\u7F6E Google \u767B\u5F55"));
      return;
    }
    identityApi.getAuthToken({ interactive }, (result) => {
      const token = typeof result === "string" ? result : result && typeof result === "object" && typeof result.token === "string" ? result.token : "";
      if (chrome.runtime.lastError)
        reject(new Error(chrome.runtime.lastError.message || "Google \u767B\u5F55\u5931\u8D25"));
      else if (!token)
        reject(new Error("Google \u767B\u5F55\u672A\u8FD4\u56DE\u6388\u6743\u51ED\u8BC1"));
      else
        resolve(token);
    });
  });
  var removeGoogleAccessToken = async (token) => new Promise((resolve) => {
    const identityApi = chrome.identity;
    if (!identityApi?.removeCachedAuthToken)
      return resolve();
    identityApi.removeCachedAuthToken({ token }, () => resolve());
  });
  var flagGoogleAuthorizationExpired = async (account, token = "") => {
    if (token)
      await removeGoogleAccessToken(token);
    await setLocalValues({ [GOOGLE_ACCOUNT_KEY]: { ...account, connected: false } });
    chrome.runtime.sendMessage({ action: "googleAccountAuthExpired" }).catch(() => {
    });
  };
  var cachedDeviceId = null;
  var getSyncDeviceIdAsync = async () => {
    if (cachedDeviceId)
      return cachedDeviceId;
    const existing = await getLocalValue(INCREMENTAL_DEVICE_KEY, "");
    if (existing) {
      cachedDeviceId = existing;
      return existing;
    }
    const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : generateId();
    await setLocalValues({ [INCREMENTAL_DEVICE_KEY]: id });
    cachedDeviceId = id;
    return id;
  };
  var getSyncDeviceId = getSyncDeviceIdAsync;
  var getScopedSyncKey = (key, accountSub) => accountSub ? `${key}_${encodeURIComponent(accountSub)}` : key;
  var getSyncShadow = async (accountSub) => {
    const key = getScopedSyncKey(INCREMENTAL_SHADOW_KEY, accountSub);
    const shadow = await getLocalValue(key, null);
    return shadow && shadow.records ? shadow : { records: {} };
  };
  var getSettingsPayload = (data) => ({
    defaultCategory: data.defaultCategory,
    hideCompleted: data.hideCompleted,
    hideOverdue: data.hideOverdue,
    showNoTimeLimitOnly: data.showNoTimeLimitOnly,
    darkMode: data.darkMode,
    weeklyGoalMinutes: data.weeklyGoalMinutes,
    weeklyGoalAnchor: data.weeklyGoalAnchor
  });
  var samePayload = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  var buildCurrentRecords = (data, shadow) => {
    const records = {};
    for (const task of data.tasks) {
      if (!task.updatedAt)
        task.updatedAt = nextSyncTimestamp();
      const id = String(task.id);
      records[recordKey("task", id)] = {
        type: "task",
        id,
        payload: task,
        deleted: false,
        updatedAt: task.updatedAt
      };
    }
    for (const category of data.categories) {
      if (!category.updatedAt)
        category.updatedAt = nextSyncTimestamp();
      const id = String(category.id);
      records[recordKey("category", id)] = {
        type: "category",
        id,
        payload: category,
        deleted: false,
        updatedAt: category.updatedAt
      };
    }
    const settingsPayload = getSettingsPayload(data);
    const previous = shadow.records[recordKey("settings", "app")];
    const settingsUpdatedAt = previous && samePayload(settingsPayload, previous.payload) ? previous.updatedAt : nextSyncTimestamp();
    data.syncSettingsUpdatedAt = settingsUpdatedAt;
    records[recordKey("settings", "app")] = {
      type: "settings",
      id: "app",
      payload: settingsPayload,
      deleted: false,
      updatedAt: settingsUpdatedAt
    };
    return records;
  };
  var buildLocalChanges = (current, shadow) => {
    const changes = [];
    for (const [key, record] of Object.entries(current)) {
      const previous = shadow.records[key];
      if (!previous || previous.deleted || !samePayload(record.payload, previous.payload)) {
        if (previous && record.updatedAt <= previous.updatedAt) {
          record.updatedAt = nextSyncTimestamp();
          if (record.payload)
            record.payload.updatedAt = record.updatedAt;
        }
        changes.push(record);
      }
    }
    for (const previous of Object.values(shadow.records)) {
      const key = recordKey(previous.type, previous.id);
      if (!previous.deleted && !current[key]) {
        changes.push({ ...previous, payload: null, deleted: true, updatedAt: nextSyncTimestamp() });
      }
    }
    return changes;
  };
  var applyRemoteChanges = (data, changes, options = {}) => {
    const applicableChanges = options.ignoreDeviceId ? changes.filter((change) => change.sourceDevice !== options.ignoreDeviceId) : changes;
    const tasks = new Map(data.tasks.map((task) => [task.id, task]));
    const categories = new Map(data.categories.map((category) => [category.id, category]));
    let settings = { ...data };
    for (const change of applicableChanges) {
      if (change.type === "task") {
        const local = tasks.get(change.id);
        if (local && local.updatedAt > change.updatedAt)
          continue;
        if (change.deleted)
          tasks.delete(change.id);
        else if (change.payload)
          tasks.set(change.id, change.payload);
      } else if (change.type === "category") {
        const local = categories.get(change.id);
        if (local && (local.updatedAt || 0) > change.updatedAt)
          continue;
        if (change.deleted)
          categories.delete(change.id);
        else if (change.payload)
          categories.set(change.id, change.payload);
      } else if (!change.deleted && change.payload) {
        if ((settings.syncSettingsUpdatedAt || 0) <= change.updatedAt) {
          settings = { ...settings, ...change.payload, syncSettingsUpdatedAt: change.updatedAt };
        }
      }
    }
    return normalizeStorageData({
      ...settings,
      tasks: [...tasks.values()],
      categories: dedupeCategories([...categories.values()])
    });
  };
  var isVirginDefaultData = (data) => {
    if (data.tasks.length > 0 || data.categories.length !== DEFAULT_CATEGORY_DEFINITIONS.length)
      return false;
    const hasDefaultCategories = data.categories.every((category) => {
      const definition = defaultCategoryByName.get(category.name);
      return definition?.id === category.id && definition.color === category.color;
    });
    return hasDefaultCategories && !data.defaultCategory && !data.hideCompleted && !data.hideOverdue && !data.showNoTimeLimitOnly && !data.darkMode && !data.weeklyGoalMinutes && !data.weeklyGoalAnchor;
  };
  var sameSyncAccount = (left, right) => left === null || right === null ? left === right : left.sub === right.sub && left.connected === right.connected;
  var syncIncrementallyNow = async (inputData, requestedAccount) => {
    try {
      const data = normalizeStorageData(inputData);
      const account = await getGoogleAccountValue();
      if (!sameSyncAccount(account, requestedAccount)) {
        return { success: false, error: "Google \u8D26\u53F7\u5DF2\u5207\u6362\uFF0C\u672C\u6B21\u540C\u6B65\u5DF2\u53D6\u6D88\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" };
      }
      if (account && !account.connected)
        return { success: false, error: "Google \u767B\u5F55\u5DF2\u9000\u51FA" };
      const settings = await getCloudSettings();
      const accountSub = account?.connected ? account.sub : null;
      if (!accountSub && (!settings.apiUrl || !settings.apiToken))
        return { success: false, error: "\u672A\u914D\u7F6E\u540C\u6B65\u8BBE\u7F6E" };
      let accessToken = null;
      if (accountSub) {
        try {
          accessToken = await getGoogleAccessToken(false);
        } catch (error) {
          if (account)
            await flagGoogleAuthorizationExpired(account);
          throw error;
        }
      }
      const syncUrl = accountSub ? `${TASKMASTER_API_URL}/api/account/sync/incremental` : `${settings.apiUrl}/api/sync/incremental`;
      const authorization = accountSub ? accessToken || "" : settings.apiToken || "";
      const cursorKey = getScopedSyncKey(INCREMENTAL_CURSOR_KEY, accountSub);
      const clockKey = getScopedSyncKey(INCREMENTAL_CLOCK_KEY, accountSub);
      const shadowKey = getScopedSyncKey(INCREMENTAL_SHADOW_KEY, accountSub);
      const [deviceId, shadow, initialCursor, storedClock] = await Promise.all([
        getSyncDeviceId(),
        getSyncShadow(accountSub),
        getLocalValue(cursorKey, 0),
        getLocalValue(clockKey, 0)
      ]);
      lastSyncTimestamp = Math.max(lastSyncTimestamp, storedClock);
      let cursor = initialCursor;
      let mergedData = data;
      const firstSync = initialCursor === 0 && Object.keys(shadow.records).length === 0;
      let pending = firstSync && isVirginDefaultData(mergedData) ? [] : buildLocalChanges(buildCurrentRecords(mergedData, shadow), shadow);
      let hasMore = true;
      let sawForeignChanges = false;
      const receivedChanges = [];
      while (pending.length > 0 || hasMore) {
        const outgoing = pending.splice(0, OUTGOING_SYNC_BATCH);
        const resp = await fetch(syncUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authorization}`
          },
          body: JSON.stringify({ deviceId, cursor, changes: outgoing })
        });
        if (!resp.ok) {
          const error = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
          if (accountSub && resp.status === 401 && account) {
            await flagGoogleAuthorizationExpired(account, accessToken || "");
          }
          return { success: false, error: error.error || `HTTP ${resp.status}` };
        }
        const result = await resp.json();
        const remoteChanges = Array.isArray(result.changes) ? result.changes : [];
        const rejectedChanges = Array.isArray(result.rejectedChanges) ? result.rejectedChanges : [];
        const foreignChanges = remoteChanges.filter((change) => change.sourceDevice !== deviceId);
        if (foreignChanges.length > 0)
          sawForeignChanges = true;
        receivedChanges.push(...foreignChanges, ...rejectedChanges);
        mergedData = applyRemoteChanges(mergedData, [...foreignChanges, ...rejectedChanges]);
        cursor = Number.isInteger(result.cursor) ? result.cursor : cursor;
        hasMore = result.hasMore === true;
      }
      const currentAccount = await getGoogleAccountValue();
      if (!sameSyncAccount(currentAccount, account)) {
        return { success: false, error: "Google \u8D26\u53F7\u5DF2\u5207\u6362\uFF0C\u672C\u6B21\u540C\u6B65\u5DF2\u53D6\u6D88\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" };
      }
      const latestLocal = await loadFromLocal();
      const finalData = latestLocal ? applyRemoteChanges(normalizeStorageData(latestLocal), receivedChanges) : mergedData;
      const finalRecords = buildCurrentRecords(mergedData, { records: {} });
      await Promise.all([
        saveToLocal(finalData),
        setLocalValues({
          [cursorKey]: cursor,
          [shadowKey]: { records: finalRecords },
          [clockKey]: lastSyncTimestamp
        })
      ]);
      return { success: true, data: finalData, hasForeignChanges: sawForeignChanges };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  };
  var syncIncrementally = (data) => {
    const snapshot = cloneStorageData(data);
    return getGoogleAccountValue().then(
      (requestedAccount) => enqueueSync(() => syncIncrementallyNow(snapshot, requestedAccount))
    );
  };
  var isRecoverableNetworkError = (error) => {
    if (!error)
      return false;
    return /(?:TypeError:\s*)?Failed to fetch|NetworkError when attempting to fetch resource|Load failed/i.test(error);
  };
  var warnForSyncFailure = (error) => {
    if (!error || error === "\u672A\u914D\u7F6E\u540C\u6B65\u8BBE\u7F6E" || error === "Google \u767B\u5F55\u5DF2\u9000\u51FA" || isRecoverableNetworkError(error))
      return;
    console.warn("[TaskMaster] incremental sync failed:", error);
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
  var fixRecurringTasks = (tasks) => tasks.map((t) => {
    if (t.repeatType && t.repeatType !== "none") {
      if (!Array.isArray(t.completedDates))
        t.completedDates = [];
      t.repeatEndDate = isValidDateOnly(t.repeatEndDate) ? t.repeatEndDate : void 0;
      if (t.repeatType === "weekly" && (!Array.isArray(t.repeatDays) || t.repeatDays.length === 0)) {
        if (t.repeatStartDate || t.dueDate) {
          const anchor = new Date(t.repeatStartDate || t.dueDate);
          t.repeatDays = [anchor.getDay()];
        }
      }
      if (t.completedDates.length === 0 && t.repeatStartDate && t.dueDate && t.dueDate > t.repeatStartDate) {
        const start = new Date(t.repeatStartDate);
        const current = new Date(t.dueDate);
        const completed = [];
        const check = new Date(start);
        while (check < current) {
          const ds = `${check.getFullYear()}-${String(check.getMonth() + 1).padStart(2, "0")}-${String(check.getDate()).padStart(2, "0")}`;
          if (isTaskMatchRepeat(t, check)) {
            completed.push(ds);
          }
          check.setDate(check.getDate() + 1);
        }
        t.completedDates = completed;
      }
      t.completed = Boolean(t.repeatEndDate && isRecurringSeriesComplete(t));
    }
    return t;
  });
  var isTaskMatchRepeat = (t, date) => {
    const anchor = new Date(t.repeatStartDate || t.dueDate);
    if (date < anchor)
      return false;
    switch (t.repeatType) {
      case "daily":
        return true;
      case "weekly":
        return (t.repeatDays || []).includes(date.getDay());
      case "monthly":
        return date.getDate() === anchor.getDate();
      case "workdays":
        return date.getDay() >= 1 && date.getDay() <= 5;
      case "custom": {
        const diff = Math.floor((date.getTime() - anchor.getTime()) / 864e5);
        return diff % (t.repeatInterval || 1) === 0;
      }
      default:
        return false;
    }
  };
  var isRecurringSeriesComplete = (task) => {
    if (!isValidDateOnly(task.repeatEndDate))
      return false;
    const anchorValue = task.repeatStartDate || task.dueDate;
    if (!isValidDateOnly(anchorValue) || task.repeatEndDate < anchorValue)
      return false;
    const completed = new Set(Array.isArray(task.completedDates) ? task.completedDates : []);
    const cursor = /* @__PURE__ */ new Date(`${anchorValue}T00:00:00`);
    const end = /* @__PURE__ */ new Date(`${task.repeatEndDate}T00:00:00`);
    while (cursor <= end) {
      if (isTaskMatchRepeat(task, cursor)) {
        const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        if (!completed.has(date))
          return false;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return true;
  };
  var saveData = async (data, onRemoteData, onSyncResult) => {
    const localData = normalizeStorageData(data);
    localData.tasks = fixRecurringTasks(localData.tasks);
    await saveToLocal(localData);
    syncIncrementally(localData).then((result) => {
      if (result.success && result.data) {
        getSyncDeviceIdAsync().then((deviceId) => {
          onRemoteData?.(result.data, { ignoreDeviceId: deviceId });
        });
      } else
        warnForSyncFailure(result.error);
      onSyncResult?.(result);
    }).catch((e) => warnForSyncFailure(String(e)));
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
      const account = await getGoogleAccountValue();
      const ownerSub = account?.sub || null;
      const ownerKey = ownerSub ? `account_${encodeURIComponent(ownerSub)}_` : "guest_";
      const key = BACKUP_PREFIX + ownerKey + formatDateKey(now);
      const payload = JSON.stringify({ timestamp: now, ownerSub, data });
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
    const account = await getGoogleAccountValue();
    const ownerSub = account?.sub || null;
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (all) => {
        if (chrome.runtime.lastError) {
          resolve([]);
          return;
        }
        const backups = [];
        for (const key of Object.keys(all)) {
          if (!key.startsWith(BACKUP_PREFIX))
            continue;
          try {
            const parsed = typeof all[key] === "string" ? JSON.parse(all[key]) : all[key];
            if ((parsed.ownerSub || null) !== ownerSub)
              continue;
            const d = parsed.data;
            const ts = parsed.timestamp || 0;
            const dd = new Date(ts);
            const dateStr = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")} ${String(dd.getHours()).padStart(2, "0")}:${String(dd.getMinutes()).padStart(2, "0")}`;
            backups.push({
              key,
              timestamp: ts,
              dateStr,
              taskCount: d?.tasks?.length || 0,
              categoryCount: d?.categories?.length || 0
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
    const backups = await listBackups();
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
  var ACCOUNT_SYNC_ALARM_NAME = "tm_google_account_sync";
  var ACCOUNT_SYNC_PERIOD_MINUTES = 2;
  chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
    chrome.alarms.create(ACCOUNT_SYNC_ALARM_NAME, { periodInMinutes: ACCOUNT_SYNC_PERIOD_MINUTES });
    console.log("[TaskMaster BG] daily backup alarm registered");
    triggerBackup();
  });
  chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.get(ALARM_NAME, (alarm) => {
      if (!alarm) {
        chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
      }
    });
    chrome.alarms.get(ACCOUNT_SYNC_ALARM_NAME, (alarm) => {
      if (!alarm)
        chrome.alarms.create(ACCOUNT_SYNC_ALARM_NAME, { periodInMinutes: ACCOUNT_SYNC_PERIOD_MINUTES });
    });
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      triggerBackup();
    } else if (alarm.name === ACCOUNT_SYNC_ALARM_NAME) {
      triggerGoogleAccountSync();
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
  async function triggerGoogleAccountSync() {
    try {
      const account = await getGoogleAccount();
      if (!account?.connected)
        return;
      const data = await loadData();
      const result = await syncIncrementally(data);
      if (result.success && result.hasForeignChanges) {
        chrome.runtime.sendMessage({ action: "googleAccountSyncUpdated" }).catch(() => {
        });
      }
    } catch (error) {
      console.warn("[TaskMaster BG] account sync deferred:", error instanceof Error ? error.message : "sync failed");
    }
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "openNewTab") {
      chrome.tabs.create({ url: chrome.runtime.getURL("newtab/newtab.html") });
      sendResponse({});
      return false;
    }
    if (message.action === "getSyncSettings") {
      chrome.storage.local.get(["tm_sync_settings"], (result) => {
        sendResponse(result.tm_sync_settings || {});
      });
      return true;
    }
    if (message.action === "saveSyncSettings") {
      chrome.storage.local.set({ tm_sync_settings: message.settings }, () => {
        sendResponse({ success: true });
      });
      return true;
    }
    if (message.action === "syncRemoteTasks") {
      getGoogleAccount().then((account) => {
        if (account) {
          sendResponse({ synced: 0 });
          return;
        }
        handleRemoteSync().then(sendResponse).catch((e) => sendResponse({ error: String(e) }));
      }).catch((e) => sendResponse({ error: String(e) }));
      return true;
    }
    sendResponse({});
    return false;
  });
  async function handleRemoteSync() {
    try {
      const settings = await new Promise((resolve) => {
        chrome.storage.local.get(["tm_sync_settings"], (r) => resolve(r.tm_sync_settings || {}));
      });
      if (!settings.apiUrl || !settings.apiToken) {
        return { error: "\u672A\u914D\u7F6E\u540C\u6B65\u8BBE\u7F6E" };
      }
      const resp = await fetch(`${settings.apiUrl}/api/tasks`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${settings.apiToken}` }
      });
      if (!resp.ok)
        return { error: `HTTP ${resp.status}` };
      const respData = await resp.json();
      const remoteTasks = Array.isArray(respData) ? respData : respData.tasks || [];
      if (remoteTasks.length === 0) {
        return { synced: 0 };
      }
      const localData = await loadData();
      const newTasks = remoteTasks.filter(
        (rt) => rt.id && !localData.tasks.some((lt) => lt.id === rt.id)
      );
      if (newTasks.length > 0) {
        localData.tasks = [...localData.tasks, ...newTasks.map((t) => {
          const createdAt = Number(t.createdAt) || Date.now();
          const completed = t.completed === true;
          return {
            ...t,
            id: t.id || Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
            createdAt,
            updatedAt: Date.now(),
            completed,
            completedAt: completed ? Number(t.completedAt) || createdAt : void 0,
            repeatType: t.repeatType || "none",
            repeatDays: Array.isArray(t.repeatDays) ? t.repeatDays : [],
            repeatInterval: Number(t.repeatInterval) || 1,
            completedDates: Array.isArray(t.completedDates) ? t.completedDates : []
          };
        })];
        await saveData(localData);
      }
      try {
        const syncedIds = remoteTasks.filter((task) => task.id && localData.tasks.some((local) => local.id === task.id)).map((task) => task.id);
        if (syncedIds.length > 0) {
          const acknowledge = await fetch(`${settings.apiUrl}/api/tasks/sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${settings.apiToken}`
            },
            body: JSON.stringify({ ids: syncedIds })
          });
          if (!acknowledge.ok)
            return { error: `\u786E\u8BA4\u5BFC\u5165\u5931\u8D25: HTTP ${acknowledge.status}` };
        }
      } catch (e) {
        return { error: `\u786E\u8BA4\u5BFC\u5165\u5931\u8D25: ${String(e)}` };
      }
      return { synced: newTasks.length };
    } catch (e) {
      return { error: String(e) };
    }
  }
})();
