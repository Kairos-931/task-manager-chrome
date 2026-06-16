var Background = (() => {
  // shared/storage.ts
  var LOCAL_BACKUP_KEY = "tm_local_backup";
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
  var mergeTasks = (local, remote) => {
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
          if (idx !== -1) {
            const merged = { ...remoteTask };
            if (localTask.repeatType && localTask.repeatType !== "none") {
              if (Array.isArray(localTask.completedDates) && localTask.completedDates.length > 0) {
                merged.completedDates = localTask.completedDates;
              }
              if (Array.isArray(localTask.repeatDays) && localTask.repeatDays.length > 0 && (!merged.repeatDays || merged.repeatDays.length === 0)) {
                merged.repeatDays = localTask.repeatDays;
              }
              if (localTask.repeatStartDate && !merged.repeatStartDate) {
                merged.repeatStartDate = localTask.repeatStartDate;
              }
            }
            result[idx] = merged;
          }
        }
      }
    }
    return result;
  };
  var mergeCategories = (local, remote) => {
    const map = new Map(local.map((c) => [c.id, c]));
    const result = [...local];
    for (const rc of remote) {
      if (!map.has(rc.id)) {
        result.push(rc);
      }
    }
    return result;
  };
  var mergeStorageData = (local, remote) => ({
    tasks: mergeTasks(local.tasks, remote.tasks),
    categories: mergeCategories(local.categories, remote.categories),
    defaultCategory: remote.defaultCategory || local.defaultCategory,
    hideCompleted: remote.hideCompleted ?? local.hideCompleted,
    hideOverdue: remote.hideOverdue ?? local.hideOverdue,
    showNoTimeLimitOnly: remote.showNoTimeLimitOnly ?? local.showNoTimeLimitOnly,
    darkMode: remote.darkMode ?? local.darkMode
  });
  var CLOUD_SYNC_SETTINGS_KEY = "tm_sync_settings";
  var getCloudSettings = async () => {
    return new Promise((resolve) => {
      chrome.storage.local.get([CLOUD_SYNC_SETTINGS_KEY], (r) => {
        resolve(r[CLOUD_SYNC_SETTINGS_KEY] || {});
      });
    });
  };
  var CLOUD_BASE_AT_KEY = "tm_cloud_base_at";
  var getCloudBaseAt = () => {
    return new Promise((resolve) => {
      chrome.storage.local.get([CLOUD_BASE_AT_KEY], (r) => {
        resolve(r[CLOUD_BASE_AT_KEY] || null);
      });
    });
  };
  var setCloudBaseAt = (at) => {
    return new Promise((resolve) => {
      if (at) {
        chrome.storage.local.set({ [CLOUD_BASE_AT_KEY]: at }, () => resolve());
      } else {
        chrome.storage.local.remove([CLOUD_BASE_AT_KEY], () => resolve());
      }
    });
  };
  var syncToCloud = async (data, opts) => {
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
      if (result.updatedAt) {
        await setCloudBaseAt(result.updatedAt);
      }
      return { data: result.data, updatedAt: result.updatedAt };
    } catch (e) {
      return { data: null, error: String(e) };
    }
  };
  var loadData = async () => {
    const localBackup = await loadFromLocal();
    const cloudResult = await syncFromCloud();
    if (cloudResult.data && cloudResult.data.tasks && cloudResult.data.tasks.length > 0) {
      let data = cloudResult.data;
      if (localBackup && localBackup.tasks && localBackup.tasks.length > 0) {
        data = mergeStorageData(localBackup, cloudResult.data);
      }
      data.tasks = data.tasks.map((t) => ({
        ...t,
        updatedAt: t.updatedAt || t.createdAt || Date.now()
      }));
      await saveToLocal(data);
      console.log("[TaskMaster] loadData: cloud", cloudResult.data.tasks.length, "+ local", localBackup?.tasks?.length || 0, "\u2192 merged", data.tasks.length);
      return data;
    }
    if (localBackup && localBackup.tasks && localBackup.tasks.length > 0) {
      console.warn("[TaskMaster] \u4E91\u7AEF\u4E3A\u7A7A\uFF0C\u4ECE\u672C\u5730\u5907\u4EFD\u6062\u590D");
      localBackup.tasks = localBackup.tasks.map((t) => ({
        ...t,
        updatedAt: t.updatedAt || t.createdAt || Date.now()
      }));
      return localBackup;
    }
    console.warn("[TaskMaster] \u4E91\u7AEF\u548C\u672C\u5730\u90FD\u4E3A\u7A7A\uFF0C\u8FD4\u56DE\u9ED8\u8BA4\u6570\u636E");
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
  var saveData = async (data) => {
    data.tasks = fixRecurringTasks(data.tasks);
    await saveToLocal(data);
    cloudSyncWrite(data).catch((e) => console.warn("[TaskMaster] cloud sync write failed:", e));
  };
  var cloudSyncWrite = async (data) => {
    const result = await syncToCloud(data);
    if (result.success)
      return;
    if (result.conflict) {
      console.warn("[TaskMaster] cloud sync conflict (stale base), refreshing base from cloud");
      await syncFromCloud().catch(() => {
      });
      return;
    }
    console.warn("[TaskMaster] cloud sync failed:", result.error);
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
