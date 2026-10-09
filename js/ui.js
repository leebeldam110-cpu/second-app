/* The Eze'Rhi'El — interface. Builds each panel once and refreshes its numbers ~10 times a second. */
(function (root) {
  'use strict';
  const EZ = root.EZ;
  const D = () => EZ.DATA;
  const L = (s, st, id) => EZ.L(s, st, id);
  const fmt = (n) => EZ.fmt(n);
  const esc = EZ.escape;
  const UI = (EZ.UI = {});
  let S = null;

  const $ = (sel, el) => (el || document).querySelector(sel);
  function h(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function setText(node, str) { if (node && node._t !== str) { node._t = str; node.textContent = str; } }
  function setHTML(node, str) { if (node && node._h !== str) { node._h = str; node.innerHTML = str; } }
  function setBar(node, frac) {
    const w = (EZ.clamp(isFinite(frac) ? frac : 0, 0, 1) * 100).toFixed(1) + '%';
    const i = node.firstElementChild;
    if (i._w !== w) { i._w = w; i.style.width = w; }
  }
  const bar = (cls) => '<div class="bar ' + (cls || '') + '"><i></i></div>';
  const logFrac = (cur, need) => (cur <= 1 ? 0 : Math.log10(cur) / Math.log10(need));

  const CUR = {
    embers: ['embers', 'var(--t-ember)'], ash: ['ash', 'var(--t-ash)'], slivers: ['slivers', 'var(--t-sliver)'],
    artron: ['artron', 'var(--t-time)'], paradox: ['paradox', 'var(--t-paradox)'], nightmare: ['nightmare', 'var(--t-night)'],
  };
  const costText = (cur, c) => fmt(c) + ' ' + CUR[cur][0];

  /* ================= buying ================= */
  function bindIcon(btn, onOne, onMax) {
    let timer = null, longFired = false;
    btn.addEventListener('click', (e) => { if (longFired) { longFired = false; return; } onOne(e); });
    btn.addEventListener('contextmenu', (e) => { e.preventDefault(); if (longFired) return; onMax(e); });
    btn.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      longFired = false;
      timer = setTimeout(() => { longFired = true; onMax(e); }, 450);
    });
    const clear = () => { clearTimeout(timer); timer = null; };
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, clear));
  }
  function flash(el) {
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }
  function doBuy(def, mode, ico) {
    const n = EZ.buy(S, def, mode);
    if (n) { flash(ico); EZ.calc(S); UI.update(); }
    return n;
  }
  function maxAffordable(s, d, cap) {
    if (d.store === 'ups' && s.chal === 'position' && d.id.startsWith('rite_')) return 0;
    let l = d.level(s), have = s[d.cur], n = 0;
    const mx = EZ.defMax(s, d);
    while (n < cap && l < mx) {
      if (d.gate && !d.gate(s, l)) break;
      const c = d.cost(s, l);
      if (!(have >= c)) break;
      have -= c; l++; n++;
    }
    return n;
  }

  /* A purchasable row/card: icon (click = 1, right-click/long-press = max) + Buy 1 / Max buttons. */
  function makeItem(d, opts) {
    const el = h('div', 'item');
    el.innerHTML =
      '<button type="button" class="ico tint-' + (d.tint || 'ember') + '" aria-label="Buy one ' + esc(d.name) +
      '. Right-click or long-press to buy the most you can afford.">' + EZ.glyph(d.glyph) + '<span class="lvl num"></span></button>' +
      '<div class="body"><div class="name">' + esc(d.name) + '<span class="lv"></span></div><div class="desc"></div>' +
      (d.flav ? '<div class="flav">' + esc(d.flav) + '</div>' : '') + '<div class="gate"></div></div>' +
      '<div class="buy"><div class="cost num"></div><div class="btns">' +
      '<button type="button" class="btn b1">Buy 1</button><button type="button" class="btn bm">Max</button></div></div>';
    const ico = $('.ico', el), lvl = $('.lvl', el), lv = $('.lv', el), desc = $('.desc', el), gate = $('.gate', el),
      cost = $('.cost', el), b1 = $('.b1', el), bm = $('.bm', el);
    ico.title = 'Click: buy 1 · Right-click or long-press: buy max';
    bindIcon(ico, () => doBuy(d, 1, ico), () => doBuy(d, 'max', ico));
    b1.addEventListener('click', () => doBuy(d, 1, ico));
    bm.addEventListener('click', () => doBuy(d, 'max', ico));
    function update() {
      const l = d.level(S), mx = EZ.defMax(S, d), maxed = l >= mx;
      const why = EZ.blocked(S, d), can = !why, gated = !!why && why !== 'poor' && why !== 'max';
      el.classList.toggle('can', can);
      el.classList.toggle('maxed', maxed);
      el.classList.toggle('gated', gated);
      setText(lvl, mx === 1 ? (l ? '✓' : '') : (l ? EZ.fmtInt(l) : ''));
      setText(lv, opts.lvText ? opts.lvText(d, l) : (mx === 1 ? (l ? ' · owned' : '') : (mx < Infinity ? ' · ' + l + ' / ' + mx : (l ? ' · level ' + l : ''))));
      setText(desc, opts.desc ? opts.desc(d, l) : d.desc ? d.desc(S, l) : '');
      setText(gate, gated ? why : '');
      setText(cost, maxed ? 'Complete' : costText(d.cur, d.cost(S, l)));
      const n = can ? maxAffordable(S, d, 500) : 0;
      b1.disabled = !can; bm.disabled = !can;
      setText(bm, n > 1 ? 'Max ×' + (n >= 500 ? '500+' : n) : 'Max');
    }
    return { el, update };
  }

  function ItemList(container, defsFn, opts) {
    opts = opts || {};
    let key = null, rows = [];
    return {
      update() {
        const defs = defsFn().filter((d) => EZ.isVisible(S, d));
        const k = defs.map((d) => d.id).join('|');
        if (k !== key) {
          key = k;
          container.innerHTML = '';
          rows = defs.map((d) => makeItem(d, opts));
          rows.forEach((r) => container.appendChild(r.el));
          if (!rows.length && opts.empty) container.innerHTML = '<p class="hint">' + opts.empty + '</p>';
        }
        for (const r of rows) r.update();
      },
    };
  }

  const ICON_HINT = '<p class="hint">Click an icon to buy one. Right-click it (or long-press on a phone) to buy as many as you can afford. The <kbd>Buy 1</kbd> and <kbd>Max</kbd> buttons do the same.</p>';

  /* ================= tabs ================= */
  const TABS = [
    { id: 'kindling', name: 'Kindling', show: () => true, build: buildKindling },
    { id: 'rites', name: 'Rites', show: (s) => D().rites.some((r) => EZ.isVisible(s, r)), build: buildRites },
    { id: 'tree', name: 'Ashen Tree', show: (s) => EZ.has.tree(s), build: buildTree },
    { id: 'crack', name: 'The Crack', show: (s) => EZ.has.crack(s), build: buildCrack },
    { id: 'gifts', name: 'Gifts', show: (s) => EZ.has.shop2(s), build: buildGifts },
    { id: 'shades', name: 'Shades', show: (s) => EZ.has.shades(s), build: buildShades },
    { id: 'grimoire', name: 'Grimoire', show: (s) => EZ.has.grimoire(s), build: buildGrimoire },
    { id: 'timewar', name: 'Time War', show: (s) => EZ.has.timewar(s), build: buildTimeWar },
    { id: 'timelines', name: 'Burnt Timelines', show: (s) => EZ.has.timelines(s), build: buildTimelines },
    { id: 'gate', name: 'Heaven’s Gate', show: (s) => EZ.has.siege(s), build: buildGate },
    { id: 'cascade', name: 'Lumen Cascade', show: (s) => EZ.has.hunt(s), build: buildCascade },
    { id: 'omens', name: 'Omens', show: (s) => s.stokesTotal > 0 || s.embersTotal > 0, build: buildOmens },
    { id: 'settings', name: 'Settings', show: () => true, build: buildSettings },
  ];
  let current = null, currentView = null, tabKey = '';

  function renderTabs() {
    const vis = TABS.filter((t) => t.show(S));
    const k = vis.map((t) => t.id).join('|');
    if (k === tabKey) return;
    tabKey = k;
    S.flags.tabsSeen = S.flags.tabsSeen || {};
    const nav = $('#tabs');
    nav.innerHTML = '';
    for (const t of vis) {
      const b = h('button', 'tab', esc(t.name));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.tab = t.id;
      b.setAttribute('aria-selected', String(t.id === current));
      if (!S.flags.tabsSeen[t.id] && t.id !== 'settings' && S.embersTotal > 0) { b.classList.add('new'); b.insertAdjacentHTML('beforeend', '<span class="ping"></span>'); }
      b.addEventListener('click', () => selectTab(t.id));
      nav.appendChild(b);
    }
    if (!vis.find((t) => t.id === current)) selectTab('kindling');
  }

  function selectTab(id) {
    current = id;
    S.flags.tabsSeen = S.flags.tabsSeen || {};
    S.flags.tabsSeen[id] = 1;
    S.flags.tab = id;
    document.querySelectorAll('#tabs .tab').forEach((b) => {
      const on = b.dataset.tab === id;
      b.setAttribute('aria-selected', String(on));
      if (on) { b.classList.remove('new'); const p = $('.ping', b); if (p) p.remove(); }
    });
    const view = $('#view');
    view.innerHTML = '';
    const t = TABS.find((x) => x.id === id);
    currentView = t.build(view) || null;
    if (currentView && currentView.update) currentView.update();
  }
  UI.selectTab = selectTab;

  /* ---------- Kindling ---------- */
  function buildKindling(view) {
    view.innerHTML = '<div class="panel-head"><h2>Kindling</h2><span class="label num" id="kRate"></span></div>' +
      '<p class="intro">Everything that burns for you. Each Kindling feeds the ember while you are away from it.</p>' + ICON_HINT +
      '<div class="items" id="kList"></div>';
    const list = ItemList($('#kList', view), () => D().gens, {
      lvText: (d, l) => (l ? ' · ' + EZ.fmtInt(l) + ' owned' : ''),
      desc: (d, l) => {
        const each = (EZ.C.genProd[d.id] || d.prod) * EZ.C.mult;
        let t = 'Each burns ' + fmt(each) + (each === 1 ? ' ember' : ' embers') + '/s';
        if (l) t += ' · together ' + fmt(each * l) + '/s (' + EZ.fmtPct(EZ.C.raw > 0 ? (EZ.C.genProd[d.id] * l) / EZ.C.raw : 0) + ' of your fire)';
        return t;
      },
    });
    return { update() { list.update(); setText($('#kRate', view), fmt(EZ.C.eps) + ' embers per second'); } };
  }

  /* ---------- Rites ---------- */
  function buildRites(view) {
    view.innerHTML = '<div class="panel-head"><h2>Rites of Kindling</h2></div>' +
      '<p class="intro">Rites deepen what already burns. A Kindling’s rite opens a new level at 1, 5, 25, 50, 100 owned and beyond.</p>' + ICON_HINT +
      '<div class="cards" id="rList"></div>';
    const list = ItemList($('#rList', view), () => D().rites, {});
    return { update: list.update };
  }

  /* ---------- Ashen Tree ---------- */
  function buildTree(view) {
    const rows = ['Roots', 'Trunk', 'Branches', 'Crown'];
    view.innerHTML = '<div class="panel-head"><h2>The Ashen Tree</h2><span class="label">Ash <b class="num" id="tAsh" style="color:var(--t-ash)"></b></span></div>' +
      '<p class="intro">What is left after a regeneration. Ash spent here keeps its shape until you claim the Title. Unlocks are never lost.</p>' + ICON_HINT +
      rows.map((r, i) => '<div class="section"><h3>' + r + '</h3><div class="cards" id="tr' + i + '" style="margin-top:8px"></div></div>').join('');
    const lists = rows.map((r, i) => ItemList($('#tr' + i, view), () => D().tree.filter((d) => d.row === i), {}));
    return { update() { lists.forEach((l) => l.update()); setText($('#tAsh', view), fmt(S.ash)); } };
  }

  /* ---------- The Crack: ghosts + tournament ---------- */
  function buildCrack(view) {
    view.innerHTML =
      '<div class="panel-head"><h2>The Crack</h2><span class="label num" id="cPop"></span></div>' +
      '<p class="intro">The Wizard fled the Nightmare Child’s cage with his Disc and left a crack behind. Ghosts seep through it. Ghosts cannot exist in the universe, so they need you.</p>' +
      '<div class="section"><h3>The Ghost Army</h3><div style="margin:8px 0 6px" id="popBar">' + bar('ghost tall') + '</div><p class="hint num" id="cRate"></p>' +
      '<div style="display:grid;gap:6px" id="jobs"></div></div>' +
      '<div class="section" id="tourneySec"><div class="panel-head"><h3>The Tournament of Skull</h3><span class="label num" id="tSig"></span></div>' +
      '<p class="hint">Judge Damien’s court pays one Skull Sigil for every champion (each tenth bout) you beat for the first time this Title. Ten Sigils let you claim the Title. Your squad waits until the haunt is 90% full, then marches. Fallen ghosts are gone.</p>' +
      '<div class="arena"><div class="combatant" id="squad"><div class="label">Your squad</div><div class="who num" id="sqWho"></div>' + bar('ghost') + '<div class="hint num" id="sqStats" style="margin:4px 0 0"></div></div>' +
      '<div class="vs">vs</div>' +
      '<div class="combatant foe" id="foe"><div class="label num" id="foeBout"></div><div class="who" id="foeWho"></div>' + bar('') + '<div class="hint num" id="foeStats" style="margin:4px 0 0"></div></div></div>' +
      '<div class="row" style="margin-top:10px"><button type="button" class="btn" id="sendNow">Send the squad now</button><span class="hint num" id="tRec" style="margin:0"></span></div></div>' +
      '<div class="section" id="armsSec"><h3>Haunts &amp; Armaments</h3>' + ICON_HINT + '<div class="cards" id="aList"></div></div>';

    const JOBS = [['stoke', 'Stokers', 'Each feeds the ember: +2% production (diminishing past 100).'],
      ['ward', 'Wardens', 'Each makes ghosts gather 3% faster.'], ['fight', 'Fighters', 'The share that marches in the Tournament.']];
    const jobsEl = $('#jobs', view);
    const sliders = {};
    for (const [id, name, tip] of JOBS) {
      const row = h('label', 'slider');
      row.title = tip;
      row.innerHTML = '<span>' + name + '</span><input type="range" min="0" max="100" step="1" id="job-' + id + '"><span class="num pct"></span><span class="count num"></span>';
      const inp = $('input', row);
      inp.addEventListener('input', () => { EZ.setJobPct(S, id, Number(inp.value)); syncJobs(); });
      sliders[id] = { inp, pct: $('.pct', row), count: $('.count', row) };
      jobsEl.appendChild(row);
    }
    function syncJobs() {
      const j = EZ.jobs(S);
      for (const id in sliders) {
        const sl = sliders[id];
        if (document.activeElement !== sl.inp) sl.inp.value = S.ghosts.pct[id];
        setText(sl.pct, S.ghosts.pct[id] + '%');
        setText(sl.count, EZ.fmtInt(j[id]));
      }
    }
    $('#sendNow', view).addEventListener('click', () => { if (!EZ.sendSquad(S, true)) UI.toast('No ghosts are assigned to fight.'); });
    const arms = ItemList($('#aList', view), () => D().arms, {});

    return {
      update() {
        const cap = EZ.ghostCap(S), n = S.ghosts.n;
        setText($('#cPop', view), EZ.fmtInt(n) + ' / ' + EZ.fmtInt(cap) + ' ghosts');
        setBar($('#popBar .bar', view), n / cap);
        setText($('#cRate', view), n >= cap ? 'The haunt is full.' : 'Gathering ' + fmt(EZ.ghostRate(S) * (1 - n / cap)) + ' ghosts per second.');
        syncJobs();
        const ts = $('#tourneySec', view);
        ts.hidden = !EZ.has.tourney(S);
        if (!ts.hidden) {
          const t = S.tourney, b = t.bout, champ = EZ.isChampion(b);
          setText($('#tSig', view), fmt(S.sigils) + ' Skull Sigils this Title');
          setText($('#foeBout', view), (champ ? 'Champion · bout ' : 'Bout ') + b);
          setText($('#foeWho', view), EZ.enemyName(b));
          $('#foe', view).classList.toggle('champ', champ);
          const ehp = Math.max(0, t.enemyHp), emax = EZ.enemyHp(b);
          setBar($('#foe .bar', view), ehp / emax);
          setText($('#foeStats', view), 'Health ' + fmt(ehp) + ' / ' + fmt(emax) + ' · strikes ' + fmt(EZ.enemyAtk(b)) + '/s');
          const atkPer = EZ.squadAtkPer(S), hpPer = EZ.squadHpPer(S);
          if (t.alive) {
            setText($('#sqWho', view), EZ.fmtInt(t.squad) + ' ghosts in the field');
            setBar($('#squad .bar', view), t.hpFrac);
            setText($('#sqStats', view), 'Health ' + fmt(t.hpFrac * t.squad * hpPer) + ' / ' + fmt(t.squad * hpPer) + ' · strikes ' + fmt(t.squad * atkPer) + '/s');
          } else {
            const f = EZ.jobs(S).fight;
            setText($('#sqWho', view), f ? 'Regrouping' : 'No fighters assigned');
            setBar($('#squad .bar', view), cap ? n / cap / 0.9 : 0);
            setText($('#sqStats', view), f ? 'Marches when the haunt is 90% full (' + EZ.fmtPct(n / cap) + '). Next squad: ' + EZ.fmtInt(f) + ' ghosts, ' + fmt(f * atkPer) + ' damage/s.' : 'Move the Fighters slider above zero.');
          }
          setText($('#tRec', view), 'Best this life: bout ' + t.best + ' · champions paid this Title: up to bout ' + S.sigilRecord + ' · best ever: ' + t.bestEver);
          $('#sendNow', view).disabled = t.alive;
        }
        arms.update();
      },
    };
  }

  /* ---------- Gifts of the Crack (slivers) ---------- */
  function buildGifts(view) {
    view.innerHTML = '<div class="panel-head"><h2>Gifts of the Crack</h2><span class="label">Slivers <b class="num" id="gS" style="color:var(--t-sliver)"></b></span></div>' +
      '<p class="intro">Every Title claimed slides another sliver of the Nightmare Child in behind your eyes. Slivers earned also multiply your embers. Gifts last until you burn a timeline.</p>' + ICON_HINT +
      '<div class="cards" id="gList"></div>';
    const list = ItemList($('#gList', view), () => D().shop2, {});
    return { update() { list.update(); setText($('#gS', view), fmt(S.slivers)); } };
  }

  /* ---------- Shades (automation) ---------- */
  function buildShades(view) {
    view.innerHTML = '<div class="panel-head"><h2>Shades</h2></div>' +
      '<p class="intro">The ability to craft a temporary Shade, made permanent. Each Shade does one task for you, endlessly. Switch them on or off and set their limits.</p>' +
      '<div class="split" id="shList"></div>';
    const wrap = $('#shList', view);
    let key = '';
    const cards = [];
    function build() {
      wrap.innerHTML = ''; cards.length = 0;
      for (const def of D().shades) {
        const unlocked = def.unlock(S);
        const c = h('div', 'shade-card' + (unlocked ? '' : ' locked'));
        c.innerHTML = '<div class="head"><span class="ico tint-ghost" aria-hidden="true">' + EZ.glyph(unlocked ? def.glyph : 'lock') + '</span><div><h3>' + esc(unlocked ? def.name : 'A shade not yet called') + '</h3>' +
          '<div class="hint" style="margin:0">' + esc(unlocked ? def.desc : 'Unlocks at: ' + def.unlockText) + '</div></div>' +
          (unlocked ? '<button type="button" class="toggle" aria-label="Switch ' + esc(def.name) + ' on or off"></button>' : '') + '</div>';
        if (unlocked) {
          const tg = $('.toggle', c);
          tg.addEventListener('click', () => {
            const sh = (S.shades[def.id] = S.shades[def.id] || {});
            sh.on = !sh.on;
          });
          for (const f of def.fields) {
            const row = h('label', 'field');
            const fid = 'shade-' + def.id + '-' + f.key;
            row.innerHTML = '<span>' + esc(f.label) + '</span><input type="number" min="0" step="any" id="' + fid + '">';
            const inp = $('input', row);
            inp.value = EZ.shadeVal(S, def.id, f.key);
            inp.addEventListener('change', () => {
              const v = Number(inp.value);
              const sh = (S.shades[def.id] = S.shades[def.id] || { on: false });
              sh[f.key] = isFinite(v) && v >= 0 ? v : f.def;
              inp.value = sh[f.key];
            });
            c.appendChild(row);
          }
          cards.push({ def, c, tg });
        }
        wrap.appendChild(c);
      }
    }
    return {
      update() {
        const k = D().shades.map((d) => (d.unlock(S) ? 1 : 0)).join('');
        if (k !== key) { key = k; build(); }
        for (const { def, c, tg } of cards) {
          const on = !!(S.shades[def.id] && S.shades[def.id].on);
          tg.setAttribute('aria-pressed', String(on));
          c.classList.toggle('on', on);
        }
      },
    };
  }

  /* ---------- Grimoire ---------- */
  function buildGrimoire(view) {
    view.innerHTML = '<div class="panel-head"><h2>Grimoire of the Child</h2><span class="label num" id="wTxt"></span></div>' +
      '<p class="intro">The Child teaches you its prayers. They are all about burning. Each costs Wrath, which slowly returns.</p>' +
      '<div style="margin-bottom:12px">' + bar('night tall') + '</div><div class="items" id="spList"></div>';
    const list = $('#spList', view);
    const rows = D().spells.map((sp) => {
      const el = h('div', 'spell');
      el.innerHTML = '<button type="button" class="ico tint-blood" aria-label="Cast ' + esc(sp.name) + '">' + EZ.glyph(sp.glyph) + '</button>' +
        '<div class="body"><div class="name" style="font-family:var(--f-display);font-size:1.15rem">' + esc(sp.name) + '</div><div class="desc" style="font-size:var(--step--1)">' + esc(sp.desc) + '</div>' +
        '<div class="cd num"></div></div><button type="button" class="btn hot">Cast</button>';
      const ico = $('.ico', el), btn = $('.btn', el);
      const cast = () => { if (EZ.cast(S, sp.id)) { flash(ico); EZ.calc(S); UI.update(); } };
      ico.addEventListener('click', cast);
      ico.addEventListener('contextmenu', (e) => { e.preventDefault(); cast(); });
      btn.addEventListener('click', cast);
      list.appendChild(el);
      return { sp, el, btn, cd: $('.cd', el) };
    });
    return {
      update() {
        setText($('#wTxt', view), 'Wrath ' + Math.floor(S.wrath) + ' / ' + EZ.wrathMax(S));
        setBar($('.bar', view), S.wrath / EZ.wrathMax(S));
        for (const r of rows) {
          const cd = S.cds[r.sp.id] || 0, ok = cd <= 0 && S.wrath >= r.sp.cost;
          r.el.classList.toggle('can', ok);
          r.btn.disabled = !ok;
          setText(r.cd, 'Costs ' + r.sp.cost + ' Wrath · ' + (cd > 0 ? 'returns in ' + EZ.fmtTime(cd) : 'ready') + ' · cooldown ' + EZ.fmtTime(r.sp.cd));
        }
      },
    };
  }

  /* ---------- Time War ---------- */
  function buildTimeWar(view) {
    view.innerHTML = '<div class="panel-head"><h2>The Time War</h2><span class="label">Artron <b class="num" id="twA" style="color:var(--t-time)"></b></span></div>' +
      '<p class="intro">Rassilon’s war rages across every when. Drive taps into it and Artron bleeds out. Each front builds the one below it. Artron held also feeds your embers, and a quadrillion of it is enough to burn a timeline.</p>' +
      '<p class="hint num" id="twRate"></p>' + ICON_HINT +
      '<div class="items" id="twList"></div><div class="section"><div class="cards" id="twRoar"></div></div>';
    const fronts = ItemList($('#twList', view), () => D().fronts, {
      lvText: (d) => ' · ' + fmt(S.fronts.n[d.idx]) + ' strong (' + S.fronts.b[d.idx] + ' bought)',
    });
    const roar = ItemList($('#twRoar', view), () => [D().roar], {});
    return {
      update() {
        fronts.update(); roar.update();
        setText($('#twA', view), fmt(S.artron));
        setText($('#twRate', view), fmt(S.fronts.n[0] * EZ.frontProd(S, 0)) + ' Artron per second · Artron multiplier ' + EZ.fmtMult(EZ.artronMult(S)));
      },
    };
  }

  /* ---------- Burnt Timelines (challenges) + Paradox gifts ---------- */
  function buildTimelines(view) {
    view.innerHTML = '<div class="panel-head"><h2>Burnt Timelines</h2><span class="label">Paradox <b class="num" id="pxA" style="color:var(--t-paradox)"></b></span></div>' +
      '<p class="intro">Each episode of the Time War Chronicles can be relived in a burning timeline. Entering one restarts your current Title under its rule. Reach the goal, then complete it to keep its reward forever.</p>' +
      '<div id="chalActive"></div><div class="split" id="chList"></div>' +
      '<div class="section"><h3>Gifts of Paradox</h3>' + ICON_HINT + '<div class="cards" id="pxList"></div></div>';
    const chList = $('#chList', view);
    const cards = D().chals.map((c) => {
      const el = h('div', 'chal');
      el.innerHTML = '<span class="ico tint-paradox" aria-hidden="true">' + EZ.glyph(c.glyph) + '</span>' +
        '<div class="row" style="justify-content:space-between"><h3>' + esc(c.name) + '</h3><span class="badge"></span></div>' +
        '<div class="rule">' + esc(c.rule) + '</div><div class="goal">Goal: <b>' + esc(c.goalText) + '</b><br>Reward: <b>' + esc(c.reward) + '</b></div>' +
        '<div style="grid-column:2"><button type="button" class="btn">Enter this timeline</button></div>';
      const btn = $('.btn', el);
      btn.addEventListener('click', () => {
        UI.confirm('Enter “' + c.name + '”?', '<p>' + esc(c.rule) + '</p><p>This restarts your current Title cycle: embers, Kindlings, Ash, the Ashen Tree and Skull Sigils. Goal: ' + esc(c.goalText) + '</p>',
          'Enter the timeline', () => { EZ.enterChal(S, c.id); EZ.calc(S); UI.update(); });
      });
      chList.appendChild(el);
      return { c, el, btn, badge: $('.badge', el) };
    });
    const act = $('#chalActive', view);
    const px = ItemList($('#pxList', view), () => D().shop3, {});
    return {
      update() {
        setText($('#pxA', view), fmt(S.paradox));
        for (const k of cards) {
          const done = !!S.chalDone[k.c.id], active = S.chal === k.c.id;
          k.el.classList.toggle('done', done);
          k.el.classList.toggle('active', active);
          setText(k.badge, active ? 'burning' : done ? 'complete' : 'unburnt');
          k.badge.style.color = active ? 'var(--flame)' : done ? 'var(--t-paradox)' : 'var(--ash)';
          k.btn.hidden = !!S.chal;
        }
        if (S.chal) {
          const c = D().chals.find((x) => x.id === S.chal), met = c.goal(S);
          setHTML(act, '<div class="tier ready" style="margin-bottom:12px"><div class="th"><span class="tn">Burning: ' + esc(c.name) + '</span></div>' +
            '<div class="req">' + esc(c.rule) + '</div><div class="gain">Goal: ' + esc(c.goalText) + (met ? ' <b style="color:var(--t-paradox)">Met.</b>' : '') + '</div>' +
            '<div class="row"><button type="button" class="btn hot" id="chalDone"' + (met ? '' : ' disabled') + '>Complete the timeline</button><button type="button" class="btn danger" id="chalQuit">Abandon</button></div></div>');
          const d1 = $('#chalDone', act), d2 = $('#chalQuit', act);
          if (d1 && !d1._b) { d1._b = 1; d1.addEventListener('click', () => { EZ.leaveChal(S); EZ.calc(S); UI.update(); }); }
          if (d2 && !d2._b) { d2._b = 1; d2.addEventListener('click', () => UI.confirm('Abandon this timeline?', '<p>You keep nothing from it, and your Title cycle restarts.</p>', 'Abandon', () => { EZ.leaveChal(S); UI.update(); })); }
        } else setHTML(act, '');
        px.update();
      },
    };
  }

  /* ---------- Heaven's Gate (siege) ---------- */
  function buildGate(view) {
    view.innerHTML = '<div class="panel-head"><h2>The Siege of Heaven’s Gate</h2><span class="label">Grace <b class="num" id="gGr" style="color:var(--t-grace)"></b></span></div>' +
      '<p class="intro">Moriarty’s plan was always this: use the Time War to break Heaven’s Gate, and use its power to cut into the cage. Every choir of angels you break gives up its Grace. A hundred Grace is enough to cut.</p>' +
      '<div class="tier"><div class="th"><span class="tn" id="gChoir"></span></div>' + bar('cool tall') + '<div class="req num" id="gWard"></div><div class="gain num" id="gDps"></div></div>' +
      '<div class="section"><h3>Siege Engines</h3>' + ICON_HINT + '<div class="cards" id="enList"></div></div>';
    const en = ItemList($('#enList', view), () => D().engines, {});
    return {
      update() {
        const sg = S.siege, c = sg.choir;
        setText($('#gGr', view), fmt(S.grace));
        setText($('#gChoir', view), (c < D().choirs.length ? D().choirs[c] : 'Heaven’s Gate, echo ' + (c - D().choirs.length + 2)) + ' · choir ' + (c + 1) + ' (worth ' + fmt((c + 1) * Math.pow(2, L(S, 'shop4', 'theft'))) + ' Grace)');
        const max = EZ.wardMax(c), ward = sg.ward < 0 ? max : sg.ward;
        setBar($('.tier .bar', view), ward / max);
        const dps = EZ.siegeDps(S), reg = EZ.wardRegen(S, c), net = dps - reg;
        setText($('#gWard', view), 'Ward ' + fmt(ward) + ' / ' + fmt(max) + ' · it heals ' + fmt(reg) + '/s');
        setText($('#gDps', view), dps <= 0 ? 'Build a Breach Ram to begin the siege.' :
          'Your siege deals ' + fmt(dps) + '/s · ' + (net > 0 ? 'breaks in ' + EZ.fmtTime(ward / net) : 'not enough to outpace the hymns') + ' · deepest choir broken: ' + sg.bestChoir);
        en.update();
      },
    };
  }

  /* ---------- Lumen Cascade (hunt) + Nightmare gifts ---------- */
  function buildCascade(view) {
    view.innerHTML = '<div class="panel-head"><h2>The Lumen Cascade</h2><span class="label">Nightmare <b class="num" id="nmA" style="color:var(--t-night)"></b></span></div>' +
      '<p class="intro">The Man on the Moon saw an echo of the Nightmare Child and built the Lumen Cascade to stop it. Its members were chosen carefully. The Shade of Moriarty hunts them one by one. When every light is out, the Door can be opened.</p>' +
      '<div class="tier"><div class="th"><span class="tn" id="hT"></span></div>' + bar('cool tall') + '<div class="req num" id="hP"></div><div class="flav dim" id="hF" style="font-style:italic;font-size:var(--step--1)"></div></div>' +
      '<ol class="ladder" id="hList" style="margin:12px 0 0;padding:0"></ol>' +
      '<div class="section"><h3>Gifts of the Nightmare</h3>' + ICON_HINT + '<div class="cards" id="nmList"></div></div>';
    const nm = ItemList($('#nmList', view), () => D().shop4, {});
    return {
      update() {
        const d = D().lumen, i = S.lumen, pw = EZ.huntPower(S);
        setText($('#nmA', view), fmt(S.nightmare));
        if (i < d.length) {
          setText($('#hT', view), 'Hunting ' + d[i].name);
          setBar($('.tier .bar', view), S.hunt.progress / d[i].light);
          setText($('#hP', view), 'Light remaining ' + fmt(d[i].light - S.hunt.progress) + ' · hunting power ' + fmt(pw) + '/s · ' + EZ.fmtTime((d[i].light - S.hunt.progress) / pw));
          setText($('#hF', view), d[i].flav);
        } else {
          setText($('#hT', view), 'The Cascade is dark');
          setBar($('.tier .bar', view), 1);
          setText($('#hP', view), 'Every light is out. Open the Door.');
          setText($('#hF', view), '');
        }
        setHTML($('#hList', view), d.map((t, k) => '<li class="' + (k < i ? 'past' : k === i ? 'here' : '') + '"><span class="rn">' + EZ.roman(k + 1) + '</span><span>' +
          (k < i ? '<s>' + esc(t.name) + '</s> · extinguished. ' : esc(t.name) + ' · ') + esc(t.boon) + '</span></li>').join(''));
        nm.update();
      },
    };
  }

  /* ---------- Omens, the Hierarchy, the ledger ---------- */
  function buildOmens(view) {
    view.innerHTML = '<div class="panel-head"><h2>Omens</h2><span class="label num" id="omC"></span></div>' +
      '<p class="intro">Signs that the universe has noticed you. Each Omen adds 2% to ember production.</p><div class="omens" id="omGrid"></div>' +
      '<div class="section split"><div><h3>The Power Hierarchy</h3><p class="hint">Each rank you climb multiplies embers by 1.15.</p><ol class="ladder" id="lad"></ol></div>' +
      '<div><h3>The Ledger of Fire</h3><p class="hint">Everything multiplying your embers right now.</p><table class="ledger" id="ledg"></table><h3 style="margin-top:14px">Records</h3><dl class="kv" id="stats"></dl></div></div>';
    const grid = $('#omGrid', view);
    const tiles = D().omens.map((o) => {
      const t = h('div', 'omen', EZ.glyph(o.glyph));
      t.setAttribute('role', 'img');
      grid.appendChild(t);
      return { o, t };
    });
    return {
      update() {
        let got = 0;
        for (const { o, t } of tiles) {
          const g = !!S.omens[o.id];
          if (g) got++;
          if (t._g !== g) { t._g = g; t.classList.toggle('got', g); t.title = (g ? o.name + ' — ' : 'Unseen omen — ') + o.desc; t.setAttribute('aria-label', t.title); }
        }
        setText($('#omC', view), got + ' of ' + tiles.length + ' · +' + got * 2 + '% embers');
        const r = D().ranks;
        setHTML($('#lad', view), r.map((x, i) => '<li class="' + (i === S.rank ? 'here' : i < S.rank ? 'past' : '') + '"><span class="rn">' + EZ.roman(x.n) + '</span><span>' + esc(x.name) +
          (i === S.rank + 1 ? '<br><span class="dim">Next: ' + esc(x.need) + '</span>' : '') + '</span></li>').join(''));
        setHTML($('#ledg', view), '<tr><td>Kindlings (raw)</td><td>' + fmt(EZ.C.raw) + '/s</td></tr>' +
          EZ.C.mults.map(([n, v]) => '<tr><td>' + esc(n) + '</td><td>' + EZ.fmtMult(v) + '</td></tr>').join('') +
          '<tr><td><b>Total</b></td><td>' + fmt(EZ.C.eps) + '/s</td></tr>');
        const st = [['Time in the dark', EZ.fmtTime(S.playTime)], ['This life', EZ.fmtTime(S.lifeTime)], ['Embers, all time', fmt(S.embersTotal)],
          ['Stokes', EZ.fmtInt(S.stokesTotal)], ['Whispers answered', S.whisper.clicked], ['Regenerations', S.regensTotal], ['Titles claimed', S.titlesTotal],
          ['Timelines burnt', S.burnsTotal], ['Cuts of the Cage', S.cutsTotal], ['Cataclysms', S.cataclysms]];
        setHTML($('#stats', view), st.map(([k, v]) => '<dt>' + k + '</dt><dd>' + v + '</dd>').join(''));
      },
    };
  }

  /* ---------- Settings ---------- */
  function buildSettings(view) {
    view.innerHTML = '<div class="panel-head"><h2>Settings</h2></div>' +
      '<div class="split"><div style="display:grid;gap:10px;align-content:start">' +
      '<label class="field"><span>Number style</span><select id="setNot"><option value="suffix">1.23 M</option><option value="sci">1.23e6</option></select></label>' +
      '<div class="field"><span>Falling ash and embers</span><button type="button" class="toggle" id="setFx" aria-label="Particles"></button></div>' +
      '<div class="field"><span>Confirm before ascending</span><button type="button" class="toggle" id="setConf" aria-label="Confirm before ascending"></button></div>' +
      '<p class="hint num" id="setOff"></p>' +
      '<div class="row"><button type="button" class="btn" id="setSave">Save now</button><span class="hint" id="setSaved" style="margin:0"></span></div>' +
      '<div class="row"><button type="button" class="btn danger" id="setWipe">Erase everything…</button></div></div>' +
      '<div style="display:grid;gap:8px;align-content:start"><h3>Carry your fire elsewhere</h3><p class="hint">Copy this text to keep a backup or move your game. Paste a saved text below and load it.</p>' +
      '<textarea class="save" id="setExp" readonly aria-label="Your save as text"></textarea><div class="row"><button type="button" class="btn" id="setCopy">Copy save text</button></div>' +
      '<textarea class="save" id="setImp" placeholder="Paste a save here" aria-label="Paste a save to load"></textarea><div class="row"><button type="button" class="btn" id="setLoad">Load pasted save</button></div></div></div>' +
      (location.hash === '#dev' ? '<div class="section"><h3>Test tools</h3><p class="hint">Simulates time passing at full speed (the bot does not buy anything).</p><div class="row" id="devRow"></div></div>' : '');
    const not = $('#setNot', view);
    not.value = S.settings.notation;
    not.addEventListener('change', () => { S.settings.notation = not.value; EZ.notation = not.value; });
    $('#setFx', view).addEventListener('click', () => { S.settings.particles = !S.settings.particles; EZ.FX.setEnabled(S.settings.particles); });
    $('#setConf', view).addEventListener('click', () => { S.settings.confirm = !S.settings.confirm; });
    $('#setSave', view).addEventListener('click', () => { const ok = EZ.save(S); setText($('#setSaved', view), ok ? 'Saved.' : 'This browser would not let the page save. Use the save text instead.'); });
    $('#setWipe', view).addEventListener('click', () => UI.confirm('Erase everything?', '<p>Every ember, title, timeline and omen will be gone. This cannot be undone. Copy your save text first if you might want it back.</p>',
      'Erase it all', () => { EZ.wipe(); UI.boot(EZ.newState()); }));
    const exp = $('#setExp', view);
    exp.value = EZ.exportSave(S);
    $('#setCopy', view).addEventListener('click', () => {
      exp.value = EZ.exportSave(S);
      const done = () => UI.toast('Save text copied.');
      try { navigator.clipboard.writeText(exp.value).then(done, () => { exp.select(); UI.toast('Select the text and copy it yourself (Ctrl/Cmd + C).'); }); }
      catch (e) { exp.select(); }
    });
    $('#setLoad', view).addEventListener('click', () => {
      const txt = $('#setImp', view).value;
      try {
        const st = EZ.importSave(txt);
        UI.confirm('Load this save?', '<p>Your current game will be replaced.</p>', 'Load it', () => { UI.boot(st); EZ.save(st); UI.toast('Save loaded.'); });
      } catch (e) { UI.toast('That text is not a save from this game. Check you copied all of it.'); }
    });
    const dev = $('#devRow', view);
    if (dev) {
      [[60, '+1 minute'], [600, '+10 minutes'], [3600, '+1 hour'], [8 * 3600, '+8 hours']].forEach(([sec, lbl]) => {
        const b = h('button', 'btn', lbl);
        b.type = 'button';
        b.addEventListener('click', () => { EZ.simulate(S, sec, 1); EZ.calc(S); UI.update(); });
        dev.appendChild(b);
      });
      const b = h('button', 'btn', '×1000 embers');
      b.type = 'button';
      b.addEventListener('click', () => { S.embers = Math.max(1e3, S.embers * 1000); });
      dev.appendChild(b);
    }
    return {
      update() {
        $('#setFx', view).setAttribute('aria-pressed', String(!!S.settings.particles));
        $('#setConf', view).setAttribute('aria-pressed', String(!!S.settings.confirm));
        setText($('#setOff', view), 'Progress continues while the page is closed, at ' + EZ.fmtPct(EZ.offlineEff(S)) + ' speed (the Ashen Tree can raise this). The game saves itself every 30 seconds.');
      },
    };
  }

  /* ================= ascension ladder ================= */
  const TIERS = [
    { id: 'regen', n: 'I', name: 'Regenerate', show: (s) => EZ.has.regen(s), veil: 'This body is burning down.',
      req: (s) => [logFrac(s.embersLife, D().REQ.regen), fmt(s.embersLife) + ' / ' + fmt(D().REQ.regen) + ' embers this life'],
      gain: (s) => '+' + fmt(EZ.ashGain(s)) + ' Ash', can: (s) => EZ.canRegen(s), act: (s) => EZ.regenerate(s),
      resets: 'Resets embers, Kindlings, Rites, ghosts and the Tournament.',
      note: (s) => (EZ.canRegen(s) && EZ.ashGain(s) < 1 ? 'Ash is paid on embers earned across the whole Title, minus what you already took. Burn longer for more.' : '') },
    { id: 'title', n: 'II', name: 'Claim the Title', show: (s) => EZ.has.tourney(s) || s.titlesTotal > 0, veil: 'Somewhere, a court of skulls is gathering.',
      req: (s) => [s.sigils / D().REQ.title, fmt(s.sigils) + ' / ' + D().REQ.title + ' Skull Sigils'],
      gain: (s) => '+' + fmt(EZ.sliverGain(s)) + ' Slivers', can: (s) => EZ.canTitle(s), act: (s) => EZ.claimTitle(s),
      resets: 'Also resets Ash, the Ashen Tree (unlocks stay) and Skull Sigils.',
      note: (s) => (s.chal ? 'Not while a timeline burns.' : s.sigils >= D().REQ.title && EZ.sliverGain(s) < 1 ? 'Beat deeper champions: Slivers pay for new heights only.' : '') },
    { id: 'burn', n: 'III', name: 'Burn a Timeline', show: (s) => EZ.has.timewar(s), veil: 'The Time War is not yours to touch. Yet.',
      req: (s) => [logFrac(s.artron, D().REQ.burn), fmt(s.artron) + ' / ' + fmt(D().REQ.burn) + ' Artron'],
      gain: (s) => '+' + fmt(EZ.paradoxGain(s)) + ' Paradox', can: (s) => EZ.canBurn(s), act: (s) => EZ.burn(s),
      resets: 'Also resets Slivers, their Gifts and the Time War.',
      note: (s) => (s.chal ? 'Not while a timeline burns.' : s.artron >= D().REQ.burn && EZ.paradoxGain(s) < 1 ? 'Paradox pays only for more Artron than your last burning held.' : '') },
    { id: 'cut', n: 'IV', name: 'Cut the Cage', show: (s) => EZ.has.siege(s), veil: 'Behind the gate, a cage. Behind the cage, a child.',
      req: (s) => [s.grace / D().REQ.cut, fmt(s.grace) + ' / ' + D().REQ.cut + ' Grace'],
      gain: (s) => '+' + fmt(EZ.nightmareGain(s)) + ' Nightmare', can: (s) => EZ.canCut(s), act: (s) => EZ.cut(s),
      resets: 'Also resets Paradox, its Gifts (unlocks stay), the siege and Grace.',
      note: (s) => (s.chal ? 'Not while a timeline burns.' : s.grace >= D().REQ.cut && EZ.nightmareGain(s) < 1 ? 'Nightmare pays only for more Grace than your last cut.' : '') },
    { id: 'door', n: 'V', name: 'Open the Door', show: (s) => EZ.has.hunt(s), veil: 'Seven lights stand between you and the Door.',
      req: (s) => [s.lumen / D().REQ.door, s.lumen + ' / ' + D().REQ.door + ' of the Lumen Cascade extinguished'],
      gain: () => 'A Child’s Cataclysm', can: (s) => EZ.canDoor(s), act: (s) => EZ.openDoor(s),
      resets: 'Resets everything except Omens, your rank, Shades and completed timelines. Every cataclysm multiplies embers by 1,000.',
      note: () => '' },
  ];

  let ascKey = '';
  const ascCards = [];
  function renderAscend() {
    const col = $('#ascend');
    const vis = [];
    for (const t of TIERS) { if (t.show(S)) vis.push(t); else { vis.push(Object.assign({ veiled: true }, t)); break; } }
    const k = vis.map((t) => t.id + (t.veiled ? '?' : '')).join('|');
    if (k !== ascKey) {
      ascKey = k;
      col.innerHTML = '<div class="panel-head" style="margin:0"><h2 style="font-family:var(--f-display);font-weight:500;margin:0">Ascension</h2></div>';
      ascCards.length = 0;
      for (const t of vis) {
        const el = h('div', 'tier' + (t.veiled ? ' veiled' : ''));
        if (t.veiled) {
          el.innerHTML = '<div class="th"><span class="num">' + t.n + '</span><span class="tn">' + esc(t.veil) + '</span></div>';
        } else {
          el.innerHTML = '<div class="th"><span class="num">' + t.n + '</span><span class="tn">' + esc(t.name) + '</span></div>' + bar('tall') +
            '<div class="req"></div><div class="gain"></div><div class="resets">' + esc(t.resets) + '</div><div class="resets note"></div>' +
            '<button type="button" class="btn hot big">' + esc(t.name) + '</button>';
          const btn = $('.btn', el);
          btn.addEventListener('click', () => ascendClick(t));
          ascCards.push({ t, el, btn, req: $('.req', el), gain: $('.gain', el), bar: $('.bar', el), note: $('.note', el) });
        }
        col.appendChild(el);
      }
    }
    for (const c of ascCards) {
      const [f, txt] = c.t.req(S);
      const can = c.t.can(S);
      setBar(c.bar, f);
      setText(c.req, txt);
      setText(c.gain, can ? 'You will gain ' + c.t.gain(S) : 'Gain when ready: ' + c.t.gain(S));
      setText(c.note, c.t.note(S));
      c.btn.disabled = !can;
      c.el.classList.toggle('ready', can);
    }
  }

  function ascendClick(t) {
    if (!t.can(S)) return;
    const go = () => {
      const wasDoor = t.id === 'door';
      t.act(S);
      EZ.calc(S);
      if (wasDoor) UI.ending();
      UI.update();
      EZ.save(S);
    };
    if (S.settings.confirm) UI.confirm(t.name + '?', '<p>You will gain <b>' + esc(t.gain(S)) + '</b>.</p><p class="dim">' + esc(t.resets) + '</p>', t.name, go);
    else go();
  }

  /* ================= top bar, hearth, whispers ================= */
  const PURSE = [
    ['embers', 'Embers', 'var(--t-ember)', () => true],
    ['ash', 'Ash', 'var(--t-ash)', (s) => s.regensTotal > 0],
    ['sigils', 'Sigils', 'var(--t-bone)', (s) => EZ.has.tourney(s) || s.titlesTotal > 0],
    ['slivers', 'Slivers', 'var(--t-sliver)', (s) => s.titlesTotal > 0],
    ['artron', 'Artron', 'var(--t-time)', (s) => EZ.has.timewar(s)],
    ['paradox', 'Paradox', 'var(--t-paradox)', (s) => s.burnsTotal > 0],
    ['grace', 'Grace', 'var(--t-grace)', (s) => EZ.has.siege(s)],
    ['nightmare', 'Nightmare', 'var(--t-night)', (s) => s.cutsTotal > 0],
    ['lumen', 'Lights out', 'var(--t-lumen)', (s) => EZ.has.hunt(s)],
  ];
  let purseKey = '';
  function renderTop() {
    const vis = PURSE.filter((p) => p[3](S));
    const k = vis.map((p) => p[0]).join('|');
    const purse = $('#purse');
    if (k !== purseKey) {
      purseKey = k;
      purse.innerHTML = vis.map((p) => '<span class="chip" style="--c:' + p[2] + '"><span class="k">' + p[1] + '</span><span class="v" data-k="' + p[0] + '"></span></span>').join('');
    }
    purse.querySelectorAll('.v').forEach((v) => setText(v, v.dataset.k === 'lumen' ? S.lumen + ' / 7' : fmt(S[v.dataset.k])));
    const r = D().ranks[S.rank];
    setHTML($('#rank'), 'Rank <b>' + EZ.roman(r.n) + '</b> · ' + esc(r.name));
  }

  function renderHearth() {
    setText($('#emAmt'), fmt(S.embers));
    setHTML($('#emRate'), '<b>' + fmt(EZ.C.eps) + '</b> per second · <b>' + fmt(EZ.C.click) + '</b> per stoke' +
      (EZ.C.autoStoke ? ' · stoked ' + EZ.C.autoStoke + '×/s for you' : ''));
    const eye = $('#eye');
    eye.classList.toggle('locked', S.chal === 'glass');
    setText($('#stokeLbl'), S.chal === 'glass' ? 'the glass is cracked. you cannot stoke.' : S.stokesTotal ? 'stoke the ember' : 'the ember is cold. stoke it.');
    setHTML($('#buffs'), S.buffs.map((b) => '<span class="buff">' + esc(b.name) + ' ' + EZ.fmtMult(b.mult) + ' · ' + Math.ceil(b.t) + 's</span>').join('') +
      (S.chal ? '<span class="buff" style="border-color:var(--t-paradox);color:var(--t-paradox)">Burning timeline</span>' : ''));
    // whispers
    const w = S.whisper.active, wb = $('#whisper');
    if (w && wb.hidden) {
      wb.style.left = (w.x * 100).toFixed(1) + 'vw';
      wb.style.top = (w.y * 100).toFixed(1) + 'vh';
      wb.hidden = false;
      wb.classList.remove('fading');
    } else if (!w && !wb.hidden) wb.hidden = true;
    if (w) wb.classList.toggle('fading', w.ttl < 3);
  }

  let lastLog = null;
  function renderLog() {
    const logEl = $('#log');
    const newest = S.log[S.log.length - 1] || null;
    if (newest === lastLog) return;
    lastLog = newest;
    const items = S.log.slice(-40).reverse();
    logEl.innerHTML = '';
    for (const e of items) {
      const p = h('p', e.cls || '');
      p.textContent = e.text;
      p._t = e.t;
      logEl.appendChild(p);
    }
  }

  function stage() {
    const showBoard = S.flags.board || S.embersTotal >= 10 || S.regensTotal > 0;
    if (showBoard) S.flags.board = 1;
    const showAsc = EZ.has.regen(S) || S.regensTotal > 0;
    $('#board').hidden = !showBoard;
    $('#ascend').hidden = !showAsc;
    const g = $('#grid');
    g.classList.toggle('solo', !showBoard);
    g.classList.toggle('noasc', showBoard && !showAsc);
  }

  /* ================= public ================= */
  UI.update = function () {
    if (!S) return;
    stage();
    renderTop();
    renderHearth();
    renderLog();
    if (!$('#board').hidden) {
      renderTabs();
      if (currentView && currentView.update) currentView.update();
    }
    if (!$('#ascend').hidden) renderAscend();
  };

  UI.toast = function (html, ms) {
    const t = h('div', 'toast', html);
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), ms || 4200);
  };

  UI.modal = function (html, actions) {
    const m = $('#modal'), box = $('#modalBox');
    box.innerHTML = html + '<div class="actions"></div>';
    const act = $('.actions', box);
    (actions || [{ label: 'Close' }]).forEach((a, i) => {
      const b = h('button', 'btn ' + (a.cls || (i === 0 ? 'hot' : '')), esc(a.label));
      b.type = 'button';
      b.addEventListener('click', () => { UI.closeModal(); if (a.fn) a.fn(); });
      act.appendChild(b);
    });
    m.hidden = false;
    const first = $('button', act);
    if (first) first.focus();
  };
  UI.closeModal = function () { $('#modal').hidden = true; };
  UI.confirm = function (title, body, okLabel, fn) {
    UI.modal('<h2>' + esc(title) + '</h2>' + body, [{ label: okLabel, cls: 'hot', fn }, { label: 'Not yet', cls: '' }]);
  };

  UI.ending = function () {
    const lines = [
      'the disc turns.',
      'the eclipse point opens like an eye, and the door is simply there, as it always was.',
      'the lumen cascade is dark. the man on the moon is dark. there is no one left to say no.',
      'you open the door.',
      'a child steps out. it is very small. it looks at the universe its brother’s knife made possible, and it hates it, and it begins.',
      'somewhere a judge bangs a gavel made of skull, and no one hears it.',
      'the title was never yours. you were never the eze’rhi’el. you were the hinge the door swung on.',
      'and now the fire has nowhere left to go but everywhere.',
      ' ',
      'the dark is cold, and very old.',
      'an ember catches.',
    ];
    UI.modal('<h2>A Child’s Cataclysm</h2><div class="ending">' + lines.map((l) => '<p>' + esc(l) + '</p>').join('') + '</div>' +
      '<p class="dim">Cataclysm ' + S.cataclysms + '. Everything burns and begins again, with embers ×' + fmt(Math.pow(1000, S.cataclysms)) + '. Your Omens, rank, Shades and completed timelines remain.</p>',
    [{ label: 'Stoke the ember' }]);
  };

  UI.whisperClick = function () {
    const msg = EZ.clickWhisper(S);
    if (msg) {
      const wb = $('#whisper');
      const r = wb.getBoundingClientRect();
      EZ.FX.burst(r.left + r.width / 2, r.top + r.height / 2, 24);
      UI.toast('<b>The Child whispers.</b><br>' + esc(msg));
    }
    $('#whisper').hidden = true;
    EZ.calc(S);
    UI.update();
  };

  UI.stokeAt = function (x, y) {
    const v = EZ.stoke(S, 1);
    if (!v) return;
    EZ.FX.burst(x, y, 8);
    const f = h('div', 'floater', '+' + esc(fmt(v)));
    f.style.left = x - 20 + (Math.random() * 30 - 15) + 'px';
    f.style.top = y - 30 + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  };

  UI.boot = function (state) {
    S = state;
    EZ.notation = S.settings.notation;
    EZ.FX.setEnabled(S.settings.particles);
    tabKey = ''; ascKey = ''; purseKey = ''; lastLog = null; current = null;
    EZ.calc(S);
    UI.update();
    selectTab(S.flags.tab && TABS.find((t) => t.id === S.flags.tab && t.show(S)) ? S.flags.tab : 'kindling');
    UI.update();
    UI.state = S;
    if (UI.onBoot) UI.onBoot(S);
  };
  UI.get = () => S;
})(typeof window !== 'undefined' ? window : globalThis);
