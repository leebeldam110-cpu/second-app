#!/usr/bin/env node
/* Engine checks: purchases, the four ascension tiers and the finale, with a scripted player. Run: node tools/test.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

for (const f of ['util.js', 'data.js', 'engine.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
}
const EZ = globalThis.EZ;
EZ.init();
const D = EZ.DATA;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok -', name); };

test('buy 1 and buy max on a Kindling', () => {
  const s = EZ.newState();
  s.embers = 15;
  assert.strictEqual(EZ.buy(s, D.gens[0], 1), 1);
  assert.strictEqual(s.gens.thought, 1);
  s.embers = 10000;
  const n = EZ.buy(s, D.gens[0], 'max');
  assert.ok(n > 10, 'max should buy many');
  assert.ok(s.embers < D.gens[0].cost(s, s.gens.thought), 'max should leave too little for one more');
});

test('rites are gated by Kindlings owned', () => {
  const s = EZ.newState();
  const rite = D.rites.find((r) => r.id === 'rite_thought');
  s.embers = 1e9;
  assert.strictEqual(EZ.buy(s, rite, 1), 0, 'needs 1 thought first');
  s.gens.thought = 5;
  assert.strictEqual(EZ.buy(s, rite, 'max'), 2, 'levels at 1 and 5 owned');
});

test('stoking and whispers', () => {
  const s = EZ.newState();
  EZ.calc(s);
  assert.strictEqual(EZ.stoke(s, 3), 3);
  s.whisper.active = { ttl: 5, x: 0.5, y: 0.5 };
  assert.ok(EZ.clickWhisper(s));
  assert.strictEqual(s.whisper.active, null);
});

test('regeneration pays only for new embers', () => {
  const s = EZ.newState();
  s.embersLife = s.embersTitle = D.REQ.regen;
  assert.strictEqual(EZ.regenerate(s), 12);
  assert.strictEqual(s.embers, 0);
  s.embersLife = D.REQ.regen; // same total this Title: nothing new to pay
  assert.strictEqual(EZ.ashGain(s), 0);
});

test('sigils are paid once per champion per Title', () => {
  const s = EZ.newState();
  s.tree = { crack: 1, herald: 1 };
  s.ghosts.n = 1e6;
  s.arms = { blade: 200, mail: 200, haunt: 1e5 };
  for (let i = 0; i < 600; i++) EZ.tick(s, 1);
  assert.ok(s.sigils >= 10, 'a strong squad should earn 10 sigils, got ' + s.sigils);
  const before = s.sigils;
  EZ.regenerate(Object.assign(s, { embersLife: D.REQ.regen, embersTitle: D.REQ.regen }));
  s.ghosts.n = 1e6; s.arms = { blade: 200, mail: 200, haunt: 1e5 };
  for (let i = 0; i < 300; i++) EZ.tick(s, 1);
  assert.ok(s.sigils - before < 2, 'refighting the same champions pays (almost) nothing more');
});

test('a scripted player reaches every tier and opens the Door', () => {
  const s = EZ.newState();
  const order = [];
  const note = (k) => { if (!order.includes(k)) order.push(k); };
  for (let t = 0; t < 72 * 3600 && s.cataclysms < 1; t += 2) {
    EZ.calc(s);
    if (s.chal !== 'glass') EZ.stoke(s, 8);
    if (s.whisper.active) EZ.clickWhisper(s);
    for (const sh of D.shades) if (sh.unlock(s)) s.shades[sh.id] = { on: true, stall: 90, min: 60 };
    EZ.buyCheapest(s, D.gens, Infinity, 200);
    for (const u of D.rites) EZ.buy(s, u, 'max');
    for (const id of ['crack', 'herald']) EZ.buy(s, D.tree.find((x) => x.id === id), 1);
    EZ.buyCheapest(s, D.tree, Infinity, 100);
    EZ.buyCheapest(s, D.arms, s.embers * 0.3, 200);
    EZ.buyCheapest(s, D.shop2, Infinity, 100);
    for (let i = D.fronts.length - 1; i >= 0; i--) if (EZ.isVisible(s, D.fronts[i])) EZ.buy(s, D.fronts[i], 'max');
    EZ.buy(s, D.roar, 'max');
    EZ.buyCheapest(s, D.engines, Infinity, 200);
    EZ.buyCheapest(s, D.shop3, Infinity, 100);
    EZ.buyCheapest(s, D.shop4, Infinity, 100);
    if (EZ.canRegen(s) && EZ.ashGain(s) >= Math.max(1, s.ashEarned)) { EZ.regenerate(s); note('regenerate'); }
    if (EZ.canTitle(s) && EZ.sliverGain(s) >= Math.max(3, s.sliversCycle * 0.5)) { EZ.claimTitle(s); note('title'); }
    if (EZ.canBurn(s) && EZ.paradoxGain(s) >= Math.max(3, s.paradoxCycle * 0.5)) { EZ.burn(s); note('burn'); }
    if (EZ.canCut(s) && EZ.nightmareGain(s) >= Math.max(5, s.nightmareCycle * 0.5)) { EZ.cut(s); note('cut'); }
    if (EZ.canDoor(s)) { EZ.openDoor(s); note('door'); }
    EZ.tick(s, 2);
    assert.ok(isFinite(s.embers) && !isNaN(s.embers), 'embers must stay finite');
  }
  assert.deepStrictEqual(order, ['regenerate', 'title', 'burn', 'cut', 'door']);
  console.log('   reached the Door after ' + EZ.fmtTime(s.playTime) + ' of simulated play');
});

test('saves round-trip through export/import', () => {
  const s = EZ.newState();
  s.embers = 1234; s.gens.thought = 7;
  const back = EZ.importSave(EZ.exportSave(s));
  assert.strictEqual(back.embers, 1234);
  assert.strictEqual(back.gens.thought, 7);
});

console.log(passed + ' tests passed');
