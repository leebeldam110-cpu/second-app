(function () {
  "use strict";

  var LS_GOALS = "aperture-todo-goals";
  var LS_WORKOUTS = "aperture-todo-workouts";
  var LS_TODAY = "aperture-todo-today";
  var LS_ROTATION = "aperture-todo-rotation";
  var GOALS_PER_DAY = 3;
  var DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var DAY_LABELS = {
    sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday",
    thu: "Thursday", fri: "Friday", sat: "Saturday"
  };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayKey(d) {
    d = d || new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* storage unavailable — state just won't persist */
    }
  }

  // ---------- Big Goals ----------
  function loadGoals() { return readJSON(LS_GOALS, []); }
  function saveGoals(goals) { writeJSON(LS_GOALS, goals); }

  function addGoal(text) {
    var goals = loadGoals();
    goals.push({ id: uid(), text: text, createdAt: Date.now() });
    saveGoals(goals);
  }

  function deleteGoal(id) {
    saveGoals(loadGoals().filter(function (g) { return g.id !== id; }));
  }

  // ---------- Weekly Workouts ----------
  function loadWorkouts() { return readJSON(LS_WORKOUTS, {}); }
  function saveWorkouts(w) { writeJSON(LS_WORKOUTS, w); }

  // ---------- Today ----------
  function pickGoalIds(count) {
    var goals = loadGoals();
    if (!goals.length) return [];
    var rotation = parseInt(localStorage.getItem(LS_ROTATION) || "0", 10);
    if (isNaN(rotation)) rotation = 0;
    var n = Math.min(count, goals.length);
    var picked = [];
    for (var i = 0; i < n; i++) {
      picked.push(goals[(rotation + i) % goals.length].id);
    }
    localStorage.setItem(LS_ROTATION, String((rotation + n) % goals.length));
    return picked;
  }

  function freshTodayState(prev) {
    var carryExtras = prev && Array.isArray(prev.extras)
      ? prev.extras.filter(function (e) { return !e.done; })
      : [];
    return {
      date: todayKey(),
      workoutDone: false,
      pickedGoalIds: pickGoalIds(GOALS_PER_DAY),
      goalDone: {},
      extras: carryExtras
    };
  }

  function loadToday() {
    var state = readJSON(LS_TODAY, null);
    var changed = false;
    if (!state || state.date !== todayKey()) {
      state = freshTodayState(state);
      changed = true;
    }
    if (!state.extras) { state.extras = []; changed = true; }
    if (!state.goalDone) { state.goalDone = {}; changed = true; }
    // If no goals were picked yet (e.g. the list was empty when today's
    // plan was first generated) but goals exist now, pick some.
    if (!state.pickedGoalIds.length && loadGoals().length) {
      state.pickedGoalIds = pickGoalIds(GOALS_PER_DAY);
      changed = true;
    }
    if (changed) saveToday(state);
    return state;
  }

  function saveToday(state) { writeJSON(LS_TODAY, state); }

  // ---------- Rendering ----------
  var todayState = loadToday();

  function weekdayKey(d) {
    d = d || new Date();
    return DAY_KEYS[d.getDay()];
  }

  function renderDate() {
    var el = document.getElementById("todo-date");
    if (!el) return;
    var d = new Date();
    el.textContent = d.toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric"
    });
  }

  function renderWorkoutToday() {
    var workouts = loadWorkouts();
    var label = workouts[weekdayKey()] || "";
    var textEl = document.getElementById("today-workout-text");
    var checkEl = document.getElementById("today-workout-check");
    if (!textEl || !checkEl) return;
    textEl.textContent = label.trim() ? label : "Rest day";
    checkEl.classList.toggle("is-checked", !!todayState.workoutDone);
    checkEl.closest(".todo-list__item").classList.toggle("is-done", !!todayState.workoutDone);
  }

  function renderGoalsToday() {
    var listEl = document.getElementById("today-goals-list");
    var emptyEl = document.getElementById("today-goals-empty");
    if (!listEl || !emptyEl) return;
    var goals = loadGoals();
    var goalsById = {};
    goals.forEach(function (g) { goalsById[g.id] = g; });
    var picked = todayState.pickedGoalIds
      .map(function (id) { return goalsById[id]; })
      .filter(Boolean);

    listEl.innerHTML = "";
    if (!picked.length) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    picked.forEach(function (goal) {
      var done = !!todayState.goalDone[goal.id];
      var li = document.createElement("li");
      li.className = "todo-list__item" + (done ? " is-done" : "");
      li.innerHTML =
        '<button class="todo-check' + (done ? " is-checked" : "") + '" type="button" data-goal-id="' + goal.id + '" aria-label="Mark goal worked on today"></button>' +
        '<span class="todo-item__text"></span>';
      li.querySelector(".todo-item__text").textContent = goal.text;
      listEl.appendChild(li);
    });
  }

  function renderExtrasToday() {
    var listEl = document.getElementById("today-extras-list");
    if (!listEl) return;
    listEl.innerHTML = "";
    todayState.extras.forEach(function (task) {
      var li = document.createElement("li");
      li.className = "todo-list__item" + (task.done ? " is-done" : "");
      li.innerHTML =
        '<button class="todo-check' + (task.done ? " is-checked" : "") + '" type="button" data-extra-id="' + task.id + '" aria-label="Mark task done"></button>' +
        '<span class="todo-item__text"></span>' +
        '<button class="todo-remove" type="button" data-remove-extra="' + task.id + '" aria-label="Delete task">×</button>';
      li.querySelector(".todo-item__text").textContent = task.text;
      listEl.appendChild(li);
    });
  }

  function renderGoalsList() {
    var listEl = document.getElementById("goals-list");
    var emptyEl = document.getElementById("goals-empty");
    if (!listEl || !emptyEl) return;
    var goals = loadGoals();
    listEl.innerHTML = "";
    if (!goals.length) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    var pickedToday = todayState.pickedGoalIds;
    goals.forEach(function (goal) {
      var li = document.createElement("li");
      li.className = "todo-list__item";
      var badge = pickedToday.indexOf(goal.id) !== -1
        ? '<span class="todo-badge">Today</span>'
        : "";
      li.innerHTML =
        '<span class="todo-item__text"></span>' +
        badge +
        '<button class="todo-remove" type="button" data-remove-goal="' + goal.id + '" aria-label="Delete goal">×</button>';
      li.querySelector(".todo-item__text").textContent = goal.text;
      listEl.appendChild(li);
    });
  }

  function renderWorkoutGrid() {
    var gridEl = document.getElementById("workout-grid");
    if (!gridEl) return;
    var workouts = loadWorkouts();
    gridEl.innerHTML = "";
    DAY_KEYS.forEach(function (key) {
      var row = document.createElement("div");
      row.className = "workout-row";
      row.innerHTML =
        '<span class="workout-row__label">' + DAY_LABELS[key] + '</span>' +
        '<input class="workout-row__input" type="text" placeholder="Rest" autocomplete="off" data-day="' + key + '">';
      var input = row.querySelector("input");
      input.value = workouts[key] || "";
      gridEl.appendChild(row);
    });
  }

  function renderAll() {
    renderDate();
    renderWorkoutToday();
    renderGoalsToday();
    renderExtrasToday();
    renderGoalsList();
    renderWorkoutGrid();
  }

  // ---------- Events ----------
  function setUpTabs() {
    var tabs = document.querySelectorAll(".todo-tab");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) {
          t.classList.remove("is-active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("is-active");
        tab.setAttribute("aria-selected", "true");
        document.querySelectorAll(".todo-panel").forEach(function (panel) {
          panel.hidden = panel.getAttribute("data-panel") !== tab.getAttribute("data-tab");
        });
      });
    });
  }

  function setUpToday() {
    var workoutCheck = document.getElementById("today-workout-check");
    if (workoutCheck) {
      workoutCheck.addEventListener("click", function () {
        todayState.workoutDone = !todayState.workoutDone;
        saveToday(todayState);
        renderWorkoutToday();
      });
    }

    var goalsList = document.getElementById("today-goals-list");
    if (goalsList) {
      goalsList.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-goal-id]");
        if (!btn) return;
        var id = btn.getAttribute("data-goal-id");
        todayState.goalDone[id] = !todayState.goalDone[id];
        saveToday(todayState);
        renderGoalsToday();
      });
    }

    var shuffleBtn = document.getElementById("shuffle-goals");
    if (shuffleBtn) {
      shuffleBtn.addEventListener("click", function () {
        var goals = loadGoals();
        if (!goals.length) return;
        var shuffled = goals.slice().sort(function () { return Math.random() - 0.5; });
        todayState.pickedGoalIds = shuffled.slice(0, Math.min(GOALS_PER_DAY, goals.length)).map(function (g) { return g.id; });
        todayState.goalDone = {};
        saveToday(todayState);
        renderGoalsToday();
        renderGoalsList();
      });
    }

    var addForm = document.getElementById("today-add-form");
    var addInput = document.getElementById("today-add-input");
    if (addForm && addInput) {
      addForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var text = addInput.value.trim();
        if (!text) return;
        todayState.extras.push({ id: uid(), text: text, done: false });
        saveToday(todayState);
        addInput.value = "";
        renderExtrasToday();
      });
    }

    var extrasList = document.getElementById("today-extras-list");
    if (extrasList) {
      extrasList.addEventListener("click", function (e) {
        var checkBtn = e.target.closest("[data-extra-id]");
        var removeBtn = e.target.closest("[data-remove-extra]");
        if (checkBtn) {
          var id = checkBtn.getAttribute("data-extra-id");
          var task = todayState.extras.find(function (t) { return t.id === id; });
          if (task) task.done = !task.done;
          saveToday(todayState);
          renderExtrasToday();
        } else if (removeBtn) {
          var rid = removeBtn.getAttribute("data-remove-extra");
          todayState.extras = todayState.extras.filter(function (t) { return t.id !== rid; });
          saveToday(todayState);
          renderExtrasToday();
        }
      });
    }
  }

  function setUpGoals() {
    var form = document.getElementById("goals-add-form");
    var input = document.getElementById("goals-add-input");
    if (form && input) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var text = input.value.trim();
        if (!text) return;
        addGoal(text);
        input.value = "";
        if (!todayState.pickedGoalIds.length) {
          todayState.pickedGoalIds = pickGoalIds(GOALS_PER_DAY);
          saveToday(todayState);
        }
        renderGoalsList();
        renderGoalsToday();
      });
    }

    var list = document.getElementById("goals-list");
    if (list) {
      list.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-remove-goal]");
        if (!btn) return;
        var id = btn.getAttribute("data-remove-goal");
        deleteGoal(id);
        todayState.pickedGoalIds = todayState.pickedGoalIds.filter(function (gid) { return gid !== id; });
        delete todayState.goalDone[id];
        saveToday(todayState);
        renderGoalsList();
        renderGoalsToday();
      });
    }
  }

  function setUpWorkouts() {
    var grid = document.getElementById("workout-grid");
    if (!grid) return;
    grid.addEventListener("change", function (e) {
      var input = e.target.closest("[data-day]");
      if (!input) return;
      var workouts = loadWorkouts();
      workouts[input.getAttribute("data-day")] = input.value.trim();
      saveWorkouts(workouts);
      renderWorkoutToday();
      renderGoalsList();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setUpTabs();
    setUpToday();
    setUpGoals();
    setUpWorkouts();
    renderAll();
  });
})();
