#!/usr/bin/env node
/* Bundles index.html + css + js into one self-contained page (dist/ezerhiel.html).
 * The bundle has no <html>/<head>/<body> wrapper so it can be published as a hosted page as-is. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = read('index.html');

const pick = (re, what) => {
  const m = html.match(re);
  if (!m) throw new Error('build: could not find ' + what + ' in index.html');
  return m[1].trim();
};
const title = pick(/<title>([\s\S]*?)<\/title>/, '<title>');
const fonts = pick(/<!--build:fonts-->([\s\S]*?)<!--\/build:fonts-->/, 'font links');
const body = pick(/<!--build:body-->([\s\S]*?)<!--\/build:body-->/, 'body markup');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const css = read('css/style.css');
const js = scripts.map((src) => '/* ' + src + ' */\n' + read(src)).join('\n');

const out = [
  '<title>' + title + '</title>',
  fonts,
  '<style>\n' + css + '\n</style>',
  body,
  '<script>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>',
  '',
].join('\n');

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'ezerhiel.html'), out);
console.log('wrote dist/ezerhiel.html (' + (out.length / 1024).toFixed(1) + ' KB, ' + scripts.length + ' scripts inlined)');
