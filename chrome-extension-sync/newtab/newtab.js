"use strict";
var TaskManager = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

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
    restoreBackup: () => restoreBackup,
    saveData: () => saveData,
    syncFromCloud: () => syncFromCloud,
    syncIncrementally: () => syncIncrementally,
    syncToCloud: () => syncToCloud,
    validateImportData: () => validateImportData
  });
  var STORAGE_KEY, LOCAL_BACKUP_KEY, generateId, DEFAULT_CATEGORY_DEFINITIONS, defaultCategoryByName, createDefaultCategories, defaultCategories, getDefaultData, loadFromLocal, saveToLocal, dedupeCategories, CLOUD_SYNC_SETTINGS_KEY, getCloudSettings, CLOUD_BASE_AT_KEY, getCloudBaseAt, setCloudBaseAt, syncToCloud, syncFromCloud, normalizeStorageData, INCREMENTAL_CURSOR_KEY, INCREMENTAL_DEVICE_KEY, INCREMENTAL_SHADOW_KEY, INCREMENTAL_CLOCK_KEY, OUTGOING_SYNC_BATCH, lastSyncTimestamp, syncQueue, recordKey, nextSyncTimestamp, cloneStorageData, enqueueSync, getLocalValue, setLocalValues, getSyncDeviceId, getSyncShadow, getSettingsPayload, samePayload, buildCurrentRecords, buildLocalChanges, applyRemoteChanges, isVirginDefaultData, syncIncrementallyNow, syncIncrementally, isCloudConfigured, loadData, fixRecurringTasks, isTaskMatchRepeat, saveData, BACKUP_PREFIX, MAX_BACKUPS, formatDateKey, createAutoBackup, listBackups, restoreBackup, deleteBackup, cleanOldBackups, getStorageUsage, exportData, downloadExportFile, validateImportData, importDataFromFile;
  var init_storage = __esm({
    "shared/storage.ts"() {
      "use strict";
      STORAGE_KEY = "tm_data";
      LOCAL_BACKUP_KEY = "tm_local_backup";
      generateId = () => {
        return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      };
      DEFAULT_CATEGORY_DEFINITIONS = [
        { id: "default-starred", name: "\u661F\u6807", color: "#f59e0b" },
        { id: "default-work", name: "\u5DE5\u4F5C", color: "#3b82f6" },
        { id: "default-life", name: "\u751F\u6D3B", color: "#10b981" },
        { id: "default-learning", name: "\u5B66\u4E60", color: "#8b5cf6" }
      ];
      defaultCategoryByName = new Map(
        DEFAULT_CATEGORY_DEFINITIONS.map((category) => [category.name, category])
      );
      createDefaultCategories = () => {
        const updatedAt = Date.now();
        return DEFAULT_CATEGORY_DEFINITIONS.map((category) => ({ ...category, updatedAt }));
      };
      defaultCategories = createDefaultCategories();
      getDefaultData = () => ({
        tasks: [],
        categories: createDefaultCategories(),
        defaultCategory: "",
        hideCompleted: false,
        hideOverdue: false,
        showNoTimeLimitOnly: false,
        darkMode: false
      });
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
      dedupeCategories = (cats) => {
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
      CLOUD_SYNC_SETTINGS_KEY = "tm_sync_settings";
      getCloudSettings = async () => {
        return new Promise((resolve) => {
          chrome.storage.local.get([CLOUD_SYNC_SETTINGS_KEY], (r) => {
            resolve(r[CLOUD_SYNC_SETTINGS_KEY] || {});
          });
        });
      };
      CLOUD_BASE_AT_KEY = "tm_cloud_base_at";
      getCloudBaseAt = () => {
        return new Promise((resolve) => {
          chrome.storage.local.get([CLOUD_BASE_AT_KEY], (r) => {
            resolve(r[CLOUD_BASE_AT_KEY] || null);
          });
        });
      };
      setCloudBaseAt = (at) => {
        return new Promise((resolve) => {
          if (at) {
            chrome.storage.local.set({ [CLOUD_BASE_AT_KEY]: at }, () => resolve());
          } else {
            chrome.storage.local.remove([CLOUD_BASE_AT_KEY], () => resolve());
          }
        });
      };
      syncToCloud = async (data, opts) => {
        try {
          const settings = await getCloudSettings();
          if (!settings.apiUrl || !settings.apiToken) {
            return { success: false, error: "\u672A\u914D\u7F6E\u540C\u6B65\u8BBE\u7F6E" };
          }
          const baseUpdatedAt = await getCloudBaseAt();
          const resp = await fetch(`${settings.apiUrl}/api/fullsync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${settings.apiToken}`
            },
            body: JSON.stringify({ data, baseUpdatedAt, force: opts?.force === true })
          });
          if (resp.status === 409) {
            const err = await resp.json().catch(() => ({ error: "HTTP 409" }));
            if (err.error === "conflict") {
              return { success: false, conflict: true, currentUpdatedAt: err.currentUpdatedAt, error: "conflict" };
            }
            return { success: false, error: err.error || "refused" };
          }
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
            return { success: false, error: err.error || `HTTP ${resp.status}` };
          }
          const result = await resp.json();
          if (result.updatedAt) {
            await setCloudBaseAt(result.updatedAt);
          }
          return { success: true, updatedAt: result.updatedAt };
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
          if (result.updatedAt) {
            await setCloudBaseAt(result.updatedAt);
          }
          return { data: result.data, updatedAt: result.updatedAt };
        } catch (e) {
          return { data: null, error: String(e) };
        }
      };
      normalizeStorageData = (data) => {
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
      INCREMENTAL_CURSOR_KEY = "tm_incremental_sync_cursor";
      INCREMENTAL_DEVICE_KEY = "tm_incremental_sync_device";
      INCREMENTAL_SHADOW_KEY = "tm_incremental_sync_shadow";
      INCREMENTAL_CLOCK_KEY = "tm_incremental_sync_clock";
      OUTGOING_SYNC_BATCH = 400;
      lastSyncTimestamp = 0;
      syncQueue = Promise.resolve();
      recordKey = (type, id) => `${type}:${id}`;
      nextSyncTimestamp = () => {
        lastSyncTimestamp = Math.max(Date.now(), lastSyncTimestamp + 1);
        return lastSyncTimestamp;
      };
      cloneStorageData = (data) => JSON.parse(JSON.stringify(data));
      enqueueSync = (operation) => {
        const next = syncQueue.then(operation, operation);
        syncQueue = next.then(() => void 0, () => void 0);
        return next;
      };
      getLocalValue = async (key, fallback) => {
        return new Promise((resolve) => {
          chrome.storage.local.get([key], (result) => resolve(result[key] || fallback));
        });
      };
      setLocalValues = async (values) => {
        return new Promise((resolve, reject) => {
          chrome.storage.local.set(values, () => {
            if (chrome.runtime.lastError)
              reject(chrome.runtime.lastError);
            else
              resolve();
          });
        });
      };
      getSyncDeviceId = async () => {
        const existing = await getLocalValue(INCREMENTAL_DEVICE_KEY, "");
        if (existing)
          return existing;
        const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : generateId();
        await setLocalValues({ [INCREMENTAL_DEVICE_KEY]: id });
        return id;
      };
      getSyncShadow = async () => {
        const shadow = await getLocalValue(INCREMENTAL_SHADOW_KEY, null);
        return shadow && shadow.records ? shadow : { records: {} };
      };
      getSettingsPayload = (data) => ({
        defaultCategory: data.defaultCategory,
        hideCompleted: data.hideCompleted,
        hideOverdue: data.hideOverdue,
        showNoTimeLimitOnly: data.showNoTimeLimitOnly,
        darkMode: data.darkMode,
        weeklyGoalMinutes: data.weeklyGoalMinutes,
        weeklyGoalAnchor: data.weeklyGoalAnchor
      });
      samePayload = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      buildCurrentRecords = (data, shadow) => {
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
      buildLocalChanges = (current, shadow) => {
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
      applyRemoteChanges = (data, changes) => {
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
      isVirginDefaultData = (data) => {
        if (data.tasks.length > 0 || data.categories.length !== DEFAULT_CATEGORY_DEFINITIONS.length)
          return false;
        const hasDefaultCategories = data.categories.every((category) => {
          const definition = defaultCategoryByName.get(category.name);
          return definition?.id === category.id && definition.color === category.color;
        });
        return hasDefaultCategories && !data.defaultCategory && !data.hideCompleted && !data.hideOverdue && !data.showNoTimeLimitOnly && !data.darkMode && !data.weeklyGoalMinutes && !data.weeklyGoalAnchor;
      };
      syncIncrementallyNow = async (inputData) => {
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
      syncIncrementally = (data) => enqueueSync(() => syncIncrementallyNow(cloneStorageData(data)));
      isCloudConfigured = async () => {
        const settings = await getCloudSettings();
        return !!(settings.apiUrl && settings.apiToken);
      };
      loadData = async () => {
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
      fixRecurringTasks = (tasks) => tasks.map((t) => {
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
      isTaskMatchRepeat = (t, date) => {
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
      saveData = async (data, onRemoteData, onSyncResult) => {
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
          version: "3.10.0",
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
  var syncStatus, statusChangeCallback, statusTimeoutId, reRenderFn, getSyncStatus, setSyncStatus, onSyncStatusChange, markLocalSave, markSaveComplete, markCloudSynced, initSyncMonitor, markSyncError, markRemoteUpdated;
  var init_sync = __esm({
    "shared/sync.ts"() {
      "use strict";
      syncStatus = "idle";
      statusChangeCallback = null;
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
        setSyncStatus("saving");
      };
      markSaveComplete = () => {
        setSyncStatus("local-saved");
      };
      markCloudSynced = () => {
        setSyncStatus("synced");
        if (statusTimeoutId)
          clearTimeout(statusTimeoutId);
        statusTimeoutId = setTimeout(() => {
          if (syncStatus === "synced") {
            setSyncStatus("idle");
            reRenderFn?.();
          }
        }, 3e3);
      };
      initSyncMonitor = (reRender2) => {
        reRenderFn = reRender2;
      };
      markSyncError = () => {
        setSyncStatus("error");
      };
      markRemoteUpdated = () => {
        setSyncStatus("remote-updated");
        if (statusTimeoutId)
          clearTimeout(statusTimeoutId);
        statusTimeoutId = setTimeout(() => {
          if (syncStatus === "remote-updated")
            setSyncStatus("idle");
        }, 3e3);
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
    getWeeklyGoalStats: () => getWeeklyGoalStats,
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
  var escapeHtml, formatDate, parseDate, formatHours, getDateLabel, getTodayStr, state, getState, setState, resetEditingTask, getRemainingTime, isOverdue, isTaskDueOnDate, getPriorityColor, getCatColor, getCatName, applyStorageData, loadState, persistState, getFilteredTasks, addTask, updateTask, deleteTask, toggleThrottleMap, toggleTask, moveTaskToDate, getNextUncompletedDate, addCategory, updateCategory, deleteCategory, getWeeklyGoalStats, getStats;
  var init_task = __esm({
    "shared/task.ts"() {
      "use strict";
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
        if (d === today)
          return "\u4ECA\u5929";
        if (d === tomorrow)
          return "\u660E\u5929";
        if (d === yesterday)
          return "\u6628\u5929";
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
        if (completed)
          return "\u5DF2\u5B8C\u6210";
        const todayStr = getTodayStr();
        const tomorrowStr = formatDate(new Date(Date.now() + 864e5));
        if (d === todayStr)
          return "\u4ECA\u5929\u5230\u671F";
        if (d === tomorrowStr)
          return "\u660E\u5929\u5230\u671F";
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
        if (completed)
          return false;
        const todayStr = getTodayStr();
        return d < todayStr;
      };
      isTaskDueOnDate = (t, d) => {
        if (t.noTimeLimit)
          return false;
        if (!t.repeatType || t.repeatType === "none") {
          return t.dueDate === d;
        }
        const anchor = t.repeatStartDate || t.dueDate;
        if (anchor === d)
          return true;
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
            if (date < anchorDate)
              return false;
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
      applyStorageData = (data) => {
        const catMap = /* @__PURE__ */ new Map();
        const cats = data.categories || defaultCategories;
        for (const c of cats) {
          const normalized = { ...c, updatedAt: c.updatedAt || Date.now() };
          if (catMap.has(normalized.name)) {
            const existing = catMap.get(normalized.name);
            catMap.set(normalized.name, { ...existing, color: normalized.color, updatedAt: normalized.updatedAt });
          } else {
            catMap.set(normalized.name, normalized);
          }
        }
        state = {
          ...state,
          ...data,
          categories: [...catMap.values()],
          editingTask: null,
          draggedTaskId: null
        };
      };
      loadState = async () => {
        const data = await loadData();
        applyStorageData(data);
        syncIncrementally(data).then((result) => {
          if (result.success && result.data) {
            applyStorageData(result.data);
            markRemoteUpdated();
          }
        }).catch(() => {
        });
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
            darkMode: state.darkMode,
            weeklyGoalMinutes: state.weeklyGoalMinutes,
            weeklyGoalAnchor: state.weeklyGoalAnchor,
            syncSettingsUpdatedAt: state.syncSettingsUpdatedAt
          }, (remoteData) => {
            applyStorageData(remoteData);
            markRemoteUpdated();
          }, (result) => {
            if (result.success)
              markCloudSynced();
            else if (result.error !== "\u672A\u914D\u7F6E\u540C\u6B65\u8BBE\u7F6E")
              markSyncError();
          });
          markSaveComplete();
        } catch {
        }
      };
      getFilteredTasks = () => {
        return state.tasks.filter((t) => {
          if (state.showNoTimeLimitOnly && !t.noTimeLimit)
            return false;
          if (state.hideCompleted && t.completed)
            return false;
          if (state.hideOverdue && !t.noTimeLimit && t.dueDate < getTodayStr())
            return false;
          if (state.filterPriority !== "all" && t.priority !== state.filterPriority)
            return false;
          if (state.filterCategory !== "all" && t.category !== state.filterCategory)
            return false;
          return true;
        }).sort((a, b) => {
          if (a.noTimeLimit !== b.noTimeLimit)
            return a.noTimeLimit ? 1 : -1;
          if (a.completed !== b.completed)
            return a.completed ? 1 : -1;
          if (a.noTimeLimit && b.noTimeLimit)
            return b.createdAt - a.createdAt;
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
          completed: task.completed || false,
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
      toggleThrottleMap = /* @__PURE__ */ new Map();
      toggleTask = (id) => {
        const task = state.tasks.find((t) => t.id === id);
        if (!task)
          return;
        if (!task.completed && task.repeatType && task.repeatType !== "none") {
          const last = toggleThrottleMap.get(id) || 0;
          if (Date.now() - last < 500)
            return;
          toggleThrottleMap.set(id, Date.now());
          const completedDate = task.dueDate;
          if (!task.completedDates)
            task.completedDates = [];
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
        const trimmed = name.trim();
        if (!trimmed)
          return;
        if (state.categories.some((c) => c.name === trimmed))
          return;
        state.categories.push({ id: generateId(), name: trimmed, color, updatedAt: Date.now() });
      };
      updateCategory = (id, name, color) => {
        const cat = state.categories.find((c) => c.id === id);
        if (cat) {
          cat.name = name;
          cat.color = color;
          cat.updatedAt = Date.now();
        }
      };
      deleteCategory = (id) => {
        if (state.categories.length > 1) {
          const fallback = state.categories.find((category) => category.id !== id);
          if (!fallback)
            return;
          const now = Date.now();
          state.tasks = state.tasks.map((task) => task.category === id ? { ...task, category: fallback.id, updatedAt: now } : task);
          state.categories = state.categories.filter((c) => c.id !== id);
          if (state.defaultCategory === id)
            state.defaultCategory = fallback.id;
          if (state.filterCategory === id)
            state.filterCategory = "all";
        }
      };
      getWeeklyGoalStats = () => {
        const { weeklyGoalMinutes = 600, weeklyGoalAnchor } = state;
        let anchor = weeklyGoalAnchor;
        if (!anchor) {
          let earliest = Infinity;
          for (const t of state.tasks) {
            if (t.completed && (!t.repeatType || t.repeatType === "none")) {
              const date = t.completedAt || parseDate(t.dueDate).getTime();
              if (date < earliest)
                earliest = date;
            }
            if (t.repeatType && t.repeatType !== "none" && t.completedDates?.length > 0) {
              const firstDate = parseDate(t.completedDates[0]).getTime();
              if (firstDate < earliest)
                earliest = firstDate;
            }
          }
          if (earliest === Infinity)
            return null;
          anchor = formatDate(new Date(earliest));
        }
        const anchorMs = parseDate(anchor).getTime();
        const nowMs = Date.now();
        const weeksElapsed = Math.max(0.1, (nowMs - anchorMs) / (7 * 864e5));
        let totalMinutes = 0;
        let completedCount = 0;
        for (const t of state.tasks) {
          if (t.completed && (!t.repeatType || t.repeatType === "none")) {
            totalMinutes += t.duration;
            completedCount++;
          }
          if (t.repeatType && t.repeatType !== "none" && t.completedDates?.length > 0) {
            totalMinutes += t.duration * t.completedDates.length;
            completedCount += t.completedDates.length;
          }
        }
        const expectedMinutes = Math.round(weeklyGoalMinutes * weeksElapsed);
        const pace = Math.round(totalMinutes / weeksElapsed * 10) / 10;
        const gap = totalMinutes - expectedMinutes;
        const progress = expectedMinutes > 0 ? Math.min(100, Math.round(totalMinutes / expectedMinutes * 100)) : 0;
        return {
          anchorDate: anchor,
          weeksElapsed: Math.round(weeksElapsed * 10) / 10,
          weeklyGoalMinutes,
          expectedMinutes,
          actualMinutes: totalMinutes,
          completedCount,
          paceMinutesPerWeek: pace,
          gapMinutes: gap,
          gapWeeks: Math.round(Math.abs(gap) / weeklyGoalMinutes * 10) / 10,
          progressPercent: progress,
          behindExpected: gap < 0
        };
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
  var entry_exports = {};
  __export(entry_exports, {
    addCategory: () => addCategory,
    addTask: () => addTask,
    attachEventListeners: () => attachEventListeners,
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
    getWeeklyGoalStats: () => getWeeklyGoalStats,
    isOverdue: () => isOverdue,
    isTaskDueOnDate: () => isTaskDueOnDate,
    loadState: () => loadState,
    moveTaskToDate: () => moveTaskToDate,
    parseDate: () => parseDate,
    persistState: () => persistState,
    renderApp: () => renderApp,
    renderCategoryModal: () => renderCategoryModal,
    renderDayView: () => renderDayView,
    renderFilters: () => renderFilters,
    renderGoalSettingsModal: () => renderGoalSettingsModal,
    renderHeader: () => renderHeader,
    renderListView: () => renderListView,
    renderMobileSyncPanel: () => renderMobileSyncPanel,
    renderModal: () => renderModal,
    renderMonthView: () => renderMonthView,
    renderStats: () => renderStats,
    renderSyncModal: () => renderSyncModal,
    renderTaskItem: () => renderTaskItem,
    renderTaskList: () => renderTaskList,
    renderWeekView: () => renderWeekView,
    renderWeeklyGoalCard: () => renderWeeklyGoalCard,
    resetEditingTask: () => resetEditingTask,
    setState: () => setState,
    toggleTask: () => toggleTask,
    updateTask: () => updateTask
  });
  init_task();

  // shared/render.ts
  init_task();
  init_sync();
  var renderSyncIndicator = () => {
    const status = getSyncStatus();
    if (status === "idle")
      return "";
    const icons = {
      idle: "",
      saving: `<span id="syncIndicator" class="p-2 rounded-lg transition text-blue-500" title="\u6B63\u5728\u540C\u6B65...">
      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
    </span>`,
      "local-saved": `<span id="syncIndicator" class="p-2 rounded-lg transition text-amber-500" title="\u5DF2\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u7B49\u5F85\u4E91\u540C\u6B65">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
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
  var renderWeeklyGoalCard = () => {
    const stats = getWeeklyGoalStats();
    if (!stats) {
      return `
      <div class="goal-card goal-card-empty" id="weeklyGoalCard">
        <div class="goal-card-header">
          <div class="goal-card-label">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span>\u6BCF\u5468\u8282\u594F</span>
          </div>
        </div>
        <p class="goal-card-empty-copy">\u6682\u65E0\u53EF\u7EDF\u8BA1\u7684\u5B8C\u6210\u65F6\u957F</p>
        <button id="openGoalSettingsBtn" class="goal-adjust-btn">\u8BBE\u7F6E\u5468\u76EE\u6807</button>
      </div>
    `;
    }
    const formatWeeks = (w) => {
      if (w < 1)
        return "<1 \u5468";
      return `${Math.floor(w)} \u5468` + (w % 1 >= 0.5 ? "\u534A" : "");
    };
    const formatH = (m) => (m / 60).toFixed(1) + "h";
    const gapClass = stats.behindExpected ? "gap-negative" : "gap-positive";
    const gapSign = stats.behindExpected ? "" : "+";
    const expectedPos = Math.min(100, stats.progressPercent);
    return `
    <div class="goal-card" id="weeklyGoalCard">
      <div class="goal-card-header">
        <div class="goal-card-label">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <span>\u6BCF\u5468\u8282\u594F</span>
        </div>
        <span class="goal-card-target">\u76EE\u6807 ${formatH(stats.weeklyGoalMinutes)} / \u5468</span>
      </div>
      <div class="goal-card-anchor"><strong>\u951A\u70B9\uFF1A</strong>${stats.anchorDate} \u7B2C 1 \u5468</div>
      <div class="goal-card-row">
        <div class="goal-card-stat">
          <div class="stat-label">\u671F\u671B\u5DE5\u65F6</div>
          <div class="stat-value">${formatH(stats.expectedMinutes)}<span class="unit">h</span></div>
          <div class="stat-sub stat-neutral">\u5386\u65F6 ${formatWeeks(stats.weeksElapsed)}</div>
        </div>
        <div class="goal-card-stat">
          <div class="stat-label">\u5B9E\u9645\u5B8C\u6210</div>
          <div class="stat-value">${formatH(stats.actualMinutes)}<span class="unit">h</span></div>
          <div class="stat-sub stat-green">${stats.completedCount} \u4E2A\u4EFB\u52A1</div>
        </div>
        <div class="goal-card-stat">
          <div class="stat-label">\u5DEE\u8DDD</div>
          <div class="stat-value ${gapClass}">${gapSign}${formatH(Math.abs(stats.gapMinutes))}<span class="unit">h</span></div>
          <div class="stat-sub ${gapClass}">${stats.behindExpected ? `\u843D\u540E\u7EA6 ${stats.gapWeeks} \u5468` : `\u9886\u5148\u7EA6 ${stats.gapWeeks} \u5468`}</div>
        </div>
      </div>
      <div class="goal-card-bar-wrap">
        <div class="goal-bar-labels">
          <span>\u5B8C\u6210\u8FDB\u5EA6</span>
          <span class="pace">\u5B9E\u9645\u8282\u594F ${formatH(stats.paceMinutesPerWeek)}/\u5468 \xB7 \u76EE\u6807 ${formatH(stats.weeklyGoalMinutes)}/\u5468</span>
        </div>
        <div class="goal-bar-bg">
          <div class="goal-bar-fill" style="width:${Math.min(100, stats.progressPercent)}%;"></div>
          <div class="goal-bar-line" style="left:${expectedPos}%;"></div>
        </div>
        <div class="goal-bar-label">
          <span>\u5F53\u524D ${formatH(stats.actualMinutes)}</span>
          <span>\u671F\u671B ${formatH(stats.expectedMinutes)}</span>
          <span>${stats.progressPercent}%</span>
        </div>
      </div>
      <div class="goal-card-detail">
        <div class="detail-grid">
          <div class="detail-item">
            <div class="label">\u5468\u76EE\u6807</div>
            <div class="value">${formatH(stats.weeklyGoalMinutes)}</div>
            <div class="desc">\u6BCF 7 \u5929\u671F\u671B\u5B8C\u6210\u91CF</div>
          </div>
          <div class="detail-item">
            <div class="label">\u5B9E\u9645\u8282\u594F</div>
            <div class="value">${formatH(stats.paceMinutesPerWeek)} / \u5468</div>
            <div class="desc">\u603B\u5DE5\u65F6 \xF7 \u603B\u5468\u6570</div>
          </div>
          <div class="detail-item">
            <div class="label">\u5B8C\u6210\u603B\u5DE5\u65F6</div>
            <div class="value">${formatH(stats.actualMinutes)}</div>
            <div class="desc">${stats.completedCount} \u4E2A\u5DF2\u5B8C\u6210\u4EFB\u52A1\u5408\u8BA1</div>
          </div>
          <div class="detail-item">
            <div class="label">\u4EFB\u52A1\u5E73\u5747\u65F6\u957F</div>
            <div class="value">${formatH(stats.completedCount > 0 ? stats.actualMinutes / stats.completedCount : 0)}</div>
            <div class="desc">\u603B\u5DE5\u65F6 \xF7 \u4EFB\u52A1\u6570</div>
          </div>
        </div>
        <button id="adjustGoalAnchorBtn" class="goal-adjust-btn">\u8C03\u6574\u8D77\u59CB\u951A\u70B9</button>
      </div>
    </div>
  `;
  };
  var renderGoalSettingsModal = () => {
    const { weeklyGoalMinutes = 600, weeklyGoalAnchor } = getState();
    const anchorDate = weeklyGoalAnchor || formatDate(/* @__PURE__ */ new Date());
    return `
    <div id="goalSettingsModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[90%] max-w-sm p-6">
        <h3 class="text-lg font-semibold mb-4">\u6BCF\u5468\u76EE\u6807\u8BBE\u7F6E</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">\u6BCF\u5468\u76EE\u6807\u65F6\u957F\uFF08\u5C0F\u65F6\uFF09</label>
            <input type="number" id="goalWeeklyHours" value="${(weeklyGoalMinutes / 60).toFixed(1)}" min="0.5" step="0.5" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">\u8D77\u59CB\u951A\u70B9\u65E5\u671F</label>
            <input type="date" id="goalAnchorDate" value="${anchorDate}" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
          </div>
          <p class="text-xs text-gray-400">\u951A\u70B9\u7528\u4E8E\u8BA1\u7B97\u5DF2\u8FC7\u5468\u6570\u3002\u4FEE\u6539\u540E\u91CD\u65B0\u8BA1\u7B97\u671F\u671B\u503C\u3002</p>
        </div>
        <div class="flex gap-3 mt-6">
          <button id="closeGoalSettingsBtn" class="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm">\u53D6\u6D88</button>
          <button id="saveGoalSettingsBtn" class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm">\u4FDD\u5B58</button>
        </div>
      </div>
    </div>
  `;
  };
  var renderStats = () => {
    const stats = getStats();
    return `
    <div id="statsRow" class="stats-row">
      <div class="stats-row-bar">
        <div class="stats-row-items">
          <span class="text-gray-500">\u5F85\u5B8C\u6210\uFF1A</span><span class="font-medium text-orange-500">${formatHours(stats.pending)}</span>
          <span class="text-gray-300 dark:text-gray-600">|</span>
          <span class="text-gray-500">\u5DF2\u5B8C\u6210\uFF1A</span><span class="font-medium text-green-500">${formatHours(stats.done)}</span>
          <span class="text-gray-300 dark:text-gray-600">|</span>
          <span class="text-gray-500">\u4ECA\u65E5\uFF1A</span><span class="font-medium">${stats.todayDone}/${stats.todayTotal}</span>
          ${stats.overdueCount > 0 ? `<span class="text-red-500 font-medium">${stats.overdueCount}\u9879\u8FC7\u671F</span>` : ""}
        </div>
        <button id="statsToggleBtn" class="stats-toggle-btn" title="\u6BCF\u5468\u8282\u594F">
          <span id="statsChevron" class="stats-chevron">&#x25BE;</span>
        </button>
      </div>
      <div id="weeklyGoalWrapper" style="display:none;">
        ${renderWeeklyGoalCard()}
      </div>
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
      if (!groups.has(key))
        groups.set(key, []);
      groups.get(key).push(t);
    });
    const dates = Array.from(groups.keys()).sort((a, b) => {
      if (a === "no-date")
        return 1;
      if (b === "no-date")
        return -1;
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
    const todayStr = formatDate(/* @__PURE__ */ new Date());
    const weekSummaries = weeks.map((week) => {
      const weekDays = week.filter((d) => {
        const dd = parseDate(d);
        return dd.getMonth() === month;
      });
      const weekPending = weekDays.reduce((s, d) => {
        return s + getState().tasks.filter((t) => !t.noTimeLimit && !t.completed && isTaskDueOnDate(t, d)).reduce((a, t) => a + t.duration, 0);
      }, 0);
      const weekDone = weekDays.reduce((s, d) => {
        return s + getState().tasks.filter((t) => !t.noTimeLimit && t.completed && t.repeatType === "none" && isTaskDueOnDate(t, d)).reduce((a, t) => a + t.duration, 0);
      }, 0);
      return { pending: weekPending, done: weekDone };
    });
    const monthTasks = getState().tasks.filter((t) => !t.noTimeLimit);
    const monthPending = monthTasks.filter((t) => !t.completed).reduce((s, t) => s + t.duration, 0);
    const monthDone = monthTasks.filter((t) => t.completed && t.repeatType === "none").reduce((s, t) => s + t.duration, 0);
    const renderWeekSummary = (week, ws) => {
      const hasToday = week.some((dd) => dd === todayStr);
      const bgClass = hasToday ? "bg-blue-50/30 dark:bg-blue-900/10" : "";
      const pendingHtml = ws.pending > 0 ? `<div class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-orange-500"></span><span class="text-[11px] font-semibold text-orange-600 dark:text-orange-400">${formatHours(ws.pending)}</span></div>` : "";
      const doneHtml = ws.done > 0 ? `<div class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span><span class="text-[11px] font-semibold text-green-600 dark:text-green-400">${formatHours(ws.done)}</span></div>` : "";
      const totalHtml = ws.pending > 0 || ws.done > 0 ? `<div class="text-[10px] text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-0.5 mt-0.5">\u5408\u8BA1 <span class="font-semibold text-gray-500 dark:text-gray-300">${formatHours(ws.pending + ws.done)}</span></div>` : `<span class="text-[10px] text-gray-300 dark:text-gray-600">\u2014</span>`;
      return `<div class="flex flex-col items-center justify-center gap-1 py-2 px-1 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 ${bgClass}">${pendingHtml}${doneHtml}${totalHtml}</div>`;
    };
    const gridCells = weeks.map((week, wi) => {
      const ws = weekSummaries[wi];
      const dayCells = week.map((d) => {
        const dayDate = parseDate(d);
        const isCurrentMonth = dayDate.getMonth() === month;
        const isToday = d === todayStr;
        const dayTasks = getState().tasks.filter((t) => !t.noTimeLimit && isTaskDueOnDate(t, d));
        const pendingMin = dayTasks.filter((t) => !t.completed).reduce((s, t) => s + t.duration, 0);
        const completedMin = dayTasks.filter((t) => t.completed && t.repeatType === "none").reduce((s, t) => s + t.duration, 0);
        const miniPending = pendingMin > 0 ? `<span class="text-[9px] text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-1 rounded leading-tight font-medium">${formatHours(pendingMin)}</span>` : "";
        const miniDone = completedMin > 0 ? `<span class="text-[9px] text-green-500 bg-green-50 dark:bg-green-900/20 px-1 rounded leading-tight font-medium">\u2713${formatHours(completedMin)}</span>` : "";
        const taskCards = dayTasks.slice(0, 2).map((t) => {
          const isRecurringDone = t.repeatType && t.repeatType !== "none" && (t.completedDates || []).includes(d);
          const done = t.completed || isRecurringDone;
          return `<div class="month-task-item text-xs p-1 rounded mb-1 truncate ${done ? "line-through opacity-40 bg-gray-100 dark:bg-gray-700" : "bg-blue-100/50 dark:bg-blue-900/30"}" draggable="true" data-task-id="${t.id}" title="\u53CC\u51FB\u7F16\u8F91">${escapeHtml(t.title)}</div>`;
        }).join("");
        const moreHtml = dayTasks.length > 2 ? `<div class="text-xs text-gray-400">+${dayTasks.length - 2}</div>` : "";
        const cellClasses = `min-h-[100px] p-2 border-b border-r dark:border-gray-700 ${isCurrentMonth ? "" : "bg-gray-50 dark:bg-gray-900/50"} ${isToday ? "bg-blue-50/50 dark:bg-blue-900/20" : ""} hover:bg-gray-100 dark:hover:bg-gray-700/30 transition cursor-pointer drop-zone`;
        const dayNumClass = `text-sm ${isCurrentMonth ? "" : "text-gray-300 dark:text-gray-600"} ${isToday ? "font-bold text-blue-500" : ""}`;
        return `<div class="${cellClasses}" data-date="${d}"><div class="flex items-center gap-1 mb-1"><span class="${dayNumClass}">${dayDate.getDate()}</span>${miniPending}${miniDone}</div>${taskCards}${moreHtml}</div>`;
      }).join("");
      return dayCells + renderWeekSummary(week, ws);
    }).join("");
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
      <div class="grid" style="grid-template-columns:repeat(7,1fr) 72px;border:1px solid #e5e7eb;border-bottom:none;border-right:none">
        ${weekdays.map((d) => `<div class="text-center py-2 font-medium text-sm text-gray-500 border-b border-r dark:border-gray-700">${d}</div>`).join("")}
        <div class="text-center py-2 text-[11px] font-medium text-gray-400 border-b border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30" style="letter-spacing:0.5px">\u5468\u7EDF\u8BA1</div>
        ${gridCells}
      </div>
      <div class="grid" style="grid-template-columns:repeat(7,1fr) 72px;border:1px solid #e5e7eb">
        <div class="col-span-7 px-3 py-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-900/30 border-r dark:border-gray-700 flex items-center gap-4">
          \u672C\u6708\u5408\u8BA1\uFF1A<span class="font-semibold text-orange-600 dark:text-orange-400">${formatHours(monthPending)} \u5F85\u529E</span><span class="text-gray-300 dark:text-gray-600">|</span><span class="font-semibold text-green-600 dark:text-green-400">${formatHours(monthDone)} \u5DF2\u5B8C\u6210</span><span class="text-gray-300 dark:text-gray-600">|</span><span class="font-semibold text-gray-600 dark:text-gray-300">${formatHours(monthPending + monthDone)} \u603B\u8BA1</span>
        </div>
        <div class="flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/30">${formatHours(monthPending + monthDone)}</div>
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
  var renderQuickDates = (selectedDate) => {
    const today = /* @__PURE__ */ new Date();
    const dayNames = ["\u5468\u65E5", "\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D"];
    const todayStr = formatDate(today);
    let html = '<div class="quick-dates-row">';
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = formatDate(d);
      const dayNum = d.getDate();
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      const label = isToday ? "\u4ECA\u5929" : i === 1 ? "\u660E\u5929" : dayNames[d.getDay()];
      const classes = [
        "quick-date-btn",
        isToday ? "today" : "",
        isSelected ? "selected" : ""
      ].filter(Boolean).join(" ");
      html += `<button type="button" class="${classes}" data-date="${dateStr}">
      <span class="quick-day-name">${label}</span>
      <span class="quick-day-num">${dayNum}</span>
      ${isToday ? '<span class="quick-date-badge">\u4ECA\u5929</span>' : ""}
    </button>`;
    }
    html += "</div>";
    return html;
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
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[90%] max-w-lg overflow-y-auto" style="max-height:90vh;max-height:90svh;">
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
            <div class="pt-6">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="taskCompleted" ${task.completed ? "checked" : ""} class="rounded">
                <span class="text-sm">\u5DF2\u5B8C\u6210</span>
              </label>
            </div>
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
                ${renderQuickDates(task.dueDate)}
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
      <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-8 p-10 max-h-[90%] overflow-y-auto">
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
    const { darkMode, currentView } = getState();
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    if (!document.getElementById("weeklyGoalStyles")) {
      const style = document.createElement("style");
      style.id = "weeklyGoalStyles";
      style.textContent = `
      .stats-row {
        margin-bottom: 16px;
      }
      .stats-row-bar {
        display: flex;
        align-items: center;
        padding: 10px 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        font-size: 13px;
      }
      .dark .stats-row-bar {
        background: #1f2937;
        border-color: #374151;
      }
      .stats-row-items {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .stats-toggle-btn {
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
        color: #cbd5e1;
        transition: all 0.15s;
        margin-left: 8px;
      }
      .stats-toggle-btn:hover {
        background: #f1f5f9;
        color: #6366f1;
      }
      .dark .stats-toggle-btn:hover {
        background: rgba(99,102,241,0.1);
      }
      .stats-chevron {
        font-size: 12px;
        transition: transform 0.2s;
        line-height: 1;
      }
      .stats-chevron.open { transform: rotate(180deg); }

      .goal-card {
        margin: 8px 0 0 0;
        background: linear-gradient(135deg, #eef2ff 0%, #f0f9ff 100%);
        border: 1px solid #e0e7ff;
        border-radius: 12px;
        padding: 18px 20px;
        animation: goalFadeIn 0.2s ease;
      }
      @keyframes goalFadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
      .dark .goal-card { background: linear-gradient(135deg, rgba(30,41,59,0.8), rgba(30,27,75,0.6)); border-color: rgba(99,102,241,0.3); }
      .goal-card-empty-copy { margin: 0 0 12px; font-size: 13px; color: #64748b; }
      .dark .goal-card-empty-copy { color: #94a3b8; }

      .goal-card .goal-card-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 14px;
      }
      .goal-card-label { display: flex; align-items: center; gap: 8px; }
      .goal-card-label svg { width: 18px; height: 18px; color: #6366f1; }
      .goal-card-label span { font-size: 14px; font-weight: 600; color: #1e293b; }
      .dark .goal-card-label span { color: #e2e8f0; }
      .goal-card-target {
        font-size: 13px; color: #6366f1;
        background: rgba(99,102,241,0.1);
        padding: 3px 10px; border-radius: 6px; font-weight: 500;
      }
      .goal-card-anchor { font-size: 12px; color: #64748b; margin-bottom: 12px; }
      .goal-card-anchor strong { color: #475569; }
      .goal-card-row { display: flex; gap: 16px; margin-bottom: 12px; }
      .goal-card-stat {
        flex: 1; background: rgba(255,255,255,0.7);
        border-radius: 8px; padding: 10px 12px;
      }
      .dark .goal-card-stat { background: rgba(30,41,59,0.6); }
      .goal-card-stat .stat-label {
        font-size: 11px; color: #94a3b8;
        text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px;
      }
      .goal-card-stat .stat-value { font-size: 20px; font-weight: 700; color: #0f172a; }
      .dark .goal-card-stat .stat-value { color: #f1f5f9; }
      .goal-card-stat .stat-value .unit { font-size: 13px; font-weight: 400; color: #94a3b8; margin-left: 2px; }
      .goal-card-stat .stat-sub { font-size: 11px; margin-top: 2px; }
      .stat-green { color: #059669; }
      .stat-red { color: #dc2626; }
      .stat-neutral { color: #6366f1; }
      .gap-negative { color: #dc2626 !important; }
      .gap-positive { color: #059669 !important; }
      .goal-card-bar-wrap { margin-top: 4px; }
      .goal-bar-labels {
        display: flex; justify-content: space-between;
        font-size: 11px; color: #94a3b8; margin-bottom: 4px;
      }
      .goal-bar-labels .pace { color: #6366f1; font-weight: 500; }
      .goal-bar-bg {
        height: 8px; background: rgba(99,102,241,0.15);
        border-radius: 4px; overflow: hidden; position: relative;
      }
      .goal-bar-fill {
        height: 100%; background: linear-gradient(90deg, #6366f1, #818cf8);
        border-radius: 4px; transition: width 0.3s;
      }
      .goal-bar-line {
        position: absolute; top: -2px; bottom: -2px;
        width: 2px; background: #f59e0b; border-radius: 1px;
      }
      .goal-bar-label {
        display: flex; justify-content: space-between;
        font-size: 11px; color: #94a3b8; margin-top: 4px;
      }
      .goal-card-detail { display: none; margin-top: 14px; padding-top: 14px; border-top: 1px dashed #c7d2fe; }
      .goal-card.expanded .goal-card-detail { display: block; }
      .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .detail-item { background: rgba(255,255,255,0.6); border-radius: 8px; padding: 10px 12px; }
      .dark .detail-item { background: rgba(30,41,59,0.6); }
      .detail-item .label { font-size: 11px; color: #94a3b8; }
      .detail-item .value { font-size: 14px; font-weight: 600; color: #0f172a; margin-top: 2px; }
      .dark .detail-item .value { color: #f1f5f9; }
      .detail-item .desc { font-size: 11px; color: #94a3b8; margin-top: 1px; }
      .goal-adjust-btn {
        margin-top: 12px; padding: 8px 0; width: 100%;
        border: 1px dashed #c7d2fe; border-radius: 8px; background: transparent;
        font-size: 13px; color: #6366f1; cursor: pointer; transition: background 0.15s;
      }
      .goal-adjust-btn:hover { background: rgba(99,102,241,0.06); }

      /* \u5FEB\u6377\u65E5\u671F\u9009\u62E9 */
      .quick-dates-row {
        display: flex;
        gap: 4px;
        margin-bottom: 8px;
      }
      .quick-date-btn {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        padding: 6px 2px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
      }
      .dark .quick-date-btn {
        background: #374151;
        border-color: #4b5563;
      }
      .quick-date-btn:hover {
        border-color: #c7d2fe;
        background: #f5f3ff;
      }
      .dark .quick-date-btn:hover {
        border-color: #6366f1;
        background: rgba(99,102,241,0.1);
      }
      .quick-date-btn .quick-day-name {
        font-size: 9px;
        color: #9ca3af;
        font-weight: 500;
      }
      .quick-date-btn .quick-day-num {
        font-size: 15px;
        font-weight: 600;
        color: #374151;
      }
      .dark .quick-date-btn .quick-day-num { color: #e5e7eb; }
      .quick-date-btn .quick-date-badge {
        font-size: 7px;
        padding: 1px 4px;
        border-radius: 3px;
        background: transparent;
        color: transparent;
      }

      /* \u4ECA\u5929\u6807\u8BB0 */
      .quick-date-btn.today {
        border-color: #6366f1;
        background: #eef2ff;
      }
      .dark .quick-date-btn.today {
        background: rgba(99,102,241,0.15);
        border-color: #818cf8;
      }
      .quick-date-btn.today .quick-day-name { color: #6366f1; }
      .quick-date-btn.today .quick-day-num { color: #6366f1; }
      .dark .quick-date-btn.today .quick-day-name,
      .dark .quick-date-btn.today .quick-day-num { color: #a5b4fc; }
      .quick-date-btn.today .quick-date-badge {
        background: #6366f1;
        color: white;
      }
      .dark .quick-date-btn.today .quick-date-badge { background: #818cf8; }

      /* \u9009\u4E2D\u72B6\u6001 */
      .quick-date-btn.selected {
        border-color: #6366f1;
        background: #6366f1;
      }
      .quick-date-btn.selected .quick-day-name { color: rgba(255,255,255,0.75); }
      .quick-date-btn.selected .quick-day-num { color: white; }
      .quick-date-btn.selected .quick-date-badge {
        background: rgba(255,255,255,0.25);
        color: white;
      }
      .dark .quick-date-btn.selected { border-color: #818cf8; background: #6366f1; }
    `;
      document.head.appendChild(style);
    }
    const viewMaxWidth = {
      list: "max-w-4xl",
      day: "max-w-4xl",
      week: "max-w-6xl",
      month: "max-w-7xl"
    };
    const maxWidth = viewMaxWidth[currentView] || "max-w-4xl";
    container.innerHTML = `
    <div class="${maxWidth} mx-auto p-4 min-h-screen transition-all duration-300">
      ${renderStats()}
      ${renderHeader()}
      ${renderFilters()}
      ${renderTaskList()}
      ${renderModal()}
      ${renderCategoryModal()}
      ${renderGoalSettingsModal()}
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
    if (!el)
      return;
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
    if (!currentContainer)
      return;
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
        completed: form.querySelector("#taskCompleted")?.checked || false,
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
    const refreshQuickDates = () => {
      const dateInput = container.querySelector('input[name="dueDate"]');
      if (!dateInput)
        return;
      const val = dateInput.value;
      container.querySelectorAll(".quick-date-btn").forEach((btn) => {
        const date = btn.dataset.date;
        btn.classList.toggle("selected", date === val);
      });
    };
    container.querySelectorAll(".quick-date-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const date = btn.dataset.date;
        if (!date)
          return;
        const dateInput = container.querySelector('input[name="dueDate"]');
        if (dateInput) {
          dateInput.value = date;
          refreshQuickDates();
        }
      });
    });
    container.querySelector('input[name="dueDate"]')?.addEventListener("change", refreshQuickDates);
    container.querySelector("#addTaskBtn")?.addEventListener("click", () => {
      setTimeout(refreshQuickDates, 0);
    });
    container.querySelector("#repeatType")?.addEventListener("change", (e) => {
      const weeklyDays = container.querySelector("#weeklyDays");
      const customInterval = container.querySelector("#customInterval");
      const value = e.target.value;
      if (weeklyDays)
        weeklyDays.classList.toggle("hidden", value !== "weekly");
      if (customInterval)
        customInterval.classList.toggle("hidden", value !== "custom");
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
        } catch {
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
          if (btn)
            btn.innerHTML = '<div class="card-title" style="color:#6b7280;">\u4E0A\u4F20\u4E2D...</div>';
          showSyncFeedback(container, "\u6B63\u5728\u4E0A\u4F20\u6570\u636E\u5230\u4E91\u7AEF...", "info");
          const { syncIncrementally: syncIncrementally2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
          const { getState: getState2 } = await Promise.resolve().then(() => (init_task(), task_exports));
          const state2 = getState2();
          const result = await syncIncrementally2({
            tasks: state2.tasks,
            categories: state2.categories,
            defaultCategory: state2.defaultCategory,
            hideCompleted: state2.hideCompleted,
            hideOverdue: state2.hideOverdue,
            showNoTimeLimitOnly: state2.showNoTimeLimitOnly,
            darkMode: state2.darkMode,
            weeklyGoalMinutes: state2.weeklyGoalMinutes,
            weeklyGoalAnchor: state2.weeklyGoalAnchor,
            syncSettingsUpdatedAt: state2.syncSettingsUpdatedAt
          });
          if (result.success && result.data) {
            setState(result.data);
            reRender();
            showSyncFeedback(container, `\u540C\u6B65\u5B8C\u6210 \u2014 ${result.data.tasks.length} \u4E2A\u4EFB\u52A1\u5DF2\u6536\u655B`, "success");
          } else {
            showSyncFeedback(container, "\u4E0A\u4F20\u5931\u8D25: " + (result.error || "\u672A\u77E5\u9519\u8BEF"), "error");
          }
        } catch (e) {
          showSyncFeedback(container, "\u4E0A\u4F20\u5931\u8D25: " + (e?.message || "\u7F51\u7EDC\u9519\u8BEF"), "error");
        } finally {
          if (btn)
            btn.innerHTML = origHTML;
        }
      });
      container.querySelector("#forceDownloadBtn")?.addEventListener("click", async () => {
        const btn = container.querySelector("#forceDownloadBtn");
        const origHTML = btn?.innerHTML;
        try {
          if (btn)
            btn.innerHTML = '<div class="card-title" style="color:#6b7280;">\u62C9\u53D6\u4E2D...</div>';
          showSyncFeedback(container, "\u6B63\u5728\u4ECE\u4E91\u7AEF\u62C9\u53D6\u6570\u636E...", "info");
          const { syncIncrementally: syncIncrementally2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
          const state2 = getState();
          const result = await syncIncrementally2({
            tasks: state2.tasks,
            categories: state2.categories,
            defaultCategory: state2.defaultCategory,
            hideCompleted: state2.hideCompleted,
            hideOverdue: state2.hideOverdue,
            showNoTimeLimitOnly: state2.showNoTimeLimitOnly,
            darkMode: state2.darkMode,
            weeklyGoalMinutes: state2.weeklyGoalMinutes,
            weeklyGoalAnchor: state2.weeklyGoalAnchor,
            syncSettingsUpdatedAt: state2.syncSettingsUpdatedAt
          });
          if (result.success && result.data) {
            setState(result.data);
            reRender();
            showSyncFeedback(container, `\u540C\u6B65\u5B8C\u6210 \u2014 \u5DF2\u6536\u655B ${result.data.tasks.length} \u4E2A\u4EFB\u52A1`, "success");
          } else {
            showSyncFeedback(container, "\u4E91\u7AEF\u6682\u65E0\u6570\u636E", "error");
          }
        } catch (e) {
          showSyncFeedback(container, "\u62C9\u53D6\u5931\u8D25: " + (e?.message || "\u7F51\u7EDC\u9519\u8BEF"), "error");
        } finally {
          if (btn)
            btn.innerHTML = origHTML;
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
        if (bar)
          bar.style.width = usage.percentage + "%";
        if (text) {
          const usedMB = (usage.used / 1024 / 1024).toFixed(2);
          text.textContent = `${usedMB} MB / 5 MB`;
        }
        const listEl = container.querySelector("#backupList");
        if (!listEl)
          return;
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
            if (!confirm("\u6062\u590D\u6B64\u5907\u4EFD\u5C06\u8986\u76D6\u5F53\u524D\u6240\u6709\u6570\u636E\uFF0C\u786E\u5B9A\uFF1F"))
              return;
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
        if (btn)
          btn.textContent = "\u5907\u4EFD\u4E2D...";
        const { createAutoBackup: createAutoBackup2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
        const result = await createAutoBackup2();
        if (btn)
          btn.textContent = "\u7ACB\u5373\u5907\u4EFD";
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
          if (urlInput && settings?.apiUrl)
            urlInput.value = settings.apiUrl;
          if (tokenInput && settings?.apiToken)
            tokenInput.value = settings.apiToken;
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
        if (statusEl)
          statusEl.textContent = "\u540C\u6B65\u4E2D...";
        chrome.runtime.sendMessage({ action: "syncRemoteTasks" }, (result) => {
          if ((result?.synced ?? 0) > 0) {
            syncToast(`\u5DF2\u540C\u6B65 ${result.synced} \u4E2A\u4EFB\u52A1`, "success");
            if (statusEl)
              statusEl.textContent = `\u4E0A\u6B21\u540C\u6B65: \u6210\u529F\uFF0C${result.synced} \u4E2A\u4EFB\u52A1`;
          } else if (result?.error) {
            syncToast("\u540C\u6B65\u5931\u8D25: " + result.error, "error");
            if (statusEl)
              statusEl.textContent = "\u540C\u6B65\u5931\u8D25: " + result.error;
          } else {
            if (statusEl)
              statusEl.textContent = "\u6CA1\u6709\u65B0\u7684\u5F85\u540C\u6B65\u4EFB\u52A1";
          }
        });
      });
    }
    setupWeeklyGoalEvents(container);
    setupDragAndDrop(container);
  };
  function setupWeeklyGoalEvents(container) {
    const toggleBtn = container.querySelector("#statsToggleBtn");
    const wrapper = container.querySelector("#weeklyGoalWrapper");
    const card = container.querySelector("#weeklyGoalCard");
    const chevron = container.querySelector("#statsChevron");
    toggleBtn?.addEventListener("click", () => {
      if (!wrapper)
        return;
      const isOpen = wrapper.style.display !== "none";
      wrapper.style.display = isOpen ? "none" : "block";
      chevron?.classList.toggle("open");
      if (card && isOpen && card.classList.contains("expanded")) {
        card.classList.remove("expanded");
      }
    });
    card?.addEventListener("click", (e) => {
      const target = e.target;
      if (target.id === "adjustGoalAnchorBtn" || target.closest("#adjustGoalAnchorBtn") || target.id === "openGoalSettingsBtn" || target.closest("#openGoalSettingsBtn")) {
        const modal = container.querySelector("#goalSettingsModal");
        if (modal)
          modal.classList.remove("hidden");
        return;
      }
      card.classList.toggle("expanded");
    });
    const closeBtn = container.querySelector("#closeGoalSettingsBtn");
    closeBtn?.addEventListener("click", () => {
      const modal = container.querySelector("#goalSettingsModal");
      if (modal)
        modal.classList.add("hidden");
    });
    const saveBtn = container.querySelector("#saveGoalSettingsBtn");
    saveBtn?.addEventListener("click", async () => {
      const hoursInput = container.querySelector("#goalWeeklyHours");
      const anchorInput = container.querySelector("#goalAnchorDate");
      setState({
        weeklyGoalMinutes: Math.round(parseFloat(hoursInput?.value || "10") * 60),
        weeklyGoalAnchor: anchorInput?.value || void 0
      });
      await persistState();
      reRender();
      const modal = container.querySelector("#goalSettingsModal");
      if (modal)
        modal.classList.add("hidden");
    });
    const overlay = container.querySelector("#goalSettingsModal");
    overlay?.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.add("hidden");
      }
    });
  }
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
        if (dt)
          dt.dropEffect = "move";
        zone.classList.add("bg-blue-100", "dark:bg-blue-900/30");
      });
      zone.addEventListener("dragleave", () => {
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
        if ((result?.synced ?? 0) > 0) {
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
  return __toCommonJS(entry_exports);
})();
