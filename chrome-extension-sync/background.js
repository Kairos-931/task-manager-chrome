var Background = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // shared/storage.ts
  var storage_exports = {};
  __export(storage_exports, {
    STORAGE_KEY: () => STORAGE_KEY,
    createAutoBackup: () => createAutoBackup,
    defaultCategories: () => defaultCategories,
    deleteBackup: () => deleteBackup,
    downloadExportFile: () => downloadExportFile,
    exportData: () => exportData,
    generateId: () => generateId,
    getDefaultData: () => getDefaultData,
    getStorageUsage: () => getStorageUsage,
    importDataFromFile: () => importDataFromFile,
    listBackups: () => listBackups,
    loadData: () => loadData,
    mergeRemoteData: () => mergeRemoteData,
    restoreBackup: () => restoreBackup,
    saveData: () => saveData,
    validateImportData: () => validateImportData
  });
  var STORAGE_KEY, META_KEY, INDEX_KEY, CHUNK_PREFIX, CHUNK_SIZE, LOCAL_BACKUP_KEY, OLD_SIMPLE_KEY, generateId, defaultCategories, getDefaultData, splitTasksToChunks, loadFromSyncChunked, saveToSyncChunked, loadFromSyncSimple, loadFromLocal, saveToLocal, mergeTasks, mergeCategories, loadData, saveData, mergeRemoteData, BACKUP_PREFIX, MAX_BACKUPS, formatDateKey, createAutoBackup, listBackups, restoreBackup, deleteBackup, cleanOldBackups, getStorageUsage, exportData, downloadExportFile, validateImportData, importDataFromFile;
  var init_storage = __esm({
    "shared/storage.ts"() {
      STORAGE_KEY = "tm_data";
      META_KEY = "tm_meta";
      INDEX_KEY = "tm_index";
      CHUNK_PREFIX = "tm_tasks_";
      CHUNK_SIZE = 7e3;
      LOCAL_BACKUP_KEY = "tm_local_backup";
      OLD_SIMPLE_KEY = "task_manager_data";
      generateId = () => {
        return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      };
      defaultCategories = [
        { id: generateId(), name: "\u5DE5\u4F5C", color: "#3b82f6" },
        { id: generateId(), name: "\u751F\u6D3B", color: "#10b981" },
        { id: generateId(), name: "\u5B66\u4E60", color: "#8b5cf6" }
      ];
      getDefaultData = () => ({
        tasks: [],
        categories: defaultCategories,
        defaultCategory: "",
        hideCompleted: false,
        hideOverdue: false,
        showNoTimeLimitOnly: false,
        darkMode: false
      });
      splitTasksToChunks = (tasks) => {
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
      loadFromSyncChunked = () => {
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
      saveToSyncChunked = (data) => {
        const meta = {
          categories: data.categories,
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
      loadFromSyncSimple = () => {
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
      loadFromLocal = () => {
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
      saveToLocal = (data) => {
        return new Promise((resolve, reject) => {
          chrome.storage.local.set({ [LOCAL_BACKUP_KEY]: JSON.stringify(data) }, () => {
            if (chrome.runtime.lastError)
              reject(chrome.runtime.lastError);
            else
              resolve();
          });
        });
      };
      mergeTasks = (local, remote) => {
        const localMap = new Map(local.map((t) => [t.id, t]));
        const result = [];
        for (const task of local) {
          result.push(task);
        }
        for (const remoteTask of remote) {
          const localTask = localMap.get(remoteTask.id);
          if (!localTask) {
            result.push(remoteTask);
          } else {
            const localTime = localTask.updatedAt || localTask.createdAt || 0;
            const remoteTime = remoteTask.updatedAt || remoteTask.createdAt || 0;
            if (remoteTime > localTime) {
              const idx = result.findIndex((t) => t.id === remoteTask.id);
              if (idx !== -1)
                result[idx] = remoteTask;
            }
          }
        }
        return result;
      };
      mergeCategories = (local, remote) => {
        const map = new Map(local.map((c) => [c.id, c]));
        const result = [...local];
        for (const rc of remote) {
          if (!map.has(rc.id)) {
            result.push(rc);
          }
        }
        return result;
      };
      loadData = async () => {
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
      saveData = async (data) => {
        await saveToLocal(data);
        await saveToSyncChunked(data);
      };
      mergeRemoteData = async (remoteData) => {
        const localData = await loadData();
        const mergedTasks = mergeTasks(localData.tasks, remoteData.tasks);
        const mergedCategories = mergeCategories(localData.categories, remoteData.categories);
        const merged = {
          tasks: mergedTasks,
          categories: mergedCategories,
          defaultCategory: remoteData.defaultCategory || localData.defaultCategory,
          hideCompleted: remoteData.darkMode !== void 0 ? remoteData.hideCompleted : localData.hideCompleted,
          hideOverdue: remoteData.darkMode !== void 0 ? remoteData.hideOverdue : localData.hideOverdue,
          showNoTimeLimitOnly: remoteData.showNoTimeLimitOnly ?? localData.showNoTimeLimitOnly,
          darkMode: remoteData.darkMode ?? localData.darkMode
        };
        await saveData(merged);
        return merged;
      };
      BACKUP_PREFIX = "tm_auto_backup_";
      MAX_BACKUPS = 3;
      formatDateKey = (ts) => {
        const d = new Date(ts);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const h = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        return `${y}${m}${day}_${h}${min}`;
      };
      createAutoBackup = async () => {
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
      listBackups = async () => {
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
      restoreBackup = async (key) => {
        try {
          const result = await new Promise((resolve) => {
            chrome.storage.local.get([key], (r) => {
              if (chrome.runtime.lastError) {
                resolve(null);
                return;
              }
              resolve(r[key] || null);
            });
          });
          if (!result)
            return { success: false, error: "\u5907\u4EFD\u4E0D\u5B58\u5728" };
          const parsed = JSON.parse(result);
          if (!parsed.data?.tasks)
            return { success: false, error: "\u5907\u4EFD\u6570\u636E\u635F\u574F" };
          await saveData(parsed.data);
          return { success: true };
        } catch (e) {
          return { success: false, error: String(e) };
        }
      };
      deleteBackup = async (key) => {
        return new Promise((resolve) => {
          chrome.storage.local.remove([key], () => resolve());
        });
      };
      cleanOldBackups = async () => {
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
      getStorageUsage = async () => {
        return new Promise((resolve) => {
          chrome.storage.local.get(null, (all) => {
            let totalSize = 0;
            const breakdown = [];
            for (const [key, value] of Object.entries(all)) {
              const size = JSON.stringify(value).length;
              totalSize += size;
              breakdown.push({ key, size });
            }
            breakdown.sort((a, b) => b.size - a.size);
            const limit = 5 * 1024 * 1024;
            resolve({
              used: totalSize,
              total: limit,
              percentage: Math.round(totalSize / limit * 100),
              breakdown
            });
          });
        });
      };
      exportData = async () => {
        const data = await loadData();
        const exportObj = {
          version: "1.2.0",
          exportTime: (/* @__PURE__ */ new Date()).toISOString(),
          data
        };
        return JSON.stringify(exportObj, null, 2);
      };
      downloadExportFile = async () => {
        const jsonStr = await exportData();
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${String((/* @__PURE__ */ new Date()).getMonth() + 1).padStart(2, "0")}-${String((/* @__PURE__ */ new Date()).getDate()).padStart(2, "0")}`;
        a.download = `task-manager-backup-${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
      };
      validateImportData = (obj) => {
        if (!obj || typeof obj !== "object") {
          return { valid: false, error: "\u6570\u636E\u683C\u5F0F\u65E0\u6548" };
        }
        const exportObj = obj;
        if (!exportObj.data || typeof exportObj.data !== "object") {
          return { valid: false, error: "\u7F3A\u5C11 data \u5B57\u6BB5" };
        }
        const data = exportObj.data;
        if (!Array.isArray(data.tasks)) {
          return { valid: false, error: "tasks \u5FC5\u987B\u662F\u6570\u7EC4" };
        }
        if (!Array.isArray(data.categories)) {
          return { valid: false, error: "categories \u5FC5\u987B\u662F\u6570\u7EC4" };
        }
        return { valid: true, data };
      };
      importDataFromFile = async (file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const text = e.target?.result;
              const parsed = JSON.parse(text);
              const validation = validateImportData(parsed);
              if (!validation.valid || !validation.data) {
                resolve({ success: false, error: validation.error });
                return;
              }
              await saveData(validation.data);
              resolve({ success: true });
            } catch {
              resolve({ success: false, error: "\u6587\u4EF6\u89E3\u6790\u5931\u8D25\uFF0C\u8BF7\u9009\u62E9\u6B63\u786E\u7684 JSON \u6587\u4EF6" });
            }
          };
          reader.onerror = () => {
            resolve({ success: false, error: "\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25" });
          };
          reader.readAsText(file);
        });
      };
    }
  });

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
      const { createAutoBackup: createAutoBackup2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
      const result = await createAutoBackup2();
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
      return;
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
      const { loadData: loadData2, saveData: saveData2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
      const localData = await loadData2();
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
      await saveData2(localData);
      return { synced: newTasks.length };
    } catch (e) {
      return { error: String(e) };
    }
  }
})();
