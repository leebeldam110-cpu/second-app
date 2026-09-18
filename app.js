/* Soundboard — static, manifest-driven, no build step.
   Everything the board shows comes from sounds.json; see README.md. */

const KEY_POOL = "1234567890qwertyuiopasdfghjklzxcvbnm".split("");
const FAVORITES_KEY = "soundboard:favorites";
const TEMPO_KEY = "soundboard:tempos";
const TEMPO_MIN = 40;
const TEMPO_MAX = 240;

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
  favorites: readStore(FAVORITES_KEY, (v) => new Set(v), () => new Set()),
  tempos: readStore(TEMPO_KEY, (v) => v, () => ({})),
};

/* ---------------------------------------------------------------- storage */

function readStore(key, hydrate, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? hydrate(JSON.parse(raw)) : fallback();
  } catch {
    return fallback();
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / blocked storage — the setting just won't persist */
  }
}

/* ------------------------------------------------------------ audio engine */

const audio = {
  ctx: null,
  master: null,
  buffers: new Map(), // id -> AudioBuffer
  loading: new Map(), // id -> Promise
  playing: new Map(), // id -> Set of voices (one-shots and loops)
  metronomes: new Map(), // id -> runner
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

async function trigger(sound, { loop = false } = {}) {
  // A metronome pad is a toggle, not a one-shot: a second press turns it off.
  if (sound.bpm) {
    if (audio.metronomes.has(sound.id)) {
      stop(sound.id);
      return;
    }
  }

  const ctx = context();

  let buffer;
  try {
    buffer = await loadBuffer(sound);
  } catch (err) {
    setStatus(`Couldn't load ${sound.file} — ${err.message}`);
    return;
  }

  if (state.solo) stopAll();
  else stop(sound.id);

  if (sound.bpm) {
    startMetronome(sound, buffer);
    paintPlaying(sound.id, { sustained: true });
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
  paintPlaying(sound.id, { loop, sustained: loop, duration: buffer.duration });
}

/* Lookahead scheduler: ticks are queued on the audio clock a fraction of a
   second early, so tempo stays steady even when the main thread is busy. */
function startMetronome(sound, buffer) {
  const ctx = context();
  const runner = {
    timer: null,
    next: ctx.currentTime + 0.1,
    sources: new Set(),
    bpm: tempoFor(sound),
  };

  const schedule = () => {
    while (runner.next < ctx.currentTime + 0.25) {
      const gain = ctx.createGain();
      gain.gain.value = sound.gain;
      gain.connect(audio.master);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.onended = () => runner.sources.delete(source);
      source.start(runner.next);

      runner.sources.add(source);
      runner.next += 60 / runner.bpm;
    }
  };

  audio.metronomes.set(sound.id, runner);
  schedule();
  runner.timer = setInterval(schedule, 40);
}

function stop(id) {
  const runner = audio.metronomes.get(id);
  if (runner) {
    clearInterval(runner.timer);
    for (const source of runner.sources) {
      try {
        source.stop();
      } catch {
        /* not started yet, or already stopped */
      }
    }
    audio.metronomes.delete(id);
  }

  const voices = audio.playing.get(id);
  if (voices) {
    for (const { source } of voices) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    audio.playing.delete(id);
  }

  paintPlaying(id);
}

function stopAll() {
  for (const id of new Set([...audio.playing.keys(), ...audio.metronomes.keys()])) stop(id);
}

/* ------------------------------------------------------------------ tempo */

function tempoFor(sound) {
  const saved = Number(state.tempos[sound.id]);
  return Number.isFinite(saved) && saved > 0 ? saved : sound.bpm;
}

function setTempo(sound, bpm) {
  const clamped = Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, bpm));
  state.tempos[sound.id] = clamped;
  writeStore(TEMPO_KEY, state.tempos);

  const runner = audio.metronomes.get(sound.id);
  if (runner) runner.bpm = clamped; // takes effect on the next scheduled tick

  const readout = padFor(sound.id)?.querySelector(".tempo-value");
  if (readout) readout.textContent = `${clamped} BPM`;
}

/* ----------------------------------------------------------------- render */

function padFor(id) {
  return el.board.querySelector(`[data-id="${CSS.escape(id)}"]`);
}

function paintPlaying(id, { loop = false, sustained = false, duration = 0 } = {}) {
  const pad = padFor(id);
  if (!pad) return;

  const active = audio.playing.has(id) || audio.metronomes.has(id);
  pad.classList.toggle("is-playing", active);
  pad.classList.toggle("is-looping", active && loop);

  const bar = pad.querySelector(".pad-progress");
  if (!bar) return;

  bar.style.transition = "none";
  bar.style.transform = "scaleX(0)";

  // A looping clip or a running metronome has no end to count down to.
  if (active && !sustained && duration > 0) {
    void bar.offsetWidth; // force a reflow so the reset isn't coalesced away
    bar.style.transition = `transform ${duration}s linear`;
    bar.style.transform = "scaleX(1)";
  }
}

function markMissing(sound, missing) {
  sound.missing = missing;
  const pad = padFor(sound.id);
  if (!pad) return;
  pad.classList.toggle("is-missing", missing);
  pad.querySelector(".pad-hit").title = missing ? `File not found: ${sound.file}` : sound.label;
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
  for (const id of audio.playing.keys()) paintPlaying(id, { sustained: true });
  for (const id of audio.metronomes.keys()) paintPlaying(id, { sustained: true });
  for (const sound of sounds) if (sound.missing) markMissing(sound, true);
}

/* The pad is a container, not a button: a full-bleed hit target sits behind the
   contents so the star and tempo controls can be real buttons in their own
   right rather than illegal nested ones. */
function buildPad(sound) {
  const pad = document.createElement("div");
  pad.className = "pad";
  pad.dataset.id = sound.id;
  pad.setAttribute("role", "listitem");
  pad.style.setProperty("--pad-color", sound.color);

  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "pad-hit";
  hit.title = sound.label;
  hit.setAttribute("aria-label", sound.bpm ? `Start or stop ${sound.label}` : `Play ${sound.label}`);
  hit.addEventListener("click", (event) => trigger(sound, { loop: event.shiftKey }));

  const emoji = document.createElement("span");
  emoji.className = "pad-emoji";
  emoji.textContent = sound.emoji;
  emoji.setAttribute("aria-hidden", "true");

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

  pad.append(hit, emoji, label, meta, progress, buildStar(sound));
  if (sound.bpm) pad.append(buildTempo(sound));

  pad.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    stop(sound.id);
  });

  return pad;
}

function buildStar(sound) {
  const star = document.createElement("button");
  star.type = "button";
  star.className = "star";
  const faved = state.favorites.has(sound.id);
  star.setAttribute("aria-pressed", String(faved));
  star.setAttribute("aria-label", `${faved ? "Unpin" : "Pin"} ${sound.label}`);
  star.textContent = faved ? "★" : "☆";
  star.addEventListener("click", () => {
    if (state.favorites.has(sound.id)) state.favorites.delete(sound.id);
    else state.favorites.add(sound.id);
    writeStore(FAVORITES_KEY, [...state.favorites]);
    renderBoard();
  });
  return star;
}

function buildTempo(sound) {
  const wrap = document.createElement("span");
  wrap.className = "tempo";

  const step = (delta, symbol) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tempo-step";
    button.textContent = symbol;
    button.setAttribute("aria-label", `${delta > 0 ? "Increase" : "Decrease"} tempo`);
    button.addEventListener("click", () => setTempo(sound, tempoFor(sound) + delta));
    return button;
  };

  const value = document.createElement("span");
  value.className = "tempo-value";
  value.textContent = `${tempoFor(sound)} BPM`;

  wrap.append(step(-5, "−"), value, step(5, "+"));
  return wrap;
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

  let key = (raw.key ?? "").toLowerCase().slice(0, 1);
  if (!key || usedKeys.has(key)) key = KEY_POOL.find((k) => !usedKeys.has(k)) ?? "";
  if (key) usedKeys.add(key);

  const bpm = Number(raw.bpm);

  return {
    id,
    label,
    key,
    category: raw.category ?? "",
    file: raw.file ?? `sounds/${id}.mp3`,
    emoji: raw.emoji ?? "🔊",
    color: raw.color ?? PALETTE[index % PALETTE.length],
    gain: typeof raw.gain === "number" ? raw.gain : 1,
    bpm: Number.isFinite(bpm) && bpm > 0 ? bpm : null,
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
    { "id": "door-slam", "label": "Wooden Door Slam", "emoji": "🚪" }
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
    if (audio.master) audio.master.gain.value = Number(el.volume.value) / 100;
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
    trigger(sound, { loop: event.shiftKey });
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
