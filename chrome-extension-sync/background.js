var Background = (() => {
  // shared/storage.ts
  var META_KEY = "tm_meta";
  var INDEX_KEY = "tm_index";
  var CHUNK_PREFIX = "tm_tasks_";
  var CHUNK_SIZE = 7e3;
  var LOCAL_BACKUP_KEY = "tm_local_backup";
  var OLD_SIMPLE_KEY = "task_manager_data";
  var generateId = () => {
    return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  };
  var defaultCategories = [
    { id: generateId(), name: "\u5DE5\u4F5C", color: "#3b82f6" },
    { id: generateId(), name: "\u751F\u6D3B", color: "#10b981" },
    { id: generateId(), name: "\u5B66\u4E60", color: "#8b5cf6" }
  ];
  var getDefaultData = () => ({
    tasks: [],
    categories: defaultCategories,
    defaultCategory: "",
    hideCompleted: false,
    hideOverdue: false,
    showNoTimeLimitOnly: false,
    darkMode: false
  });
  var splitTasksToChunks = (tasks) => {
    const chunks = [];
    let current = [];
    let currentSize = 0;
    for (const task of tasks) {
      const taskStr = JSON.stringify(task);
      if (currentSize + taskStr.length + 1 > CHUNK_SIZE && current.length > 0) {
        chunks.push(current);
        current = [];
        currentSize = 0;
      }
      current.push(task);
      currentSize += taskStr.length + 1;
    }
    if (current.length > 0) {
      chunks.push(current);
    }
    return chunks;
  };
  var loadFromSyncChunked = () => {
    return new Promise((resolve) => {
      chrome.storage.sync.get([META_KEY, INDEX_KEY], (result) => {
        if (chrome.runtime.lastError) {
          console.error("[TaskMaster] loadData meta error:", chrome.runtime.lastError);
          resolve(null);
          return;
        }
        if (!result[META_KEY]) {
          console.log("[TaskMaster] loadData: no tm_meta found in sync");
          resolve(null);
          return;
        }
        const meta = result[META_KEY];
        const index = result[INDEX_KEY] || { chunkCount: 0 };
        const chunkKeys = [];
        for (let i = 0; i < index.chunkCount; i++) {
          chunkKeys.push(CHUNK_PREFIX + i);
        }
        if (chunkKeys.length === 0) {
          resolve({ ...meta, tasks: [] });
          return;
        }
        chrome.storage.sync.get(chunkKeys, (chunkResult) => {
          if (chrome.runtime.lastError) {
            console.error("[TaskMaster] loadData chunks error:", chrome.runtime.lastError);
            resolve({ ...meta, tasks: [] });
            return;
          }
          const tasks = [];
          for (let i = 0; i < index.chunkCount; i++) {
            const chunk = chunkResult[CHUNK_PREFIX + i];
            if (Array.isArray(chunk)) {
              tasks.push(...chunk);
            } else {
              console.warn("[TaskMaster] loadData: chunk", i, "missing or not array", chunk);
            }
          }
          console.log("[TaskMaster] loadData: got", tasks.length, "tasks from", index.chunkCount, "chunks");
          resolve({ ...meta, tasks });
        });
      });
    });
  };
  var saveToSyncChunked = (data) => {
    const meta = {
      categories: data.categories,
      defaultCategory: data.defaultCategory,
      hideCompleted: data.hideCompleted,
      hideOverdue: data.hideOverdue,
      showNoTimeLimitOnly: data.showNoTimeLimitOnly,
      darkMode: data.darkMode
    };
    const tasks = data.tasks || [];
    const chunks = splitTasksToChunks(tasks);
    const newIndex = { chunkCount: chunks.length };
    const update = {
      [META_KEY]: meta,
      [INDEX_KEY]: newIndex
    };
    chunks.forEach((chunk, i) => {
      update[CHUNK_PREFIX + i] = chunk;
    });
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get([INDEX_KEY], (r) => {
        const oldIndex = r[INDEX_KEY];
        const removeKeys = [];
        if (oldIndex) {
          for (let i = chunks.length; i < (oldIndex.chunkCount || 0); i++) {
            removeKeys.push(CHUNK_PREFIX + i);
          }
        }
        chrome.storage.sync.set(update, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          if (removeKeys.length > 0) {
            chrome.storage.sync.remove(removeKeys, () => resolve());
          } else {
            resolve();
          }
        });
      });
    });
  };
  var loadFromSyncSimple = () => {
    return new Promise((resolve) => {
      chrome.storage.sync.get([OLD_SIMPLE_KEY], (result) => {
        if (result[OLD_SIMPLE_KEY]) {
          try {
            const parsed = JSON.parse(result[OLD_SIMPLE_KEY]);
            if (parsed && Array.isArray(parsed.tasks) && Array.isArray(parsed.categories)) {
              console.log("[TaskMaster] loadData: migrated from old simple key, got", parsed.tasks.length, "tasks");
              chrome.storage.sync.remove([OLD_SIMPLE_KEY]);
              resolve(parsed);
              return;
            }
          } catch {
          }
        }
        resolve(null);
      });
    });
  };
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
  var CLOUD_SYNC_SETTINGS_KEY = "tm_sync_settings";
  var getCloudSettings = async () => {
    return new Promise((resolve) => {
      chrome.storage.local.get([CLOUD_SYNC_SETTINGS_KEY], (r) => {
        resolve(r[CLOUD_SYNC_SETTINGS_KEY] || {});
      });
    });
  };
  var syncToCloud = async (data) => {
    try {
      const settings = await getCloudSettings();
      if (!settings.apiUrl || !settings.apiToken) {
        return { success: false, error: "\u672A\u914D\u7F6E\u540C\u6B65\u8BBE\u7F6E" };
      }
      const resp = await fetch(`${settings.apiUrl}/api/fullsync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.apiToken}`
        },
        body: JSON.stringify({ data })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        return { success: false, error: err.error || `HTTP ${resp.status}` };
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  };
  var syncFromCloud = async () => {
    try {
      const settings = await getCloudSettings();
      if (!settings.apiUrl || !settings.apiToken) {
        return { data: null, error: "\u672A\u914D\u7F6E\u540C\u6B65\u8BBE\u7F6E" };
      }
      const resp = await fetch(`${settings.apiUrl}/api/fullsync`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${settings.apiToken}` }
      });
      if (!resp.ok) {
        return { data: null, error: `HTTP ${resp.status}` };
      }
      const result = await resp.json();
      if (!result.data) {
        return { data: null };
      }
      return { data: result.data };
    } catch (e) {
      return { data: null, error: String(e) };
    }
  };
  var loadData = async () => {
    const cloudResult = await syncFromCloud();
    if (cloudResult.data && cloudResult.data.tasks && cloudResult.data.tasks.length > 0) {
      cloudResult.data.tasks = cloudResult.data.tasks.map((t) => ({
        ...t,
        updatedAt: t.updatedAt || t.createdAt || Date.now()
      }));
      await saveToLocal(cloudResult.data);
      console.log("[TaskMaster] loadData: got", cloudResult.data.tasks.length, "tasks from cloud");
      return cloudResult.data;
    }
    const syncData = await loadFromSyncChunked();
    if (syncData) {
      syncData.tasks = syncData.tasks.map((t) => ({
        ...t,
        updatedAt: t.updatedAt || t.createdAt || Date.now()
      }));
      await saveToLocal(syncData);
      return syncData;
    }
    const oldSyncData = await loadFromSyncSimple();
    if (oldSyncData) {
      oldSyncData.tasks = oldSyncData.tasks.map((t) => ({
        ...t,
        updatedAt: t.updatedAt || t.createdAt || Date.now()
      }));
      await saveToLocal(oldSyncData);
      await saveToSyncChunked(oldSyncData);
      return oldSyncData;
    }
    const localData = await loadFromLocal();
    if (localData) {
      console.warn("[TaskMaster] sync\u4E3A\u7A7A\uFF0C\u4ECElocal\u6062\u590D\u6570\u636E");
      localData.tasks = localData.tasks.map((t) => ({
        ...t,
        updatedAt: t.updatedAt || t.createdAt || Date.now()
      }));
      await saveToSyncChunked(localData);
      return localData;
    }
    console.warn("[TaskMaster] local\u548Csync\u90FD\u4E3A\u7A7A\uFF0C\u8FD4\u56DE\u9ED8\u8BA4\u6570\u636E");
    return getDefaultData();
  };
  var saveData = async (data) => {
    await saveToLocal(data);
    saveToSyncChunked(data).catch((e) => console.warn("[TaskMaster] chrome.storage.sync write failed:", e));
    syncToCloud(data).catch((e) => console.warn("[TaskMaster] cloud sync write failed:", e));
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
      const resp = await fetch(`${settings.apiUrl}/api/tasks?token=${settings.apiToken}`, {
        method: "GET"
      });
      if (!resp.ok)
        return { error: `HTTP ${resp.status}` };
      const remoteTasks = await resp.json();
      if (!Array.isArray(remoteTasks) || remoteTasks.length === 0) {
        return { synced: 0 };
      }
      const localData = await loadData();
      const newTasks = remoteTasks.filter((rt) => {
        return !localData.tasks.some((lt) => lt.id === rt.id || lt.title === rt.title);
      });
      if (newTasks.length === 0)
        return { synced: 0 };
      localData.tasks = [...localData.tasks, ...newTasks.map((t) => ({
        ...t,
        id: t.id || Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
        createdAt: t.createdAt || Date.now(),
        updatedAt: Date.now()
      }))];
      await saveData(localData);
      return { synced: newTasks.length };
    } catch (e) {
      return { error: String(e) };
    }
  }
})();
