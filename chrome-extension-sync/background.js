"use strict";
var Background = (() => {
  // shared/storage.ts
  var LOCAL_BACKUP_KEY = "tm_local_backup";
  var generateId = () => {
    return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  };
  var DEFAULT_CATEGORY_DEFINITIONS = [
    { id: "default-starred", name: "\u661F\u6807", color: "#f59e0b" },
    { id: "default-work", name: "\u5DE5\u4F5C", color: "#3b82f6" },
    { id: "default-life", name: "\u751F\u6D3B", color: "#10b981" },
    { id: "default-learning", name: "\u5B66\u4E60", color: "#8b5cf6" }
  ];
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
  var CLOUD_SYNC_SETTINGS_KEY = "tm_sync_settings";
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
    return {
      ...data,
      tasks: Array.isArray(data.tasks) ? data.tasks.map((task) => ({ ...task, category: resolveCategoryId(task.category || "") })) : [],
      categories,
      defaultCategory: resolveCategoryId(data.defaultCategory || "")
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
  var getSyncDeviceId = async () => {
    const existing = await getLocalValue(INCREMENTAL_DEVICE_KEY, "");
    if (existing)
      return existing;
    const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : generateId();
    await setLocalValues({ [INCREMENTAL_DEVICE_KEY]: id });
    return id;
  };
  var getSyncShadow = async () => {
    const shadow = await getLocalValue(INCREMENTAL_SHADOW_KEY, null);
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
  var applyRemoteChanges = (data, changes) => {
    const tasks = new Map(data.tasks.map((task) => [task.id, task]));
    const categories = new Map(data.categories.map((category) => [category.id, category]));
    let settings = { ...data };
    for (const change of changes) {
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
  var syncIncrementallyNow = async (inputData) => {
    try {
      const data = normalizeStorageData(inputData);
      const settings = await getCloudSettings();
      if (!settings.apiUrl || !settings.apiToken)
        return { success: false, error: "\u672A\u914D\u7F6E\u540C\u6B65\u8BBE\u7F6E" };
      const [deviceId, shadow, initialCursor, storedClock] = await Promise.all([
        getSyncDeviceId(),
        getSyncShadow(),
        getLocalValue(INCREMENTAL_CURSOR_KEY, 0),
        getLocalValue(INCREMENTAL_CLOCK_KEY, 0)
      ]);
      lastSyncTimestamp = Math.max(lastSyncTimestamp, storedClock);
      let cursor = initialCursor;
      let mergedData = data;
      const firstSync = initialCursor === 0 && Object.keys(shadow.records).length === 0;
      let pending = firstSync && isVirginDefaultData(mergedData) ? [] : buildLocalChanges(buildCurrentRecords(mergedData, shadow), shadow);
      let hasMore = true;
      const receivedChanges = [];
      while (pending.length > 0 || hasMore) {
        const outgoing = pending.splice(0, OUTGOING_SYNC_BATCH);
        const resp = await fetch(`${settings.apiUrl}/api/sync/incremental`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${settings.apiToken}`
          },
          body: JSON.stringify({ deviceId, cursor, changes: outgoing })
        });
        if (!resp.ok) {
          const error = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
          return { success: false, error: error.error || `HTTP ${resp.status}` };
        }
        const result = await resp.json();
        const remoteChanges = Array.isArray(result.changes) ? result.changes : [];
        const rejectedChanges = Array.isArray(result.rejectedChanges) ? result.rejectedChanges : [];
        receivedChanges.push(...remoteChanges, ...rejectedChanges);
        mergedData = applyRemoteChanges(mergedData, [...remoteChanges, ...rejectedChanges]);
        cursor = Number.isInteger(result.cursor) ? result.cursor : cursor;
        hasMore = result.hasMore === true;
      }
      const latestLocal = await loadFromLocal();
      const finalData = latestLocal ? applyRemoteChanges(normalizeStorageData(latestLocal), receivedChanges) : mergedData;
      const finalRecords = buildCurrentRecords(mergedData, { records: {} });
      await Promise.all([
        saveToLocal(finalData),
        setLocalValues({
          [INCREMENTAL_CURSOR_KEY]: cursor,
          [INCREMENTAL_SHADOW_KEY]: { records: finalRecords },
          [INCREMENTAL_CLOCK_KEY]: lastSyncTimestamp
        })
      ]);
      return { success: true, data: finalData };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  };
  var syncIncrementally = (data) => enqueueSync(() => syncIncrementallyNow(cloneStorageData(data)));
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
      t.completed = false;
      if (!Array.isArray(t.completedDates))
        t.completedDates = [];
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
  var saveData = async (data, onRemoteData, onSyncResult) => {
    const localData = normalizeStorageData(data);
    localData.tasks = fixRecurringTasks(localData.tasks);
    await saveToLocal(localData);
    syncIncrementally(localData).then((result) => {
      if (result.success && result.data)
        onRemoteData?.(result.data);
      else if (result.error !== "\u672A\u914D\u7F6E\u540C\u6B65\u8BBE\u7F6E")
        console.warn("[TaskMaster] incremental sync failed:", result.error);
      onSyncResult?.(result);
    }).catch((e) => console.warn("[TaskMaster] incremental sync failed:", e));
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
          if (!key.startsWith(BACKUP_PREFIX))
            continue;
          try {
            const parsed = typeof all[key] === "string" ? JSON.parse(all[key]) : all[key];
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
      handleRemoteSync().then(sendResponse).catch((e) => sendResponse({ error: String(e) }));
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
