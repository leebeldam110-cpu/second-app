/* The Eze'Rhi'El — boot, the game loop, saving and time spent away. */
(function (root) {
  'use strict';
  const EZ = root.EZ;
  const UI = EZ.UI;
  EZ.init();

  /* The burning eye: used for the Stoke button and, smaller, for the Child's whispers. */
  function eyeSVG(p) {
    return '<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<radialGradient id="' + p + 'iris" cx="50%" cy="58%" r="55%"><stop offset="0" stop-color="#fff2c2"/><stop offset=".28" stop-color="#ffb24a"/>' +
      '<stop offset=".62" stop-color="#ff6a1f"/><stop offset="1" stop-color="#6e1307"/></radialGradient>' +
      '<linearGradient id="' + p + 'tongue" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff6a1f"/><stop offset=".6" stop-color="#ffb24a" stop-opacity=".8"/>' +
      '<stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="' + p + 'glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff6a1f" stop-opacity=".35"/><stop offset="1" stop-color="#ff6a1f" stop-opacity="0"/></radialGradient>' +
      '<clipPath id="' + p + 'clip"><path d="M18 104C52 56 148 56 182 104 148 152 52 152 18 104Z"/></clipPath>' +
      '</defs>' +
      '<circle cx="100" cy="104" r="96" fill="url(#' + p + 'glow)"/>' +
      '<path class="tongue" fill="url(#' + p + 'tongue)" d="M70 72C64 54 76 44 72 22 86 36 92 50 86 72Z"/>' +
      '<path class="tongue" fill="url(#' + p + 'tongue)" d="M90 66C84 42 104 30 98 4 118 24 122 46 112 66Z"/>' +
      '<path class="tongue" fill="url(#' + p + 'tongue)" d="M116 72C114 54 126 46 126 28 138 42 140 58 132 72Z"/>' +
      '<path class="lid" d="M18 104C52 56 148 56 182 104 148 152 52 152 18 104Z"/>' +
      '<g clip-path="url(#' + p + 'clip)"><g class="iris"><circle cx="100" cy="104" r="36" fill="url(#' + p + 'iris)"/>' +
      '<path d="M100 76C107 90 107 118 100 132 93 118 93 90 100 76Z" fill="#140806"/>' +
      '<path d="M100 84C103 94 103 112 100 124" stroke="#ff8a3a" stroke-width="1" fill="none" opacity=".6"/></g>' +
      '<path d="M18 104C52 74 148 74 182 104" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="10"/></g>' +
      '<path d="M18 104C52 56 148 56 182 104 148 152 52 152 18 104Z" fill="none" stroke="#ff8a3a" stroke-opacity=".55" stroke-width="1.5"/>' +
      '<path d="M40 128l-8 10M62 140l-4 12M138 140l4 12M160 128l8 10" stroke="#4a3328" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>';
  }

  let S = null, last = 0, saveT = 0;

  function offlineCatchUp(state, why) {
    const away = (Date.now() - (state.lastTick || Date.now())) / 1000;
    if (!(away > 30)) return;
    const capped = Math.min(away, 7 * 86400);
    const eff = EZ.offlineEff(state);
    const sum = EZ.simulate(state, capped, eff);
    const rows = [['Embers', sum.embers], ['Ash', sum.ash], ['Skull Sigils', sum.sigils], ['Artron', sum.artron], ['Grace', sum.grace]]
      .filter((r) => r[1] > 0).map((r) => '<dt>' + r[0] + '</dt><dd>+' + EZ.fmt(r[1]) + '</dd>').join('');
    const body = '<h2>While you smouldered</h2><p>You were gone for ' + EZ.fmtTime(away) + (away > capped ? ' (only the last 7 days count)' : '') +
      '. The fire kept burning at ' + EZ.fmtPct(eff) + ' strength.</p>' + (rows ? '<dl class="kv">' + rows + '</dl>' : '<p class="dim">Nothing caught.</p>');
    if (why === 'load') UI.pendingWelcome = body;
    else UI.toast('<b>The fire kept burning.</b><br>' + EZ.fmtTime(away) + ' passed while the page slept.');
  }

  function start(state) {
    S = state || EZ.load() || EZ.newState();
    offlineCatchUp(S, 'load');
    S.lastTick = Date.now();
    UI.boot(S);
    if (UI.pendingWelcome) { UI.modal(UI.pendingWelcome, [{ label: 'Return to the fire' }]); UI.pendingWelcome = null; }
  }
  UI.onBoot = (st) => {
    S = st;
    if (!S.log.length) { EZ.log(S, 'the dark is cold, and very old.', 'story'); S.flags.story.start = 1; UI.update(); }
  };

  function loop() {
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    if (!S || !(dt > 0)) return;
    if (dt > 60) {
      S.lastTick = Date.now() - dt * 1000;
      offlineCatchUp(S, 'sleep');
    } else EZ.tick(S, Math.min(dt, 60));
    S.lastTick = Date.now();
    saveT += dt;
    if (saveT >= 30) { saveT = 0; if (S.settings.autosave) EZ.save(S); }
    if (!document.hidden) {
      UI.update();
      const t = EZ.fmt(S.embers) + ' embers · The Eze’Rhi’El';
      if (document.title !== t) document.title = t;
    }
  }

  function wire() {
    const eye = document.getElementById('eye');
    eye.addEventListener('click', (e) => {
      const r = eye.getBoundingClientRect();
      const x = e.clientX || r.left + r.width / 2, y = e.clientY || r.top + r.height / 2;
      UI.stokeAt(x, y);
    });
    document.getElementById('whisper').addEventListener('click', () => UI.whisperClick());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.getElementById('modal').hidden) UI.closeModal(); });
    document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') UI.closeModal(); });
    const persist = () => { if (S) { S.lastTick = Date.now(); EZ.save(S); } };
    document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
    root.addEventListener('pagehide', persist);
    EZ.onOmen = (o) => UI.toast('<b>An omen: ' + EZ.escape(o.name) + '</b><br>' + EZ.escape(o.desc) + ' Embers +2%.');
  }

  function boot() {
    document.getElementById('eyeArt').innerHTML = eyeSVG('e');
    document.getElementById('whisper').innerHTML = eyeSVG('w');
    EZ.FX.init(document.getElementById('fx'));
    wire();
    // keep the game across live page updates when the host offers it
    const hot = root.claude && root.claude.hot;
    if (hot && typeof hot.snapshot === 'function') {
      try { hot.snapshot(() => ({ save: S ? EZ.serialize(S) : null })); } catch (e) { /* not available */ }
    }
    const begin = (data) => {
      let st = null;
      try { if (data && data.save) st = EZ.hydrate(JSON.parse(data.save)); } catch (e) { st = null; }
      start(st);
    };
    if (hot && typeof hot.ready === 'function') hot.ready(begin);
    else begin((hot && hot.data) || {});
    last = performance.now();
    setInterval(loop, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
