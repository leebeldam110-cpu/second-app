/* The Eze'Rhi'El — hand-drawn SVG glyphs (24×24, stroked) used for every upgrade icon. */
(function (root) {
  'use strict';
  const EZ = (root.EZ = root.EZ || {});

  function spiral() {
    let d = '';
    for (let i = 0; i <= 120; i++) {
      const a = i * 0.16, r = 0.6 + a * 0.5;
      const x = 12 + r * Math.cos(a), y = 12 + r * Math.sin(a);
      d += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
    }
    return '<path d="' + d + '"/>';
  }
  const dot = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + (r || 0.9) + '" class="fill"/>';

  const G = {
    eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/><path class="fill" d="M12 9.6c.9 1 1.2 1.8.6 2.7-.3.5-1 .5-1.3 0-.5-.8-.2-1.7.7-2.7z"/>',
    flame: '<path d="M12 2.5c1 3.2 4.8 5.3 4.8 10a4.8 4.8 0 0 1-9.6 0c0-2.4 1.2-3.9 2.4-5 .1 1.6.9 2.6 1.8 3 .2-3-.3-5.4.6-8z"/><path d="M12 14c.6.8 1.6 1.5 1.6 2.8a1.6 1.6 0 0 1-3.2 0c0-1.2.9-1.9 1.6-2.8z"/>',
    ember: '<circle cx="12" cy="14" r="4"/><path d="M12 5.5v2.5M6.8 7.8l1.6 1.6M17.2 7.8l-1.6 1.6M4.5 14H6M18 14h1.5"/>' + dot(12, 14, 1.4),
    brain: '<path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.3A3 3 0 0 0 7 18a3 3 0 0 0 5 1.5v-14A3 3 0 0 0 9 4.5zM15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.3A3 3 0 0 1 17 18a3 3 0 0 1-5 1.5"/><path d="M12 9c1.2-.2 2-1 2.2-2M12 13.5c-1.4 0-2.4-.8-2.8-2"/>',
    whisper: '<path d="M4 14c2.5-2.5 5.5-2.5 8 0 2.5-2.5 5.5-2.5 8 0-2.5 3-5.5 4-8 4s-5.5-1-8-4z"/><path d="M4 14h16"/><path d="M8 4.5c1 .8 1 2 0 2.8M12 3.5c1.4 1.1 1.4 3.4 0 4.6M16 4.5c1 .8 1 2 0 2.8"/>',
    hood: '<path d="M12 3c-4 0-6.5 3.5-6.5 8v9.5h13V11c0-4.5-2.5-8-6.5-8z"/><path d="M9 12.5c0-2 1.3-3.5 3-3.5s3 1.5 3 3.5V15H9z"/>' + dot(10.8, 12.6, 0.6) + dot(13.2, 12.6, 0.6),
    ghost: '<path d="M6 20V10a6 6 0 0 1 12 0v10l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z"/>' + dot(10, 10.5, 1) + dot(14, 10.5, 1),
    firestare: '<circle cx="12" cy="13" r="7.5"/><path d="M8.5 13c.6-.6 1.8-.6 2.4 0M13.1 13c.6-.6 1.8-.6 2.4 0"/><path d="M9.7 12c-.7-1.4 0-2.6.9-3.4M14.3 12c-.7-1.4 0-2.6.9-3.4"/><path d="M9.5 17h5"/>',
    pyre: '<path d="M4 20.5h16M6 18l12-3M6 15l12 3"/><path d="M12 3c.8 2.5 3.5 3.8 3.5 7a3.5 3.5 0 0 1-7 0c0-1.6.8-2.6 1.6-3.3.1 1 .6 1.7 1.2 2 .1-2-.2-3.6.7-5.7z"/>',
    planet: '<circle cx="12" cy="12" r="5.5"/><ellipse cx="12" cy="12" rx="10" ry="3.2" transform="rotate(-20 12 12)"/>',
    anvil: '<path d="M3 8h13a4 4 0 0 1-4 4h-1v3h3v3H7v-3h3v-3H8C5.5 12 3 10.5 3 8z"/><path d="M18 5l2-1M18 8h3M18 11l2 1"/>',
    eclipse: '<circle cx="12" cy="12" r="5.5"/><path class="fill" d="M14 6.9a5.5 5.5 0 0 1 0 10.2 5.5 5.5 0 0 0 0-10.2z"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    shade: '<circle cx="12" cy="5.8" r="2.5"/><path d="M9 21v-6l-1.5-1 1-4.5h7l1 4.5-1.5 1v6"/><path d="M15 21h6.5" opacity=".6"/>',
    hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6.5 7-2.5 0-4-1.2-5.5-3.5L3.5 14a1.6 1.6 0 0 1 2.5-2L8 14"/>',
    skull: '<path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.3 4.4 3 5.5V19a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-3c1.7-1.1 3-2.9 3-5.5A7.5 7.5 0 0 0 12 3z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M12 13.5l-1 2h2zM10 20v-2M14 20v-2"/>',
    chain: '<path d="M9.5 14.5l5-5"/><path d="M10.5 6.5l1.5-1.5a3.5 3.5 0 0 1 5 5l-1.5 1.5M13.5 17.5L12 19a3.5 3.5 0 0 1-5-5l1.5-1.5"/>',
    crack: '<path d="M12 2l-2 5 3 3-3.5 4 3 3-1.5 5"/><path d="M10 7l-4-1M13 10l4.5-1M9.5 14l-4 2M12.5 17l4 1.5"/>',
    tree: '<path d="M12 21v-8M12 13l-4-4M12 13l4-5M8 9L5 8M8 9V5.5M16 8l3-1M16 8l-1-4M12 13V9l-1.5-3"/><path d="M8 21h8"/>',
    hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/><path class="fill" d="M9.5 19h5L12 16z"/>',
    sword: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6M16 16l4 4M19 21l2-2"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M12 7v10M8 11h8"/>',
    crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/><path d="M5 16h14"/>',
    scales: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    wing: '<path d="M3 20c3-9 9-14 18-16-1 4-3 6.5-6 7.5 2 .2 3.4-.2 4.5-1-1.2 3-3.5 4.8-7 5.5 1.4.4 2.8.4 4-.2-2 2.6-5.5 4-10.5 4.2"/>',
    feather: '<path d="M20 4c-7 0-13 6-13 13v3"/><path d="M20 4c0 8-5 13-13 13M7 17l4-4M10 13.5h4M12.5 10.5h4"/>',
    gate: '<path d="M3 21V9a9 6 0 0 1 18 0v12"/><path d="M7 21v-9M12 21V8.5M17 21v-9M3 14h18"/>',
    door: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17"/><path d="M3 21h18"/>' + dot(15, 12, 1) + '<path d="M9 3v2.5M9 8l1.5 2-1.5 2 1 2"/>',
    disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/><path d="M15.5 4.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z"/>',
    star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/><path d="M12 6.5c.6 1.4 2 2.1 2 3.7a2 2 0 0 1-4 0c0-1 .5-1.6 1-2 .1.6.4 1 .7 1.1.1-1.1-.1-1.9.3-2.8z"/>',
    key: '<circle cx="7.5" cy="15.5" r="4"/><path d="M10.5 12.5L20 3M16 7l3 3M18 5l2 2"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    spiral: spiral(),
    cog: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    dalek: '<path d="M8 9a4 4 0 0 1 8 0"/><path d="M7 9h10l1.5 11h-13z"/><path d="M14 7.5l5-1.5M7.5 11.5h-3"/>' + dot(9, 14, 0.8) + dot(12, 14, 0.8) + dot(15, 14, 0.8) + dot(10, 17.5, 0.8) + dot(14, 17.5, 0.8),
    mask: '<path d="M4 6c5-2 11-2 16 0 0 8-3 13-8 13S4 14 4 6z"/><path d="M7.5 10.5c.8-.8 2.2-.8 3 0M13.5 10.5c.8-.8 2.2-.8 3 0"/><path d="M8 14c2.5 2.2 5.5 2.2 8 0"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/><path d="M12 7.4V12"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
    candle: '<path d="M9 21V11h6v10M7 21h10"/><path d="M12 3c.8 1.6 2 2.4 2 4a2 2 0 0 1-4 0c0-1.6 1.2-2.4 2-4z"/><path d="M12 9v2"/>',
    house: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>' + dot(9.3, 12.5, 0.7) + dot(14.7, 12.5, 0.7),
    smoke: '<path d="M5 20c0-3 3-3 3-6s-3-3-3-6 3-3 3-5M11 20c0-3 3-3 3-6s-3-3-3-6 3-3 3-5M17 20c0-3 3-3 3-6s-3-3-3-6"/>',
    gun: '<path d="M3 9h15l2-2h1v4h-4l-1 2h-3l-1 3H9l1-3H7l-2 7H3l2-7H3z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    rune: '<path d="M12 3l7 9-7 9-7-9z"/><path d="M12 7v10M9 12h6"/>',
    portal: '<ellipse cx="12" cy="12" rx="6" ry="9"/><ellipse cx="12" cy="12" rx="3" ry="5.5"/><path d="M12 9.5v5"/>',
    horns: '<path d="M5 4c-1 5 1 8 5 9M19 4c1 5-1 8-5 9"/><circle cx="12" cy="15" r="5"/>' + dot(10.2, 14.5, 0.8) + dot(13.8, 14.5, 0.8),
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>' + dot(12, 12, 1.5) + '<path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
    cage: '<path d="M5 9a7 5 0 0 1 14 0v11H5z"/><path d="M9 6.5V20M12 4v16M15 6.5V20M5 14h14"/><path d="M12 2v2"/>',
    tower: '<path d="M8 21l1-12h6l1 12z"/><path d="M7 9h10l-1.5-3h-7z"/><path d="M12 6V3l2 1"/><path d="M11 14h2v3h-2z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    question: '<path d="M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.2-1.5 2.4"/>' + dot(12, 17.5, 1),
  };

  EZ.GLYPHS = G;

  /** Raw glyph <svg>. */
  EZ.glyph = function (name, cls) {
    return '<svg class="glyph ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (G[name] || G.question) + '</svg>';
  };
})(typeof window !== 'undefined' ? window : globalThis);
