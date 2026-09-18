/* Soundboard — static, manifest-driven, no build step.
   Everything the board shows comes from sounds.json; see README.md. */

const KEY_POOL = "1234567890qwertyuiopasdfghjklzxcvbnm".split("");
const FAVORITES_KEY = "soundboard:favorites";

const el = {
  title: document.getElementById("board-title"),
  board: document.getElementById("board"),
  categories: document.getElementById("categories"),
  search: document.getElementById("search"),
  volume: document.getElementById("volume"),
  solo: document.getElementById("solo"),
  stopAll: document.getElementById("stop-all"),
  helpBtn: document.getElementById("help-btn"),
  help: document.getElementById("help"),
  empty: document.getElementById("empty"),
  setup: document.getElementById("setup"),
  status: document.getElementById("status"),
};

const state = {
  sounds: [],
  filter: "",
  category: "all",
  solo: false,
  favorites: loadFavorites(),
};

/* ---------------------------------------------------------------- storage */

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
  } catch {
    /* private mode / blocked storage — favorites just won't persist */
  }
}

/* ------------------------------------------------------------ audio engine */

const audio = {
  ctx: null,
  master: null,
  buffers: new Map(), // id -> AudioBuffer
  loading: new Map(), // id -> Promise
  playing: new Map(), // id -> Set of { source, gain }
};

function context() {
  if (!audio.ctx) {
    audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = Number(el.volume.value) / 100;
    audio.master.connect(audio.ctx.destination);
  }
  if (audio.ctx.state === "suspended") audio.ctx.resume();
  return audio.ctx;
}

function loadBuffer(sound) {
  if (audio.buffers.has(sound.id)) return Promise.resolve(audio.buffers.get(sound.id));
  if (audio.loading.has(sound.id)) return audio.loading.get(sound.id);

  const task = fetch(sound.file)
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.arrayBuffer();
    })
    .then((bytes) => context().decodeAudioData(bytes))
    .then((buffer) => {
      audio.buffers.set(sound.id, buffer);
      markMissing(sound, false);
      return buffer;
    })
    .catch((err) => {
      audio.loading.delete(sound.id);
      markMissing(sound, true);
      throw err;
    });

  audio.loading.set(sound.id, task);
  return task;
}

async function play(sound, { loop = false } = {}) {
  const ctx = context();

  if (state.solo) stopAll();
  else stop(sound.id);

  let buffer;
  try {
    buffer = await loadBuffer(sound);
  } catch (err) {
    setStatus(`Couldn't load ${sound.file} — ${err.message}`);
    return;
  }

  const gain = ctx.createGain();
  gain.gain.value = sound.gain;
  gain.connect(audio.master);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;
  source.connect(gain);

  const voice = { source, gain };
  if (!audio.playing.has(sound.id)) audio.playing.set(sound.id, new Set());
  audio.playing.get(sound.id).add(voice);

  source.onended = () => {
    const voices = audio.playing.get(sound.id);
    if (voices) {
      voices.delete(voice);
      if (voices.size === 0) audio.playing.delete(sound.id);
    }
    paintPlaying(sound.id);
  };

  source.start();
  paintPlaying(sound.id, { loop, duration: buffer.duration });
}

function stop(id) {
  const voices = audio.playing.get(id);
  if (!voices) return;
  for (const { source } of voices) {
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
  }
  audio.playing.delete(id);
  paintPlaying(id);
}

function stopAll() {
  for (const id of [...audio.playing.keys()]) stop(id);
}

/* ----------------------------------------------------------------- render */

function padFor(id) {
  return el.board.querySelector(`[data-id="${CSS.escape(id)}"]`);
}

function paintPlaying(id, { loop = false, duration = 0 } = {}) {
  const pad = padFor(id);
  if (!pad) return;

  const active = audio.playing.has(id);
  pad.classList.toggle("is-playing", active);
  pad.classList.toggle("is-looping", active && loop);

  const bar = pad.querySelector(".pad-progress");
  if (!bar) return;

  bar.style.transition = "none";
  bar.style.transform = "scaleX(0)";

  if (active && !loop && duration > 0) {
    // force a reflow so the reset above is not coalesced with the animation
    void bar.offsetWidth;
    bar.style.transition = `transform ${duration}s linear`;
    bar.style.transform = "scaleX(1)";
  }
}

function markMissing(sound, missing) {
  sound.missing = missing;
  const pad = padFor(sound.id);
  if (pad) {
    pad.classList.toggle("is-missing", missing);
    pad.title = missing ? `File not found: ${sound.file}` : sound.label;
  }
}

function visibleSounds() {
  const q = state.filter.trim().toLowerCase();
  return state.sounds
    .filter((s) => state.category === "all" || s.category === state.category)
    .filter(
      (s) =>
        !q ||
        s.label.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    )
    .sort((a, b) => {
      const fav = Number(state.favorites.has(b.id)) - Number(state.favorites.has(a.id));
      return fav !== 0 ? fav : a.order - b.order;
    });
}

function renderBoard() {
  const sounds = visibleSounds();
  el.board.replaceChildren(...sounds.map(buildPad));
  el.empty.hidden = sounds.length > 0;

  // repaint transient state for pads that survived the re-render
  for (const id of audio.playing.keys()) paintPlaying(id, { loop: true });
  for (const sound of sounds) if (sound.missing) markMissing(sound, true);
}

function buildPad(sound) {
  const pad = document.createElement("button");
  pad.type = "button";
  pad.className = "pad";
  pad.dataset.id = sound.id;
  pad.setAttribute("role", "listitem");
  pad.style.setProperty("--pad-color", sound.color);
  pad.title = sound.label;

  const top = document.createElement("span");
  top.className = "pad-emoji";
  top.textContent = sound.emoji;
  top.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "pad-label";
  label.textContent = sound.label;

  const meta = document.createElement("span");
  meta.className = "pad-meta";
  if (sound.key) {
    const key = document.createElement("span");
    key.className = "pad-key";
    key.textContent = sound.key.toUpperCase();
    meta.append(key);
  }
  if (sound.category) {
    const cat = document.createElement("span");
    cat.className = "pad-cat";
    cat.textContent = sound.category;
    meta.append(cat);
  }

  const progress = document.createElement("span");
  progress.className = "pad-progress";

  const star = document.createElement("button");
  star.type = "button";
  star.className = "star";
  const faved = state.favorites.has(sound.id);
  star.setAttribute("aria-pressed", String(faved));
  star.setAttribute("aria-label", `${faved ? "Unpin" : "Pin"} ${sound.label}`);
  star.textContent = faved ? "★" : "☆";
  star.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(sound);
  });

  pad.append(top, label, meta, progress, star);
  pad.addEventListener("click", (event) => play(sound, { loop: event.shiftKey }));
  pad.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    stop(sound.id);
  });

  return pad;
}

function toggleFavorite(sound) {
  if (state.favorites.has(sound.id)) state.favorites.delete(sound.id);
  else state.favorites.add(sound.id);
  saveFavorites();
  renderBoard();
}

function renderCategories() {
  const names = [...new Set(state.sounds.map((s) => s.category).filter(Boolean))];
  if (names.length < 2) {
    el.categories.replaceChildren();
    return;
  }

  const make = (value, text) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = text;
    chip.setAttribute("aria-pressed", String(state.category === value));
    chip.addEventListener("click", () => {
      state.category = value;
      renderCategories();
      renderBoard();
    });
    return chip;
  };

  el.categories.replaceChildren(make("all", "All"), ...names.map((n) => make(n, n)));
}

function setStatus(message) {
  el.status.textContent = message;
}

/* ------------------------------------------------------------- manifest */

const PALETTE = ["#6ea8fe", "#f7768e", "#9ece6a", "#e0af68", "#bb9af7", "#2ac3de", "#ff9e64", "#7dcfff"];

function normalize(raw, index, usedKeys) {
  const id = String(raw.id ?? raw.label ?? `sound-${index}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const label = raw.label ?? raw.name ?? id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const category = raw.category ?? "";

  let key = (raw.key ?? "").toLowerCase().slice(0, 1);
  if (!key || usedKeys.has(key)) key = KEY_POOL.find((k) => !usedKeys.has(k)) ?? "";
  if (key) usedKeys.add(key);

  return {
    id,
    label,
    category,
    key,
    file: raw.file ?? `sounds/${id}.mp3`,
    emoji: raw.emoji ?? "🔊",
    color: raw.color ?? PALETTE[index % PALETTE.length],
    gain: typeof raw.gain === "number" ? raw.gain : 1,
    order: index,
    missing: false,
  };
}

async function loadManifest() {
  const res = await fetch("sounds.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`sounds.json returned ${res.status}`);
  const data = await res.json();

  const list = Array.isArray(data) ? data : data.sounds;
  if (!Array.isArray(list)) throw new Error("sounds.json must be an array, or an object with a `sounds` array");

  const title = (!Array.isArray(data) && data.title) || "Soundboard";
  const usedKeys = new Set();
  return { title, sounds: list.map((raw, i) => normalize(raw, i, usedKeys)) };
}

function showSetup(message) {
  const onFileProtocol = location.protocol === "file:";
  el.setup.hidden = false;
  el.setup.innerHTML = `
    <h2>Nothing to play yet</h2>
    <p>${message}</p>
    ${
      onFileProtocol
        ? `<p>You opened this page as a <code>file://</code> URL, and browsers block
           <code>fetch</code> there. Serve the folder instead:</p>
           <pre>python3 -m http.server 8000</pre>
           <p>Then visit <code>http://localhost:8000</code>.</p>`
        : `<p>Add your clips to <code>sounds/</code> and list them in <code>sounds.json</code>:</p>
           <pre>{
  "title": "My Soundboard",
  "sounds": [
    { "id": "airhorn", "label": "Air Horn", "category": "Classic", "emoji": "📢" }
  ]
}</pre>
           <p>Each entry looks for <code>sounds/&lt;id&gt;.mp3</code> unless you set
           <code>"file"</code> yourself.</p>`
    }`;
}

/* --------------------------------------------------------------- controls */

function bindControls() {
  el.search.addEventListener("input", () => {
    state.filter = el.search.value;
    renderBoard();
  });

  el.volume.addEventListener("input", () => {
    const value = Number(el.volume.value) / 100;
    if (audio.master) audio.master.gain.value = value;
  });

  el.solo.addEventListener("click", () => {
    state.solo = !state.solo;
    el.solo.setAttribute("aria-pressed", String(state.solo));
    setStatus(state.solo ? "Solo mode: one sound at a time." : "");
    if (state.solo) stopAll();
  });

  el.stopAll.addEventListener("click", stopAll);

  el.helpBtn.addEventListener("click", () => {
    if (typeof el.help.showModal === "function") el.help.showModal();
  });

  document.addEventListener("keydown", (event) => {
    const typing = event.target.matches("input, textarea, select");

    if (event.key === "Escape") {
      if (typing) return;
      stopAll();
      return;
    }
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === "/") {
      event.preventDefault();
      el.search.focus();
      el.search.select();
      return;
    }

    // read the physical key so Shift (loop) doesn't turn "1" into "!"
    const code = event.code;
    const char = code.startsWith("Key")
      ? code.slice(3).toLowerCase()
      : code.startsWith("Digit")
        ? code.slice(5)
        : "";
    if (!char) return;

    const sound = state.sounds.find((s) => s.key === char);
    if (!sound) return;

    event.preventDefault();
    play(sound, { loop: event.shiftKey });
  });
}

/* Probe every file once at start-up so pads for clips that aren't there yet
   read as unavailable instead of failing silently on the first click. */
async function checkAvailability() {
  const queue = [...state.sounds];
  let missing = 0;

  const worker = async () => {
    for (let sound = queue.shift(); sound; sound = queue.shift()) {
      try {
        const res = await fetch(sound.file, { method: "HEAD" });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        missing += 1;
        markMissing(sound, true);
      }
    }
  };

  await Promise.all(Array.from({ length: 6 }, worker));
  return missing;
}

/* ------------------------------------------------------------------- boot */

async function init() {
  bindControls();

  let manifest;
  try {
    manifest = await loadManifest();
  } catch (err) {
    showSetup(`Couldn't read <code>sounds.json</code> — ${err.message}`);
    return;
  }

  state.sounds = manifest.sounds;
  el.title.textContent = manifest.title;
  document.title = manifest.title;

  if (state.sounds.length === 0) {
    showSetup("<code>sounds.json</code> loaded, but it lists no sounds.");
    return;
  }

  renderCategories();
  renderBoard();

  const total = state.sounds.length;
  setStatus(`${total} sound${total === 1 ? "" : "s"} · press ? for shortcuts`);

  const missing = await checkAvailability();
  if (missing > 0) {
    setStatus(
      `${total - missing} of ${total} clips found — ${missing} still missing from sounds/ (dimmed pads)`
    );
  }
}

init();
