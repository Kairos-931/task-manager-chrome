var TaskManager = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
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
    renderHeader: () => renderHeader,
    renderListView: () => renderListView,
    renderModal: () => renderModal,
    renderMonthView: () => renderMonthView,
    renderStats: () => renderStats,
    renderTaskItem: () => renderTaskItem,
    renderTaskList: () => renderTaskList,
    renderWeekView: () => renderWeekView,
    resetEditingTask: () => resetEditingTask,
    setState: () => setState,
    toggleTask: () => toggleTask,
    updateTask: () => updateTask
  });

  // shared/storage.ts
  var STORAGE_KEY = "task_manager_data";
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
    hideCompleted: false,
    hideOverdue: false,
    showNoTimeLimitOnly: false,
    darkMode: false
  });
  var isValidData = (data) => {
    return !!data && typeof data === "object" && Array.isArray(data.tasks) && Array.isArray(data.categories);
  };
  var readFromStorage = (area) => {
    return new Promise((resolve) => {
      area.get([STORAGE_KEY], (result) => {
        if (result[STORAGE_KEY]) {
          try {
            const parsed = JSON.parse(result[STORAGE_KEY]);
            resolve(isValidData(parsed) ? parsed : null);
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  };
  var writeToStorage = (area, data) => {
    return new Promise((resolve, reject) => {
      area.set({ [STORAGE_KEY]: JSON.stringify(data) }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  };
  var loadData = async () => {
    const localData = await readFromStorage(chrome.storage.local);
    const syncData = await readFromStorage(chrome.storage.sync);
    const localHas = !!localData;
    const syncHas = !!syncData;
    console.warn("[TaskManager] loadData:", { localHas, syncHas, localTasks: localData?.tasks?.length, syncTasks: syncData?.tasks?.length });
    if (syncData && localData) {
      await writeToStorage(chrome.storage.local, syncData);
      return syncData;
    }
    if (syncData) {
      await writeToStorage(chrome.storage.local, syncData);
      return syncData;
    }
    if (localData) {
      console.warn("[TaskManager] sync\u4E3A\u7A7A\uFF0C\u4ECElocal\u6062\u590D\u6570\u636E");
      await writeToStorage(chrome.storage.sync, localData);
      return localData;
    }
    console.warn("[TaskManager] local\u548Csync\u90FD\u4E3A\u7A7A\uFF0C\u8FD4\u56DE\u9ED8\u8BA4\u6570\u636E");
    return getDefaultData();
  };
  var saveData = async (data) => {
    await writeToStorage(chrome.storage.local, data);
    await writeToStorage(chrome.storage.sync, data);
  };
  var exportData = async () => {
    const data = await loadData();
    const exportObj = {
      version: "1.0.0",
      exportTime: (/* @__PURE__ */ new Date()).toISOString(),
      data
    };
    return JSON.stringify(exportObj, null, 2);
  };
  var downloadExportFile = async () => {
    const jsonStr = await exportData();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    a.download = `task-manager-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  var validateImportData = (obj) => {
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
  var importDataFromFile = async (file) => {
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
          resolve({ success: true, merged: false });
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

  // shared/sync.ts
  var syncStatus = "idle";
  var statusChangeCallback = null;
  var localSaveTime = 0;
  var statusTimeoutId = null;
  var reRenderFn = null;
  var getSyncStatus = () => syncStatus;
  var setSyncStatus = (status) => {
    syncStatus = status;
    statusChangeCallback?.(status);
  };
  var onSyncStatusChange = (cb) => {
    statusChangeCallback = cb;
  };
  var markLocalSave = () => {
    localSaveTime = Date.now();
  };
  var markSaveComplete = () => {
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
  var initSyncMonitor = (reRender2) => {
    reRenderFn = reRender2;
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync")
        return;
      if (!changes[STORAGE_KEY])
        return;
      const now = Date.now();
      if (localSaveTime > 0 && now - localSaveTime < 2e3) {
        return;
      }
      const change = changes[STORAGE_KEY];
      const isEmpty = !change || change.newValue === void 0 || change.newValue === null || change.newValue === "";
      console.warn("[TaskManager] sync onChanged:", { isEmpty, hasNewValue: !!change?.newValue });
      if (isEmpty) {
        const current = getState();
        if (current.tasks.length > 0 || current.categories.length > 0) {
          console.warn("[TaskManager] \u68C0\u6D4B\u5230sync\u88AB\u6E05\u7A7A\uFF0C\u4ECE\u5185\u5B58\u56DE\u5199\u6570\u636E");
          markLocalSave();
          persistState().catch(() => {
          });
        }
        return;
      }
      setSyncStatus("remote-updated");
      loadState().then(() => {
        reRender2();
        showSyncToast();
        if (statusTimeoutId)
          clearTimeout(statusTimeoutId);
        statusTimeoutId = setTimeout(() => {
          if (syncStatus === "remote-updated") {
            setSyncStatus("idle");
            reRender2();
          }
        }, 4e3);
      }).catch(() => {
        setSyncStatus("error");
      });
    });
  };
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

  // shared/task.ts
  var escapeHtml = (str) => {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  };
  var formatDate = (d) => d.toISOString().split("T")[0];
  var parseDate = (s) => /* @__PURE__ */ new Date(s + "T00:00:00");
  var formatHours = (m) => (m / 60).toFixed(1) + "h";
  var getDateLabel = (d) => {
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
  var getTodayStr = () => formatDate(/* @__PURE__ */ new Date());
  var state = {
    tasks: [],
    categories: [],
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
  var getState = () => state;
  var setState = (newState) => {
    state = { ...state, ...newState };
  };
  var resetEditingTask = () => {
    state.editingTask = null;
  };
  var getRemainingTime = (d, completed) => {
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
  var isOverdue = (d, completed) => {
    if (completed)
      return false;
    const todayStr = getTodayStr();
    return d < todayStr;
  };
  var isTaskDueOnDate = (t, d) => {
    if (t.noTimeLimit)
      return false;
    if (t.dueDate === d)
      return true;
    const date = parseDate(d);
    const taskDate = parseDate(t.dueDate);
    switch (t.repeatType) {
      case "daily":
        return date >= taskDate;
      case "weekly":
        return date >= taskDate && t.repeatDays.includes(date.getDay());
      case "monthly":
        return date >= taskDate && date.getDate() === taskDate.getDate();
      case "workdays":
        return date >= taskDate && date.getDay() >= 1 && date.getDay() <= 5;
      case "custom":
        if (date < taskDate)
          return false;
        const daysDiff = Math.floor((date.getTime() - taskDate.getTime()) / 864e5);
        return daysDiff % t.repeatInterval === 0;
      default:
        return d === t.dueDate;
    }
  };
  var getPriorityColor = (p) => {
    switch (p) {
      case "high":
        return "bg-red-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
    }
  };
  var getCatColor = (id) => {
    const c = state.categories.find((x) => x.id === id);
    return c ? c.color : "#6b7280";
  };
  var getCatName = (id) => {
    const c = state.categories.find((x) => x.id === id);
    return c ? c.name : "";
  };
  var loadState = async () => {
    const data = await loadData();
    state = {
      ...state,
      ...data,
      categories: data.categories || defaultCategories,
      editingTask: null,
      draggedTaskId: null
    };
  };
  var persistState = async () => {
    markLocalSave();
    try {
      await saveData({
        tasks: state.tasks,
        categories: state.categories,
        hideCompleted: state.hideCompleted,
        hideOverdue: state.hideOverdue,
        showNoTimeLimitOnly: state.showNoTimeLimitOnly,
        darkMode: state.darkMode
      });
      markSaveComplete();
    } catch {
    }
  };
  var getFilteredTasks = () => {
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
  var addTask = (task) => {
    state.tasks.push({
      ...task,
      id: generateId(),
      createdAt: Date.now(),
      completed: false
    });
  };
  var updateTask = (id, updates) => {
    const idx = state.tasks.findIndex((t) => t.id === id);
    if (idx !== -1) {
      state.tasks[idx] = { ...state.tasks[idx], ...updates };
    }
  };
  var deleteTask = (id) => {
    state.tasks = state.tasks.filter((t) => t.id !== id);
  };
  var toggleTask = (id) => {
    const task = state.tasks.find((t) => t.id === id);
    if (task) {
      task.completed = !task.completed;
      task.completedAt = task.completed ? Date.now() : void 0;
    }
  };
  var moveTaskToDate = (id, date) => {
    const task = state.tasks.find((t) => t.id === id);
    if (task) {
      task.dueDate = date;
      task.noTimeLimit = false;
    }
  };
  var addCategory = (name, color) => {
    state.categories.push({ id: generateId(), name, color });
  };
  var updateCategory = (id, name, color) => {
    const cat = state.categories.find((c) => c.id === id);
    if (cat) {
      cat.name = name;
      cat.color = color;
    }
  };
  var deleteCategory = (id) => {
    if (state.categories.length > 1) {
      state.categories = state.categories.filter((c) => c.id !== id);
      if (state.filterCategory === id)
        state.filterCategory = "all";
    }
  };
  var getStats = () => {
    const tasks = getFilteredTasks();
    const pending = tasks.filter((t) => !t.completed).reduce((s, t) => s + t.duration, 0);
    const done = tasks.filter((t) => t.completed).reduce((s, t) => s + t.duration, 0);
    const overdueCount = tasks.filter((t) => !t.completed && !t.noTimeLimit && isOverdue(t.dueDate, false)).length;
    const todayStr = formatDate(/* @__PURE__ */ new Date());
    const todayTasks = tasks.filter((t) => !t.noTimeLimit && isTaskDueOnDate(t, todayStr));
    const todayDone = todayTasks.filter((t) => t.completed).length;
    return { pending, done, overdueCount, todayTotal: todayTasks.length, todayDone };
  };

  // shared/render.ts
  var renderSyncIndicator = () => {
    const status = getSyncStatus();
    if (status === "idle")
      return "";
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
        <button id="exportBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition" title="\u5BFC\u51FA\u6570\u636E\u5907\u4EFD">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
        </button>
        <label id="importBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer" title="\u5BFC\u5165\u6570\u636E\u6062\u590D">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          <input type="file" id="importFileInput" accept=".json" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">
        </label>
        <button id="manageCategoryBtn" class="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm">\u5206\u7C7B</button>
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
      const dayTasks = getFilteredTasks().filter((t) => !t.noTimeLimit && isTaskDueOnDate(t, d));
      const isToday = d === todayStr;
      const pendingMin = dayTasks.filter((t) => !t.completed).reduce((s, t) => s + t.duration, 0);
      const completedMin = dayTasks.filter((t) => t.completed).reduce((s, t) => s + t.duration, 0);
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
                ${dayTasks.length === 0 ? '<span class="text-xs text-gray-300 dark:text-gray-600">\u65E0</span>' : dayTasks.map((t) => renderWeekTaskCard(t)).join("")}
              </div>
            </div>
          `;
    }).join("")}
      </div>
    </div>
  `;
  };
  var renderWeekTaskCard = (task) => {
    const cat = getState().categories.find((c) => c.id === task.category);
    return `
    <div class="week-task-item p-2 rounded border dark:border-gray-600 ${task.completed ? "opacity-60" : "bg-white dark:bg-gray-700 hover:shadow-md"} transition cursor-move flex-shrink-0" style="min-width:140px" draggable="true" data-task-id="${task.id}" title="\u53CC\u51FB\u7F16\u8F91">
      <div class="flex items-start gap-2">
        <div class="w-1 h-full min-h-[32px] rounded ${getPriorityColor(task.priority)}"></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1 mb-1">
            <span class="text-sm font-medium truncate ${task.completed ? "line-through" : ""}">${escapeHtml(task.title)}</span>
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
      const dayTasks = getFilteredTasks().filter((t) => !t.noTimeLimit && isTaskDueOnDate(t, d));
      return `
            <div class="min-h-[100px] p-2 border-b border-r dark:border-gray-700 ${isCurrentMonth ? "" : "bg-gray-50 dark:bg-gray-900/50"} ${isToday ? "bg-blue-50/50 dark:bg-blue-900/20" : ""} hover:bg-gray-100 dark:hover:bg-gray-700/30 transition cursor-pointer drop-zone" data-date="${d}">
              <div class="text-sm mb-1 ${isCurrentMonth ? "" : "text-gray-300 dark:text-gray-600"} ${isToday ? "font-bold text-blue-500" : ""}">${dayDate.getDate()}</div>
              ${dayTasks.slice(0, 2).map((t) => `<div class="month-task-item text-xs p-1 rounded mb-1 truncate ${t.completed ? "line-through opacity-50 bg-gray-100" : "bg-blue-100/50 dark:bg-blue-900/30"}" draggable="true" data-task-id="${t.id}" title="\u53CC\u51FB\u7F16\u8F91">${escapeHtml(t.title)}</div>`).join("")}
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
    const { editingTask, categories = [] } = getState();
    const isEditing = editingTask !== null;
    const task = editingTask || {
      title: "",
      description: "",
      priority: "medium",
      category: categories[0]?.id || "",
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
    const { categories = [] } = getState();
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
                </div>
                <div class="flex gap-1">
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
    </div>
  `;
  };

  // shared/events.ts
  var draggedTaskId = null;
  var currentContainer = null;
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
    }
    setupDragAndDrop(container);
  };
  var setupDragAndDrop = (container) => {
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
    container.querySelectorAll(".drop-zone").forEach((zone) => {
      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        const dt = e.dataTransfer;
        if (dt)
          dt.dropEffect = "move";
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
  };
  function showToast(container, message, type = "success") {
    const existingToast = container.querySelector(".toast-message");
    existingToast?.remove();
    const toast = document.createElement("div");
    toast.className = `toast-message fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-white text-sm z-50 ${type === "success" ? "bg-green-500" : "bg-red-500"}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3e3);
  }

  // shared/entry.ts
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
      await persistState();
      renderApp(container);
      attachEventListeners(container);
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
