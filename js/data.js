/* The Eze'Rhi'El — content definitions.
 * Lore source: the DRPG (Act 1/Act 2, Journey to the Cataclysm, The Lumen Cascade,
 * the Power Hierarchy, the Time War Chronicles). */
(function (root) {
  'use strict';
  const EZ = (root.EZ = root.EZ || {});
  const L = (s, store, id) => EZ.L(s, store, id);
  const fmt = (n) => EZ.fmt(n);

  /* ---------- helpers that build purchasable definitions ---------- */
  function leveled(store, cur, tint, o) {
    const d = Object.assign({ store, cur, tint, max: Infinity, growth: 1 }, o);
    if (!d.level) d.level = (s) => L(s, store, d.id);
    if (!d.cost) d.cost = (s, l) => d.base * Math.pow(d.growth, l);
    return d;
  }

  /* ---------- Tier 0: Kindlings (generators) ---------- */
  const gens = [
    { id: 'thought', name: 'Smouldering Thought', glyph: 'brain', base: 15, prod: 0.1,
      flav: 'A thought that will not go out. It speaks in your voice, only slower.' },
    { id: 'whisper', name: 'Whisper Through the Crack', glyph: 'whisper', base: 100, prod: 1,
      flav: 'Something caged is talking. Only you lean close enough to listen.' },
    { id: 'acolyte', name: 'Ash-Mouthed Acolyte', glyph: 'hood', base: 1100, prod: 8,
      flav: 'They preach of a Child that hates the universe, and of the one it will choose.' },
    { id: 'ghost', name: 'Ghost of the Army', glyph: 'ghost', base: 12000, prod: 47,
      flav: 'Ghosts cannot exist in the universe. These ones are rehearsing anyway.' },
    { id: 'rendition', name: 'Fire-Eyed Rendition', glyph: 'firestare', base: 130000, prod: 260,
      flav: 'Servus Tate was one of the first renditions. Each one burns a little brighter.' },
    { id: 'indoviea', name: 'Pyre of Indoviea', glyph: 'pyre', base: 1.4e6, prod: 1400,
      flav: 'The first great civilised empire after the dark ages. It made very good kindling.' },
    { id: 'gallifrey', name: 'The Burning of Gallifrey', glyph: 'planet', base: 2e7, prod: 7800,
      flav: 'Twice now, by the hands of Fire Eyes. The Doctor still counts the dead.' },
    { id: 'forge', name: 'Hellfire Forge', glyph: 'anvil', base: 3.3e8, prod: 44000,
      flav: 'Lucifer was banished to a sphere of fire. You merely rent it by the hour.' },
    { id: 'eclipse', name: 'Eclipse Point', glyph: 'eclipse', base: 5.1e9, prod: 260000,
      flav: 'Where the Disc is turned, the light goes out. You have learned to stand there.' },
    { id: 'shade', name: 'Shade of the Nightmare Child', glyph: 'shade', base: 7.5e10, prod: 1.6e6,
      flav: 'Not the Child. Its shadow. Even so, the stars flinch.' },
    { id: 'court', name: 'The Corrupted Court', glyph: 'scales', base: 1e12, prod: 1e7,
      req: (s) => s.titlesTotal >= 1, reqText: 'Claim the Title once',
      flav: 'Damien was the first to rot. The rest of the Court followed, bench by bench.' },
    { id: 'cage', name: 'Crack in the Cage', glyph: 'cage', base: 1.4e13, prod: 6.5e7,
      req: (s) => s.burnsTotal >= 1, reqText: 'Burn a Timeline once',
      flav: 'The Wizard left it when he fled with his Disc. It has been widening ever since.' },
  ];
  gens.forEach((g, i) => { g.idx = i; g.tint = 'ember'; g.cur = 'embers'; g.store = 'gens'; });

  /* Each Kindling has a rite that doubles it, unlocked by owning enough of it. */
  const RITE_AT = [1, 5, 25, 50, 100, 150, 200, 250, 300, 400];
  const RITE_COST = [10, 50, 500, 5e4, 5e6, 5e8, 5e10, 5e12, 5e14, 5e17];
  const RITE_NAMES = {
    thought: ['Obsession', 'It will not go out — the smouldering thought feeds itself.'],
    whisper: ['Lean Closer', 'The voice is clearer when you stop pretending not to hear it.'],
    acolyte: ['Ash Sermons', 'Every sermon ends the same way: with something burning.'],
    ghost: ['Haunting Drills', 'The army of ghosts marches in place, waiting for a universe that will hold it.'],
    rendition: ['Kindled Disgust', 'The scepter turns its wielder into Fire Eyes. Your renditions skip the scepter.'],
    indoviea: ['Patriotic Pyres', 'They stood for the renaissance of the universe. They burn for it now.'],
    gallifrey: ['The Second Burning', 'The first time was a tragedy. The second time was a method.'],
    forge: ['Breath of Hellfire', 'Hellfire, breathed rather than thrown, finds every gap.'],
    eclipse: ['Eclipse Doctrine', 'The Disc opens the eclipse point. Eclipses can be taught.'],
    shade: ['Doppelganger', 'A temporary Shade, made a little less temporary.'],
    court: ['Order in the Court', 'The gavel falls. The sentence is always fire.'],
    cage: ['Ethereal Chains Fray', 'The Wizard\'s chains were strong. They were not forever.'],
  };
  const rites = gens.map((g) => leveled('ups', 'embers', 'flame', {
    id: 'rite_' + g.id, gen: g.id, name: RITE_NAMES[g.id][0], glyph: g.glyph, max: RITE_AT.length,
    cost: (s, l) => g.base * RITE_COST[l],
    gate: (s, l) => L(s, 'gens', g.id) >= RITE_AT[l],
    gateText: (s, l) => 'Needs ' + RITE_AT[l] + ' ' + g.name + ' owned',
    visible: (s) => L(s, 'gens', g.id) >= 1 || L(s, 'ups', 'rite_' + g.id) > 0,
    desc: (s) => g.name + ' produce ' + EZ.fmtMult(EZ.riteBase(s)) + ' per level.',
    flav: RITE_NAMES[g.id][1],
  }));
  rites.push(
    leveled('ups', 'embers', 'flame', {
      id: 'pyric', name: 'Pyric Manipulation', glyph: 'hand', base: 100, growth: 9, max: 15,
      visible: (s) => s.stokesTotal >= 5 || s.embersLife >= 50,
      desc: () => 'Each Stoke yields ×2 per level.',
      flav: 'Control fire. Not by force — by agreement.' }),
    leveled('ups', 'embers', 'flame', {
      id: 'condemned', name: 'Condemned Fate', glyph: 'flame', base: 2000, growth: 14, max: 40,
      visible: (s) => s.embersLife >= 1000 || L(s, 'ups', 'condemned') > 0,
      desc: () => 'All ember production ×1.25 per level.',
      flav: 'A hellfire blessing. It burns during, and it burns worse at the end.' }),
    leveled('ups', 'embers', 'flame', {
      id: 'untempered', name: 'Untempered Flame', glyph: 'bolt', base: 5e4, growth: 25, max: 10,
      visible: (s) => s.embersLife >= 1e4 || L(s, 'ups', 'untempered') > 0,
      desc: () => 'Each Stoke also yields 1% of your embers per second, per level.',
      flav: 'Grab the energy. Then let it go all at once.' }),
    leveled('ups', 'embers', 'flame', {
      id: 'legion', name: 'Legion', glyph: 'crown', base: 1e6, growth: 60, max: 10,
      visible: (s) => s.embersLife >= 3e5 || L(s, 'ups', 'legion') > 0,
      desc: () => 'Every Kindling gains +0.25% production per Kindling you own, per level.',
      flav: 'We are many. We are one fire.' }),
    leveled('ups', 'embers', 'flame', {
      id: 'focused', name: 'A Focused Prediction', glyph: 'eye', base: 7.77e4, growth: 40, max: 5,
      visible: (s) => s.whisper.seen > 0,
      desc: () => 'The Child whispers 12% sooner per level.',
      flav: 'Enter focus. See the eye before it opens.' }),
    leveled('ups', 'embers', 'flame', {
      id: 'migrating', name: 'Migrating Thoughts', glyph: 'whisper', base: 1.5e5, growth: 50, max: 5,
      visible: (s) => s.whisper.clicked > 0,
      desc: () => 'Whispered boons last 15% longer per level.',
      flav: 'Steal a dead thought. Keep it warm.' }),
  );

  /* ---------- Tier 1: The Ashen Tree (spends Ash) ---------- */
  const tree = [
    { id: 'hands', row: 0, name: 'Ashen Hands', glyph: 'hand', base: 1, growth: 3, max: 6,
      desc: () => 'Stokes ×3 per level.', flav: 'Your hands remember the heat of a body you no longer wear.' },
    { id: 'lungs', row: 0, name: 'Ash in the Lungs', glyph: 'smoke', base: 2, growth: 2.2, max: 40,
      desc: () => 'All ember production ×1.6 per level.', flav: 'Every breath tastes of the last life.' },
    { id: 'memory', row: 0, name: 'Ember Memory', glyph: 'ember', base: 3, growth: 2.5, max: 5,
      desc: (s, l) => 'Begin each life with ' + 10 * Math.max(1, l) + ' Smouldering Thoughts and ' + 5 * Math.max(1, l) + ' Whispers (per level).',
      flav: 'Some thoughts survive regeneration.' },
    { id: 'smoulder', row: 0, name: 'The Smoulder Remains', glyph: 'moon', base: 3, growth: 2, max: 5,
      desc: () => 'Offline progress +15% per level (base 25%).', flav: 'Even unattended, a fire keeps its promises.' },
    { id: 'crack', row: 1, name: 'Widen the Crack', glyph: 'crack', base: 3, max: 1, unlock: true,
      desc: () => 'Unlock THE CRACK: an army of ghosts that seeps through the Nightmare Child\'s cage.',
      flav: 'The Wizard fled with his Disc and left a crack behind. It is a door if you are patient.' },
    { id: 'patient', row: 1, name: 'Patient Kindling', glyph: 'candle', base: 10, growth: 4, max: 4,
      desc: () => 'Kindling prices grow 0.5% slower per level.', flav: 'Fire is cheaper when you are not in a hurry.' },
    { id: 'lean', row: 1, name: 'Lean Into the Dark', glyph: 'whisper', base: 4, growth: 3, max: 3,
      desc: () => 'The Child whispers 15% sooner per level.', flav: 'It was always talking. You were just too loud.' },
    { id: 'restless', row: 1, name: 'Restless Hands', glyph: 'hand', base: 6, growth: 2, max: 10,
      desc: () => 'Automatically Stoke once per second per level.', flav: 'Even asleep, the hands keep feeding the fire.' },
    { id: 'herald', row: 2, name: 'Herald of Skull', glyph: 'skull', base: 8, max: 1, unlock: true, req: ['crack'],
      desc: () => 'Unlock THE TOURNAMENT OF SKULL. Each champion beaten for the first time this Title pays a Skull Sigil.',
      flav: 'Damien, the Judge, needs a champion. Ghosts cannot exist in the universe — someone must carry them.' },
    { id: 'fecund', row: 2, name: 'Fecund Dark', glyph: 'ghost', base: 5, growth: 1.9, max: 15, req: ['crack'],
      desc: () => 'Ghosts gather ×1.5 faster per level.', flav: 'The dark is crowded tonight.' },
    { id: 'hollow', row: 2, name: 'Hollowed Halls', glyph: 'house', base: 5, growth: 1.9, max: 15, req: ['crack'],
      desc: () => 'Ghost capacity +30% per level.', flav: 'Empty rooms, waiting for tenants who will not breathe.' },
    { id: 'unborn', row: 2, name: 'Unborn Blood', glyph: 'drop', base: 10, growth: 2.2, max: 25, req: ['herald'],
      desc: () => 'Your squad\'s attack and health ×1.5 per level.', flav: 'An internal rift. It messes up whatever it touches.' },
    { id: 'favour', row: 3, name: 'The Judge\'s Favour', glyph: 'scales', base: 20, growth: 3, max: 6, req: ['herald'],
      desc: () => 'Champions yield ×1.25 Skull Sigils per level.', flav: 'Damien keeps score. He has started to cheat for you.' },
    { id: 'remembered', row: 3, name: 'Remembered Rites', glyph: 'book', base: 40, max: 1, unlock: true,
      desc: () => 'Keep your Kindling rites when you regenerate.', flav: 'Write it down. Regeneration is cruel to memory.' },
    { id: 'energy', row: 3, name: 'Regeneration Energy', glyph: 'spiral', base: 15, growth: 2.6, max: 20,
      desc: () => 'Ash from regeneration ×1.25 per level.', flav: 'Light pours out of every cell. Catch some of it.' },
  ].map((o) => leveled('tree', 'ash', 'ash', o));
  tree.forEach((d) => {
    d.visible = () => true;
    d.gate = (s) => !d.req || d.req.every((r) => L(s, 'tree', r) > 0);
    d.gateText = () => 'Requires ' + d.req.map((r) => tree.find((t) => t.id === r).name).join(', ');
  });

  /* ---------- Tier 1: The Crack & the Tournament (spends embers) ---------- */
  const arms = [
    { id: 'haunt', name: 'Haunts', glyph: 'house', base: 1e4, growth: 1.28,
      visible: (s) => L(s, 'tree', 'crack') > 0,
      desc: () => '+6 ghost capacity each.', flav: 'Every ruin is a home, to the right tenant.' },
    { id: 'blade', name: 'Bone Blades', glyph: 'sword', base: 2e4, growth: 1.5,
      visible: (s) => L(s, 'tree', 'herald') > 0,
      desc: () => 'Squad attack ×1.3 per level.', flav: 'Sharpened from the Court\'s leftovers.' },
    { id: 'mail', name: 'Ash Mail', glyph: 'shield', base: 2e4, growth: 1.5,
      visible: (s) => L(s, 'tree', 'herald') > 0,
      desc: () => 'Squad health ×1.3 per level.', flav: 'Ash packed so tight it remembers being armour.' },
    { id: 'scepter', name: 'Vampiric Scepter', glyph: 'drop', base: 5e6, growth: 30, max: 8,
      visible: (s) => L(s, 'tree', 'herald') > 0 && s.tourney.bestEver >= 10,
      desc: () => 'After each bout the squad heals +5% of its health per level (base 20%).', flav: 'Prolonged life, paid for by someone else.' },
    { id: 'eternal', name: 'Eternal Blade', glyph: 'sword', base: 1e7, growth: 18,
      visible: (s) => L(s, 'tree', 'herald') > 0 && s.tourney.bestEver >= 20,
      desc: () => 'Squad attack ×2 per level.', flav: 'Always a critical strike. Always.' },
    { id: 'skullward', name: 'Skull Ward', glyph: 'skull', base: 1e7, growth: 18,
      visible: (s) => L(s, 'tree', 'herald') > 0 && s.tourney.bestEver >= 20,
      desc: () => 'Squad health ×2 per level.', flav: 'Worn by the Skull Brood. Taken from the Skull Brood.' },
  ].map((o) => leveled('arms', 'embers', 'bone', o));

  const enemies = ['Twisted Arachnid', 'Skaro Mining Dalek', 'Skaro Guard Dalek', 'Securo-bot', 'Scrap-bot',
    'Headless Mimic', 'Cyber Drone', 'VoidSpawn', 'Dream Eater', 'Death Runner', 'Vess Hunter', 'Time Pirate',
    'Reaper', 'Hellspawn', 'Succubus', 'Dark Realm Hunter', 'Skull Brood', 'Sphere Demon', 'Daedelus Trooper',
    'Dalek Captain', 'Silence', 'Trickster', 'Ghost of a Time Lord', 'Chameleon Tank'];
  /* Bout 100 is Kylo — the Court's other possibility for the title. */
  const champions = ['Private Dusk', 'Sergeant Major Havvingson', 'Mortimer Krieg', 'The Beast', 'Radian',
    'Brista', 'Lilith', 'The Master', 'The Joker', 'Kylo, the Other Possibility', 'Azeroth', 'The Black Dalek',
    'Kolbrai\'Kani', 'Virosa Cantrice', 'The Count', 'Hades', 'The Grandlord', 'Judge Damien\'s Shade'];

  /* ---------- Tier 2: Gifts of the Crack (spends Slivers) ---------- */
  const shop2 = [
    { id: 'weight', name: 'The Title\'s Weight', glyph: 'crown', base: 1, growth: 2, max: 60,
      desc: () => 'All ember production ×2 per level.', flav: 'Eze\'Rhi\'El. It is heavier than a crown and it burns more.' },
    { id: 'conduit', name: 'Ashen Conduit', glyph: 'smoke', base: 2, growth: 2.5, max: 30,
      desc: () => 'Ash from regeneration ×2 per level.', flav: 'Every death a little warmer than the last.' },
    { id: 'disgust', name: 'Kindled Disgust', glyph: 'firestare', base: 1, growth: 2.2, max: 40,
      desc: () => 'Squad attack and health ×2 per level.', flav: 'The champions you broke now fight beside you. They do not like it.' },
    { id: 'spawn', name: 'Hellspawn Brood', glyph: 'horns', base: 2, growth: 2.4, max: 10,
      desc: () => 'Ghosts gather ×2 faster and capacity ×1.5 per level.', flav: 'The crack is wider than it was. Ask the Court why.' },
    { id: 'banked', name: 'Banked Embers', glyph: 'ember', base: 3, growth: 3, max: 6,
      desc: (s, l) => 'Begin each life with ' + fmt(1e3 * Math.pow(100, Math.max(1, l))) + ' embers (scales with level).',
      flav: 'An ember tucked behind a rib, for the next body.' },
    { id: 'sigil', name: 'The Court Remembers', glyph: 'rune', base: 4, growth: 3, max: 8,
      desc: () => 'Skull Sigils ×1.5 per level.', flav: 'The gallery of skulls applauds a returning favourite.' },
    { id: 'artronc', name: 'Artron Conduit', glyph: 'hourglass', base: 2, growth: 2.5, max: 40,
      visible: (s) => s.titlesTotal >= 1,
      desc: () => 'Artron production ×2 per level.', flav: 'Bleed the Time War a little faster.' },
    { id: 'well', name: 'Well of Wrath', glyph: 'drop', base: 3, growth: 3, max: 10,
      visible: (s) => s.titlesTotal >= 2,
      desc: () => 'Wrath capacity +25 and regeneration ×1.25 per level.', flav: 'The Child\'s prayers need fuel.' },
  ].map((o) => leveled('shop2', 'slivers', 'void', o));

  /* ---------- Tier 2: The Time War (spends Artron) ---------- */
  const fronts = [
    { name: 'Temporal Siphon', glyph: 'hourglass', base: 10, growth: 1.8, prod: 1,
      flav: 'A tap driven into the side of the war. Artron drips out.' },
    { name: 'Dalek Battle-Line', glyph: 'dalek', base: 1000, growth: 3.5, prod: 0.1,
      flav: 'Exterminate, extract, repeat. They build siphons as they advance.' },
    { name: 'Gallifreyan Cascade', glyph: 'planet', base: 1e6, growth: 6, prod: 0.05,
      flav: 'Rassilon\'s Time Warriors pour through the cascade. You redirect the flow.' },
    { name: 'Eye of Harmony Tap', glyph: 'eye', base: 1e10, growth: 10, prod: 0.02,
      flav: 'The star at the heart of Gallifrey, in a box. The box leaks.' },
    { name: 'Rassilon\'s Gauntlet', glyph: 'hand', base: 1e16, growth: 15, prod: 0.01,
      req: (s) => L(s, 'shop3', 'gauntlet') > 0, reqText: 'Paradox gift: Rassilon\'s Gauntlet',
      flav: 'The Lord President\'s own hand. It does not let go.' },
  ].map((o, i) => {
    o.id = 'front' + i; o.idx = i; o.store = 'fronts'; o.cur = 'artron'; o.tint = 'time';
    o.level = (s) => s.fronts.b[i];
    o.cost = (s, l) => o.base * Math.pow(o.growth, l);
    o.visible = (s) => (i === 0 || s.fronts.b[i - 1] > 0 || s.fronts.b[i] > 0) && (!o.req || o.req(s));
    o.set = (s, l) => { s.fronts.n[i] += l - s.fronts.b[i]; s.fronts.b[i] = l; };
    o.desc = (s) => (i === 0 ? 'Produces ' + EZ.fmt(EZ.frontProd(s, 0)) + ' Artron per second each.'
      : 'Builds ' + EZ.fmt(EZ.frontProd(s, i)) + ' ' + fronts[i - 1].name + ' per second each.') + ' ×2 for every 10 bought.';
    return o;
  });
  const roar = leveled('misc', 'artron', 'time', {
    id: 'roar', name: 'Roar of Time', glyph: 'bolt', base: 1000, growth: 20,
    level: (s) => s.roar, set: (s, l) => { s.roar = l; },
    desc: () => 'Artron production ×1.4 per level.',
    flav: 'Thunder in every tense at once.' });

  /* ---------- Tier 2: The Grimoire of the Child ---------- */
  const spells = [
    { id: 'breath', name: 'Breath of Hellfire', glyph: 'flame', cost: 40, cd: 60, dur: 30,
      desc: 'Ember production ×10 for 30 seconds.' },
    { id: 'torment', name: 'Soul Torment', glyph: 'skull', cost: 60, cd: 120,
      desc: 'Wring 10 minutes of ember production out of the damned, instantly.' },
    { id: 'manip', name: 'Hellfire Manipulation', glyph: 'hand', cost: 20, cd: 30, dur: 15,
      desc: 'Stokes ×100 for 15 seconds.' },
    { id: 'hellspawn', name: 'Hellspawn', glyph: 'horns', cost: 30, cd: 90,
      desc: 'Summon ghosts equal to 25% of your capacity.' },
    { id: 'amputate', name: 'Soul Amputation', glyph: 'crack', cost: 50, cd: 60,
      desc: 'Cut away half of the current foe\'s health (a quarter, for champions).' },
    { id: 'resurrect', name: 'Demon Resurrection', glyph: 'heart', cost: 70, cd: 120,
      desc: 'Raise your squad at full health, at once.' },
    { id: 'portal', name: 'Void Portal', glyph: 'portal', cost: 50, cd: 180,
      desc: 'Tear the dark open: the Child whispers now.' },
  ];

  /* ---------- Shades (automation) ---------- */
  const shades = [
    { id: 'stoker', name: 'Shade of the Stoker', glyph: 'hand', unlock: (s) => s.titlesTotal >= 1, unlockText: '1 Title claimed',
      desc: 'Stokes the ember 10 times every second.', fields: [] },
    { id: 'kindler', name: 'Shade of Kindling', glyph: 'flame', unlock: (s) => s.titlesTotal >= 1, unlockText: '1 Title claimed',
      desc: 'Buys Kindlings, best value first.', fields: [{ key: 'pct', label: 'Spend up to % of embers', def: 100 }] },
    { id: 'rites', name: 'Shade of Rites', glyph: 'book', unlock: (s) => s.titlesTotal >= 2, unlockText: '2 Titles claimed',
      desc: 'Buys Rites of Kindling whenever affordable.', fields: [{ key: 'pct', label: 'Spend up to % of embers', def: 100 }] },
    { id: 'armourer', name: 'Shade of the Armourer', glyph: 'anvil', unlock: (s) => s.titlesTotal >= 2, unlockText: '2 Titles claimed',
      desc: 'Buys Haunts and armaments for the Tournament.', fields: [{ key: 'pct', label: 'Spend up to % of embers', def: 25 }] },
    { id: 'listener', name: 'Shade of Listening', glyph: 'whisper', unlock: (s) => s.titlesTotal >= 3, unlockText: '3 Titles claimed',
      desc: 'Answers the Child\'s whispers the moment they appear.', fields: [] },
    { id: 'regen', name: 'Shade of Regeneration', glyph: 'spiral', unlock: (s) => s.titlesTotal >= 3, unlockText: '3 Titles claimed',
      desc: 'Regenerates for you. Leave a field at 0 to ignore it.',
      fields: [{ key: 'ash', label: 'Regenerate when Ash gain ≥', def: 0 },
        { key: 'stall', label: '…or when the Tournament stalls for (s)', def: 90 },
        { key: 'min', label: 'Never before this life is (s) old', def: 60 }] },
    { id: 'ashen', name: 'Shade of the Ashen Tree', glyph: 'tree', unlock: (s) => s.titlesTotal >= 4, unlockText: '4 Titles claimed',
      desc: 'Spends Ash on the Ashen Tree, cheapest first.', fields: [] },
    { id: 'title', name: 'Shade of the Title', glyph: 'crown', unlock: (s) => s.burnsTotal >= 1, unlockText: '1 Timeline burnt',
      desc: 'Claims the Title when enough Sigils are held.', fields: [{ key: 'sigils', label: 'Claim at Sigils ≥', def: 10 }] },
    { id: 'warfront', name: 'Shade of the Time War', glyph: 'hourglass', unlock: (s) => s.burnsTotal >= 1, unlockText: '1 Timeline burnt',
      desc: 'Buys Time War fronts and the Roar of Time.', fields: [] },
    { id: 'gifts', name: 'Shade of Gifts', glyph: 'rune', unlock: (s) => s.burnsTotal >= 2, unlockText: '2 Timelines burnt',
      desc: 'Spends Slivers on the Gifts of the Crack, cheapest first.', fields: [] },
    { id: 'grim', name: 'Shade of the Grimoire', glyph: 'drop', unlock: (s) => s.burnsTotal >= 3, unlockText: '3 Timelines burnt',
      desc: 'Casts Breath of Hellfire, Soul Torment and Hellspawn whenever ready.', fields: [] },
    { id: 'siege', name: 'Shade of the Siege', glyph: 'gate', unlock: (s) => s.cutsTotal >= 1, unlockText: '1 Cut of the Cage',
      desc: 'Buys siege engines and Paradox gifts, cheapest first.', fields: [] },
    { id: 'burn', name: 'Shade of the Burning', glyph: 'pyre', unlock: (s) => s.cutsTotal >= 1, unlockText: '1 Cut of the Cage',
      desc: 'Burns the timeline when Paradox gain is high enough.', fields: [{ key: 'paradox', label: 'Burn when Paradox gain ≥', def: 10 }] },
  ];

  /* ---------- Tier 3: Burnt Timelines (challenges) ---------- */
  const chals = [
    { id: 'glass', name: 'When the Glass Cracked and Havok Cried', glyph: 'crack',
      rule: 'You cannot Stoke, by hand or by shade.', goalText: 'Regenerate once.',
      goal: (s) => s.chalRegens >= 1, reward: 'Stokes ×10, and automatic Stokes count three times.' },
    { id: 'tale', name: 'A Tale of Two', glyph: 'eclipse',
      rule: 'Ember production is square-rooted.', goalText: 'Earn 1e9 embers in one life.',
      goal: (s) => s.embersLife >= 1e9, reward: 'Ember production is raised to the power 1.03.' },
    { id: 'shadows', name: 'Hunting Shadows', glyph: 'eye',
      rule: 'The Child never whispers.', goalText: 'Earn 1e12 embers in one life.',
      goal: (s) => s.embersLife >= 1e12, reward: 'Whispered boons ×2 strength; whispers come a third sooner.' },
    { id: 'position', name: 'A Position of Power', glyph: 'crown',
      rule: 'The rites that double a Kindling cannot be performed.', goalText: 'Earn 1e10 embers in one life.',
      goal: (s) => s.embersLife >= 1e10, reward: 'Each Kindling rite multiplies by ×2.2 instead of ×2.' },
    { id: 'dagger', name: '‘You Know My Name Is Dagger’', glyph: 'sword',
      rule: 'Your squad deals one tenth of its damage.', goalText: 'Reach bout 60 of the Tournament.',
      goal: (s) => s.tourney.best >= 60, reward: 'Squad attack ×5.' },
    { id: 'grind', name: 'Don’t Let the Bastards Grind You Down', glyph: 'ghost',
      rule: 'Ghosts gather at one tenth the speed.', goalText: 'Reach bout 40 of the Tournament.',
      goal: (s) => s.tourney.best >= 40, reward: 'Ghosts gather ×3 faster and capacity ×2.' },
    { id: 'fronts', name: 'A War on Two Fronts', glyph: 'dalek',
      rule: 'Ember production is halved for every ten bouts cleared this life.', goalText: 'Reach bout 50 of the Tournament.',
      goal: (s) => s.tourney.best >= 50, reward: 'Ember production ×1.15 per ten bouts cleared this life.' },
    { id: 'abyss', name: 'All Time Leads to the Abyss', glyph: 'portal',
      rule: 'Kindling prices grow ×1.25 per purchase.', goalText: 'Earn 1e11 embers in one life.',
      goal: (s) => s.embersLife >= 1e11, reward: 'Kindling prices grow 1% slower, forever.' },
    { id: 'depths', name: 'The Depths of Reality', glyph: 'cage',
      rule: 'Only the first six Kindlings exist.', goalText: 'Earn 1e11 embers in one life.',
      goal: (s) => s.embersLife >= 1e11, reward: 'The seventh Kindling and beyond produce ×10.' },
  ];

  /* ---------- Tier 3: Gifts of Paradox (spends Paradox) ---------- */
  const shop3 = [
    { id: 'scorch', name: 'Scorched Moments', glyph: 'flame', base: 1, growth: 2.5, max: 50,
      desc: () => 'All ember production ×5 per level.', flav: 'A moment burnt is a moment that cannot argue.' },
    { id: 'engine', name: 'Paradox Engine', glyph: 'cog', base: 1, growth: 2.2, max: 40,
      desc: () => 'Artron production ×3 per level.', flav: 'It runs on the fact that it should not run.' },
    { id: 'recursion', name: 'Recursion', glyph: 'spiral', base: 2, growth: 2.5, max: 25,
      desc: () => 'Slivers from claiming the Title ×2 per level.', flav: 'You have claimed this title before. You will claim it again.' },
    { id: 'rigged', name: 'Rigged Bouts', glyph: 'scales', base: 2, growth: 2.5, max: 25,
      desc: () => 'Skull Sigils ×1.5 per level.', flav: 'The Judge was always going to rule in your favour. Now it is official.' },
    { id: 'rewound', name: 'Rewound Ash', glyph: 'hourglass', base: 3, growth: 3, max: 10,
      desc: (s, l) => 'Begin each Title with ' + fmt(10 * Math.pow(Math.max(1, l), 2)) + ' Ash (scales with level).',
      flav: 'The ash of a life that has not happened yet.' },
    { id: 'gauntlet', name: 'Rassilon\'s Gauntlet', glyph: 'hand', base: 5, max: 1, unlock: true,
      desc: () => 'Open a fifth Time War front.', flav: 'Take the hand. Keep the power.' },
    { id: 'siegecraft', name: 'Siegecraft', glyph: 'gate', base: 2, growth: 2.4, max: 30,
      desc: () => 'Siege damage ×3 per level.', flav: 'Heaven was built to be defended. You were built to be patient.' },
  ].map((o) => leveled('shop3', 'paradox', 'paradox', o));

  /* ---------- Tier 3: The Siege of Heaven's Gate ---------- */
  const choirs = ['The Angels', 'The Spherical Angels', 'The Archangels', 'The Principalities', 'The Powers',
    'The Virtues', 'The Dominions', 'The Seraphs', 'Heaven\'s Gate'];
  const engines = [
    { id: 'ram', name: 'Breach Ram', glyph: 'anvil', base: 1e8, growth: 1.45,
      desc: () => '+1,000 base siege damage per second per level.', flav: 'Iron, hellfire, and a great deal of resentment.' },
    { id: 'mortar', name: 'Hellfire Mortar', glyph: 'flame', base: 1e10, growth: 8,
      desc: () => 'Siege damage ×1.5 per level.', flav: 'It lobs pieces of the forge over the wall.' },
    { id: 'sapper', name: 'Shade Sappers', glyph: 'shade', base: 5e9, growth: 5, max: 15,
      desc: () => 'Choir wards regenerate 15% slower per level.', flav: 'Shades under the foundations, unpicking the hymns.' },
    { id: 'ladder', name: 'Ghost Ladders', glyph: 'ghost', base: 1e12, max: 1, unlock: true,
      desc: () => 'Siege damage ×(1 + ghost capacity / 40).', flav: 'They climb on each other. They do not mind. They cannot.' },
    { id: 'bluefire', name: 'Stolen Bluefire', glyph: 'flame', tint: 'blue', base: 1e15, max: 1, unlock: true,
      desc: () => 'Siege damage ×(1 + Paradox gained this cycle).',
      flav: 'Like minty hellfire. The Red Faction made it to burn corruption. It burns angels just as well.' },
  ].map((o) => leveled('engines', 'artron', o.tint || 'grace', o));

  /* ---------- Tier 4: Gifts of the Nightmare (spends Nightmare) ---------- */
  const shop4 = [
    { id: 'army', name: 'Nightmare Army', glyph: 'ghost', base: 1, growth: 3, max: 30,
      desc: () => 'Squad attack and health ×10 per level.', flav: 'The ghost army breathes for the first time. It does not like the taste.' },
    { id: 'hunger', name: 'The Child\'s Hunger', glyph: 'shade', base: 1, growth: 2.5, max: 40,
      desc: () => 'All ember and Artron production ×10 per level.', flav: 'It hated the universe. It is happy to eat it.' },
    { id: 'widens', name: 'The Crack Widens', glyph: 'crack', base: 2, growth: 3, max: 20,
      desc: () => 'Paradox from burning ×2 per level.', flav: 'A finger\'s breadth. Then a hand. Then a door.' },
    { id: 'theft', name: 'Stolen Grace', glyph: 'feather', base: 2, growth: 3, max: 20,
      desc: () => 'Grace from broken choirs ×2 per level.', flav: 'Pluck the feathers while the angel is still singing.' },
    { id: 'moriarty', name: 'Shade of Moriarty', glyph: 'mask', base: 1, growth: 2, max: 40,
      desc: () => 'Hunting power against the Lumen Cascade ×3 per level.', flav: 'The first Eze\'Rhi\'El left a shade behind. It knows the Cascade by name.' },
  ].map((o) => leveled('shop4', 'nightmare', 'nightmare', o));

  /* ---------- Tier 4: Hunting the Lumen Cascade ---------- */
  const lumen = [
    { name: 'Captain Jack', glyph: 'gun', light: 1e2, boon: 'Ember production ×10.',
      flav: 'He has died before. He is very good at it. You are better.' },
    { name: 'Loki', glyph: 'mask', light: 3e3, boon: 'Artron production ×10.',
      flav: 'The trickster saw it coming. Tricksters always do. It did not help.' },
    { name: 'Abel', glyph: 'heart', light: 1e5, boon: 'Squad attack and health ×100.',
      flav: 'The Court hunted Abel for a disc he did not have. You hunt him for the light he does.' },
    { name: 'The Gunslinger', glyph: 'gun', light: 3e6, boon: 'Siege damage ×10.',
      flav: 'He walked through many hells to resist the Child. He was set to watch Cain. No one watched him.' },
    { name: 'Mason Drake of the Red Faction', glyph: 'flame', tint: 'blue', light: 1e8, boon: 'Paradox from burning ×3.',
      flav: 'He fought the Nightmare directly, in the universe, with Bluefire. The bastion floods with flame one last time.' },
    { name: 'The 16th Doctor', glyph: 'planet', light: 3e9, boon: 'Nightmare from cutting ×3.',
      flav: 'He watched Gallifrey burn twice by your hands. He wore the Master\'s face to do grey things. Grey is not enough.' },
    { name: 'The Man on the Moon', glyph: 'moon', light: 1e11, boon: 'The Door can be found.',
      flav: 'A dark realm hunter who saw an echo of the Child and built the Cascade to stop it. He saw this too.' },
  ];

  /* ---------- Omens (achievements) ---------- */
  const omens = [];
  const emberOmens = [[1e3, 'Kindled'], [1e6, 'Smouldering'], [1e9, 'Blaze'], [1e12, 'Wildfire'], [1e15, 'Inferno'],
    [1e18, 'Conflagration'], [1e21, 'Firestorm'], [1e24, 'Pyroclasm'], [1e30, 'Hellfire'], [1e40, 'Sunburn'],
    [1e50, 'Universe Aflame'], [1e75, 'Ash of Stars'], [1e100, 'The Last Light']];
  emberOmens.forEach(([n, name]) => omens.push({ id: 'emb' + n, name, glyph: 'flame',
    desc: 'Earn ' + EZ.fmt(n) + ' embers in total.', test: (s) => s.embersTotal >= n }));
  [[100, 'Restless Fingers'], [1000, 'Burnt Fingertips'], [10000, 'Hands of Ash'], [100000, 'The Stoker Eternal']]
    .forEach(([n, name]) => omens.push({ id: 'stk' + n, name, glyph: 'hand', desc: 'Stoke ' + EZ.fmt(n) + ' times.', test: (s) => s.stokesTotal >= n }));
  [[1, 'It Speaks'], [10, 'Confidant'], [50, 'Favoured'], [200, 'The Child\'s Ear']]
    .forEach(([n, name]) => omens.push({ id: 'wsp' + n, name, glyph: 'whisper', desc: 'Answer ' + n + ' whisper' + (n > 1 ? 's' : '') + '.', test: (s) => s.whisper.clicked >= n }));
  gens.forEach((g) => omens.push({ id: 'gen100' + g.id, name: 'A Hundred ' + g.name.replace(/^The /, ''), glyph: g.glyph,
    desc: 'Own 100 ' + g.name + '.', test: (s) => L(s, 'gens', g.id) >= 100 }));
  [[1, 'A New Face'], [5, 'Regenerative'], [13, 'Thirteen Lives'], [50, 'The Endless Cycle']]
    .forEach(([n, name]) => omens.push({ id: 'rgn' + n, name, glyph: 'spiral', desc: 'Regenerate ' + n + ' time' + (n > 1 ? 's' : '') + '.', test: (s) => s.regensTotal >= n }));
  [[10, 'First Blood in the Court'], [50, 'Crowd Favourite'], [100, 'The Other Possibility'], [200, 'Beyond the Bracket']]
    .forEach(([n, name]) => omens.push({ id: 'bout' + n, name, glyph: 'skull', desc: 'Reach bout ' + n + ' of the Tournament.', test: (s) => s.tourney.bestEver >= n }));
  [[1, 'Eze\'Rhi\'El'], [5, 'Title Holder'], [25, 'The Only Possibility']]
    .forEach(([n, name]) => omens.push({ id: 'ttl' + n, name, glyph: 'crown', desc: 'Claim the Title ' + n + ' time' + (n > 1 ? 's' : '') + '.', test: (s) => s.titlesTotal >= n }));
  [[1, 'The Burning of a Timeline'], [5, 'Arsonist of Tenses'], [25, 'Every When Aflame']]
    .forEach(([n, name]) => omens.push({ id: 'brn' + n, name, glyph: 'pyre', desc: 'Burn ' + n + ' timeline' + (n > 1 ? 's' : '') + '.', test: (s) => s.burnsTotal >= n }));
  chals.forEach((c) => omens.push({ id: 'chal' + c.id, name: c.name, glyph: c.glyph, desc: 'Complete the burnt timeline “' + c.name + '”.', test: (s) => !!s.chalDone[c.id] }));
  [[3, 'Wingclipper'], [7, 'Dominion Over Dominions'], [9, 'At the Gate']]
    .forEach(([n, name]) => omens.push({ id: 'chr' + n, name, glyph: 'wing', desc: 'Break ' + n + ' choirs of Heaven\'s Gate in one siege.', test: (s) => s.siege.bestChoir >= n }));
  [[1, 'The Cage Is Cut'], [5, 'A Nightmare Army']]
    .forEach(([n, name]) => omens.push({ id: 'cut' + n, name, glyph: 'cage', desc: 'Cut the Cage ' + n + ' time' + (n > 1 ? 's' : '') + '.', test: (s) => s.cutsTotal >= n }));
  [[1, 'One Light Fewer'], [4, 'The Cascade Falters'], [7, 'Lights Out']]
    .forEach(([n, name]) => omens.push({ id: 'lum' + n, name, glyph: 'moon', desc: 'Extinguish ' + n + ' of the Lumen Cascade.', test: (s) => s.lumen >= n }));
  omens.push({ id: 'door', name: 'A Child\'s Cataclysm', glyph: 'door', desc: 'Open the Door.', test: (s) => s.cataclysms >= 1 });

  /* ---------- The Power Hierarchy (ranks, XV → I) ---------- */
  const ranks = [
    { n: 15, name: 'Mankind', test: () => true, need: '' },
    { n: 14, name: 'Cybermen & Gallifreyans', test: (s) => s.embersTotal >= 1e4, need: 'Earn 10K embers in total' },
    { n: 13, name: 'Time Lords & Daleks', test: (s) => s.embersTotal >= 1e7, need: 'Earn 10M embers in total' },
    { n: 12, name: 'Warlocks & The Gifted', test: (s) => s.regensTotal >= 1, need: 'Regenerate' },
    { n: 11, name: 'Angels, Demons & The Ascended', test: (s) => s.tourney.bestEver >= 20, need: 'Reach bout 20 of the Tournament' },
    { n: 10, name: 'Greater Dream Eaters', test: (s) => s.tourney.bestEver >= 50, need: 'Reach bout 50 of the Tournament' },
    { n: 9, name: 'Sentinels & The Promised', test: (s) => s.titlesTotal >= 1, need: 'Claim the Title' },
    { n: 8, name: 'The Court of Skull', test: (s) => s.titlesTotal >= 5, need: 'Claim the Title 5 times' },
    { n: 7, name: 'Sphere Demons & Spherical Angels', test: (s) => s.burnsTotal >= 1, need: 'Burn a timeline' },
    { n: 6, name: 'Seraphs, Dark Age Deities & The Judge', test: (s) => Object.keys(s.chalDone).length >= 4, need: 'Complete 4 burnt timelines' },
    { n: 5, name: 'Archangels & Asgardians', test: (s) => s.cutsTotal >= 1, need: 'Cut the Cage' },
    { n: 4, name: 'Chrono-Arches & Major Dark Age Deities', test: (s) => s.lumen >= 3, need: 'Extinguish 3 of the Lumen Cascade' },
    { n: 3, name: 'The All-Father & Heimdall', test: (s) => s.lumen >= 6, need: 'Extinguish 6 of the Lumen Cascade' },
    { n: 2, name: 'The Eternals', test: (s) => s.cataclysms >= 1, need: 'Open the Door' },
    { n: 1, name: 'Death', test: (s) => s.cataclysms >= 3, need: 'Open the Door three times' },
  ];

  /* ---------- The story (A Dark Room-style log, fired once each) ---------- */
  const story = [
    { id: 'start', when: () => true, text: 'the dark is cold, and very old.' },
    { id: 'stoke1', when: (s) => s.stokesTotal >= 1, text: 'an ember catches behind your eyes. it remembers how to burn.' },
    { id: 'stoke8', when: (s) => s.stokesTotal >= 8, text: 'the ember whispers. it knows your name. it knows a name you have not earned yet.' },
    { id: 'g_thought', when: (s) => L(s, 'gens', 'thought') >= 1, text: 'a thought begins to smoulder on its own.' },
    { id: 'g_whisper', when: (s) => L(s, 'gens', 'whisper') >= 1, text: 'through a crack in something vast, a voice: “closer.”' },
    { id: 'g_acolyte', when: (s) => L(s, 'gens', 'acolyte') >= 1, text: 'they come with ash on their tongues. they call you chosen. they do not say by what.' },
    { id: 'g_ghost', when: (s) => L(s, 'gens', 'ghost') >= 1, text: 'ghosts cannot exist in the universe. the ghosts have not been told.' },
    { id: 'g_rendition', when: (s) => L(s, 'gens', 'rendition') >= 1, text: 'eyes like yours open, elsewhere. they burn the same colour.' },
    { id: 'g_indoviea', when: (s) => L(s, 'gens', 'indoviea') >= 1, text: 'indoviea stood against the dark ages. it falls to something warmer.' },
    { id: 'g_gallifrey', when: (s) => L(s, 'gens', 'gallifrey') >= 1, text: 'gallifrey burns. somewhere a time lord swears he will remember the colour of your eyes.' },
    { id: 'g_forge', when: (s) => L(s, 'gens', 'forge') >= 1, text: 'the sphere lucifer was banished to is still hot. you put it to work.' },
    { id: 'g_eclipse', when: (s) => L(s, 'gens', 'eclipse') >= 1, text: 'where the disc is turned the light goes out. you learn to stand in the eclipse.' },
    { id: 'g_shade', when: (s) => L(s, 'gens', 'shade') >= 1, text: 'a small shadow stands beside yours. it is not yours.' },
    { id: 'w_seen', when: (s) => s.whisper.seen >= 1, text: 'an eye opens in the dark. it will not stay open long.' },
    { id: 'regen_ready', when: (s) => s.embersLife >= EZ.DATA.REQ.regen, text: 'this body is spent. a time lord does not die. not yet.' },
    { id: 'regen1', when: (s) => s.regensTotal >= 1, text: 'light pours from every cell. a new face. the same fire. what is left is ash, and ash remembers.' },
    { id: 'crack', when: (s) => L(s, 'tree', 'crack') > 0, text: 'the crack in the cage widens a finger’s breadth. ghosts seep through, cold and eager.' },
    { id: 'herald', when: (s) => L(s, 'tree', 'herald') > 0, text: 'damien, judge of the court of skull, calls a tournament. the prize is a title, and a piece of the child.' },
    { id: 'champ1', when: (s) => s.tourney.bestEver > 10, text: 'the first champion falls. the gallery of skulls clatters its approval.' },
    { id: 'title_ready', when: (s) => s.sigils >= EZ.DATA.REQ.title, text: 'the court has seen enough. the judge raises his gavel. the title waits.' },
    { id: 'title1', when: (s) => s.titlesTotal >= 1, text: '“eze’rhi’el,” says the judge, and the crack sings. a sliver of the child slides in behind your eyes.' },
    { id: 'army', when: (s) => s.titlesTotal >= 1, text: 'the champions you broke kneel. the beast, radian, the master, the joker, azeroth. the army of nightmare.' },
    { id: 'timewar', when: (s) => s.titlesTotal >= 1, text: 'the time war rages across every when. there is power in the bleeding. they call it artron.' },
    { id: 'grim', when: (s) => s.titlesTotal >= 2, text: 'the child teaches you its prayers. they are all about burning.' },
    { id: 'burn_ready', when: (s) => s.artron >= EZ.DATA.REQ.burn, text: 'the time war has given enough. a timeline could be burnt with this. a whole one.' },
    { id: 'burn1', when: (s) => s.burnsTotal >= 1, text: 'you set fire to a timeline. it screams in every tense. paradox settles like ash.' },
    { id: 'gate', when: (s) => s.burnsTotal >= 1, text: 'heaven’s gate stands. behind it, the cage. behind the cage, the child.' },
    { id: 'cut_ready', when: (s) => s.grace >= EZ.DATA.REQ.cut, text: 'enough grace, stolen from enough throats. the cage can be cut.' },
    { id: 'cut1', when: (s) => s.cutsTotal >= 1, text: 'the cage is cut. the ghost army takes its first breath. it is a nightmare army now.' },
    { id: 'cascade', when: (s) => s.cutsTotal >= 1, text: 'the lumen cascade knew this day would come. they chose their members carefully. it will not save them.' },
    { id: 'lumen1', when: (s) => s.lumen >= 1, text: 'one light goes out. the universe is a little darker, and a little warmer.' },
    { id: 'lumen6', when: (s) => s.lumen >= 6, text: 'only the man on the moon remains. he has seen this nightmare every night of his life.' },
    { id: 'door_ready', when: (s) => s.lumen >= 7, text: 'the cascade is dark. the disc turns in your hand. the door is there. it was always there.' },
  ];
  const ambient = [
    'ash falls, soft as forgetting.', 'somewhere a bell rings in a tense that has not happened.',
    'the crack hums. it sounds like a lullaby played backwards.', 'the embers settle. something underneath them breathes.',
    'a draught from nowhere. the flames lean toward it.', 'your eyes itch. they are hotter than they should be.',
    'the gallery of skulls is quiet tonight.', 'a ghost forgets its name, then remembers yours.',
    'smoke rises in the shape of a child, and disperses.', 'the fire does not crackle. it whispers.',
  ];

  EZ.DATA = {
    REQ: { regen: 4e7, title: 10, burn: 1e15, cut: 100, door: 7 },
    RITE_AT, gens, rites, tree, arms, enemies, champions, shop2, fronts, roar, spells, shades,
    chals, shop3, choirs, engines, shop4, lumen, omens, ranks, story, ambient,
  };
})(typeof window !== 'undefined' ? window : globalThis);
