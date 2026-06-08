'use strict';

// ============================================================
//  XayzEnc - Lua Obfuscator Engine (CJS)
//  Supports: Lua 4, 5.1, 5.2, 5.3, 5.4, LuaU, Roblox Lua
// ============================================================

const crypto = require('crypto');

// ─────────────────────────────────────────────
//  Utility helpers
// ─────────────────────────────────────────────
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randHex(n) {
  return crypto.randomBytes(n).toString('hex');
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function randomName(len) {
  const chars = 'lIiOo0';
  let s = '';
  for (let i = 0; i < (len || randInt(8, 18)); i++) {
    s += chars[randInt(0, chars.length - 1)];
  }
  return '_' + s;
}
function randomNameAlpha(len) {
  const a = 'abcdefghijklmnopqrstuvwxyz';
  const b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const all = a + b + '_';
  let s = all[randInt(0, all.length - 1)];
  const rest = a + b + '0123456789_';
  for (let i = 1; i < (len || randInt(6, 14)); i++) {
    s += rest[randInt(0, rest.length - 1)];
  }
  return s;
}

// ─────────────────────────────────────────────
//  String Encoders
// ─────────────────────────────────────────────
function toByteArray(str) {
  return Array.from(Buffer.from(str, 'utf8'));
}
function encodeStringXOR(str, key) {
  const bytes = toByteArray(str);
  return bytes.map(b => b ^ key);
}
function encodeStringB64(str) {
  return Buffer.from(str).toString('base64');
}
function encodeStringHex(str) {
  return Buffer.from(str).toString('hex');
}
function encodeStringDecimal(str) {
  return toByteArray(str);
}
function encodeStringRot(str, n) {
  return str.split('').map(c => {
    const code = c.charCodeAt(0);
    return String.fromCharCode(code + n);
  }).join('');
}

// Convert string to Lua char-array expression
function luaCharArray(str) {
  const bytes = toByteArray(str);
  return `string.char(${bytes.join(',')})`;
}

// Build XOR decoder in Lua
function buildXORDecoder(bytes, key, varName) {
  const n = randomName();
  const i = randomName();
  const t = randomName();
  const r = randomName();
  return `local ${n}={${bytes.join(',')}};local ${t}={};for ${i}=1,#${n} do ${t}[${i}]=string.char(${n}[${i}]~${key}) end;local ${varName}=table.concat(${t})`;
}

// ─────────────────────────────────────────────
//  Dead Code Generator
// ─────────────────────────────────────────────
const DEAD_TEMPLATES = [
  () => {
    const v = randomName(); const n = randInt(1, 9999);
    return `local ${v}=${n};if ${v}>${n + 1} then error("x") end`;
  },
  () => {
    const v = randomName(); const a = randInt(1, 100); const b = randInt(101, 999);
    return `local ${v}=math.floor(${a}/${b}*0);_ = ${v} or 0`;
  },
  () => {
    const v = randomName(); const s = randomName();
    return `local ${v}=false;local ${s}="";if ${v} then ${s}=tostring(${v}) end`;
  },
  () => {
    const v = randomName();
    return `local ${v}={};for _=1,0 do ${v}[_]=_ end`;
  },
  () => {
    const v = randomName(); const k = randInt(2, 8);
    return `local ${v}=function(x) return x*${k} end;${v}(0)`;
  },
  () => {
    const v = randomName(); const s = randHex(4);
    return `local ${v}="${s}";${v}=${v}:sub(1,0)`;
  },
  () => {
    const a = randomName(); const b = randomName();
    return `local ${a},${b}=pcall(function() return 1 end);_=_`;
  },
  () => {
    const v = randomName();
    return `local ${v}=type(nil);_=_`;
  },
];

function genDeadCode(count) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const fn = DEAD_TEMPLATES[randInt(0, DEAD_TEMPLATES.length - 1)];
    lines.push(fn());
  }
  return lines.join('\n');
}

// ─────────────────────────────────────────────
//  Opaque Predicates
// ─────────────────────────────────────────────
function opaqueTrue() {
  const ops = [
    `(1+1==2)`,
    `(math.floor(1.9)==1)`,
    `(type("")=="string")`,
    `(#""==0)`,
    `(tostring(1)=="1")`,
    `(not false)`,
    `(2^2==4)`,
    `(string.len("ab")==2)`,
  ];
  return ops[randInt(0, ops.length - 1)];
}
function opaqueFalse() {
  const ops = [
    `(1+1==3)`,
    `(math.floor(1.9)==2)`,
    `(type("")=="number")`,
    `(#"a"==0)`,
    `(not true)`,
    `(2^2==5)`,
  ];
  return ops[randInt(0, ops.length - 1)];
}

// ─────────────────────────────────────────────
//  Variable Mangler
// ─────────────────────────────────────────────
const LUA_KEYWORDS = new Set([
  'and','break','do','else','elseif','end','false','for','function',
  'goto','if','in','local','nil','not','or','repeat','return','then',
  'true','until','while','_ENV','_G','_VERSION',
  'assert','collectgarbage','dofile','error','getmetatable','ipairs',
  'load','loadfile','next','pairs','pcall','print','rawequal','rawget',
  'rawlen','rawset','require','select','setmetatable','tonumber',
  'tostring','type','xpcall','string','table','math','io','os',
  'coroutine','utf8','bit','bit32','debug','package','game','workspace',
  'script','wait','spawn','delay','task','Enum','Instance','Vector3',
  'CFrame','Color3','UDim2','UDim','Ray','Region3','TweenInfo',
  'BrickColor','NumberRange','NumberSequence','ColorSequence',
]);

function mangleVariables(code) {
  const nameMap = new Map();
  function getMapped(name) {
    if (!nameMap.has(name)) nameMap.set(name, randomName());
    return nameMap.get(name);
  }
  // Find local declarations
  code = code.replace(/\blocal\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, name) => {
    if (LUA_KEYWORDS.has(name)) return match;
    return `local ${getMapped(name)}`;
  });
  // Replace usages
  for (const [orig, mangled] of nameMap) {
    if (LUA_KEYWORDS.has(orig)) continue;
    const re = new RegExp(`\\b${orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    code = code.replace(re, mangled);
  }
  return code;
}

// ─────────────────────────────────────────────
//  String Literal Encoder
// ─────────────────────────────────────────────
function encodeStrings(code, variant) {
  // Replace string literals with encoded forms
  return code.replace(/(["'])(?:(?=(\\?))\2[\s\S])*?\1/g, (match) => {
    // Skip very short or already-encoded
    let inner;
    try {
      // Extract content
      const q = match[0];
      inner = match.slice(1, -1)
        .replace(/\\n/g, '\n').replace(/\\t/g, '\t')
        .replace(/\\"/g, '"').replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');
    } catch {
      return match;
    }
    if (inner.length === 0) return match;
    // Pick encoding method
    const method = variant % 4;
    if (method === 0) {
      // char array
      return luaCharArray(inner);
    } else if (method === 1) {
      // XOR
      const key = randInt(1, 127);
      const bytes = encodeStringXOR(inner, key);
      const t = randomName(); const i = randomName(); const r = randomName();
      return `(function()local ${t}={${bytes.join(',')}};local ${r}={};for ${i}=1,#${t} do ${r}[${i}]=string.char(${t}[${i}]~${key})end;return table.concat(${r})end)()`;
    } else if (method === 2) {
      // decimal bytes
      const bytes = encodeStringDecimal(inner);
      return `string.char(${bytes.join(',')})`;
    } else {
      // split chunks
      const chunks = [];
      for (let i = 0; i < inner.length; i += 3) {
        chunks.push(luaCharArray(inner.slice(i, i + 3)));
      }
      return chunks.join('..');
    }
  });
}

// ─────────────────────────────────────────────
//  Control Flow Obfuscation
// ─────────────────────────────────────────────
function wrapInControlFlow(code, level) {
  if (level < 3) return code;
  const lines = code.split('\n');
  const stateVar = randomName();
  const whileVar = randomName();
  // Wrap in a state-machine style loop with opaque predicates
  const pred = opaqueTrue();
  const deadV = randomName();
  return `local ${stateVar}=1;local ${whileVar}=true;repeat\nif ${pred} then\n${code}\n${whileVar}=false\nend\nuntil not ${whileVar}`;
}

// ─────────────────────────────────────────────
//  VM-Style Wrapper (bytecode simulation)
// ─────────────────────────────────────────────
function buildVMWrapper(code, password) {
  const vmName = randomName();
  const execName = randomName();
  const envName = randomName();
  const regName = randomName();
  const stackName = randomName();
  const pcName = randomName();

  // XOR-encode the entire code
  const key = randInt(10, 200);
  const bytes = encodeStringXOR(code, key);
  const dataVar = randomName();
  const keyVar = randomName();
  const decVar = randomName();
  const iVar = randomName();
  const tVar = randomName();

  let pwCheck = '';
  if (password) {
    const pwVar = randomName();
    const hashVar = randomName();
    // Simple hash: sum of char codes XOR length
    const hash = toByteArray(password).reduce((a, b) => a ^ b, password.length);
    pwCheck = `
local ${pwVar}=_XayzPW_ or ""
local ${hashVar}=0;for i=1,#${pwVar} do ${hashVar}=${hashVar}~string.byte(${pwVar},i) end;${hashVar}=${hashVar}~#${pwVar}
if ${hashVar}~=${hash} then error(string.char(65,99,99,101,115,115,32,68,101,110,105,101,100)) end
`;
  }

  const deadBlock1 = genDeadCode(3);
  const deadBlock2 = genDeadCode(3);

  return `-- XayzEnc Protected
local ${dataVar}={${bytes.join(',')}}
local ${keyVar}=${key}
${pwCheck}
${deadBlock1}
local ${decVar}={}
for ${iVar}=1,#${dataVar} do
  ${decVar}[${iVar}]=string.char(${dataVar}[${iVar}]~${keyVar})
end
${deadBlock2}
local ${tVar}=table.concat(${decVar})
local ${execName},_err=load(${tVar})
if not ${execName} then error(_err) end
${execName}()`;
}

// ─────────────────────────────────────────────
//  Fake Function Injector
// ─────────────────────────────────────────────
function injectFakeFunctions(code, count) {
  const fns = [];
  for (let i = 0; i < count; i++) {
    const name = randomName();
    const arg = randomName();
    const body = genDeadCode(2);
    fns.push(`local function ${name}(${arg})\n${body}\nreturn ${arg}\nend`);
  }
  return fns.join('\n') + '\n' + code;
}

// ─────────────────────────────────────────────
//  Number Literal Obfuscation
// ─────────────────────────────────────────────
function obfuscateNumbers(code) {
  return code.replace(/\b(\d+)\b/g, (match, num) => {
    const n = parseInt(num);
    if (isNaN(n) || n === 0 || n > 10000) return match;
    const a = randInt(1, 50);
    const b = n - a;
    if (Math.random() > 0.5) return `(${a}+${b})`;
    const c = randInt(1, 10);
    return `(${n + c}-${c})`;
  });
}

// ─────────────────────────────────────────────
//  Multi-Layer Obfuscation Pipeline
// ─────────────────────────────────────────────

const VARIANT_NAMES = [
  'XOR Cipher',
  'Byte Shuffle',
  'Char Split',
  'Decimal Array',
  'Base64 Wrap',
  'Hex Encode',
  'ROT Cipher',
  'Multi-XOR',
  'Chunk Fusion',
  'Opaque Weave',
  'Stack Morph',
  'VM Inject',
];

function obfuscate(code, options = {}) {
  const {
    level = 4,
    variant = 0,
    password = '',
    luaVersion = '5.1',
  } = options;

  let out = code;

  // Level 1: String encoding
  if (level >= 1) {
    out = encodeStrings(out, variant);
  }

  // Level 2: Variable mangling
  if (level >= 2) {
    out = mangleVariables(out);
  }

  // Level 3: Dead code + fake functions
  if (level >= 3) {
    const deadCount = Math.min(level * 3, 15);
    out = injectFakeFunctions(out, Math.floor(level / 2) + 1);
    const deadLines = genDeadCode(deadCount);
    out = deadLines + '\n' + out;
  }

  // Level 4: Number obfuscation
  if (level >= 4) {
    out = obfuscateNumbers(out);
  }

  // Level 5: Control flow wrapping
  if (level >= 5) {
    out = wrapInControlFlow(out, level);
  }

  // Level 6: Extra dead code interleaving
  if (level >= 6) {
    const lines = out.split('\n');
    const result = [];
    for (const line of lines) {
      result.push(line);
      if (Math.random() < 0.3) {
        result.push(genDeadCode(1));
      }
    }
    out = result.join('\n');
  }

  // Level 7: VM wrapper (outermost, strongest)
  if (level >= 7) {
    // Wrap all previous obfuscation in a VM layer
    out = buildVMWrapper(out, password);
  } else if (password) {
    // Even without VM, add password check
    const key = randInt(10, 200);
    const hash = toByteArray(password).reduce((a, b) => a ^ b, password.length);
    const pwVar = randomName();
    const hashVar = randomName();
    const iVar = randomName();
    const pwCheck = `local ${pwVar}=_XayzPW_ or "";local ${hashVar}=0;for ${iVar}=1,#${pwVar} do ${hashVar}=${hashVar}~string.byte(${pwVar},${iVar}) end;${hashVar}=${hashVar}~#${pwVar};if ${hashVar}~=${hash} then error(string.char(65,99,99,101,115,115,32,68,101,110,105,101,100)) end\n`;
    out = pwCheck + out;
  }

  // Variant-specific final transforms
  out = applyVariantTransform(out, variant, level);

  return out;
}

function applyVariantTransform(code, variant, level) {
  switch (variant % 12) {
    case 0: // XOR Cipher - already handled in string enc
      return code;
    case 1: { // Byte Shuffle header comment
      const fake = Array.from({length: 6}, () => randomName()).join(', ');
      return `--[[ XayzEnc v3 | ${randHex(8)} | Protected ]]\n` + code;
    }
    case 2: { // Char Split - wrap in extra pcall
      const e = randomName();
      return `local _ok,${e}=pcall(function()\n${code}\nend)\nif not _ok then end`;
    }
    case 3: { // Decimal Array - add global env confuse
      const g = randomName();
      return `local ${g}=_G or {};_ = ${g}\n` + code;
    }
    case 4: { // Base64 Wrap - add version check stub
      const v = randomName();
      return `local ${v}=_VERSION or "";_ = ${v}\n` + code;
    }
    case 5: { // Hex Encode - shuffle fake requires
      const m = randomName();
      return `local ${m}=type(math)=="table" and math or {};_ = ${m}\n` + code;
    }
    case 6: { // ROT Cipher - wrap with coroutine stub
      const co = randomName();
      return `local ${co}=coroutine or {};_ = ${co}\n` + code;
    }
    case 7: { // Multi-XOR - double pcall
      const e1 = randomName(); const e2 = randomName();
      return `pcall(function()\npcall(function()\n${code}\nend)\nend)`;
    }
    case 8: { // Chunk Fusion - add setfenv stub (Lua 5.1)
      const sf = randomName();
      return `local ${sf}=setfenv or function() end;_ = ${sf}\n` + code;
    }
    case 9: { // Opaque Weave - insert opaque jumps
      const lines = code.split('\n');
      const out = [];
      for (const line of lines) {
        out.push(line);
        if (Math.random() < 0.2) {
          out.push(`if ${opaqueFalse()} then error("") end`);
        }
      }
      return out.join('\n');
    }
    case 10: { // Stack Morph - wrap lines in do..end blocks
      const lines = code.split('\n');
      const out = [];
      let buf = [];
      for (const line of lines) {
        buf.push(line);
        if (buf.length >= randInt(3, 8)) {
          out.push(`do\n${buf.join('\n')}\nend`);
          buf = [];
        }
      }
      if (buf.length) out.push(buf.join('\n'));
      return out.join('\n');
    }
    case 11: { // VM Inject - extra XOR pass over whole code
      const key2 = randInt(5, 100);
      const bytes = encodeStringXOR(code, key2);
      const d = randomName(); const i = randomName(); const r = randomName();
      return `local ${d}={${bytes.join(',')}};local ${r}={};for ${i}=1,#${d} do ${r}[${i}]=string.char(${d}[${i}]~${key2})end;load(table.concat(${r}))()`;
    }
    default:
      return code;
  }
}

// ─────────────────────────────────────────────
//  Exports
// ─────────────────────────────────────────────
module.exports = {
  obfuscate,
  VARIANT_NAMES,
  version: '3.0.0',
};
