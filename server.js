'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { obfuscate, VARIANT_NAMES } = require('./xayzenc.js');

const PORT = process.env.PORT || 3000;

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function sendHTML(res, filePath) {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // Static HTML
  if (pathname === '/' || pathname === '/index.html') {
    sendHTML(res, path.join(__dirname, 'home.html'));
    return;
  }

  // API: obfuscate
  if (pathname === '/api/obfuscate' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { code, level, variant, password, luaVersion } = body;

      if (!code || typeof code !== 'string') {
        sendJSON(res, 400, { error: 'No code provided' });
        return;
      }
      if (code.length > 500_000) {
        sendJSON(res, 400, { error: 'Code too large (max 500KB)' });
        return;
      }

      const lvl = Math.min(7, Math.max(1, parseInt(level) || 4));
      const vari = Math.min(11, Math.max(0, parseInt(variant) || 0));
      const pw = typeof password === 'string' ? password.trim() : '';
      const luaVer = luaVersion || '5.1';

      const start = Date.now();
      const result = obfuscate(code, {
        level: lvl,
        variant: vari,
        password: pw,
        luaVersion: luaVer,
      });
      const elapsed = Date.now() - start;

      sendJSON(res, 200, {
        success: true,
        result,
        stats: {
          originalSize: code.length,
          obfuscatedSize: result.length,
          ratio: ((result.length / code.length) * 100).toFixed(1),
          timeMs: elapsed,
          level: lvl,
          variant: VARIANT_NAMES[vari],
          luaVersion: luaVer,
        },
      });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // API: variants list
  if (pathname === '/api/variants' && req.method === 'GET') {
    sendJSON(res, 200, { variants: VARIANT_NAMES });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`XayzEnc server running on http://localhost:${PORT}`);
});
