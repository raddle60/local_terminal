# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev    # Build and launch Electron app
npm run build  # Compile TypeScript and copy assets
npm start      # Run Electron app (requires prior build)
```

## Architecture

**Electron Multi-Process Architecture:**
- `src/main/` — Main process: window creation, IPC handlers, node-pty management
- `src/preload/` — Preload script: exposes `shellAPI` to renderer via `contextBridge`
- `src/renderer/` — Renderer process: UI components using xterm.js

**Shell Management Flow:**
1. User double-clicks profile in tree → renderer calls `shellAPI.createShell()`
2. Main process creates node-pty instance via `PtyManager`
3. PTY output streams to renderer via `shell:data` IPC event
4. Renderer input sends to PTY via `shell:write` IPC event

**Key Modules:**
- `PtyManager` — Manages multiple shell instances, handles auto-scripts with pattern matching
- `ProfileTree` — Renders folder/profile hierarchy, emits double-click events
- `TabBar` — Manages tab states (active, outputting, disconnected) with visual indicators
- `TerminalView` — Wraps xterm.js Terminal with FitAddon for auto-sizing

**IPC Channels:**
- `shell:create`, `shell:write`, `shell:resize`, `shell:close` — renderer → main
- `shell:data`, `shell:exit`, `shell:output-start`, `shell:output-end` — main → renderer
- `profile:load`, `profile:save` — profile configuration persistence

**Auto-Script Execution:**
- Commands run sequentially via `runAutoScripts()`
- `waitFor: null` → 100ms delay before next command
- `waitFor: "pattern"` → poll output for pattern match (5s timeout)
- Uses `pendingData` accumulator on each `ShellInstance`

**Window Title State:**
- PtyManager tracks `isOutputting` per shell
- Title becomes "Local Terminal ● 输出中" when any shell is outputting
- Resets after 500ms of no output (via `outputTimer`)
