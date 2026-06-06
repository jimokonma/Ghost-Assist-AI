# GHOSTASSIST AI
## Invisible Real-Time AI Meeting & Interview Assistant
### Product Requirements Document — Version 1.0

---

| Field | Value |
|---|---|
| **Product Name** | GhostAssist AI |
| **Version** | 1.0 — Full Feature Release |
| **Platform** | Windows 10/11 — Electron Desktop App |
| **AI Engine** | Claude API (Anthropic) |
| **Prepared By** | Jim Okonma, Digital Okonma Technologies |
| **Date** | June 2025 |
| **Status** | Ready for Claude Code Build |

---

## 1. Executive Summary

GhostAssist AI is a Windows desktop application built with Electron and powered by Anthropic's Claude API. It operates as an invisible, real-time AI assistant that listens to meetings, interviews, and conferences through system audio and responds to questions or prompts instantly — without ever being detected by screen sharing software such as Zoom, Google Meet, or Microsoft Teams.

The application floats as a draggable overlay on the user's physical monitor, visible only to them. When the user holds a designated hotkey, the app captures live audio. Upon release, Claude processes the captured audio and returns a structured, easy-to-read answer in the floating window. For coding questions, the user can hold a screenshot hotkey to capture the on-screen problem and receive a fully explained solution.

GhostAssist AI targets professionals in high-stakes scenarios: technical interviews, sales calls, client meetings, live presentations, and real-time Q&A sessions.

---

## 2. Problem Statement

Professionals in real-time conversations — job interviews, client demos, technical meetings — often face unexpected, complex questions they cannot answer with full confidence. Existing AI tools require switching context, typing queries, or sharing their screen, all of which expose the tool to the interviewer or caller.

**Current market limitations:**

- Most require manual text input — not suitable for live verbal conversations
- Browser-based tools are easily detected during screen sharing
- None support full multi-modal input (audio + screenshot + coding analysis) in a single tool
- Response formats are often verbose and difficult to scan quickly under pressure
- No existing tool provides a completely stealth, OS-level invisible overlay for Windows

---

## 3. Goals & Success Metrics

### 3.1 Primary Goals

- Deliver real-time AI responses to spoken or on-screen questions **within 3 seconds** of hotkey release
- Maintain **complete invisibility** to all major screen sharing and recording platforms on Windows
- Provide **clean, scannable, structured answers** optimised for quick reading under pressure
- Support both verbal interview questions and visual coding problems via screenshot capture
- Run entirely on the user's local machine with **no cloud backend required**

### 3.2 Success Metrics

| Metric | Target |
|---|---|
| **Response Time** | < 3 seconds from hotkey release to first answer token |
| **Stealth Rate** | 100% undetected across Zoom, Google Meet, Teams, WebEx |
| **Accuracy** | Claude API response quality — structured, concise, correct |
| **Uptime** | Zero crash rate during a 60-minute interview session |
| **Audio Quality** | Clean system audio capture with < 5% transcription error rate |
| **User Satisfaction** | Answer readable and usable within 5 seconds of appearing |

---

## 4. Target Users

### 4.1 Primary Users
- Software engineers in technical coding interviews (LeetCode, HackerRank, take-homes)
- Professionals in high-stakes sales calls, discovery calls, and client demos
- Job candidates in behavioural and panel interviews
- Anyone presenting in conferences, webinars, or live Q&A sessions

### 4.2 Secondary Users
- Developers and freelancers who want a real-time coding assistant during pair programming
- Non-technical professionals handling complex product or data questions in meetings

---

## 5. Feature Requirements

| Feature | Description | Priority | Phase |
|---|---|---|---|
| Stealth Overlay Window | Floating draggable window invisible to screen share software at OS level | P0 | Phase 1 |
| Hotkey Audio Capture | Hold hotkey to record system audio; release to trigger Claude analysis | P0 | Phase 1 |
| Real-Time AI Response | Claude API processes question, returns structured answer in < 3s | P0 | Phase 1 |
| System Audio Tap | Capture audio from meeting apps (Meet, Zoom, Teams) via system loopback | P0 | Phase 1 |
| Screenshot Capture | Hold hotkey to capture screen; Claude analyses code/problem visually | P0 | Phase 1 |
| Structured Answers | Responses with headers, bullet points, code blocks — scannable format | P0 | Phase 1 |
| Local SQLite Storage | All history, preferences, and transcripts stored locally on device | P0 | Phase 1 |
| Draggable Window | User can drag the overlay anywhere on their physical monitor | P0 | Phase 1 |
| Keyboard Hotkeys | Configurable global hotkeys that don't propagate to screen sharing tools | P0 | Phase 1 |
| Speaker Identification | Distinguish between different voices in the meeting audio | P1 | Phase 1 |
| Knowledge Base | User uploads resume/docs; Claude uses them to personalise answers | P1 | Phase 1 |
| STAR Response Mode | Pre-built templates for behavioural interview answers (Situation-Task-Action-Result) | P1 | Phase 1 |
| Coding Interview Mode | Optimised flow for LeetCode-style problems: approach, code, complexity | P1 | Phase 1 |
| Session History | View, search, and replay past question-answer pairs from SQLite | P1 | Phase 1 |
| Window Opacity Control | Slide transparency of overlay from 30% to 100% | P1 | Phase 1 |
| Font Size Control | Increase/decrease answer text size on the fly | P1 | Phase 1 |
| Audio Whisper Mode | Optional text-to-speech reads answer quietly through earbuds | P2 | Phase 2 |
| Performance Analytics | Track question types, response times, session duration | P2 | Phase 2 |
| Auto-Meeting Detection | Detect when a meeting app opens and prompt user to activate | P2 | Phase 2 |
| Multi-Language Support | Transcription and response in French, Spanish, Portuguese, others | P2 | Phase 2 |

---

## 6. Detailed Feature Specifications

### 6.1 Stealth Overlay Window

The core of GhostAssist AI is a native Electron window configured at the OS level to be excluded from all screen capture APIs on Windows. This is achieved using the Windows `SetWindowDisplayAffinity` API with `WDA_EXCLUDEFROMCAPTURE`, which instructs the OS to render the window on the physical display but exclude it from all DirectX/GDI capture calls — including those made by Zoom, Google Meet, Microsoft Teams, WebEx, and OBS.

- Window type: `BrowserWindow` with `transparent: true`, `frame: false`, `alwaysOnTop: true`
- Screen capture exclusion: `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` via `node-ffi-napi` or native Electron addon
- No system tray icon: the app does not appear in the taskbar or system tray
- Default position: top-left corner, fully draggable with mouse
- Resize handles: user can resize the window width and height
- Opacity slider: 30–100% transparency controlled by the user
- Minimum size: 380px wide, 200px tall

### 6.2 Hotkey Audio Capture

The user holds a configurable global hotkey (default: `Alt+Z`) to begin recording. The recording captures system loopback audio — the audio coming from the meeting application — not the user's microphone. On release, the captured audio buffer is sent to the transcription pipeline.

- Hotkey registration: `Electron globalShortcut`, registered at OS level — not detectable by browser or meeting apps
- Audio capture: Windows WASAPI loopback via `naudiodon` or `node-audio-windows`
- Buffer duration: captures from hotkey press to release — no pre-buffering needed
- Format: 16kHz mono PCM, then transcribed via OpenAI Whisper API
- Fallback: if audio capture fails, user can type query directly in the overlay text input
- Default hotkeys: `Alt+Z` (listen and respond), `Alt+S` (screenshot capture)
- All hotkeys fully configurable in Settings panel

### 6.3 Screenshot Capture & Visual Analysis

When the user holds `Alt+S`, the app captures a screenshot of the primary monitor, excluding the GhostAssist overlay window itself. The screenshot is sent to Claude's vision API along with a prompt asking Claude to identify the coding problem, understand the constraints, and provide a step-by-step solution with clean code.

- Capture method: `Electron desktopCapturer` or Windows GDI `BitBlt`
- Overlay excluded: the GhostAssist window is excluded from the screenshot
- Image sent to Claude: as base64-encoded PNG with the vision prompt
- Claude returns: problem summary, approach, code solution, time & space complexity
- Multiple screenshots: user can capture again to update context or ask a follow-up

### 6.4 AI Response Engine (Claude Integration)

All AI processing is done through the Anthropic Claude API. The app uses `claude-sonnet-4-20250514` for optimal balance of speed and intelligence. Responses are streamed to the overlay in real time as tokens arrive.

- **Model:** `claude-sonnet-4-20250514`
- **Streaming:** yes — tokens rendered as they arrive for zero perceived latency
- **System prompt:** instructs Claude to respond concisely, use plain language, structure with headers and bullets, include code blocks when needed
- **Context window:** last 3 exchanges included for continuity
- **Knowledge base injection:** if user has uploaded a resume or docs, they are injected into the system prompt
- **Mode-specific prompts:** Interview, Coding, Meeting, Sales — each has a tailored system prompt

### 6.5 Structured Response Format

All Claude responses are formatted for maximum scannability under pressure. The answer panel renders markdown in the overlay window.

- Short, punchy sentences — no filler words or padding
- Headers for multi-part answers (e.g., `Approach / Code / Complexity`)
- Bullet points for lists of steps or options
- Syntax-highlighted code blocks for all code
- Bold for the single most important phrase in each section
- **Maximum answer length:** 300 words — Claude is instructed to be brief

### 6.6 Local SQLite Database

All data is stored locally using `better-sqlite3` — no data ever leaves the user's machine except to the Claude API for AI processing.

- Tables: `sessions`, `questions`, `answers`, `settings`, `knowledge_base`, `hotkeys`
- `sessions` — stores timestamp, duration, mode, and total exchanges
- `exchanges` — audio transcription or typed query, screenshot path, Claude response, response time
- `settings` — key-value store for all user preferences
- `knowledge_base` — uploaded documents stored as text chunks
- History viewer: built-in panel to browse, search, and replay past sessions

---

## 7. Multi-Agent Build Orchestration

GhostAssist AI will be built using a **multi-agent Claude Code architecture**. Each agent owns a specific domain of the application. Agents work simultaneously and in parallel. When an agent completes its module, it marks it done. The Testing Agent immediately picks up completed modules and runs unit, integration, E2E, and performance tests. All agents report to the Orchestrator Agent.

### 7.1 Agent Roster

| Agent | Responsibility | Tech | Output |
|---|---|---|---|
| **Orchestrator** | Coordinates all agents, tracks progress, resolves conflicts, merges outputs | Claude Code + task queue | Build plan, agent assignments, final merge |
| **Audio Agent** | System audio loopback capture, hotkey recording, PCM buffer management | WASAPI, naudiodon | Raw audio buffer on hotkey release |
| **Transcription Agent** | Convert audio buffer to text via Whisper API, speaker diarization | OpenAI Whisper API, faster-whisper | Timestamped transcript with speaker labels |
| **Vision Agent** | Screenshot capture, image preprocessing, visual context extraction | Electron desktopCapturer, Sharp | Base64 image + extracted text context |
| **Claude Agent** | Build Claude API calls, manage system prompts, stream responses, mode switching | Anthropic SDK, streaming API | Streamed markdown response tokens |
| **UI Agent** | Build Electron overlay window, stealth config, drag, resize, opacity, markdown renderer | Electron, React, marked.js | Functional invisible overlay UI |
| **Storage Agent** | SQLite schema, CRUD operations, session management, knowledge base indexing | better-sqlite3, Node.js | Local database, all read/write ops |
| **Settings Agent** | Hotkey config, mode settings, font/opacity, knowledge base upload | Electron IPC, React settings panel | Persistent user preferences |
| **Testing Agent** | Unit, integration, E2E, and performance testing across all modules | Jest, Playwright, Electron testing | Test report — pass/fail per module |

### 7.2 Agent Communication Protocol

- All agents communicate via a central **EventBus** (`Node.js EventEmitter`)
- Each agent publishes events: `agent:audio:ready`, `agent:transcript:ready`, `agent:vision:ready`, `agent:response:streaming`, `agent:response:complete`
- Orchestrator subscribes to all events and manages state machine
- Completed modules are flagged in a shared **task registry** (`JSON file`)
- Testing Agent subscribes to `registry.on('module:done')` and begins test suite immediately
- Integration tests run when two or more related agents mark complete
- E2E tests run when all core agents (Audio, Transcription, Claude, UI) mark complete
- Performance tests measure: audio capture latency, transcription time, Claude TTFT, render time

### 7.3 Parallel Build Tracks

| Track | Agents | Notes |
|---|---|---|
| **Track A — Core Audio** | Audio Agent + Transcription Agent | Runs in parallel |
| **Track B — AI Engine** | Claude Agent + Vision Agent | Runs in parallel |
| **Track C — Interface** | UI Agent + Settings Agent | Runs in parallel |
| **Track D — Data** | Storage Agent | Starts immediately, blocks nothing |
| **Track E — QA** | Testing Agent | Activates as soon as any Track marks done |
| **Track F — Merge** | Orchestrator | Merges all tracks after Track E passes tests |

---

## 8. Technical Stack

| Layer | Technology |
|---|---|
| **Runtime** | Electron (Node.js + Chromium) — Windows 10/11 |
| **Frontend** | React 18 + Tailwind CSS (within Electron renderer) |
| **AI Engine** | Anthropic Claude API — `claude-sonnet-4-20250514` with streaming |
| **Audio Capture** | `naudiodon` or `node-audio-windows` for WASAPI system loopback |
| **Transcription** | OpenAI Whisper API (cloud) or `faster-whisper` (local fallback) |
| **Screenshot** | `Electron desktopCapturer` + Sharp for image processing |
| **Local Database** | `better-sqlite3` — embedded SQLite, no server required |
| **Stealth Window** | Windows `SetWindowDisplayAffinity` via `node-ffi-napi` or native addon |
| **Markdown Render** | `marked.js` + `highlight.js` for code syntax highlighting |
| **Hotkeys** | `Electron globalShortcut` — OS-level, undetectable by meeting apps |
| **IPC** | Electron IPC (`ipcMain` / `ipcRenderer`) for main-renderer communication |
| **Packaging** | `electron-builder` — produces `.exe` installer for Windows |
| **Testing** | Jest (unit), Playwright (E2E), electron-testing-library |
| **Build Tool** | Vite + `electron-vite` for fast HMR during development |

---

## 9. Hotkey Reference

| Hotkey | Action |
|---|---|
| `Alt + Z` (hold) | Record system audio — release to send to Claude for response |
| `Alt + S` (hold) | Capture screenshot — release to send to Claude for visual analysis |
| `Alt + H` | Toggle overlay visibility (show/hide on physical monitor) |
| `Alt + C` | Clear current answer panel |
| `Alt + +` / `Alt + -` | Increase / decrease overlay font size |
| `Alt + [` / `Alt + ]` | Decrease / increase overlay opacity |
| `Alt + M` | Cycle through modes: Interview → Coding → Meeting → Sales |
| `Alt + ,` | Open Settings panel |

> All hotkeys are fully configurable in the Settings panel. Defaults shown above.

---

## 10. User Flows

### 10.1 Primary Flow — Live Audio Question

1. User opens GhostAssist AI — overlay appears in top-left corner, invisible to screen share
2. User joins Zoom / Google Meet / Teams meeting and shares their screen normally
3. Interviewer or participant asks a question verbally
4. User holds `Alt+Z` — audio recording begins from system loopback
5. User releases `Alt+Z` — audio buffer sent to Whisper for transcription
6. Transcribed question sent to Claude with mode-appropriate system prompt
7. Claude streams a structured answer back — visible in the overlay within 3 seconds
8. User reads the answer and responds naturally in the meeting
9. Exchange saved to local SQLite database automatically

### 10.2 Coding Interview Flow — Screenshot Analysis

1. Interviewer shares a coding problem on screen (LeetCode, HackerRank, shared editor)
2. User holds `Alt+S` — full screen captured (overlay excluded from capture)
3. User releases `Alt+S` — screenshot sent to Claude Vision
4. Claude returns: problem restatement, brute-force approach, optimal approach, code solution, time complexity, space complexity
5. User reads solution in overlay and begins coding

### 10.3 Settings & Knowledge Base Setup

1. User opens Settings with `Alt+,`
2. User uploads their CV / resume / technical docs to the Knowledge Base
3. Documents chunked and stored in local SQLite
4. In all future sessions, Claude references the knowledge base for personalised answers
5. User configures hotkeys, preferred mode, font size, opacity, and audio device

---

## 11. UI Specification

### 11.1 Overlay Window Layout

| Property | Value |
|---|---|
| **Default Position** | Top-left, 20px from edge |
| **Default Size** | 420px wide × auto height (max 600px with scroll) |
| **Background** | Dark semi-transparent (`#0F172A` at 85% opacity) |
| **Border** | 1px solid accent colour with subtle glow |
| **Drag Handle** | Top bar — click and drag to move anywhere on screen |
| **Resize** | Bottom-right corner resize handle |
| **Font** | JetBrains Mono for code, Inter for body text |
| **Text Colour** | White body, green for code, yellow for headers |
| **Scrollable** | Answer panel scrolls if content exceeds max height |

### 11.2 Overlay Panels

- **Status Bar** — top strip showing current mode, recording indicator (red dot when `Alt+Z` held), hotkey hints
- **Answer Panel** — main scrollable area showing Claude's structured markdown response
- **Transcript Panel** — collapsible strip showing the last transcribed question
- **Action Bar** — bottom strip with quick buttons: Clear, Copy Answer, Toggle Mode, Settings
- **Settings Panel** — full overlay panel with tabs: Hotkeys, Knowledge Base, Audio Device, Appearance
- **History Panel** — browse and replay past sessions from SQLite

---

## 12. Response Modes

| Mode | Behaviour |
|---|---|
| **Interview Mode** | STAR-framed behavioural answers. Concise. Uses knowledge base (resume) for personalisation |
| **Coding Mode** | Problem restatement, brute force, optimal solution, clean code, complexity analysis |
| **Meeting Mode** | Short, confident answers to meeting questions. Action items highlighted |
| **Sales Mode** | Objection handling, product positioning, next steps. Confident and direct |
| **General Mode** | Default. Claude responds naturally with structure based on question type |

---

## 13. Local Data Model (SQLite)

### 13.1 Schema

```sql
-- Sessions
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  mode TEXT,
  duration_seconds INTEGER,
  question_count INTEGER DEFAULT 0
);

-- Exchanges (question + answer pairs)
CREATE TABLE exchanges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES sessions(id),
  question_text TEXT,
  answer_text TEXT,
  screenshot_path TEXT,
  response_time_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings (key-value store)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Knowledge Base
CREATE TABLE knowledge_base (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT,
  content_text TEXT,
  chunk_index INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audio Devices
CREATE TABLE audio_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_name TEXT,
  device_id TEXT,
  is_default BOOLEAN DEFAULT 0
);
```

### 13.2 Data Privacy

- All data stored locally — no telemetry, no analytics, no cloud sync
- Only data leaving the device: audio buffer to Whisper API, text/image to Claude API
- User can clear all data at any time from Settings
- SQLite file location: `%APPDATA%\GhostAssistAI\data.db`

---

## 14. Testing Strategy

### 14.1 Unit Tests (Jest) — Per Agent

- **Audio Agent:** test buffer capture, silence detection, format conversion
- **Transcription Agent:** mock Whisper responses, verify transcript parsing
- **Vision Agent:** test screenshot capture, image encoding, overlay exclusion
- **Claude Agent:** mock API responses, verify prompt construction, test streaming parser
- **Storage Agent:** test all CRUD operations, session lifecycle, knowledge base chunking
- **UI Agent:** test React component rendering, markdown display, opacity controls

### 14.2 Integration Tests

- Audio → Transcription: full pipeline from hotkey press to transcript text
- Screenshot → Claude Vision: image capture to structured code answer
- Claude → UI: streaming response renders correctly in overlay
- Storage → UI: session history loads and displays correctly

### 14.3 End-to-End Tests (Playwright + Electron)

- Full interview simulation: launch app, press hotkey, simulate audio, verify answer appears
- Coding flow: press screenshot hotkey, verify Claude response with code block
- Settings: change hotkey, verify it registers correctly at OS level
- Session history: complete session, close app, reopen, verify history persists

### 14.4 Performance Benchmarks

| Benchmark | Target |
|---|---|
| Audio capture latency | < 50ms from hotkey press to buffer start |
| Transcription time | < 1,500ms for a 10-second audio clip |
| Claude TTFT (time to first token) | < 1,000ms |
| Total response time (hotkey release → first visible text) | < 3,000ms |
| Memory usage | < 200MB during active session |
| CPU usage | < 15% on idle meeting with no active processing |

---

## 15. Platform & Compatibility

| Item | Detail |
|---|---|
| **OS** | Windows 10 (build 1903+) and Windows 11 |
| **Electron Version** | Latest stable (v31+) |
| **Node.js** | v20 LTS |
| **Zoom** | Tested invisible on v5.x and v6.x |
| **Google Meet** | Tested invisible — Chrome and Electron-based Meet |
| **Microsoft Teams** | Tested invisible — Desktop client |
| **WebEx** | Tested invisible — Desktop client |
| **OBS Studio** | Tested invisible — window capture mode |
| **Architecture** | x64 only for v1.0 |
| **Installer** | `.exe` via electron-builder (NSIS installer) |

> **Note on Zoom v6.16+:** Users may need to set Screen Capture Mode to "Advanced capture with window filtering" in Zoom Settings → Share Screen. GhostAssist AI will detect Zoom version and prompt the user with this instruction automatically.

---

## 16. Phased Roadmap

### Phase 1 — Core Build (Weeks 1–4)

- [ ] Stealth overlay window with `SetWindowDisplayAffinity`
- [ ] Global hotkey system (`Alt+Z` listen, `Alt+S` screenshot)
- [ ] System audio loopback capture via WASAPI
- [ ] Whisper transcription pipeline
- [ ] Claude API integration with streaming
- [ ] Structured markdown response renderer
- [ ] SQLite local database with full session storage
- [ ] Interview, Coding, Meeting, Sales modes
- [ ] Knowledge base upload and injection
- [ ] Draggable, resizable, opacity-controlled overlay window
- [ ] Settings panel with hotkey configuration
- [ ] Speaker identification
- [ ] Full test suite: unit, integration, E2E, performance

### Phase 2 — Enhancement (Weeks 5–8)

- [ ] Audio Whisper Mode — TTS reads answer quietly through earbuds
- [ ] Performance Analytics dashboard
- [ ] Auto-meeting detection (detects when Zoom/Meet opens)
- [ ] Multi-language transcription and responses
- [ ] Session export to PDF or Markdown
- [ ] Answer bookmarking and tagging

### Phase 3 — Scale (Post-Launch)

- [ ] macOS support
- [ ] Optional cloud sync (encrypted) for cross-device history
- [ ] Team/enterprise licensing with shared knowledge bases
- [ ] Integration with LinkedIn profile for automatic personalisation

---

## 17. Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Zoom v6.16+ detection | Prompt user to enable Advanced Capture Mode — include one-click guide in app |
| WASAPI loopback on some drivers | Fallback to virtual audio cable (VB-Cable) with setup guide |
| Whisper API latency spikes | Local `faster-whisper` fallback for offline or slow connection scenarios |
| Claude API rate limits | Implement request queue and backoff — surface error in overlay gracefully |
| `SetWindowDisplayAffinity` support | Requires Windows 10 build 1903+ — enforce in installer with clear error |
| High CPU during recording | Audio capture runs on separate worker thread, not main or renderer process |
| User hotkey conflicts | Validate hotkey doesn't conflict with system shortcuts at Settings save time |

---

## 18. Claude Code Build Instructions

### 18.1 Initialisation

```bash
# 1. Create project
npx create-electron-vite ghostassist-ai --template react

cd ghostassist-ai

# 2. Install dependencies
npm install @anthropic-ai/sdk better-sqlite3 naudiodon sharp marked highlight.js node-ffi-napi

npm install -D jest playwright @playwright/test electron-builder vite

# 3. Configure electron-builder in package.json for Windows x64
```

### 18.2 Directory Structure

```
ghostassist-ai/
├── src/
│   ├── main/
│   │   ├── main.js              # App entry, window creation, IPC handlers
│   │   ├── stealth.js           # SetWindowDisplayAffinity native call
│   │   ├── hotkeys.js           # Electron globalShortcut registration
│   │   ├── audio.js             # WASAPI loopback capture
│   │   ├── transcription.js     # Whisper API call
│   │   ├── screenshot.js        # Electron desktopCapturer
│   │   ├── claude.js            # Anthropic SDK, streaming, mode prompts
│   │   ├── database.js          # better-sqlite3 CRUD
│   │   └── eventbus.js          # Central EventEmitter
│   ├── renderer/
│   │   ├── App.jsx
│   │   └── components/
│   │       ├── AnswerPanel.jsx       # Markdown renderer
│   │       ├── StatusBar.jsx         # Mode + recording indicator
│   │       ├── TranscriptPanel.jsx   # Last question text
│   │       ├── ActionBar.jsx         # Quick action buttons
│   │       ├── SettingsPanel.jsx     # Full settings UI
│   │       └── HistoryPanel.jsx      # Session history viewer
│   └── agents/
│       ├── orchestrator.js
│       ├── audio-agent.js
│       ├── transcription-agent.js
│       ├── vision-agent.js
│       ├── claude-agent.js
│       ├── ui-agent.js
│       ├── storage-agent.js
│       └── settings-agent.js
├── tests/
│   ├── unit/                    # One test file per agent
│   ├── integration/             # Cross-agent pipeline tests
│   ├── e2e/                     # Full app simulation tests
│   └── performance/             # Latency and CPU benchmarks
├── electron-builder.config.js
├── vite.config.js
└── package.json
```

### 18.3 Agent Template

Every agent must follow this structure:

```javascript
// src/agents/example-agent.js
const EventBus = require('./eventbus');
const registry = require('./registry');

class ExampleAgent {
  constructor() {
    this.name = 'example-agent';
  }

  async start() {
    try {
      // Agent logic here
      await this.doWork();

      // Mark complete
      registry.markDone(this.name);
      EventBus.emit('agent:module:complete', { agent: this.name });

    } catch (err) {
      EventBus.emit('agent:error', { agent: this.name, error: err.message });
    }
  }

  async doWork() {
    // Implementation
  }
}

module.exports = new ExampleAgent();
```

### 18.4 Orchestrator Instructions for Claude Code

```
Build all agents simultaneously across parallel tracks:

Track A: Audio Agent + Transcription Agent
Track B: Claude Agent + Vision Agent
Track C: UI Agent + Settings Agent
Track D: Storage Agent (start immediately)
Track E: Testing Agent (activates on first module:complete event)
Track F: Orchestrator merge (runs after Track E passes all tests)

Rules:
- Each agent exports start() and emits completion via EventBus
- Agents mark themselves done: registry.markDone('agent-name')
- Testing Agent listens for registry.on('module:done') and runs tests immediately
- All agents handle errors gracefully — never crash the main process
- Integration tests run when 2+ related agents mark complete
- E2E tests run when Audio + Transcription + Claude + UI all mark complete
- Performance tests measure: audio latency, transcription time, Claude TTFT, render time
- Orchestrator merges all agent outputs after final integration test passes
```

### 18.5 Stealth Window Implementation

```javascript
// src/main/stealth.js
const ffi = require('node-ffi-napi');
const ref = require('ref-napi');

const user32 = ffi.Library('user32', {
  'SetWindowDisplayAffinity': ['bool', ['pointer', 'uint32']]
});

const WDA_EXCLUDEFROMCAPTURE = 0x00000011;

function makeWindowStealth(hwnd) {
  return user32.SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
}

module.exports = { makeWindowStealth };
```

### 18.6 Audio Capture Implementation

```javascript
// src/main/audio.js
const { globalShortcut } = require('electron');
const EventBus = require('./eventbus');

let recording = false;
let audioBuffer = [];

function startRecording() {
  recording = true;
  audioBuffer = [];
  // Initialise WASAPI loopback capture
  // naudiodon or node-audio-windows captures system output
  EventBus.emit('audio:recording:start');
}

function stopRecording() {
  recording = false;
  const buffer = Buffer.concat(audioBuffer);
  EventBus.emit('audio:recording:complete', { buffer });
}

function registerHotkeys() {
  // Alt+Z: listen mode
  globalShortcut.register('Alt+Z', () => {
    if (!recording) startRecording();
  });

  // Release is handled by keyup listener via native hook
  // Alt+S: screenshot mode
  globalShortcut.register('Alt+S', () => {
    EventBus.emit('screenshot:capture');
  });
}

module.exports = { registerHotkeys, startRecording, stopRecording };
```

### 18.7 Claude Streaming Implementation

```javascript
// src/main/claude.js
const Anthropic = require('@anthropic-ai/sdk');
const EventBus = require('./eventbus');

const client = new Anthropic(); // API key from ANTHROPIC_API_KEY env var

const SYSTEM_PROMPTS = {
  interview: `You are an interview coach. Answer questions clearly and concisely using STAR format where relevant. Use the user's resume context if provided. Keep answers under 200 words. Use bullet points. Be direct.`,
  coding: `You are a coding interview assistant. For any problem: 1) Restate the problem briefly, 2) Give brute force approach, 3) Give optimal approach, 4) Write clean code, 5) State time and space complexity. Be concise.`,
  meeting: `You are a meeting assistant. Answer questions confidently and briefly. Highlight action items. Keep responses under 150 words.`,
  sales: `You are a sales assistant. Handle objections confidently. Highlight value. Suggest clear next steps. Keep responses under 150 words.`,
  general: `You are a helpful assistant. Answer clearly and concisely with structure. Use bullet points and headers. Keep responses under 250 words.`
};

async function getResponse({ question, mode = 'general', knowledgeBase = '', screenshot = null }) {
  const messages = [];

  if (screenshot) {
    messages.push({
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshot } },
        { type: 'text', text: question || 'Analyse this coding problem and provide a solution.' }
      ]
    });
  } else {
    messages.push({ role: 'user', content: question });
  }

  const systemPrompt = knowledgeBase
    ? `${SYSTEM_PROMPTS[mode]}\n\nUser context:\n${knowledgeBase}`
    : SYSTEM_PROMPTS[mode];

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages
  });

  stream.on('text', (text) => {
    EventBus.emit('claude:token', { text });
  });

  stream.on('message', (message) => {
    EventBus.emit('claude:complete', { message });
  });
}

module.exports = { getResponse };
```

---

## 19. Competitor Analysis

| Tool | Strengths | Weaknesses |
|---|---|---|
| **LockedIn AI** | Real-time answers, stealth mode | Browser-based — limited stealth reliability |
| **Final Round AI** | Invisible copilot, 10M+ users | No coding screenshot mode |
| **Interview Coder** | Native desktop, coding-focused | No audio capture |
| **Cluely** | Reads screen + audio | No Windows `SetWindowDisplayAffinity` |
| **ParakeetAI** | Undetectable to proctors | Process name visible in Task Manager |
| **OffscreenAI** | Clean overlay UI | No knowledge base personalisation |
| **GhostAssist AI** | ✅ Full audio + vision + stealth + local data + multi-agent build | **This app** |

---

*GhostAssist AI — Digital Okonma Technologies © 2025 — Confidential*