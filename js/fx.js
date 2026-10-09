/* The Eze'Rhi'El — atmosphere: falling ash, rising embers, bursts when you stoke. */
(function (root) {
  'use strict';
  const EZ = (root.EZ = root.EZ || {});
  const FX = (EZ.FX = {});
  let cv, ctx, W = 0, H = 0, parts = [], enabled = true, last = 0, ambient = 0;
  const reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  FX.init = function (canvas) {
    cv = canvas;
    ctx = cv.getContext('2d');
    resize();
    root.addEventListener('resize', resize);
    root.requestAnimationFrame(loop);
  };
  FX.setEnabled = function (v) { enabled = !!v; if (!enabled) parts = []; };

  function resize() {
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    W = root.innerWidth; H = root.innerHeight;
    cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function ash() {
    parts.push({ k: 0, x: Math.random() * W, y: -8, vx: (Math.random() - 0.5) * 10, vy: 9 + Math.random() * 16,
      r: 0.6 + Math.random() * 1.7, a: 0.18 + Math.random() * 0.3, w: Math.random() * 6.28, life: 99 });
  }
  function ember(x, y, speed, life) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
    const v = speed * (0.4 + Math.random());
    parts.push({ k: 1, x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, r: 0.8 + Math.random() * 1.6,
      a: 1, w: Math.random() * 6.28, life: life * (0.6 + Math.random() * 0.8), max: life });
  }
  FX.burst = function (x, y, n) {
    if (!enabled || reduced) return;
    for (let i = 0; i < (n || 10) && parts.length < 320; i++) ember(x, y, 140, 0.9);
  };

  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    ctx.clearRect(0, 0, W, H);
    if (enabled && !reduced) {
      ambient += dt * 5;
      while (ambient > 1) { ambient--; if (parts.length < 220) ash(); }
      if (Math.random() < dt * 3) ember(Math.random() * W, H + 4, 60, 4);
    }
    const next = [];
    for (const p of parts) {
      p.w += dt * 1.6;
      p.x += (p.vx + Math.sin(p.w) * (p.k ? 6 : 10)) * dt;
      p.y += p.vy * dt;
      if (p.k) { p.vy -= 10 * dt; p.life -= dt; p.a = Math.max(0, p.life / p.max); }
      if (p.y > H + 10 || p.y < -20 || p.life <= 0) continue;
      next.push(p);
      if (p.k) {
        ctx.fillStyle = 'rgba(255,' + (120 + Math.floor(p.a * 80)) + ',40,' + p.a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(255,106,31,' + (p.a * 0.18).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.2, 0, 6.283); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(170,158,148,' + p.a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
    }
    parts = next;
    root.requestAnimationFrame(loop);
  }
})(typeof window !== 'undefined' ? window : globalThis);
