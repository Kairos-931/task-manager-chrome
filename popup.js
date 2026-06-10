(() => {
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
    isCloudConfigured: () => isCloudConfigured,
    listBackups: () => listBackups,
    loadData: () => loadData,
    mergeRemoteData: () => mergeRemoteData,
    restoreBackup: () => restoreBackup,
    saveData: () => saveData,
    syncFromCloud: () => syncFromCloud,
    syncToCloud: () => syncToCloud,
    validateImportData: () => validateImportData
  });
  var STORAGE_KEY, META_KEY, INDEX_KEY, CHUNK_PREFIX, CHUNK_SIZE, LOCAL_BACKUP_KEY, OLD_SIMPLE_KEY, generateId, defaultCategories, getDefaultData, splitTasksToChunks, loadFromSyncChunked, saveToSyncChunked, loadFromSyncSimple, loadFromLocal, saveToLocal, mergeTasks, mergeCategories, CLOUD_SYNC_SETTINGS_KEY, getCloudSettings, syncToCloud, syncFromCloud, isCloudConfigured, loadData, saveData, mergeRemoteData, BACKUP_PREFIX, MAX_BACKUPS, formatDateKey, createAutoBackup, listBackups, restoreBackup, deleteBackup, cleanOldBackups, getStorageUsage, exportData, downloadExportFile, validateImportData, importDataFromFile;
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
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve();
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
              if (idx !== -1) result[idx] = remoteTask;
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
      CLOUD_SYNC_SETTINGS_KEY = "tm_sync_settings";
      getCloudSettings = async () => {
        return new Promise((resolve) => {
          chrome.storage.local.get([CLOUD_SYNC_SETTINGS_KEY], (r) => {
            resolve(r[CLOUD_SYNC_SETTINGS_KEY] || {});
          });
        });
      };
      syncToCloud = async (data) => {
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
      syncFromCloud = async () => {
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
      isCloudConfigured = async () => {
        const settings = await getCloudSettings();
        return !!(settings.apiUrl && settings.apiToken);
      };
      loadData = async () => {
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
      saveData = async (data) => {
        await saveToLocal(data);
        saveToSyncChunked(data).catch((e) => console.warn("[TaskMaster] chrome.storage.sync write failed:", e));
        syncToCloud(data).catch((e) => console.warn("[TaskMaster] cloud sync write failed:", e));
      };
      mergeRemoteData = async (localState) => {
        const remoteData = await loadFromSyncChunked();
        if (!remoteData) return localState;
        const mergedTasks = mergeTasks(localState.tasks, remoteData.tasks);
        const mergedCategories = mergeCategories(localState.categories, remoteData.categories);
        const merged = {
          tasks: mergedTasks,
          categories: mergedCategories,
          defaultCategory: remoteData.defaultCategory || localState.defaultCategory,
          hideCompleted: remoteData.hideCompleted ?? localState.hideCompleted,
          hideOverdue: remoteData.hideOverdue ?? localState.hideOverdue,
          showNoTimeLimitOnly: remoteData.showNoTimeLimitOnly ?? localState.showNoTimeLimitOnly,
          darkMode: remoteData.darkMode ?? localState.darkMode
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
              if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
              else resolve();
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
              if (!key.startsWith(BACKUP_PREFIX)) continue;
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
          if (!result) return { success: false, error: "\u5907\u4EFD\u4E0D\u5B58\u5728" };
          const parsed = JSON.parse(result);
          if (!parsed.data?.tasks) return { success: false, error: "\u5907\u4EFD\u6570\u636E\u635F\u574F" };
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
        if (backups.length <= MAX_BACKUPS) return;
        const toRemove = backups.slice(MAX_BACKUPS).map((b) => b.key);
        if (toRemove.length === 0) return;
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

  // shared/sync.ts
  function showSyncToast() {
    const existing = document.querySelector(".sync-toast");
    existing?.remove();
    const toast = document.createElement("div");
    toast.className = "sync-toast fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-white text-sm z-50 bg-blue-500 transition-opacity duration-500";
    toast.innerHTML = `
    <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>
    \u5DF2\u540C\u6B65\u6765\u81EA\u5176\u4ED6\u8BBE\u5907\u7684\u66F4\u65B0
  `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 500);
    }, 3e3);
  }
  function showToast(container, message, type = "success") {
    const existing = container.querySelector(".toast-message");
    existing?.remove();
    const toast = document.createElement("div");
    toast.className = `toast-message fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-white text-sm z-50 ${type === "success" ? "bg-green-500" : "bg-red-500"}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3e3);
  }
  var syncStatus, statusChangeCallback, localSaveTime, statusTimeoutId, reRenderFn, getSyncStatus, setSyncStatus, onSyncStatusChange, markLocalSave, markSaveComplete, initSyncMonitor;
  var init_sync = __esm({
    "shared/sync.ts"() {
      init_task();
      init_storage();
      syncStatus = "idle";
      statusChangeCallback = null;
      localSaveTime = 0;
      statusTimeoutId = null;
      reRenderFn = null;
      getSyncStatus = () => syncStatus;
      setSyncStatus = (status) => {
        syncStatus = status;
        statusChangeCallback?.(status);
      };
      onSyncStatusChange = (cb) => {
        statusChangeCallback = cb;
      };
      markLocalSave = () => {
        localSaveTime = Date.now();
      };
      markSaveComplete = () => {
        setSyncStatus("synced");
        if (statusTimeoutId) clearTimeout(statusTimeoutId);
        statusTimeoutId = setTimeout(() => {
          if (syncStatus === "synced") {
            setSyncStatus("idle");
            reRenderFn?.();
          }
        }, 3e3);
      };
      initSyncMonitor = (reRender2) => {
        reRenderFn = reRender2;
        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (areaName !== "sync") return;
          const now = Date.now();
          if (localSaveTime > 0 && now - localSaveTime < 2e3) {
            return;
          }
          const hasMetaChange = !!changes["tm_meta"];
          const hasChunkChange = Object.keys(changes).some((k) => k.startsWith("tm_tasks_"));
          if (!hasMetaChange && !hasChunkChange) return;
          const metaChange = changes["tm_meta"];
          if (metaChange && metaChange.newValue === void 0) {
            const current = getState();
            if (current.tasks.length > 0 || current.categories.length > 0) {
              console.warn("[TaskMaster] \u68C0\u6D4B\u5230sync\u88AB\u6E05\u7A7A\uFF0C\u4ECE\u5185\u5B58\u56DE\u5199\u6570\u636E");
              markLocalSave();
              persistState().catch(() => {
              });
            }
            return;
          }
          setSyncStatus("remote-updated");
          const localState = getState();
          mergeRemoteData(localState).then(() => {
            loadState().then(() => {
              reRender2();
              showSyncToast();
              if (statusTimeoutId) clearTimeout(statusTimeoutId);
              statusTimeoutId = setTimeout(() => {
                if (syncStatus === "remote-updated") {
                  setSyncStatus("idle");
                  reRender2();
                }
              }, 4e3);
            });
          }).catch(() => {
            setSyncStatus("error");
          });
        });
      };
    }
  });

  // shared/task.ts
  var task_exports = {};
  __export(task_exports, {
    addCategory: () => addCategory,
    addTask: () => addTask,
    deleteCategory: () => deleteCategory,
    deleteTask: () => deleteTask,
    escapeHtml: () => escapeHtml,
    formatDate: () => formatDate,
    formatHours: () => formatHours,
    getCatColor: () => getCatColor,
    getCatName: () => getCatName,
    getDateLabel: () => getDateLabel,
    getFilteredTasks: () => getFilteredTasks,
    getPriorityColor: () => getPriorityColor,
    getRemainingTime: () => getRemainingTime,
    getState: () => getState,
    getStats: () => getStats,
    getTodayStr: () => getTodayStr,
    isOverdue: () => isOverdue,
    isTaskDueOnDate: () => isTaskDueOnDate,
    loadState: () => loadState,
    moveTaskToDate: () => moveTaskToDate,
    parseDate: () => parseDate,
    persistState: () => persistState,
    resetEditingTask: () => resetEditingTask,
    setState: () => setState,
    toggleTask: () => toggleTask,
    updateCategory: () => updateCategory,
    updateTask: () => updateTask
  });
  var escapeHtml, formatDate, parseDate, formatHours, getDateLabel, getTodayStr, state, getState, setState, resetEditingTask, getRemainingTime, isOverdue, isTaskDueOnDate, getPriorityColor, getCatColor, getCatName, loadState, persistState, getFilteredTasks, addTask, updateTask, deleteTask, toggleTask, moveTaskToDate, getNextUncompletedDate, addCategory, updateCategory, deleteCategory, getStats;
  var init_task = __esm({
    "shared/task.ts"() {
      init_storage();
      init_sync();
      escapeHtml = (str) => {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
      };
      formatDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };
      parseDate = (s) => /* @__PURE__ */ new Date(s + "T00:00:00");
      formatHours = (m) => (m / 60).toFixed(1) + "h";
      getDateLabel = (d) => {
        const today = formatDate(/* @__PURE__ */ new Date());
        const tomorrow = formatDate(new Date(Date.now() + 864e5));
        const yesterday = formatDate(new Date(Date.now() - 864e5));
        if (d === today) return "\u4ECA\u5929";
        if (d === tomorrow) return "\u660E\u5929";
        if (d === yesterday) return "\u6628\u5929";
        const date = parseDate(d);
        const w = ["\u5468\u65E5", "\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D"][date.getDay()];
        return `${date.getMonth() + 1}\u6708${date.getDate()}\u65E5 ${w}`;
      };
      getTodayStr = () => formatDate(/* @__PURE__ */ new Date());
      state = {
        tasks: [],
        categories: [],
        defaultCategory: "",
        hideCompleted: false,
        hideOverdue: false,
        showNoTimeLimitOnly: false,
        darkMode: false,
        editingTask: null,
        currentView: "list",
        currentDate: getTodayStr(),
        filterPriority: "all",
        filterCategory: "all",
        draggedTaskId: null
      };
      getState = () => state;
      setState = (newState) => {
        state = { ...state, ...newState };
      };
      resetEditingTask = () => {
        state.editingTask = null;
      };
      getRemainingTime = (d, completed) => {
        if (completed) return "\u5DF2\u5B8C\u6210";
        const todayStr = getTodayStr();
        const tomorrowStr = formatDate(new Date(Date.now() + 864e5));
        if (d === todayStr) return "\u4ECA\u5929\u5230\u671F";
        if (d === tomorrowStr) return "\u660E\u5929\u5230\u671F";
        const date = parseDate(d);
        const today = parseDate(todayStr);
        const diff = date.getTime() - today.getTime();
        const days = Math.floor(diff / 864e5);
        if (days < 0) {
          const overdueDays = Math.abs(days);
          return overdueDays === 1 ? "\u5DF2\u8FC7\u671F" : `\u5DF2\u8FC7\u671F ${overdueDays} \u5929`;
        }
        return `${days} \u5929\u540E\u5230\u671F`;
      };
      isOverdue = (d, completed) => {
        if (completed) return false;
        const todayStr = getTodayStr();
        return d < todayStr;
      };
      isTaskDueOnDate = (t, d) => {
        if (t.noTimeLimit) return false;
        if (!t.repeatType || t.repeatType === "none") {
          return t.dueDate === d;
        }
        const anchor = t.repeatStartDate || t.dueDate;
        if (anchor === d) return true;
        const date = parseDate(d);
        const anchorDate = parseDate(anchor);
        switch (t.repeatType) {
          case "daily":
            return date >= anchorDate;
          case "weekly":
            return date >= anchorDate && (t.repeatDays || []).includes(date.getDay());
          case "monthly":
            return date >= anchorDate && date.getDate() === anchorDate.getDate();
          case "workdays":
            return date >= anchorDate && date.getDay() >= 1 && date.getDay() <= 5;
          case "custom":
            if (date < anchorDate) return false;
            const daysDiff = Math.floor((date.getTime() - anchorDate.getTime()) / 864e5);
            return daysDiff % (t.repeatInterval || 1) === 0;
          default:
            return anchor === d;
        }
      };
      getPriorityColor = (p) => {
        switch (p) {
          case "high":
            return "bg-red-500";
          case "medium":
            return "bg-yellow-500";
          case "low":
            return "bg-green-500";
        }
      };
      getCatColor = (id) => {
        const c = state.categories.find((x) => x.id === id);
        return c ? c.color : "#6b7280";
      };
      getCatName = (id) => {
        const c = state.categories.find((x) => x.id === id);
        return c ? c.name : "";
      };
      loadState = async () => {
        const data = await loadData();
        state = {
          ...state,
          ...data,
          categories: data.categories || defaultCategories,
          editingTask: null,
          draggedTaskId: null
        };
      };
      persistState = async () => {
        markLocalSave();
        try {
          await saveData({
            tasks: state.tasks,
            categories: state.categories,
            defaultCategory: state.defaultCategory,
            hideCompleted: state.hideCompleted,
            hideOverdue: state.hideOverdue,
            showNoTimeLimitOnly: state.showNoTimeLimitOnly,
            darkMode: state.darkMode
          });
          markSaveComplete();
        } catch {
        }
      };
      getFilteredTasks = () => {
        return state.tasks.filter((t) => {
          if (state.showNoTimeLimitOnly && !t.noTimeLimit) return false;
          if (state.hideCompleted && t.completed) return false;
          if (state.hideOverdue && !t.noTimeLimit && t.dueDate < getTodayStr()) return false;
          if (state.filterPriority !== "all" && t.priority !== state.filterPriority) return false;
          if (state.filterCategory !== "all" && t.category !== state.filterCategory) return false;
          return true;
        }).sort((a, b) => {
          if (a.noTimeLimit !== b.noTimeLimit) return a.noTimeLimit ? 1 : -1;
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          if (a.noTimeLimit && b.noTimeLimit) return b.createdAt - a.createdAt;
          return parseDate(a.dueDate).getTime() - parseDate(b.dueDate).getTime();
        });
      };
      addTask = (task) => {
        const now = Date.now();
        const newTask = {
          ...task,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
          completed: false,
          completedDates: []
        };
        if (newTask.repeatType && newTask.repeatType !== "none" && !newTask.noTimeLimit) {
          newTask.repeatStartDate = newTask.dueDate;
        }
        state.tasks.push(newTask);
      };
      updateTask = (id, updates) => {
        const idx = state.tasks.findIndex((t) => t.id === id);
        if (idx !== -1) {
          state.tasks[idx] = { ...state.tasks[idx], ...updates, updatedAt: Date.now() };
        }
      };
      deleteTask = (id) => {
        state.tasks = state.tasks.filter((t) => t.id !== id);
      };
      toggleTask = (id) => {
        const task = state.tasks.find((t) => t.id === id);
        if (!task) return;
        if (!task.completed && task.repeatType && task.repeatType !== "none") {
          const completedDate = task.dueDate;
          if (!task.completedDates) task.completedDates = [];
          if (!task.completedDates.includes(completedDate)) {
            task.completedDates.push(completedDate);
          }
          if (!task.repeatStartDate) {
            task.repeatStartDate = task.dueDate;
          }
          task.dueDate = getNextUncompletedDate(task, completedDate);
          task.updatedAt = Date.now();
        } else {
          task.completed = !task.completed;
          task.completedAt = task.completed ? Date.now() : void 0;
          task.updatedAt = Date.now();
        }
      };
      moveTaskToDate = (id, date) => {
        const task = state.tasks.find((t) => t.id === id);
        if (task) {
          task.dueDate = date;
          task.noTimeLimit = false;
          task.updatedAt = Date.now();
        }
      };
      getNextUncompletedDate = (task, afterDate) => {
        const completed = task.completedDates || [];
        const after = afterDate ? parseDate(afterDate) : parseDate(getTodayStr());
        const start = new Date(after);
        start.setDate(start.getDate() + 1);
        for (let i = 0; i < 365; i++) {
          const candidate = new Date(start);
          candidate.setDate(candidate.getDate() + i);
          const dateStr = formatDate(candidate);
          if (isTaskDueOnDate(task, dateStr) && !completed.includes(dateStr)) {
            return dateStr;
          }
        }
        return formatDate(start);
      };
      addCategory = (name, color) => {
        state.categories.push({ id: generateId(), name, color });
      };
      updateCategory = (id, name, color) => {
        const cat = state.categories.find((c) => c.id === id);
        if (cat) {
          cat.name = name;
          cat.color = color;
        }
      };
      deleteCategory = (id) => {
        if (state.categories.length > 1) {
          state.categories = state.categories.filter((c) => c.id !== id);
          if (state.filterCategory === id) state.filterCategory = "all";
        }
      };
      getStats = () => {
        const tasks = getFilteredTasks();
        const pending = tasks.filter((t) => !t.completed && t.repeatType === "none").reduce((s, t) => s + t.duration, 0);
        const done = tasks.filter((t) => t.completed && t.repeatType === "none").reduce((s, t) => s + t.duration, 0);
        const overdueCount = tasks.filter((t) => !t.completed && !t.noTimeLimit && isOverdue(t.dueDate, false)).length;
        const todayStr = formatDate(/* @__PURE__ */ new Date());
        const todayTasks = tasks.filter((t) => !t.noTimeLimit && isTaskDueOnDate(t, todayStr));
        const todayDone = todayTasks.filter((t) => t.completed).length;
        return { pending, done, overdueCount, todayTotal: todayTasks.length, todayDone };
      };
    }
  });

  // shared/entry.ts
  init_task();

  // shared/render.ts
  init_task();
  init_sync();
  var renderSyncIndicator = () => {
    const status = getSyncStatus();
    if (status === "idle") return "";
    const icons = {
      idle: "",
      saving: `<span id="syncIndicator" class="p-2 rounded-lg transition text-blue-500" title="\u6B63\u5728\u540C\u6B65...">
      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
    </span>`,
      synced: `<span id="syncIndicator" class="p-2 rounded-lg transition text-green-500" title="\u5DF2\u540C\u6B65">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
    </span>`,
      "remote-updated": `<span id="syncIndicator" class="p-2 rounded-lg transition text-blue-500" title="\u5DF2\u6536\u5230\u8FDC\u7AEF\u66F4\u65B0">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
    </span>`,
      error: `<span id="syncIndicator" class="p-2 rounded-lg transition text-red-500" title="\u540C\u6B65\u5931\u8D25">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
    </span>`
    };
    return icons[status];
  };
  var renderStats = () => {
    const stats = getStats();
    return `
    <div class="flex gap-6 p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 mb-4 text-sm">
      <div><span class="text-gray-500">\u5F85\u5B8C\u6210\uFF1A</span><span class="font-medium text-orange-500">${formatHours(stats.pending)}</span></div>
      <div><span class="text-gray-500">\u5DF2\u5B8C\u6210\uFF1A</span><span class="font-medium text-green-500">${formatHours(stats.done)}</span></div>
      <div><span class="text-gray-500">\u4ECA\u65E5\uFF1A</span><span class="font-medium">${stats.todayDone}/${stats.todayTotal}</span></div>
      ${stats.overdueCount > 0 ? `<div class="text-red-500">${stats.overdueCount}\u9879\u5DF2\u8FC7\u671F</div>` : ""}
    </div>
  `;
  };
  var renderHeader = () => {
    const { currentView, darkMode } = getState();
    const isNewTab = window.location.pathname.includes("newtab");
    return `
    <header class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-semibold">\u4EFB\u52A1\u7BA1\u7406</h1>
        <button id="openFullPage" class="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm" title="\u65B0\u6807\u7B7E\u9875\u6253\u5F00">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
        </button>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button data-view="list" class="px-3 py-1 rounded text-sm transition ${currentView === "list" ? "bg-white dark:bg-gray-700 shadow" : ""}">\u5217\u8868</button>
          <button data-view="day" class="px-3 py-1 rounded text-sm transition ${currentView === "day" ? "bg-white dark:bg-gray-700 shadow" : ""}">\u65E5</button>
          <button data-view="week" class="px-3 py-1 rounded text-sm transition ${currentView === "week" ? "bg-white dark:bg-gray-700 shadow" : ""}">\u5468</button>
          <button data-view="month" class="px-3 py-1 rounded text-sm transition ${currentView === "month" ? "bg-white dark:bg-gray-700 shadow" : ""}">\u6708</button>
        </div>
        <button id="darkModeBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition" title="\u5207\u6362\u6DF1\u8272\u6A21\u5F0F">
          ${darkMode ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>' : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>'}
        </button>
        ${renderSyncIndicator()}
        ${isNewTab ? `
        <button id="syncDataBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition" title="\u6570\u636E\u540C\u6B65">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
        <button id="manageCategoryBtn" class="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm">\u5206\u7C7B</button>
        <button id="mobileSyncSettingsBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition" title="\u624B\u673A\u540C\u6B65\u8BBE\u7F6E">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
        </button>
        ` : ""}
        <button id="addTaskBtn" class="px-4 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">+ \u6DFB\u52A0</button>
      </div>
    </header>
  `;
  };
  var renderFilters = () => {
    const { hideCompleted, hideOverdue, showNoTimeLimitOnly, filterPriority, filterCategory, categories = [] } = getState();
    return `
    <div class="flex flex-wrap gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 mb-4 items-center text-sm">
      <div class="flex items-center gap-1">
        <span class="text-gray-500">\u4F18\u5148\u7EA7</span>
        <select id="filterPriority" class="px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm">
          <option value="all" ${filterPriority === "all" ? "selected" : ""}>\u5168\u90E8</option>
          <option value="high" ${filterPriority === "high" ? "selected" : ""}>\u9AD8</option>
          <option value="medium" ${filterPriority === "medium" ? "selected" : ""}>\u4E2D</option>
          <option value="low" ${filterPriority === "low" ? "selected" : ""}>\u4F4E</option>
        </select>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-gray-500">\u5206\u7C7B</span>
        <select id="filterCategory" class="px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm">
          <option value="all" ${filterCategory === "all" ? "selected" : ""}>\u5168\u90E8</option>
          ${categories.map((c) => `<option value="${c.id}" ${filterCategory === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
        </select>
      </div>
      <label class="flex items-center gap-1 cursor-pointer">
        <input type="checkbox" id="hideCompleted" class="rounded" ${hideCompleted ? "checked" : ""}> 
        <span>\u9690\u85CF\u5DF2\u5B8C\u6210</span>
      </label>
      <label class="flex items-center gap-1 cursor-pointer">
        <input type="checkbox" id="hideOverdue" class="rounded" ${hideOverdue ? "checked" : ""}> 
        <span>\u9690\u85CF\u4ECA\u65E5\u4E4B\u524D</span>
      </label>
      <label class="flex items-center gap-1 cursor-pointer">
        <input type="checkbox" id="showNoTimeLimitOnly" class="rounded" ${showNoTimeLimitOnly ? "checked" : ""}> 
        <span>\u4EFB\u52A1\u6C60\uFF08\u65E0\u622A\u6B62\u65E5\u671F\uFF09</span>
      </label>
    </div>
  `;
  };
  var renderTaskItem = (task) => {
    const category = getState().categories.find((c) => c.id === task.category);
    const overdue = !task.noTimeLimit && isOverdue(task.dueDate, task.completed);
    return `
    <div class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${task.completed ? "opacity-60" : ""} ${task.noTimeLimit ? "border-l-[3px] border-dashed border-gray-300 dark:border-gray-600 pl-3 -ml-3" : ""} ${overdue && !task.completed ? "bg-red-50/50 dark:bg-red-900/10" : ""}" data-task-id="${task.id}" draggable="true">
      <div class="w-2 h-8 rounded ${getPriorityColor(task.priority)} flex-shrink-0"></div>
      <button class="task-toggle flex-shrink-0 w-5 h-5 rounded-full border-2 ${task.completed ? "bg-green-500 border-green-500" : task.noTimeLimit ? "border-dashed border-gray-400" : "border-gray-300 dark:border-gray-500"} flex items-center justify-center hover:border-blue-400 transition" data-task-id="${task.id}">
        ${task.completed ? '<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>' : ""}
      </button>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-medium truncate ${task.completed ? "line-through text-gray-400" : ""}">${escapeHtml(task.title)}</span>
          ${category ? `<span class="text-xs px-2 py-0.5 rounded flex-shrink-0" style="background-color: ${category.color}20; color: ${category.color}">${escapeHtml(category.name)}</span>` : ""}
          ${task.noTimeLimit ? `<span class="text-xs px-2 py-0.5 rounded flex-shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-500">\u65E0\u671F\u9650</span>` : ""}
        </div>
        <div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
          ${task.duration > 0 ? `<span>${formatHours(task.duration)}</span>` : ""}
          ${!task.noTimeLimit ? `<span class="${overdue ? "text-red-500 font-medium" : ""}">${getRemainingTime(task.dueDate, task.completed)}</span>` : ""}
          ${task.repeatType !== "none" ? `<span class="text-blue-500">\u{1F504}</span>` : ""}
        </div>
        ${task.description ? `<p class="text-sm text-gray-500 mt-1 truncate dark:text-gray-400">${escapeHtml(task.description)}</p>` : ""}
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        <button class="task-edit p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition" data-id="${task.id}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
        </button>
        <button class="task-delete p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition text-red-500" data-id="${task.id}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>
  `;
  };
  var renderListView = () => {
    const tasks = getFilteredTasks();
    if (tasks.length === 0) {
      return `<div class="text-center py-12 text-gray-400"><p class="text-lg">\u6682\u65E0\u4EFB\u52A1</p><p class="text-sm mt-2">\u70B9\u51FB\u53F3\u4E0A\u89D2"\u6DFB\u52A0"\u5F00\u59CB</p></div>`;
    }
    const groups = /* @__PURE__ */ new Map();
    tasks.forEach((t) => {
      const key = t.noTimeLimit ? "no-date" : t.dueDate;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    });
    const dates = Array.from(groups.keys()).sort((a, b) => {
      if (a === "no-date") return 1;
      if (b === "no-date") return -1;
      return a.localeCompare(b);
    });
    return dates.map((d) => `
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden mb-4">
      <div class="px-4 py-2 bg-gray-50 dark:bg-gray-900 font-medium text-sm text-gray-600 dark:text-gray-400 drop-zone" data-date="${d}">
        ${d === "no-date" ? "\u4EFB\u52A1\u6C60\uFF08\u65E0\u622A\u6B62\u65E5\u671F\uFF09" : getDateLabel(d)}
      </div>
      ${(groups.get(d) || []).map((t) => renderTaskItem(t)).join("")}
    </div>
  `).join("");
  };
  var renderDayView = () => {
    const { currentDate } = getState();
    const tasks = getFilteredTasks().filter((t) => !t.noTimeLimit && isTaskDueOnDate(t, currentDate));
    const todayStr = formatDate(/* @__PURE__ */ new Date());
    const isToday = currentDate === todayStr;
    return `
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
      <div class="flex items-center justify-between mb-4 pb-2 border-b dark:border-gray-700">
        <button id="prevDay" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div class="flex flex-col items-center">
          <span class="font-medium">${getDateLabel(currentDate)}</span>
          ${!isToday ? `<button id="goTodayDay" class="text-xs text-blue-500 hover:underline mt-1">\u56DE\u5230\u4ECA\u5929</button>` : ""}
        </div>
        <button id="nextDay" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div class="${tasks.length === 0 ? "py-8 text-center text-gray-400" : ""}">
        ${tasks.length === 0 ? "\u4ECA\u65E5\u65E0\u4EFB\u52A1" : tasks.map((t) => renderTaskItem(t)).join("")}
      </div>
    </div>
  `;
  };
  var renderWeekView = () => {
    const { currentDate } = getState();
    const today = parseDate(currentDate);
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(formatDate(d));
    }
    const todayStr = formatDate(/* @__PURE__ */ new Date());
    const todayMonday = new Date(todayStr);
    todayMonday.setDate(new Date(todayStr).getDate() - new Date(todayStr).getDay() + 1);
    const isCurrentWeek = formatDate(todayMonday) === formatDate(monday);
    return `
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
      <div class="flex items-center justify-between mb-4 pb-2 border-b dark:border-gray-700">
        <button id="prevWeek" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div class="flex flex-col items-center">
          <span class="font-medium">${days[0].slice(5)} ~ ${days[6].slice(5)}</span>
          ${!isCurrentWeek ? `<button id="goTodayWeek" class="text-xs text-blue-500 hover:underline mt-1">\u56DE\u5230\u672C\u5468</button>` : ""}
        </div>
        <button id="nextWeek" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div>
        ${days.map((d) => {
      const dayTasks = getState().tasks.filter((t) => !t.noTimeLimit && isTaskDueOnDate(t, d));
      const isToday = d === todayStr;
      const pendingMin = dayTasks.filter((t) => !t.completed && t.repeatType === "none").reduce((s, t) => s + t.duration, 0);
      const completedMin = dayTasks.filter((t) => t.completed && t.repeatType === "none").reduce((s, t) => s + t.duration, 0);
      return `
            <div class="flex border-b dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition drop-zone" data-date="${d}">
              <div class="w-24 flex-shrink-0 p-3 ${isToday ? "bg-blue-50/50 dark:bg-blue-900/20" : ""}">
                <div class="text-sm font-medium ${isToday ? "text-blue-500" : ""}">${getDateLabel(d)}</div>
                <div class="text-xs text-gray-400 mt-1">
                  ${pendingMin > 0 ? `<span class="text-orange-500">${formatHours(pendingMin)}</span>` : ""}
                  ${completedMin > 0 ? `<br><span class="text-green-500">${formatHours(completedMin)}</span>` : ""}
                </div>
              </div>
              <div class="flex-1 p-2 min-h-[80px] flex flex-wrap content-start gap-2">
                ${dayTasks.length === 0 ? '<span class="text-xs text-gray-300 dark:text-gray-600">\u65E0</span>' : dayTasks.map((t) => renderWeekTaskCard(t, d)).join("")}
              </div>
            </div>
          `;
    }).join("")}
      </div>
    </div>
  `;
  };
  var renderWeekTaskCard = (task, date) => {
    const cat = getState().categories.find((c) => c.id === task.category);
    const isRecurringDone = task.repeatType && task.repeatType !== "none" && date && (task.completedDates || []).includes(date);
    const done = task.completed || isRecurringDone;
    return `
    <div class="week-task-item p-2 rounded border dark:border-gray-600 ${done ? "opacity-50 bg-gray-50 dark:bg-gray-800" : "bg-white dark:bg-gray-700 hover:shadow-md"} transition cursor-move flex-shrink-0" style="min-width:140px" draggable="true" data-task-id="${task.id}" title="\u53CC\u51FB\u7F16\u8F91">
      <div class="flex items-start gap-2">
        <div class="w-1 h-full min-h-[32px] rounded ${getPriorityColor(task.priority)}"></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1 mb-1">
            <span class="text-sm font-medium truncate ${done ? "line-through" : ""}">${escapeHtml(task.title)}</span>
            ${task.repeatType !== "none" ? '<span class="text-blue-500">\u{1F504}</span>' : ""}
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <span>${formatHours(task.duration)}</span>
            ${cat ? `<span class="px-1 py-0.5 rounded text-white" style="background-color:${cat.color}">${escapeHtml(cat.name)}</span>` : ""}
          </div>
        </div>
      </div>
    </div>
  `;
  };
  var renderMonthView = () => {
    const { currentDate } = getState();
    const today = parseDate(currentDate);
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1));
    const weekdays = ["\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D", "\u5468\u65E5"];
    const weeks = [];
    let currentWeek = [];
    let current = new Date(startDate);
    for (let i = 0; i < 42; i++) {
      currentWeek.push(formatDate(current));
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      current.setDate(current.getDate() + 1);
    }
    return `
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
      <div class="flex items-center justify-between mb-4 pb-2 border-b dark:border-gray-700">
        <button id="prevMonth" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <span class="font-medium">${year}\u5E74${month + 1}\u6708</span>
        <button id="nextMonth" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div class="grid grid-cols-7" style="border:1px solid #e5e7eb;border-bottom:none;border-right:none">
        ${weekdays.map((d) => `<div class="text-center py-2 font-medium text-sm text-gray-500 border-b border-r dark:border-gray-700">${d}</div>`).join("")}
        ${weeks.map((week) => week.map((d) => {
      const dayDate = parseDate(d);
      const isCurrentMonth = dayDate.getMonth() === month;
      const isToday = d === formatDate(/* @__PURE__ */ new Date());
      const dayTasks = getState().tasks.filter((t) => !t.noTimeLimit && isTaskDueOnDate(t, d));
      return `
            <div class="min-h-[100px] p-2 border-b border-r dark:border-gray-700 ${isCurrentMonth ? "" : "bg-gray-50 dark:bg-gray-900/50"} ${isToday ? "bg-blue-50/50 dark:bg-blue-900/20" : ""} hover:bg-gray-100 dark:hover:bg-gray-700/30 transition cursor-pointer drop-zone" data-date="${d}">
              <div class="text-sm mb-1 ${isCurrentMonth ? "" : "text-gray-300 dark:text-gray-600"} ${isToday ? "font-bold text-blue-500" : ""}">${dayDate.getDate()}</div>
              ${dayTasks.slice(0, 2).map((t) => {
        const isRecurringDone = t.repeatType && t.repeatType !== "none" && (t.completedDates || []).includes(d);
        const done = t.completed || isRecurringDone;
        return `<div class="month-task-item text-xs p-1 rounded mb-1 truncate ${done ? "line-through opacity-40 bg-gray-100 dark:bg-gray-700" : "bg-blue-100/50 dark:bg-blue-900/30"}" draggable="true" data-task-id="${t.id}" title="\u53CC\u51FB\u7F16\u8F91">${escapeHtml(t.title)}</div>`;
      }).join("")}
              ${dayTasks.length > 2 ? `<div class="text-xs text-gray-400">+${dayTasks.length - 2}</div>` : ""}
            </div>
          `;
    }).join("")).join("")}
      </div>
    </div>
  `;
  };
  var renderTaskList = () => {
    const { currentView } = getState();
    switch (currentView) {
      case "list":
        return renderListView();
      case "day":
        return renderDayView();
      case "week":
        return renderWeekView();
      case "month":
        return renderMonthView();
    }
  };
  var renderModal = () => {
    const { editingTask, categories = [], defaultCategory } = getState();
    const isEditing = editingTask !== null;
    const task = editingTask || {
      title: "",
      description: "",
      priority: "medium",
      category: defaultCategory || categories[0]?.id || "",
      dueDate: formatDate(/* @__PURE__ */ new Date()),
      duration: 60,
      repeatType: "none",
      repeatDays: [],
      repeatInterval: 1,
      noTimeLimit: false,
      completed: false
    };
    const weekdays = ["\u5468\u65E5", "\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D"];
    return `
    <div id="taskModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[90%] max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 class="text-lg font-semibold">${isEditing ? "\u7F16\u8F91\u4EFB\u52A1" : "\u6DFB\u52A0\u4EFB\u52A1"}</h2>
          <button id="closeModal" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="taskForm" class="p-4 space-y-4">
          <div class="flex items-start gap-4">
            <div class="flex-1">
              <label class="block text-sm font-medium mb-1">\u4EFB\u52A1\u540D\u79F0 *</label>
              <input type="text" name="title" value="${escapeHtml(task.title)}" required class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
            </div>
            ${isEditing ? `
              <div class="pt-6">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="taskCompleted" ${task.completed ? "checked" : ""} class="rounded"> 
                  <span class="text-sm">\u5DF2\u5B8C\u6210</span>
                </label>
              </div>
            ` : ""}
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">\u5907\u6CE8</label>
            <textarea name="description" rows="2" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white resize-none">${escapeHtml(task.description)}</textarea>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">\u4F18\u5148\u7EA7</label>
              <select name="priority" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
                <option value="high" ${task.priority === "high" ? "selected" : ""}>\u9AD8</option>
                <option value="medium" ${task.priority === "medium" ? "selected" : ""}>\u4E2D</option>
                <option value="low" ${task.priority === "low" ? "selected" : ""}>\u4F4E</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">\u5206\u7C7B</label>
              <select name="category" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
                ${categories.map((c) => `<option value="${c.id}" ${task.category === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="border-t dark:border-gray-700 pt-4">
            <label class="flex items-center gap-2 cursor-pointer mb-3">
              <input type="checkbox" id="noTimeLimit" name="noTimeLimit" ${task.noTimeLimit ? "checked" : ""} class="rounded"> 
              <span class="text-sm font-medium">\u65E0\u65F6\u95F4\u9650\u5236\uFF08\u4EFB\u52A1\u6C60\uFF09</span>
            </label>
            <div id="dueDateField" style="${task.noTimeLimit ? "opacity:0.5;pointer-events:none" : ""}">
              <div>
                <label class="block text-sm font-medium mb-1">\u622A\u6B62\u65E5\u671F</label>
                <input type="date" name="dueDate" value="${task.dueDate}" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
              </div>
            </div>
            <div class="mt-4">
              <label class="block text-sm font-medium mb-1">\u9884\u8BA1\u65F6\u957F (\u5C0F\u65F6)</label>
              <div class="flex items-center gap-2">
                <button type="button" id="durationDecrease" class="px-3 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">-</button>
                <input type="number" name="duration" id="durationInput" value="${(task.duration / 60).toFixed(1)}" min="0.1" step="0.1" class="w-16 text-center px-2 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
                <button type="button" id="durationIncrease" class="px-3 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">+</button>
              </div>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">\u91CD\u590D</label>
            <select name="repeatType" id="repeatType" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
              <option value="none" ${task.repeatType === "none" ? "selected" : ""}>\u4E0D\u91CD\u590D</option>
              <option value="daily" ${task.repeatType === "daily" ? "selected" : ""}>\u6BCF\u5929</option>
              <option value="weekly" ${task.repeatType === "weekly" ? "selected" : ""}>\u6BCF\u5468\u51E0</option>
              <option value="monthly" ${task.repeatType === "monthly" ? "selected" : ""}>\u6BCF\u6708</option>
              <option value="workdays" ${task.repeatType === "workdays" ? "selected" : ""}>\u5DE5\u4F5C\u65E5</option>
              <option value="custom" ${task.repeatType === "custom" ? "selected" : ""}>\u81EA\u5B9A\u4E49\u95F4\u9694</option>
            </select>
          </div>
          <div id="weeklyDays" class="${task.repeatType !== "weekly" ? "hidden" : ""}">
            <label class="block text-sm font-medium mb-1">\u9009\u62E9\u661F\u671F</label>
            <div class="flex gap-2">
              ${weekdays.map((d, i) => `
                <label class="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" name="repeatDays" value="${i}" ${task.repeatDays.includes(i) ? "checked" : ""} class="rounded"> 
                  <span class="text-sm">${d.slice(1)}</span>
                </label>
              `).join("")}
            </div>
          </div>
          <div id="customInterval" class="${task.repeatType !== "custom" ? "hidden" : ""}">
            <label class="block text-sm font-medium mb-1">\u95F4\u9694\u5929\u6570</label>
            <input type="number" name="repeatInterval" value="${task.repeatInterval}" min="1" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
          </div>
          <div class="flex gap-3 pt-4">
            ${isEditing ? `<button type="button" id="deleteTaskBtn" class="px-4 py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition">\u5220\u9664</button>` : ""}
            <div class="flex-1"></div>
            <button type="button" id="cancelBtn" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">\u53D6\u6D88</button>
            <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">${isEditing ? "\u4FDD\u5B58" : "\u6DFB\u52A0"}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  };
  var renderCategoryModal = () => {
    const { categories = [], defaultCategory } = getState();
    return `
    <div id="categoryModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[90%] max-w-md">
        <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 class="text-lg font-semibold">\u7BA1\u7406\u5206\u7C7B</h2>
          <button id="closeCategoryModal" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="p-4 max-h-[400px] overflow-y-auto">
          <div id="categoryList">
            ${categories.map((cat) => `
              <div class="category-item flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded mb-2" data-id="${cat.id}">
                <div class="flex items-center gap-2 flex-1">
                  <input type="color" value="${cat.color}" class="category-color w-8 h-8 rounded cursor-pointer border-0" data-id="${cat.id}">
                  <input type="text" value="${escapeHtml(cat.name)}" class="category-name flex-1 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm" data-id="${cat.id}">
                  ${defaultCategory === cat.id ? '<span class="text-xs text-blue-500 font-medium">\u9ED8\u8BA4</span>' : ""}
                </div>
                <div class="flex gap-1">
                  <button class="set-default-category p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded text-blue-500 transition ${defaultCategory === cat.id ? "opacity-30" : ""}" data-id="${cat.id}" title="\u8BBE\u4E3A\u9ED8\u8BA4\u5206\u7C7B">
                    <svg class="w-4 h-4" fill="${defaultCategory === cat.id ? "currentColor" : "none"}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                  </button>
                  <button class="save-category p-1 hover:bg-green-50 dark:hover:bg-green-900/20 rounded text-green-500 transition" data-id="${cat.id}" title="\u4FDD\u5B58">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                  </button>
                  <button class="delete-category p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-500 transition" data-id="${cat.id}" title="\u5220\u9664">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
            `).join("")}
          </div>
          <div class="flex gap-2 mt-4 pt-4 border-t dark:border-gray-700">
            <input type="text" id="newCategoryName" placeholder="\u65B0\u5206\u7C7B\u540D\u79F0" class="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm">
            <input type="color" id="newCategoryColor" value="#3b82f6" class="w-10 h-10 rounded cursor-pointer">
            <button id="createCategoryBtn" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm">\u6DFB\u52A0</button>
          </div>
        </div>
      </div>
    </div>
  `;
  };
  var renderSyncModal = () => {
    const { tasks, categories } = getState();
    return `
    <style>
      #syncModal .sync-card {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px 12px;
        border-radius: 12px;
        border: 1.5px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
      }
      #syncModal .sync-card::before {
        content: '';
        position: absolute;
        top: -30px;
        right: -30px;
        width: 80px;
        height: 80px;
        border-radius: 50%;
        opacity: 0.08;
        transition: all 0.2s ease;
      }
      #syncModal .sync-card:hover::before { opacity: 0.15; }
      #syncModal .sync-card:active { transform: scale(0.97); }
      #syncModal .card-upload {
        background: #eff6ff;
        border-color: #bfdbfe;
      }
      #syncModal .card-upload::before { background: #3b82f6; }
      #syncModal .card-upload:hover { border-color: #93c5fd; box-shadow: 0 4px 12px rgba(59,130,246,0.15); }
      #syncModal .card-download {
        background: #ecfdf5;
        border-color: #a7f3d0;
      }
      #syncModal .card-download::before { background: #10b981; }
      #syncModal .card-download:hover { border-color: #6ee7b7; box-shadow: 0 4px 12px rgba(16,185,129,0.15); }
      .dark #syncModal .card-upload { background: rgba(30,58,138,0.2); border-color: rgba(96,165,250,0.2); }
      .dark #syncModal .card-upload:hover { border-color: rgba(96,165,250,0.4); box-shadow: 0 4px 12px rgba(59,130,246,0.1); }
      .dark #syncModal .card-download { background: rgba(6,78,59,0.2); border-color: rgba(52,211,153,0.2); }
      .dark #syncModal .card-download:hover { border-color: rgba(52,211,153,0.4); box-shadow: 0 4px 12px rgba(16,185,129,0.1); }
      #syncModal .icon-circle {
        width: 44px; height: 44px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        margin-bottom: 10px;
        transition: transform 0.2s ease;
      }
      #syncModal .sync-card:hover .icon-circle { transform: translateY(-2px); }
      #syncModal .icon-upload { background: #3b82f6; }
      #syncModal .icon-download { background: #10b981; }
      #syncModal .card-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
      #syncModal .card-upload .card-title { color: #1d4ed8; }
      #syncModal .card-download .card-title { color: #059669; }
      .dark #syncModal .card-upload .card-title { color: #93c5fd; }
      .dark #syncModal .card-download .card-title { color: #6ee7b7; }
      #syncModal .card-hint { font-size: 11px; color: #9ca3af; }
      #syncModal .file-btn {
        flex: 1;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        padding: 8px 12px;
        font-size: 12px;
        color: #6b7280;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
        border: none; background: none;
      }
      #syncModal .file-btn:hover { background: #f3f4f6; color: #374151; }
      .dark #syncModal .file-btn { color: #9ca3af; }
      .dark #syncModal .file-btn:hover { background: rgba(55,65,81,0.5); color: #d1d5db; }
      #syncModal .close-btn { padding:6px;border-radius:8px;border:none;background:none;cursor:pointer;color:#9ca3af;transition:all 0.15s; }
      #syncModal .close-btn:hover { background:#f3f4f6; color:#4b5563; }
      .dark #syncModal .close-btn:hover { background:rgba(55,65,81,0.5); color:#d1d5db; }
    </style>
    <div id="syncModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[90%] max-w-md overflow-hidden" style="border-radius:16px;">
        <div style="padding:20px 24px 16px;">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold" style="color:#111827;">\u6570\u636E\u540C\u6B65</h2>
            <button id="closeSyncModal" class="close-btn">
              <svg style="width:18px;height:18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <p style="font-size:12px;color:#9ca3af;margin-top:4px;">${tasks.length} \u4E2A\u4EFB\u52A1 \xB7 ${categories.length} \u4E2A\u5206\u7C7B \xB7 \u4E91\u7AEF\u540C\u6B65</p>
        </div>
        <div id="syncFeedback" style="margin:0 24px 0;padding:8px 12px;border-radius:8px;font-size:12px;display:none;"></div>
        <div style="padding:0 24px 20px;">
          <div class="flex gap-3">
            <button id="forceUploadBtn" class="sync-card card-upload">
              <div class="icon-circle icon-upload">
                <svg style="width:20px;height:20px;color:white;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
              </div>
              <div class="card-title">\u4E0A\u4F20\u5230\u4E91\u7AEF</div>
              <div class="card-hint">\u672C\u673A \u2192 \u4E91\u7AEF</div>
            </button>
            <button id="forceDownloadBtn" class="sync-card card-download">
              <div class="icon-circle icon-download">
                <svg style="width:20px;height:20px;color:white;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>
              </div>
              <div class="card-title">\u4ECE\u4E91\u7AEF\u62C9\u53D6</div>
              <div class="card-hint">\u4E91\u7AEF \u2192 \u672C\u673A</div>
            </button>
          </div>
        </div>
        <div class="flex border-t dark:border-gray-700" style="padding:10px 24px;">
          <button id="exportFileBtn" class="file-btn">
            <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            \u5BFC\u51FA\u6587\u4EF6
          </button>
          <button id="importFileBtn" class="file-btn">
            <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            \u5BFC\u5165\u6587\u4EF6
          </button>
        </div>
        <!-- \u6570\u636E\u5907\u4EFD\u533A\u57DF -->
        <div id="backupSection" class="border-t dark:border-gray-700" style="padding:16px 24px 20px;">
          <div class="flex items-center justify-between mb-3">
            <span style="font-size:13px;font-weight:600;color:#374151;" class="dark:text-gray-300">\u6570\u636E\u5907\u4EFD</span>
            <div class="flex items-center gap-2">
              <span id="storageUsageText" style="font-size:11px;color:#9ca3af;">\u8BA1\u7B97\u4E2D...</span>
              <button id="createBackupBtn" style="font-size:12px;padding:4px 10px;border-radius:6px;border:1px solid #d1d5db;background:white;color:#374151;cursor:pointer;transition:all 0.15s;" class="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600">\u7ACB\u5373\u5907\u4EFD</button>
            </div>
          </div>
          <!-- \u5B58\u50A8\u7528\u91CF\u6761 -->
          <div style="height:4px;background:#f3f4f6;border-radius:2px;margin-bottom:12px;overflow:hidden;" class="dark:bg-gray-700">
            <div id="storageUsageBar" style="height:100%;width:0%;background:#3b82f6;border-radius:2px;transition:width 0.3s;"></div>
          </div>
          <div id="backupList" style="font-size:12px;color:#6b7280;" class="dark:text-gray-400">
            \u52A0\u8F7D\u4E2D...
          </div>
        </div>
      </div>
    </div>
    <input type="file" id="syncImportInput" accept=".json" style="opacity:0;position:absolute;pointer-events:none;">
  `;
  };
  var renderMobileSyncPanel = () => {
    return `
    <div id="mobileSyncModal" class="hidden fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" id="mobileSyncOverlay"></div>
      <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-8 p-10 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-8">
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white">\u624B\u673A\u540C\u6B65\u8BBE\u7F6E</h3>
          <button id="mobileSyncClose" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2.5">API \u5730\u5740</label>
            <input type="url" id="mobileSyncApiUrl" class="w-full px-4 py-3 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="https://your-worker.workers.dev">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2.5">API \u5BC6\u94A5</label>
            <input type="text" id="mobileSyncApiToken" class="w-full px-4 py-3 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="\u7C98\u8D34\u4F60\u7684 API Token" autocomplete="off">
          </div>
          <div class="flex gap-4 pt-2">
            <button id="mobileSyncSaveBtn" class="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">\u4FDD\u5B58\u8BBE\u7F6E</button>
            <button id="mobileSyncNowBtn" class="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm font-medium">\u7ACB\u5373\u540C\u6B65</button>
          </div>
          <div id="mobileSyncStatus" class="text-xs text-gray-500 dark:text-gray-400 min-h-[1.25rem]"></div>
          <div class="pt-4 border-t dark:border-gray-700">
            <p class="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">\u624B\u673A\u8BBF\u95EE\u4F60\u7684 Worker \u5730\u5740\u5373\u53EF\u6DFB\u52A0\u4EFB\u52A1\uFF0C\u4E5F\u53EF\u901A\u8FC7 Telegram Bot \u53D1\u6D88\u606F\u6DFB\u52A0\u3002</p>
          </div>
        </div>
      </div>
    </div>
  `;
  };
  var renderApp = (container) => {
    const { darkMode } = getState();
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    container.innerHTML = `
    <div class="max-w-4xl mx-auto p-4 min-h-screen">
      ${renderStats()}
      ${renderHeader()}
      ${renderFilters()}
      ${renderTaskList()}
      ${renderModal()}
      ${renderCategoryModal()}
      ${renderSyncModal()}
      ${renderMobileSyncPanel()}
    </div>
  `;
  };

  // shared/events.ts
  init_task();
  init_task();
  init_storage();
  init_sync();
  var draggedTaskId = null;
  var currentContainer = null;
  function showSyncFeedback(container, message, type = "success") {
    const el = container.querySelector("#syncFeedback");
    if (!el) return;
    const colors = {
      success: "background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;",
      error: "background:#fef2f2;color:#dc2626;border:1px solid #fecaca;",
      info: "background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;"
    };
    el.style.cssText = `margin:0 24px 0;padding:8px 12px;border-radius:8px;font-size:12px;display:block;${colors[type]}`;
    el.textContent = message;
  }
  function syncToast(message, type = "success") {
    document.querySelectorAll(".sync-action-toast").forEach((el) => el.remove());
    const toast = document.createElement("div");
    toast.className = "sync-action-toast";
    const bgColor = type === "success" ? "#22c55e" : "#ef4444";
    toast.style.cssText = `position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);padding:0.75rem 1.5rem;border-radius:0.75rem;box-shadow:0 10px 25px rgba(0,0,0,0.15);color:#fff;font-size:0.875rem;font-weight:500;z-index:10000;background:${bgColor};transition:opacity 0.3s;white-space:nowrap;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 3e3);
  }
  function reRender() {
    if (!currentContainer) return;
    renderApp(currentContainer);
    attachEventListeners(currentContainer);
  }
  var attachEventListeners = (container) => {
    currentContainer = container;
    container.querySelector("#addTaskBtn")?.addEventListener("click", () => {
      resetEditingTask();
      reRender();
      const modal = container.querySelector("#taskModal");
      modal?.classList.remove("hidden");
    });
    container.querySelector("#openFullPage")?.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "openNewTab" });
    });
    container.querySelector("#darkModeBtn")?.addEventListener("click", async () => {
      const { darkMode } = getState();
      setState({ darkMode: !darkMode });
      await persistState();
      reRender();
    });
    container.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const view = e.currentTarget.dataset.view;
        setState({ currentView: view });
        reRender();
      });
    });
    container.querySelector("#filterPriority")?.addEventListener("change", async (e) => {
      setState({ filterPriority: e.target.value });
      await persistState();
      reRender();
    });
    container.querySelector("#filterCategory")?.addEventListener("change", async (e) => {
      setState({ filterCategory: e.target.value });
      await persistState();
      reRender();
    });
    container.querySelector("#hideCompleted")?.addEventListener("change", async (e) => {
      setState({ hideCompleted: e.target.checked });
      await persistState();
      reRender();
    });
    container.querySelector("#hideOverdue")?.addEventListener("change", async (e) => {
      setState({ hideOverdue: e.target.checked });
      await persistState();
      reRender();
    });
    container.querySelector("#showNoTimeLimitOnly")?.addEventListener("change", async (e) => {
      setState({ showNoTimeLimitOnly: e.target.checked });
      await persistState();
      reRender();
    });
    container.querySelector("#prevDay")?.addEventListener("click", () => {
      const { currentDate } = getState();
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setState({ currentDate: formatDate(d) });
      reRender();
    });
    container.querySelector("#nextDay")?.addEventListener("click", () => {
      const { currentDate } = getState();
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setState({ currentDate: formatDate(d) });
      reRender();
    });
    container.querySelector("#goTodayDay")?.addEventListener("click", () => {
      setState({ currentDate: formatDate(/* @__PURE__ */ new Date()) });
      reRender();
    });
    container.querySelector("#prevWeek")?.addEventListener("click", () => {
      const { currentDate } = getState();
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setState({ currentDate: formatDate(d) });
      reRender();
    });
    container.querySelector("#nextWeek")?.addEventListener("click", () => {
      const { currentDate } = getState();
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setState({ currentDate: formatDate(d) });
      reRender();
    });
    container.querySelector("#goTodayWeek")?.addEventListener("click", () => {
      setState({ currentDate: formatDate(/* @__PURE__ */ new Date()) });
      reRender();
    });
    container.querySelector("#prevMonth")?.addEventListener("click", () => {
      const { currentDate } = getState();
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() - 1);
      setState({ currentDate: formatDate(d) });
      reRender();
    });
    container.querySelector("#nextMonth")?.addEventListener("click", () => {
      const { currentDate } = getState();
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() + 1);
      setState({ currentDate: formatDate(d) });
      reRender();
    });
    container.querySelectorAll(".task-toggle").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.taskId;
        if (id) {
          toggleTask(id);
          await persistState();
          reRender();
        }
      });
    });
    container.querySelectorAll(".task-edit").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        if (id) {
          const task = getState().tasks.find((t) => t.id === id);
          if (task) {
            setState({ editingTask: task });
            reRender();
            const modal = container.querySelector("#taskModal");
            modal?.classList.remove("hidden");
          }
        }
      });
    });
    container.querySelectorAll(".task-delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        if (id && confirm("\u786E\u5B9A\u5220\u9664\u6B64\u4EFB\u52A1\uFF1F")) {
          deleteTask(id);
          await persistState();
          reRender();
        }
      });
    });
    const taskForm = container.querySelector("#taskForm");
    taskForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const formData = new FormData(form);
      const { editingTask } = getState();
      const noTimeLimit = form.querySelector("#noTimeLimit")?.checked || false;
      const repeatDays = [];
      form.querySelectorAll('[name="repeatDays"]:checked').forEach((cb) => {
        repeatDays.push(parseInt(cb.value));
      });
      const durationInput = form.querySelector("#durationInput");
      const duration = Math.round(parseFloat(durationInput?.value || "1") * 60) || 60;
      const taskData = {
        title: formData.get("title"),
        description: formData.get("description"),
        priority: formData.get("priority"),
        category: formData.get("category"),
        dueDate: noTimeLimit ? "" : formData.get("dueDate"),
        duration,
        completed: editingTask?.completed || false,
        repeatType: formData.get("repeatType"),
        repeatDays,
        repeatInterval: parseInt(formData.get("repeatInterval")) || 1,
        noTimeLimit
      };
      if (editingTask) {
        updateTask(editingTask.id, taskData);
      } else {
        addTask(taskData);
      }
      await persistState();
      resetEditingTask();
      reRender();
    });
    container.querySelector("#closeModal")?.addEventListener("click", () => {
      const modal = container.querySelector("#taskModal");
      modal?.classList.add("hidden");
      resetEditingTask();
      reRender();
    });
    container.querySelector("#cancelBtn")?.addEventListener("click", () => {
      const modal = container.querySelector("#taskModal");
      modal?.classList.add("hidden");
      resetEditingTask();
      reRender();
    });
    container.querySelector("#taskModal")?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) {
        const modal = container.querySelector("#taskModal");
        modal?.classList.add("hidden");
        resetEditingTask();
        reRender();
      }
    });
    container.querySelector("#deleteTaskBtn")?.addEventListener("click", async () => {
      const { editingTask } = getState();
      if (editingTask && confirm("\u786E\u5B9A\u5220\u9664\u6B64\u4EFB\u52A1\uFF1F")) {
        deleteTask(editingTask.id);
        await persistState();
        const modal = container.querySelector("#taskModal");
        modal?.classList.add("hidden");
        resetEditingTask();
        reRender();
      }
    });
    container.querySelector("#durationDecrease")?.addEventListener("click", () => {
      const input = container.querySelector("#durationInput");
      if (input) {
        const val = parseFloat(input.value) - 0.5;
        input.value = Math.max(0.5, val).toFixed(1);
      }
    });
    container.querySelector("#durationIncrease")?.addEventListener("click", () => {
      const input = container.querySelector("#durationInput");
      if (input) {
        const val = parseFloat(input.value) + 0.5;
        input.value = Math.min(24, val).toFixed(1);
      }
    });
    container.querySelector("#noTimeLimit")?.addEventListener("change", (e) => {
      const dueDateField = container.querySelector("#dueDateField");
      if (dueDateField) {
        dueDateField.style.opacity = e.target.checked ? "0.5" : "1";
        dueDateField.style.pointerEvents = e.target.checked ? "none" : "auto";
      }
    });
    container.querySelector("#repeatType")?.addEventListener("change", (e) => {
      const weeklyDays = container.querySelector("#weeklyDays");
      const customInterval = container.querySelector("#customInterval");
      const value = e.target.value;
      if (weeklyDays) weeklyDays.classList.toggle("hidden", value !== "weekly");
      if (customInterval) customInterval.classList.toggle("hidden", value !== "custom");
    });
    const isNewTab = window.location.pathname.includes("newtab");
    if (isNewTab) {
      container.querySelector("#manageCategoryBtn")?.addEventListener("click", () => {
        const modal = container.querySelector("#categoryModal");
        modal?.classList.remove("hidden");
      });
      container.querySelector("#closeCategoryModal")?.addEventListener("click", () => {
        const modal = container.querySelector("#categoryModal");
        modal?.classList.add("hidden");
      });
      container.querySelector("#categoryModal")?.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) {
          const modal = container.querySelector("#categoryModal");
          modal?.classList.add("hidden");
        }
      });
      container.querySelector("#createCategoryBtn")?.addEventListener("click", async () => {
        const nameInput = container.querySelector("#newCategoryName");
        const colorInput = container.querySelector("#newCategoryColor");
        if (nameInput.value.trim()) {
          addCategory(nameInput.value.trim(), colorInput.value);
          await persistState();
          nameInput.value = "";
          reRender();
          const modal = container.querySelector("#categoryModal");
          modal?.classList.remove("hidden");
        }
      });
      container.querySelectorAll(".save-category").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = e.currentTarget.dataset.id;
          if (id) {
            const item = container.querySelector(`.category-item[data-id="${id}"]`);
            const nameInput = item?.querySelector(".category-name");
            const colorInput = item?.querySelector(".category-color");
            if (nameInput && colorInput && nameInput.value.trim()) {
              updateCategory(id, nameInput.value.trim(), colorInput.value);
              await persistState();
              reRender();
              const modal = container.querySelector("#categoryModal");
              modal?.classList.remove("hidden");
            }
          }
        });
      });
      container.querySelectorAll(".delete-category").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = e.currentTarget.dataset.id;
          if (id && getState().categories.length > 1) {
            if (confirm("\u786E\u5B9A\u5220\u9664\u6B64\u5206\u7C7B\uFF1F")) {
              deleteCategory(id);
              if (getState().defaultCategory === id) {
                setState({ defaultCategory: "" });
              }
              await persistState();
              reRender();
              const modal = container.querySelector("#categoryModal");
              modal?.classList.remove("hidden");
            }
          } else if (id && getState().categories.length <= 1) {
            alert("\u81F3\u5C11\u4FDD\u7559\u4E00\u4E2A\u5206\u7C7B");
          }
        });
      });
      container.querySelectorAll(".set-default-category").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = e.currentTarget.dataset.id;
          if (id) {
            setState({ defaultCategory: id });
            await persistState();
            reRender();
            const modal = container.querySelector("#categoryModal");
            modal?.classList.remove("hidden");
          }
        });
      });
      container.querySelector("#exportBtn")?.addEventListener("click", async () => {
        try {
          await downloadExportFile();
          showToast(container, "\u6570\u636E\u5DF2\u5BFC\u51FA\u6210\u529F\uFF01", "success");
        } catch (err) {
          showToast(container, "\u5BFC\u51FA\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5", "error");
        }
      });
      const importInput = container.querySelector("#importFileInput");
      importInput?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const result = await importDataFromFile(file);
          if (result.success) {
            await loadState();
            reRender();
            showToast(container, "\u6570\u636E\u5BFC\u5165\u6210\u529F\uFF01", "success");
          } else {
            showToast(container, result.error || "\u5BFC\u5165\u5931\u8D25", "error");
          }
          importInput.value = "";
        }
      });
      container.querySelector("#syncDataBtn")?.addEventListener("click", () => {
        const modal = container.querySelector("#syncModal");
        modal?.classList.remove("hidden");
      });
      container.querySelector("#closeSyncModal")?.addEventListener("click", () => {
        const modal = container.querySelector("#syncModal");
        modal?.classList.add("hidden");
      });
      container.querySelector("#syncModal")?.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) {
          const modal = container.querySelector("#syncModal");
          modal?.classList.add("hidden");
        }
      });
      container.querySelector("#forceUploadBtn")?.addEventListener("click", async () => {
        const btn = container.querySelector("#forceUploadBtn");
        const origHTML = btn?.innerHTML;
        try {
          if (btn) btn.innerHTML = '<div class="card-title" style="color:#6b7280;">\u4E0A\u4F20\u4E2D...</div>';
          showSyncFeedback(container, "\u6B63\u5728\u4E0A\u4F20\u6570\u636E\u5230\u4E91\u7AEF...", "info");
          const { syncToCloud: syncToCloud2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
          const { getState: getState2 } = await Promise.resolve().then(() => (init_task(), task_exports));
          const state2 = getState2();
          const result = await syncToCloud2({
            tasks: state2.tasks,
            categories: state2.categories,
            defaultCategory: state2.defaultCategory,
            hideCompleted: state2.hideCompleted,
            hideOverdue: state2.hideOverdue,
            showNoTimeLimitOnly: state2.showNoTimeLimitOnly,
            darkMode: state2.darkMode
          });
          if (result.success) {
            await persistState();
            showSyncFeedback(container, `\u4E0A\u4F20\u6210\u529F \u2014 ${state2.tasks.length} \u4E2A\u4EFB\u52A1\u5DF2\u540C\u6B65\u5230\u4E91\u7AEF`, "success");
          } else {
            showSyncFeedback(container, "\u4E0A\u4F20\u5931\u8D25: " + (result.error || "\u672A\u77E5\u9519\u8BEF"), "error");
          }
        } catch (e) {
          showSyncFeedback(container, "\u4E0A\u4F20\u5931\u8D25: " + (e?.message || "\u7F51\u7EDC\u9519\u8BEF"), "error");
        } finally {
          if (btn) btn.innerHTML = origHTML;
        }
      });
      container.querySelector("#forceDownloadBtn")?.addEventListener("click", async () => {
        const btn = container.querySelector("#forceDownloadBtn");
        const origHTML = btn?.innerHTML;
        try {
          if (btn) btn.innerHTML = '<div class="card-title" style="color:#6b7280;">\u62C9\u53D6\u4E2D...</div>';
          showSyncFeedback(container, "\u6B63\u5728\u4ECE\u4E91\u7AEF\u62C9\u53D6\u6570\u636E...", "info");
          const { syncFromCloud: syncFromCloud2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
          const result = await syncFromCloud2();
          if (result.data && result.data.tasks) {
            const { saveData: saveData2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
            await saveData2(result.data);
            await loadState();
            reRender();
            showSyncFeedback(container, `\u62C9\u53D6\u6210\u529F \u2014 \u5DF2\u6062\u590D ${result.data.tasks.length} \u4E2A\u4EFB\u52A1`, "success");
          } else {
            showSyncFeedback(container, "\u4E91\u7AEF\u6682\u65E0\u6570\u636E", "error");
          }
        } catch (e) {
          showSyncFeedback(container, "\u62C9\u53D6\u5931\u8D25: " + (e?.message || "\u7F51\u7EDC\u9519\u8BEF"), "error");
        } finally {
          if (btn) btn.innerHTML = origHTML;
        }
      });
      container.querySelector("#exportFileBtn")?.addEventListener("click", async () => {
        try {
          await downloadExportFile();
          showToast(container, "\u6570\u636E\u5DF2\u5BFC\u51FA", "success");
        } catch {
          showToast(container, "\u5BFC\u51FA\u5931\u8D25", "error");
        }
      });
      container.querySelector("#importFileBtn")?.addEventListener("click", () => {
        const input = container.querySelector("#syncImportInput");
        input?.click();
      });
      const syncImportInput = container.querySelector("#syncImportInput");
      syncImportInput?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const result = await importDataFromFile(file);
          if (result.success) {
            await loadState();
            reRender();
            showToast(container, "\u6570\u636E\u5BFC\u5165\u6210\u529F", "success");
          } else {
            showToast(container, result.error || "\u5BFC\u5165\u5931\u8D25", "error");
          }
          syncImportInput.value = "";
        }
      });
      const refreshBackupUI = async () => {
        const { listBackups: listBackups2, getStorageUsage: getStorageUsage2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
        const [backups, usage] = await Promise.all([listBackups2(), getStorageUsage2()]);
        const bar = container.querySelector("#storageUsageBar");
        const text = container.querySelector("#storageUsageText");
        if (bar) bar.style.width = usage.percentage + "%";
        if (text) {
          const usedMB = (usage.used / 1024 / 1024).toFixed(2);
          text.textContent = `${usedMB} MB / 5 MB`;
        }
        const listEl = container.querySelector("#backupList");
        if (!listEl) return;
        if (backups.length === 0) {
          listEl.innerHTML = '<div style="text-align:center;padding:8px 0;color:#d1d5db;">\u6682\u65E0\u5907\u4EFD</div>';
          return;
        }
        listEl.innerHTML = backups.map((b) => `
        <div class="flex items-center justify-between" style="padding:6px 0;border-bottom:1px solid #f3f4f6;" data-backup-key="${b.key}">
          <div>
            <span style="color:#374151;" class="dark:text-gray-300">${b.dateStr}</span>
            <span style="color:#9ca3af;margin-left:8px;">${b.taskCount} \u4E2A\u4EFB\u52A1</span>
          </div>
          <div class="flex gap-2">
            <button class="backup-restore-btn" data-key="${b.key}" style="font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid #d1d5db;background:white;color:#374151;cursor:pointer;" class="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300">\u6062\u590D</button>
            <button class="backup-delete-btn" data-key="${b.key}" style="font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid #fecaca;background:white;color:#ef4444;cursor:pointer;">\u5220\u9664</button>
          </div>
        </div>
      `).join("");
        listEl.querySelectorAll(".backup-restore-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const key = btn.dataset.key;
            if (!confirm("\u6062\u590D\u6B64\u5907\u4EFD\u5C06\u8986\u76D6\u5F53\u524D\u6240\u6709\u6570\u636E\uFF0C\u786E\u5B9A\uFF1F")) return;
            const { restoreBackup: restoreBackup2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
            const result = await restoreBackup2(key);
            if (result.success) {
              await loadState();
              reRender();
              showToast(container, "\u5DF2\u6062\u590D\u5907\u4EFD", "success");
            } else {
              showToast(container, result.error || "\u6062\u590D\u5931\u8D25", "error");
            }
          });
        });
        listEl.querySelectorAll(".backup-delete-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const key = btn.dataset.key;
            const { deleteBackup: deleteBackup2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
            await deleteBackup2(key);
            refreshBackupUI();
            showToast(container, "\u5907\u4EFD\u5DF2\u5220\u9664", "success");
          });
        });
      };
      container.querySelector("#syncDataBtn")?.addEventListener("click", () => {
        const modal = container.querySelector("#syncModal");
        modal?.classList.remove("hidden");
        refreshBackupUI();
      });
      container.querySelector("#createBackupBtn")?.addEventListener("click", async () => {
        const btn = container.querySelector("#createBackupBtn");
        if (btn) btn.textContent = "\u5907\u4EFD\u4E2D...";
        const { createAutoBackup: createAutoBackup2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
        const result = await createAutoBackup2();
        if (btn) btn.textContent = "\u7ACB\u5373\u5907\u4EFD";
        if (result.success) {
          showToast(container, "\u5907\u4EFD\u5DF2\u521B\u5EFA", "success");
          refreshBackupUI();
        } else {
          showToast(container, result.error || "\u5907\u4EFD\u5931\u8D25", "error");
        }
      });
      container.querySelector("#mobileSyncSettingsBtn")?.addEventListener("click", () => {
        const modal = container.querySelector("#mobileSyncModal");
        modal?.classList.remove("hidden");
        chrome.runtime.sendMessage({ action: "getSyncSettings" }, (settings) => {
          const urlInput = container.querySelector("#mobileSyncApiUrl");
          const tokenInput = container.querySelector("#mobileSyncApiToken");
          if (urlInput && settings?.apiUrl) urlInput.value = settings.apiUrl;
          if (tokenInput && settings?.apiToken) tokenInput.value = settings.apiToken;
        });
      });
      container.querySelector("#mobileSyncClose")?.addEventListener("click", () => {
        container.querySelector("#mobileSyncModal")?.classList.add("hidden");
      });
      container.querySelector("#mobileSyncOverlay")?.addEventListener("click", () => {
        container.querySelector("#mobileSyncModal")?.classList.add("hidden");
      });
      container.querySelector("#mobileSyncSaveBtn")?.addEventListener("click", () => {
        const apiUrl = container.querySelector("#mobileSyncApiUrl")?.value.replace(/\/+$/, "").trim();
        const apiToken = container.querySelector("#mobileSyncApiToken")?.value.trim();
        if (!apiUrl || !apiToken) {
          syncToast("\u8BF7\u586B\u5199 API \u5730\u5740\u548C\u5BC6\u94A5", "error");
          return;
        }
        chrome.runtime.sendMessage({ action: "saveSyncSettings", settings: { apiUrl, apiToken } }, () => {
          syncToast("\u8BBE\u7F6E\u5DF2\u4FDD\u5B58", "success");
        });
      });
      container.querySelector("#mobileSyncNowBtn")?.addEventListener("click", () => {
        const statusEl = container.querySelector("#mobileSyncStatus");
        if (statusEl) statusEl.textContent = "\u540C\u6B65\u4E2D...";
        chrome.runtime.sendMessage({ action: "syncRemoteTasks" }, (result) => {
          if (result?.synced > 0) {
            syncToast(`\u5DF2\u540C\u6B65 ${result.synced} \u4E2A\u4EFB\u52A1`, "success");
            if (statusEl) statusEl.textContent = `\u4E0A\u6B21\u540C\u6B65: \u6210\u529F\uFF0C${result.synced} \u4E2A\u4EFB\u52A1`;
          } else if (result?.error) {
            syncToast("\u540C\u6B65\u5931\u8D25: " + result.error, "error");
            if (statusEl) statusEl.textContent = "\u540C\u6B65\u5931\u8D25: " + result.error;
          } else {
            if (statusEl) statusEl.textContent = "\u6CA1\u6709\u65B0\u7684\u5F85\u540C\u6B65\u4EFB\u52A1";
          }
        });
      });
    }
    setupDragAndDrop(container);
  };
  function setupDragAndDrop(container) {
    container.querySelectorAll('[draggable="true"]').forEach((el) => {
      el.addEventListener("dragstart", async (e) => {
        const taskId = e.target.dataset.taskId;
        if (taskId) {
          draggedTaskId = taskId;
          e.target.classList.add("opacity-50");
          const dt = e.dataTransfer;
          if (dt) {
            dt.effectAllowed = "move";
            dt.setData("text/plain", taskId);
          }
        }
      });
      el.addEventListener("dragend", () => {
        ;
        el.classList.remove("opacity-50");
        draggedTaskId = null;
        container.querySelectorAll(".drop-zone").forEach((zone) => {
          ;
          zone.classList.remove("bg-blue-100", "dark:bg-blue-900/30");
        });
      });
    });
    container.querySelectorAll(".week-task-item, .month-task-item").forEach((el) => {
      el.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        const taskId = el.dataset.taskId;
        if (taskId) {
          const task = getState().tasks.find((t) => t.id === taskId);
          if (task) {
            setState({ editingTask: task });
            reRender();
            const modal = container.querySelector("#taskModal");
            modal?.classList.remove("hidden");
          }
        }
      });
    });
    container.querySelectorAll('[data-task-id][draggable="true"]').forEach((el) => {
      if (!el.classList.contains("week-task-item") && !el.classList.contains("month-task-item")) {
        el.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          const taskId = el.dataset.taskId;
          if (taskId) {
            const task = getState().tasks.find((t) => t.id === taskId);
            if (task) {
              setState({ editingTask: task });
              reRender();
              const modal = container.querySelector("#taskModal");
              modal?.classList.remove("hidden");
            }
          }
        });
      }
    });
    container.querySelectorAll(".drop-zone").forEach((zone) => {
      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        const dt = e.dataTransfer;
        if (dt) dt.dropEffect = "move";
        zone.classList.add("bg-blue-100", "dark:bg-blue-900/30");
      });
      zone.addEventListener("dragleave", (e) => {
        ;
        zone.classList.remove("bg-blue-100", "dark:bg-blue-900/30");
      });
      zone.addEventListener("drop", async (e) => {
        e.preventDefault();
        zone.classList.remove("bg-blue-100", "dark:bg-blue-900/30");
        const date = zone.dataset.date;
        if (draggedTaskId && date && date !== "no-date") {
          moveTaskToDate(draggedTaskId, date);
          await persistState();
          reRender();
        }
      });
    });
  }

  // shared/entry.ts
  init_sync();
  function syncActionToast(message, type = "success") {
    document.querySelectorAll(".sync-action-toast").forEach((el) => el.remove());
    const toast = document.createElement("div");
    toast.className = "sync-action-toast";
    const bgColor = type === "success" ? "#22c55e" : "#ef4444";
    toast.style.cssText = `position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);padding:0.75rem 1.5rem;border-radius:0.75rem;box-shadow:0 10px 25px rgba(0,0,0,0.15);color:#fff;font-size:0.875rem;font-weight:500;z-index:10000;background:${bgColor};transition:opacity 0.3s;white-space:nowrap;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 3e3);
  }
  function autoInit() {
    const container = document.getElementById("app");
    if (!container) {
      console.error("Container #app not found");
      return;
    }
    const reRender2 = () => {
      renderApp(container);
      attachEventListeners(container);
    };
    loadState().then(async () => {
      const { tasks } = getState();
      if (tasks.length > 0) {
        await persistState();
        console.log(`[TaskMaster] \u5DF2\u52A0\u8F7D ${tasks.length} \u4E2A\u4EFB\u52A1`);
      }
      renderApp(container);
      attachEventListeners(container);
      chrome.runtime.sendMessage({ action: "syncRemoteTasks" }, (result) => {
        if (result?.synced > 0) {
          syncActionToast(`\u5DF2\u4ECE\u624B\u673A\u540C\u6B65 ${result.synced} \u4E2A\u4EFB\u52A1`, "success");
        }
      });
      initSyncMonitor(reRender2);
      onSyncStatusChange(() => {
        const indicator = container.querySelector("#syncIndicator");
        if (indicator) {
          reRender2();
        }
      });
    }).catch((err) => {
      console.error("Failed to initialize app:", err);
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
})();
