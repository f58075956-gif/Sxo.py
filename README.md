# 🛠️ Lua Dumper Bot v2.0

> High-end Discord bot for Lua script analysis — deobfuscation, obfuscation, bytecode reconstruction, and readability improvement.

---

## 📋 Feature Overview

| Command | Description |
|---|---|
| `!deob` | Full multi-layer deobfuscation pipeline |
| `!obf` | Standard Lua obfuscation (base64 + junk) |
| `!obf2` | Advanced XOR byte-array obfuscation |
| `!decode` | Single-layer decoder (base64, hex, string.char) |
| `!luadump` | Deobfuscate + reconstruct `.luac` bytecode |
| `!unluac` | Decompile `.luac` binary → readable Lua |
| `!moonsec` | Specialized Moonsec decoder + LUAC rebuild |
| `!loadstring` | Inline all `loadstring()` / `load()` layers |
| `!ping` | Latency check |
| `!log [n]` | Last N lines of execution log |
| `!env` | Runtime configuration |
| `!get / !set / !unset` | Per-user settings |
| `!checkban` | Admin ban management |
| `!add` | Admin whitelist management |
| `!help [cmd]` | Command reference |

---

## 🧱 Architecture

```
lua-dumper-bot/
├── index.js                  ← Entry point
├── .env.example              ← Config template
├── discord/
│   ├── client.js             ← Discord.js client factory
│   ├── commandHandler.js     ← Command loader & registry
│   ├── messageListener.js    ← Message parser + rate limiter
│   └── attachmentProcessor.js← File upload handler
├── core/
│   ├── analyzer.js           ← Main analysis pipeline (detect → deob → beautify → LUAC)
│   ├── detector.js           ← Signature + entropy-based detection
│   ├── deobfuscator.js       ← Multi-handler dispatcher
│   ├── obfuscator.js         ← Standard & advanced obfuscation
│   ├── parser.js             ← Beautifier, var renamer, junk remover, loadstring inliner
│   └── luac_rebuilder.js     ← Lua 5.1 bytecode reconstruction
├── handlers/
│   ├── moonsec.js            ← XOR key recovery + byte-array decoding
│   ├── luraph.js             ← Outer payload extraction
│   ├── wearedevs.js          ← XOR key + base64 decode
│   ├── luaobfuscator.js      ← Name mangling + dispatch flattening
│   ├── iprotect.js           ← Numeric XOR + base64
│   ├── nigalose.js           ← Running-sum XOR decoder
│   ├── ryzens.js             ← gsub pattern resolver
│   ├── xhider.js             ← Single-layer base64 extractor
│   ├── anonymous_net.js      ← Base64 + char-shift decoder
│   ├── twentyfivems.js       ← table.concat byte array decoder
│   ├── moonix.js             ← Byte-rotation decoder
│   ├── virtualbox.js         ← Bytecode disassembler
│   └── generic.js            ← Heuristic fallback handler
├── commands/
│   ├── deob.js  obf.js  obf2.js  decode.js
│   ├── luadump.js  unluac.js  moonsec.js  loadstring.js
│   ├── ping.js  log.js  env.js
│   ├── get.js  set.js  unset.js
│   ├── checkban.js  add.js  help.js
├── security/
│   ├── sandbox.js            ← vm2-isolated execution tracing
│   ├── rateLimiter.js        ← Sliding-window per-user rate limit
│   ├── banSystem.js          ← SQLite-backed ban management
│   ├── payloadScanner.js     ← Token / webhook / exfil detection
│   └── whitelist.js          ← Admin whitelist
└── utils/
    ├── logger.js             ← Winston structured logger
    ├── responder.js          ← Discord embed helpers
    ├── queue.js              ← p-queue async job queue
    ├── entropy.js            ← Shannon entropy calculator
    ├── performanceTracker.js ← Per-stage timing
    └── envValidator.js       ← Startup env checks
```

---

## ⚙️ Supported Obfuscators

| Obfuscator | Detection | Handler | Notes |
|---|---|---|---|
| Moonsec | ✅ | ✅ Advanced (XOR key recovery, LFSR schedule) | LUAC rebuild supported |
| WeAreDevs | ✅ | ✅ | XOR key + base64 |
| LuaObfuscator | ✅ | ✅ | Name mangling + control-flow flatten |
| Luraph v13 | ✅ | ⚠️ Partial | Outer layer only; VM core needs manual review |
| iProtect | ✅ | ✅ | Numeric XOR + base64 |
| Nigalose | ✅ | ✅ | Running-sum XOR |
| Ryzens | ✅ | ✅ | gsub cipher |
| XHider | ✅ | ✅ | Single-layer base64 |
| Anonymous.net v1 | ✅ | ✅ | Base64 + char-shift |
| 25ms | ✅ | ⚠️ Partial | table.concat byte array |
| Moonix v1.2 | ✅ | ✅ | Byte-rotation |
| VirtualBox VM | ✅ | ⚠️ Disasm only | Full VM emulation out of scope |
| Generic (high entropy) | ✅ | ✅ | Fallback heuristics |

---

## 🚀 Setup & Deployment

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | ≥ 18.0.0 | Runtime |
| npm | ≥ 9 | Package manager |
| Java (optional) | ≥ 11 | `!unluac` via `unluac.jar` |
| `luac` binary (optional) | 5.1 | LUAC compilation |
| `luadec` binary (optional) | any | Alternative decompiler |

### 1. Clone & Install

```bash
git clone https://github.com/yourname/lua-dumper-bot.git
cd lua-dumper-bot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values:
#   DISCORD_TOKEN=...
#   ADMIN_USER_IDS=your_discord_id
```

### 3. Create Data Directory

```bash
mkdir -p data logs
```

### 4. (Optional) Add unluac.jar

Download from https://github.com/nicowillis/unluac/releases and place at:
```
lua-dumper-bot/bin/unluac.jar
```

### 5. Run

```bash
# Development (auto-restart)
npm run dev

# Production
npm start

# Production with PM2
pm2 start index.js --name lua-dumper-bot
pm2 save
```

---

## 🔐 Security Model

- **No raw execution** — Scripts are never `eval()`-ed or run natively; all analysis is static.
- **Payload scanner** — Token patterns, webhook URLs, `os.execute`, filesystem writes, and HTTP exfiltration are detected and blocked before processing.
- **Sandboxed tracing** — The vm2 sandbox is used for structural analysis only, with a configurable timeout.
- **Rate limiting** — Sliding-window limiter (default: 5 commands / 10s per user).
- **Ban & whitelist system** — SQLite-backed, admin-controlled.
- **Max script size** — Configurable (default 512 KB); larger files are rejected before download completes.

---

## 🧪 Example Usage

```
# Deobfuscate a pasted script
!deob
local a = {72,101,108,108,111}

# Deobfuscate an uploaded file
!deob       ← attach script.lua

# Moonsec with LUAC reconstruction
!moonsec    ← attach moonsec_script.lua

# Reconstruct bytecode from any script
!luadump    ← attach script.lua

# Decompile a .luac binary
!unluac     ← attach compiled.luac

# Obfuscate your own script
!obf
print("Hello World")

# Decode a base64 blob
!decode SGVsbG8gV29ybGQ=

# Admin: ban a user
!checkban ban 123456789 Spamming malicious scripts

# Admin: add to whitelist
!add add 987654321
```

---

## 🔧 Adding a New Obfuscator Handler

1. Create `handlers/myobfuscator.js` implementing:
   ```js
   async function deobfuscate(script, opts) {
     // ... detection and decoding logic
     return { output: decodedScript, changed: true, info: 'MyObfuscator: decoded' };
   }
   module.exports = { deobfuscate };
   ```

2. Add a signature entry to `core/detector.js` in the `SIGNATURES` array.

3. Register the handler key in `core/deobfuscator.js` `HANDLER_MAP`.

4. Done — the multi-layer pipeline picks it up automatically.

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `discord.js` | Discord API client |
| `dotenv` | Environment config |
| `winston` | Structured logging |
| `p-queue` | Async job queue |
| `quick.db` | SQLite user data (bans, whitelist, config) |
| `vm2` | Sandboxed JS execution for tracing |
| `js-base64` | Base64 encode/decode |
| `axios` | Attachment download |
| `lz-string` | LZ compression helpers |
| `string-similarity` | Heuristic comparisons |
| `chalk` | Console colours |
| `zod` | Runtime schema validation |

---

## 📄 License

MIT — use freely, contribute back improvements.
