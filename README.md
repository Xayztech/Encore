# XayzEnc — Lua Obfuscator v3.0.0

Multi-layer Lua obfuscation engine with 12 variants and 7 levels.

## Files
- `server.js`   — HTTP server (Node.js CJS)
- `xayzenc.js`  — Obfuscation engine
- `home.html`   — Frontend UI
- `package.json`
- `vercel.json`

## Local
```
node server.js
# Open http://localhost:3000
```

## Vercel Deploy
1. Upload folder to GitHub
2. Import repo at vercel.com
3. Framework: Other | Root: ./
4. Deploy — done!

## VPS/Hosting
```
npm start
```
Use PM2 for production:
```
npm install -g pm2
pm2 start server.js --name xayzenc
```

## Password Usage
When password is set, add this BEFORE running obfuscated code:
```lua
_XayzPW_ = "your_password"
-- then run obfuscated code
```

## Features
- 12 encryption variants
- 7 protection levels (1=basic → 7=VM layer)
- Variable mangling, string encoding, dead code injection
- Control flow obfuscation, opaque predicates
- Number obfuscation, fake function injection
- Support: Lua 4, 5.1, 5.2, 5.3, 5.4, LuaU, Roblox Lua
- Optional password lock
- Real-time progress bar
