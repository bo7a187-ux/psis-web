// Turns dist-single/index.html into a body fragment for the claude.ai preview host
// (the host adds its own <html>/<head>/<body> skeleton).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const html = readFileSync('dist-single/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
// title first so it is found in the first 8 KB
const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
mkdirSync('dist-artifact', { recursive: true });
writeFileSync('dist-artifact/schedule-intelligence.html', `${title}\n${head.replace(title, '')}\n${body}\n`);
console.log('ok', (readFileSync('dist-artifact/schedule-intelligence.html').length / 1024).toFixed(0) + ' KB');
