var Background = (() => {
  // ── Constants (must match popup.js/newtab.js) ──────
  var META_KEY = "tm_meta";
  var INDEX_KEY = "tm_index";
  var CHUNK_PREFIX = "tm_tasks_";
  var CHUNK_SIZE = 7000;
  var SYNC_SETTINGS_KEY = "tm_sync_settings";

  // ── Message handler ────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "openNewTab") {
      chrome.tabs.create({ url: chrome.runtime.getURL("newtab/newtab.html") });
    }

    if (message.action === "syncRemoteTasks") {
      syncRemoteTasks().then(sendResponse);
      return true; // keep channel open for async
    }

    if (message.action === "getSyncSettings") {
      chrome.storage.sync.get(SYNC_SETTINGS_KEY, (result) => {
        sendResponse(result[SYNC_SETTINGS_KEY] || {});
      });
      return true;
    }

    if (message.action === "saveSyncSettings") {
      var update = {};
      update[SYNC_SETTINGS_KEY] = message.settings;
      chrome.storage.sync.set(update, () => {
        // Push local categories to backend
        pushCategories(message.settings);
        sendResponse({ ok: true });
      });
      return true;
    }
  });

  // ── Periodic sync via alarm ────────────────────────
  chrome.alarms.create("taskmasterSync", { periodInMinutes: 5 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "taskmasterSync") {
      syncRemoteTasks();
    }
  });

  // ── Storage helpers (duplicated from popup.js) ─────
  function generateId() {
    return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  }

  function splitTasksToChunks(tasks) {
    var chunks = [];
    var current = [];
    var currentSize = 0;
    for (var i = 0; i < tasks.length; i++) {
      var taskStr = JSON.stringify(tasks[i]);
      if (currentSize + taskStr.length + 1 > CHUNK_SIZE && current.length > 0) {
        chunks.push(current);
        current = [];
        currentSize = 0;
      }
      current.push(tasks[i]);
      currentSize += taskStr.length + 1;
    }
    if (current.length > 0) {
      chunks.push(current);
    }
    return chunks;
  }

  function loadAllTasks() {
    return new Promise(function(resolve) {
      chrome.storage.sync.get([META_KEY, INDEX_KEY], function(result) {
        if (!result[META_KEY]) {
          resolve({ tasks: [], categories: [] });
          return;
        }
        var meta = result[META_KEY];
        var index = result[INDEX_KEY] || { chunkCount: 0 };
        var chunkKeys = [];
        for (var i = 0; i < index.chunkCount; i++) {
          chunkKeys.push(CHUNK_PREFIX + i);
        }
        if (chunkKeys.length === 0) {
          resolve({ tasks: [], categories: meta.categories || [] });
          return;
        }
        chrome.storage.sync.get(chunkKeys, function(chunkResult) {
          var tasks = [];
          for (var i = 0; i < index.chunkCount; i++) {
            var chunk = chunkResult[CHUNK_PREFIX + i];
            if (Array.isArray(chunk)) {
              tasks = tasks.concat(chunk);
            }
          }
          resolve({ tasks: tasks, categories: meta.categories || [] });
        });
      });
    });
  }

  function saveAllTasks(tasks, meta) {
    var chunks = splitTasksToChunks(tasks);
    var newIndex = { chunkCount: chunks.length };
    var update = {};
    update[META_KEY] = meta;
    update[INDEX_KEY] = newIndex;
    for (var i = 0; i < chunks.length; i++) {
      update[CHUNK_PREFIX + i] = chunks[i];
    }

    return new Promise(function(resolve, reject) {
      chrome.storage.sync.get([INDEX_KEY], function(r) {
        var oldIndex = r[INDEX_KEY];
        chrome.storage.sync.set(update, function() {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          var removeKeys = [];
          if (oldIndex) {
            for (var i = chunks.length; i < (oldIndex.chunkCount || 0); i++) {
              removeKeys.push(CHUNK_PREFIX + i);
            }
          }
          if (removeKeys.length > 0) {
            chrome.storage.sync.remove(removeKeys, function() { resolve(); });
          } else {
            resolve();
          }
        });
      });
    });
  }

  // ── Sync logic ─────────────────────────────────────
  async function syncRemoteTasks() {
    var settings = await new Promise(function(resolve) {
      chrome.storage.sync.get(SYNC_SETTINGS_KEY, function(r) {
        resolve(r[SYNC_SETTINGS_KEY] || {});
      });
    });

    if (!settings.apiUrl || !settings.apiToken) {
      return { synced: 0, error: "not configured" };
    }

    // Push local categories to backend on every sync
    pushCategories(settings);

    try {
      var res = await fetch(settings.apiUrl + "/api/tasks", {
        headers: { "Authorization": "Bearer " + settings.apiToken }
      });
      if (!res.ok) return { synced: 0, error: "fetch failed: " + res.status };

      var data = await res.json();
      var remoteTasks = data.tasks;
      if (!remoteTasks || remoteTasks.length === 0) return { synced: 0 };

      // Merge into local storage
      var localData = await loadAllTasks();
      var localTasks = localData.tasks;
      var categories = localData.categories;
      var mergedIds = [];

      for (var i = 0; i < remoteTasks.length; i++) {
        var rt = remoteTasks[i];

        // Dedup: skip if same title + dueDate already exists
        var dup = localTasks.some(function(lt) {
          return lt.title === rt.title && lt.dueDate === (rt.dueDate || "");
        });
        if (dup) {
          mergedIds.push(rt.id);
          continue;
        }

        // Map category by name to local ID, default to first category
        var categoryId = categories.length > 0 ? categories[0].id : "";
        if (rt.category) {
          var found = categories.find(function(c) { return c.name === rt.category; });
          if (found) categoryId = found.id;
        }

        // Build local task object
        var newTask = {
          id: generateId(),
          title: rt.title,
          description: rt.description || "",
          priority: rt.priority || "medium",
          category: categoryId,
          dueDate: rt.dueDate || "",
          duration: rt.duration || 60,
          completed: false,
          completedAt: undefined,
          completedDates: [],
          createdAt: Date.now(),
          noTimeLimit: rt.noTimeLimit ? true : false,
          repeatType: "none",
          repeatDays: [],
          repeatInterval: 1
        };

        localTasks.push(newTask);
        mergedIds.push(rt.id);
      }

      // Save back to storage
      var meta = await new Promise(function(resolve) {
        chrome.storage.sync.get(META_KEY, function(r) { resolve(r[META_KEY]); });
      });
      if (meta) {
        meta.tasks = undefined; // tasks stored separately in chunks
        await saveAllTasks(localTasks, meta);
      }

      // Mark as synced on server
      if (mergedIds.length > 0) {
        await fetch(settings.apiUrl + "/api/tasks/sync", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + settings.apiToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ ids: mergedIds })
        });
      }

      return { synced: mergedIds.length };
    } catch (e) {
      return { synced: 0, error: e.message };
    }
  }

  function pushCategories(settings) {
    if (!settings || !settings.apiUrl || !settings.apiToken) return;
    chrome.storage.sync.get(META_KEY, function(result) {
      var meta = result[META_KEY];
      if (!meta || !meta.categories) return;
      var categories = meta.categories.map(function(c) { return { name: c.name }; });
      fetch(settings.apiUrl + "/api/categories", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + settings.apiToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ categories: categories })
      }).catch(function() {});
    });
  }
})();