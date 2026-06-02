# Local Terminal Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于 Electron + node-pty + xterm.js 的本地终端管理器，左侧树形 profile，右侧 tab 页 shell。

**Architecture:** 采用标准的 Electron 多进程架构：主进程管理 node-pty 实例，渲染进程使用 xterm.js 渲染终端，preload 桥接 IPC 通信。

**Tech Stack:** Electron, node-pty, xterm.js, TypeScript, JSON

---

## 1. 项目脚手架

### 1.1 创建 package.json

**Files:**
- Create: `package.json`

```json
{
  "name": "local-terminal",
  "version": "1.0.0",
  "description": "Local Terminal Manager with profile management",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "npm run build && electron .",
    "build": "tsc",
    "start": "electron ."
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "typescript": "^5.3.0"
  },
  "dependencies": {
    "electron-store": "^8.1.0",
    "node-pty": "^1.0.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0"
  }
}
```

- [ ] **Step 1: Create package.json**

```bash
cd D:\eclipse-workspace\local_terminal && cat > package.json << 'EOF'
{
  "name": "local-terminal",
  "version": "1.0.0",
  "description": "Local Terminal Manager with profile management",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "npm run build && electron .",
    "build": "tsc",
    "start": "electron ."
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "typescript": "^5.3.0"
  },
  "dependencies": {
    "electron-store": "^8.1.0",
    "node-pty": "^1.0.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0"
  }
}
EOF
```

- [ ] **Step 2: Install dependencies**

```bash
cd D:\eclipse-workspace\local_terminal && npm install
```

- [ ] **Step 3: Commit**

```bash
git add package.json && git commit -m "chore: add package.json with dependencies"
```

---

### 1.2 创建 TypeScript 配置

**Files:**
- Create: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 1: Create tsconfig.json**

```bash
cd D:\eclipse-workspace\local_terminal && cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add tsconfig.json && git commit -m "chore: add TypeScript config"
```

---

## 2. 主进程基础

### 2.1 创建目录结构

**Files:**
- Create: `src/main/index.ts`
- Create: `src/main/pty-manager.ts`
- Create: `src/main/ipc-handlers.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/index.ts`
- Create: `src/renderer/components/ProfileTree.ts`
- Create: `src/renderer/components/TabBar.ts`
- Create: `src/renderer/components/TerminalView.ts`
- Create: `src/renderer/services/ipc-client.ts`
- Create: `profiles.json`

- [ ] **Step 1: Create directory structure**

```bash
cd D:\eclipse-workspace\local_terminal
mkdir -p src/main src/preload src/renderer/components src/renderer/services
```

---

### 2.2 主进程入口

**Files:**
- Create: `src/main/index.ts`

```typescript
import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { setupIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
```

- [ ] **Step 1: Create src/main/index.ts**

```bash
cat > src/main/index.ts << 'EOF'
import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { setupIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add src/main/index.ts && git commit -m "feat: add main process entry point"
```

---

### 2.3 Preload 脚本

**Files:**
- Create: `src/preload/index.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';

export interface ProfileConfig {
  id: string;
  name: string;
  type: 'folder' | 'profile';
  icon?: string | null;
  children?: ProfileConfig[];
  config?: {
    shell: string;
    args: string[];
    cwd: string;
    autoScripts: Array<{ command: string; waitFor: string | null }>;
  };
}

export interface ShellAPI {
  createShell: (profileId: string, config: ProfileConfig['config']) => Promise<string>;
  writeToShell: (shellId: string, data: string) => void;
  resizeShell: (shellId: string, cols: number, rows: number) => void;
  closeShell: (shellId: string) => void;
  onShellData: (callback: (shellId: string, data: string) => void) => void;
  onShellExit: (callback: (shellId: string, exitCode: number) => void) => void;
  onShellOutputStart: (callback: (shellId: string) => void) => void;
  onShellOutputEnd: (callback: (shellId: string) => void) => void;
  loadProfiles: () => Promise<ProfileConfig[]>;
  saveProfiles: (profiles: ProfileConfig[]) => Promise<void>;
}

const shellAPI: ShellAPI = {
  createShell: (profileId, config) => ipcRenderer.invoke('shell:create', profileId, config),
  writeToShell: (shellId, data) => ipcRenderer.send('shell:write', shellId, data),
  resizeShell: (shellId, cols, rows) => ipcRenderer.send('shell:resize', shellId, cols, rows),
  closeShell: (shellId) => ipcRenderer.send('shell:close', shellId),
  onShellData: (callback) => {
    ipcRenderer.on('shell:data', (_event, shellId, data) => callback(shellId, data));
  },
  onShellExit: (callback) => {
    ipcRenderer.on('shell:exit', (_event, shellId, exitCode) => callback(shellId, exitCode));
  },
  onShellOutputStart: (callback) => {
    ipcRenderer.on('shell:output-start', (_event, shellId) => callback(shellId));
  },
  onShellOutputEnd: (callback) => {
    ipcRenderer.on('shell:output-end', (_event, shellId) => callback(shellId));
  },
  loadProfiles: () => ipcRenderer.invoke('profile:load'),
  saveProfiles: (profiles) => ipcRenderer.invoke('profile:save', profiles),
};

contextBridge.exposeInMainWorld('shellAPI', shellAPI);
```

- [ ] **Step 1: Create src/preload/index.ts**

```bash
cat > src/preload/index.ts << 'EOF'
import { contextBridge, ipcRenderer } from 'electron';

export interface ProfileConfig {
  id: string;
  name: string;
  type: 'folder' | 'profile';
  icon?: string | null;
  children?: ProfileConfig[];
  config?: {
    shell: string;
    args: string[];
    cwd: string;
    autoScripts: Array<{ command: string; waitFor: string | null }>;
  };
}

export interface ShellAPI {
  createShell: (profileId: string, config: ProfileConfig['config']) => Promise<string>;
  writeToShell: (shellId: string, data: string) => void;
  resizeShell: (shellId: string, cols: number, rows: number) => void;
  closeShell: (shellId: string) => void;
  onShellData: (callback: (shellId: string, data: string) => void) => void;
  onShellExit: (callback: (shellId: string, exitCode: number) => void) => void;
  onShellOutputStart: (callback: (shellId: string) => void) => void;
  onShellOutputEnd: (callback: (shellId: string) => void) => void;
  loadProfiles: () => Promise<ProfileConfig[]>;
  saveProfiles: (profiles: ProfileConfig[]) => Promise<void>;
}

const shellAPI: ShellAPI = {
  createShell: (profileId, config) => ipcRenderer.invoke('shell:create', profileId, config),
  writeToShell: (shellId, data) => ipcRenderer.send('shell:write', shellId, data),
  resizeShell: (shellId, cols, rows) => ipcRenderer.send('shell:resize', shellId, cols, rows),
  closeShell: (shellId) => ipcRenderer.send('shell:close', shellId),
  onShellData: (callback) => {
    ipcRenderer.on('shell:data', (_event, shellId, data) => callback(shellId, data));
  },
  onShellExit: (callback) => {
    ipcRenderer.on('shell:exit', (_event, shellId, exitCode) => callback(shellId, exitCode));
  },
  onShellOutputStart: (callback) => {
    ipcRenderer.on('shell:output-start', (_event, shellId) => callback(shellId));
  },
  onShellOutputEnd: (callback) => {
    ipcRenderer.on('shell:output-end', (_event, shellId) => callback(shellId));
  },
  loadProfiles: () => ipcRenderer.invoke('profile:load'),
  saveProfiles: (profiles) => ipcRenderer.invoke('profile:save', profiles),
};

contextBridge.exposeInMainWorld('shellAPI', shellAPI);
EOF
```

- [ ] **Step 2: Commit**

```bash
git add src/preload/index.ts && git commit -m "feat: add preload script with IPC bridge"
```

---

## 3. node-pty 管理器

### 3.1 PTY Manager 实现

**Files:**
- Create: `src/main/pty-manager.ts`

```typescript
import * as pty from 'node-pty';
import { getMainWindow } from './index';

interface AutoScript {
  command: string;
  waitFor: string | null;
}

interface ShellInstance {
  pty: pty.IPty;
  outputTimer: NodeJS.Timeout | null;
  isOutputting: boolean;
  autoScripts: AutoScript[];
  currentScriptIndex: number;
  pendingData: string;
}

export class PtyManager {
  private shells: Map<string, ShellInstance> = new Map();
  private shellCounter = 0;

  createShell(profileId: string, config: {
    shell: string;
    args: string[];
    cwd: string;
    autoScripts: AutoScript[];
  }): string {
    const shellId = `${profileId}-${this.shellCounter++}`;

    const shell = pty.spawn(config.shell, config.args, {
      cwd: config.cwd,
      env: process.env as { [key: string]: string },
    });

    const instance: ShellInstance = {
      pty: shell,
      outputTimer: null,
      isOutputting: false,
      autoScripts: config.autoScripts || [],
      currentScriptIndex: 0,
      pendingData: '',
    };

    this.shells.set(shellId, instance);

    shell.onData((data) => {
      this.handleData(shellId, data);
    });

    shell.onExit(({ exitCode }) => {
      this.handleExit(shellId, exitCode);
    });

    // Start auto scripts
    this.runAutoScripts(shellId);

    return shellId;
  }

  private runAutoScripts(shellId: string): void {
    const instance = this.shells.get(shellId);
    if (!instance) return;

    const runNext = () => {
      if (instance.currentScriptIndex >= instance.autoScripts.length) {
        return;
      }

      const script = instance.autoScripts[instance.currentScriptIndex++];
      instance.pty.write(script.command + '\r');

      if (script.waitFor) {
        // Wait for pattern match
        instance.pendingData = '';
        const timeout = setTimeout(() => {
          // Timeout, continue to next script
          runNext();
        }, 5000);

        const checkInterval = setInterval(() => {
          if (instance.pendingData.includes(script.waitFor!)) {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            instance.pendingData = '';
            runNext();
          }
        }, 100);
      } else {
        // Wait 100ms then next
        setTimeout(runNext, 100);
      }
    };

    runNext();
  }

  private handleData(shellId: string, data: string): void {
    const instance = this.shells.get(shellId);
    if (!instance) return;

    // Accumulate data for pattern matching
    instance.pendingData += data;

    // Notify renderer
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('shell:data', shellId, data);
    }

    // Output state tracking
    if (!instance.isOutputting) {
      instance.isOutputting = true;
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('shell:output-start', shellId);
        this.updateWindowTitle(true);
      }
    }

    // Reset output end timer
    if (instance.outputTimer) {
      clearTimeout(instance.outputTimer);
    }
    instance.outputTimer = setTimeout(() => {
      instance.isOutputting = false;
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('shell:output-end', shellId);
        this.updateWindowTitle(false);
      }
    }, 500);
  }

  private handleExit(shellId: string, exitCode: number): void {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('shell:exit', shellId, exitCode);
    }
    this.shells.delete(shellId);
  }

  private updateWindowTitle(hasOutput: boolean): void {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;

    const hasActiveShells = Array.from(this.shells.values()).some(s => s.isOutputting);
    const title = hasActiveShells
      ? 'Local Terminal ● 输出中'
      : 'Local Terminal';
    mainWindow.setTitle(title);
  }

  write(shellId: string, data: string): void {
    const instance = this.shells.get(shellId);
    if (instance) {
      instance.pty.write(data);
    }
  }

  resize(shellId: string, cols: number, rows: number): void {
    const instance = this.shells.get(shellId);
    if (instance) {
      instance.pty.resize(cols, rows);
    }
  }

  close(shellId: string): void {
    const instance = this.shells.get(shellId);
    if (instance) {
      instance.pty.kill();
      if (instance.outputTimer) {
        clearTimeout(instance.outputTimer);
      }
      this.shells.delete(shellId);
    }
  }
}

export const ptyManager = new PtyManager();
```

- [ ] **Step 1: Create src/main/pty-manager.ts**

```bash
cat > src/main/pty-manager.ts << 'EOF'
import * as pty from 'node-pty';
import { getMainWindow } from './index';

interface AutoScript {
  command: string;
  waitFor: string | null;
}

interface ShellInstance {
  pty: pty.IPty;
  outputTimer: NodeJS.Timeout | null;
  isOutputting: boolean;
  autoScripts: AutoScript[];
  currentScriptIndex: number;
  pendingData: string;
}

export class PtyManager {
  private shells: Map<string, ShellInstance> = new Map();
  private shellCounter = 0;

  createShell(profileId: string, config: {
    shell: string;
    args: string[];
    cwd: string;
    autoScripts: AutoScript[];
  }): string {
    const shellId = `${profileId}-${this.shellCounter++}`;

    const shell = pty.spawn(config.shell, config.args, {
      cwd: config.cwd,
      env: process.env as { [key: string]: string },
    });

    const instance: ShellInstance = {
      pty: shell,
      outputTimer: null,
      isOutputting: false,
      autoScripts: config.autoScripts || [],
      currentScriptIndex: 0,
      pendingData: '',
    };

    this.shells.set(shellId, instance);

    shell.onData((data) => {
      this.handleData(shellId, data);
    });

    shell.onExit(({ exitCode }) => {
      this.handleExit(shellId, exitCode);
    });

    // Start auto scripts
    this.runAutoScripts(shellId);

    return shellId;
  }

  private runAutoScripts(shellId: string): void {
    const instance = this.shells.get(shellId);
    if (!instance) return;

    const runNext = () => {
      if (instance.currentScriptIndex >= instance.autoScripts.length) {
        return;
      }

      const script = instance.autoScripts[instance.currentScriptIndex++];
      instance.pty.write(script.command + '\r');

      if (script.waitFor) {
        // Wait for pattern match
        instance.pendingData = '';
        const timeout = setTimeout(() => {
          // Timeout, continue to next script
          runNext();
        }, 5000);

        const checkInterval = setInterval(() => {
          if (instance.pendingData.includes(script.waitFor!)) {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            instance.pendingData = '';
            runNext();
          }
        }, 100);
      } else {
        // Wait 100ms then next
        setTimeout(runNext, 100);
      }
    };

    runNext();
  }

  private handleData(shellId: string, data: string): void {
    const instance = this.shells.get(shellId);
    if (!instance) return;

    // Accumulate data for pattern matching
    instance.pendingData += data;

    // Notify renderer
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('shell:data', shellId, data);
    }

    // Output state tracking
    if (!instance.isOutputting) {
      instance.isOutputting = true;
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('shell:output-start', shellId);
        this.updateWindowTitle(true);
      }
    }

    // Reset output end timer
    if (instance.outputTimer) {
      clearTimeout(instance.outputTimer);
    }
    instance.outputTimer = setTimeout(() => {
      instance.isOutputting = false;
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('shell:output-end', shellId);
        this.updateWindowTitle(false);
      }
    }, 500);
  }

  private handleExit(shellId: string, exitCode: number): void {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('shell:exit', shellId, exitCode);
    }
    this.shells.delete(shellId);
  }

  private updateWindowTitle(hasOutput: boolean): void {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;

    const hasActiveShells = Array.from(this.shells.values()).some(s => s.isOutputting);
    const title = hasActiveShells
      ? 'Local Terminal ● 输出中'
      : 'Local Terminal';
    mainWindow.setTitle(title);
  }

  write(shellId: string, data: string): void {
    const instance = this.shells.get(shellId);
    if (instance) {
      instance.pty.write(data);
    }
  }

  resize(shellId: string, cols: number, rows: number): void {
    const instance = this.shells.get(shellId);
    if (instance) {
      instance.pty.resize(cols, rows);
    }
  }

  close(shellId: string): void {
    const instance = this.shells.get(shellId);
    if (instance) {
      instance.pty.kill();
      if (instance.outputTimer) {
        clearTimeout(instance.outputTimer);
      }
      this.shells.delete(shellId);
    }
  }
}

export const ptyManager = new PtyManager();
EOF
```

- [ ] **Step 2: Commit**

```bash
git add src/main/pty-manager.ts && git commit -m "feat: add PtyManager for shell process management"
```

---

## 4. IPC 处理器

### 4.1 IPC Handlers 实现

**Files:**
- Create: `src/main/ipc-handlers.ts`

```typescript
import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ptyManager } from './pty-manager';

const profilesPath = path.join(__dirname, '../../profiles.json');

interface ProfileConfig {
  id: string;
  name: string;
  type: 'folder' | 'profile';
  icon?: string | null;
  children?: ProfileConfig[];
  config?: {
    shell: string;
    args: string[];
    cwd: string;
    autoScripts: Array<{ command: string; waitFor: string | null }>;
  };
}

function loadProfiles(): ProfileConfig[] {
  try {
    if (fs.existsSync(profilesPath)) {
      const data = fs.readFileSync(profilesPath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.profileTree || [];
    }
  } catch (e) {
    console.error('Failed to load profiles:', e);
  }
  return getDefaultProfiles();
}

function saveProfiles(profiles: ProfileConfig[]): void {
  try {
    fs.writeFileSync(profilesPath, JSON.stringify({ profileTree: profiles }, null, 2));
  } catch (e) {
    console.error('Failed to save profiles:', e);
  }
}

function getDefaultProfiles(): ProfileConfig[] {
  return [
    {
      id: 'folder-dev',
      name: '开发环境',
      type: 'folder',
      children: [
        {
          id: 'profile-powershell',
          name: 'PowerShell',
          type: 'profile',
          icon: null,
          config: {
            shell: 'powershell.exe',
            args: [],
            cwd: process.env.USERPROFILE || 'C:\\Users\\' + process.env.USERNAME,
            autoScripts: [],
          },
        },
        {
          id: 'profile-cmd',
          name: 'CMD',
          type: 'profile',
          icon: null,
          config: {
            shell: 'cmd.exe',
            args: [],
            cwd: process.env.USERPROFILE || 'C:\\Users\\' + process.env.USERNAME,
            autoScripts: [],
          },
        },
        {
          id: 'profile-git-bash',
          name: 'Git Bash',
          type: 'profile',
          icon: null,
          config: {
            shell: 'C:\\Program Files\\Git\\bin\\bash.exe',
            args: [],
            cwd: process.env.USERPROFILE || 'C:\\Users\\' + process.env.USERNAME,
            autoScripts: [],
          },
        },
      ],
    },
  ];
}

export function setupIpcHandlers(): void {
  ipcMain.handle('profile:load', () => {
    return loadProfiles();
  });

  ipcMain.handle('profile:save', (_event, profiles: ProfileConfig[]) => {
    saveProfiles(profiles);
  });

  ipcMain.handle('shell:create', (_event, profileId: string, config: ProfileConfig['config']) => {
    return ptyManager.createShell(profileId, config!);
  });

  ipcMain.on('shell:write', (_event, shellId: string, data: string) => {
    ptyManager.write(shellId, data);
  });

  ipcMain.on('shell:resize', (_event, shellId: string, cols: number, rows: number) => {
    ptyManager.resize(shellId, cols, rows);
  });

  ipcMain.on('shell:close', (_event, shellId: string) => {
    ptyManager.close(shellId);
  });
}
```

- [ ] **Step 1: Create src/main/ipc-handlers.ts**

```bash
cat > src/main/ipc-handlers.ts << 'EOF'
import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ptyManager } from './pty-manager';

const profilesPath = path.join(__dirname, '../../profiles.json');

interface ProfileConfig {
  id: string;
  name: string;
  type: 'folder' | 'profile';
  icon?: string | null;
  children?: ProfileConfig[];
  config?: {
    shell: string;
    args: string[];
    cwd: string;
    autoScripts: Array<{ command: string; waitFor: string | null }>;
  };
}

function loadProfiles(): ProfileConfig[] {
  try {
    if (fs.existsSync(profilesPath)) {
      const data = fs.readFileSync(profilesPath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.profileTree || [];
    }
  } catch (e) {
    console.error('Failed to load profiles:', e);
  }
  return getDefaultProfiles();
}

function saveProfiles(profiles: ProfileConfig[]): void {
  try {
    fs.writeFileSync(profilesPath, JSON.stringify({ profileTree: profiles }, null, 2));
  } catch (e) {
    console.error('Failed to save profiles:', e);
  }
}

function getDefaultProfiles(): ProfileConfig[] {
  return [
    {
      id: 'folder-dev',
      name: '开发环境',
      type: 'folder',
      children: [
        {
          id: 'profile-powershell',
          name: 'PowerShell',
          type: 'profile',
          icon: null,
          config: {
            shell: 'powershell.exe',
            args: [],
            cwd: process.env.USERPROFILE || 'C:\\Users\\' + process.env.USERNAME,
            autoScripts: [],
          },
        },
        {
          id: 'profile-cmd',
          name: 'CMD',
          type: 'profile',
          icon: null,
          config: {
            shell: 'cmd.exe',
            args: [],
            cwd: process.env.USERPROFILE || 'C:\\Users\\' + process.env.USERNAME,
            autoScripts: [],
          },
        },
        {
          id: 'profile-git-bash',
          name: 'Git Bash',
          type: 'profile',
          icon: null,
          config: {
            shell: 'C:\\Program Files\\Git\\bin\\bash.exe',
            args: [],
            cwd: process.env.USERPROFILE || 'C:\\Users\\' + process.env.USERNAME,
            autoScripts: [],
          },
        },
      ],
    },
  ];
}

export function setupIpcHandlers(): void {
  ipcMain.handle('profile:load', () => {
    return loadProfiles();
  });

  ipcMain.handle('profile:save', (_event, profiles: ProfileConfig[]) => {
    saveProfiles(profiles);
  });

  ipcMain.handle('shell:create', (_event, profileId: string, config: ProfileConfig['config']) => {
    return ptyManager.createShell(profileId, config!);
  });

  ipcMain.on('shell:write', (_event, shellId: string, data: string) => {
    ptyManager.write(shellId, data);
  });

  ipcMain.on('shell:resize', (_event, shellId: string, cols: number, rows: number) => {
    ptyManager.resize(shellId, cols, rows);
  });

  ipcMain.on('shell:close', (_event, shellId: string) => {
    ptyManager.close(shellId);
  });
}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add src/main/ipc-handlers.ts && git commit -m "feat: add IPC handlers for profile and shell management"
```

---

## 5. 渲染进程组件

### 5.1 ProfileTree 组件

**Files:**
- Create: `src/renderer/components/ProfileTree.ts`

```typescript
interface ProfileNode {
  id: string;
  name: string;
  type: 'folder' | 'profile';
  icon?: string | null;
  children?: ProfileNode[];
  config?: {
    shell: string;
    args: string[];
    cwd: string;
    autoScripts: Array<{ command: string; waitFor: string | null }>;
  };
}

type TreeListener = (node: ProfileNode) => void;

export class ProfileTree {
  private container: HTMLElement;
  private profiles: ProfileNode[] = [];
  private listeners: TreeListener[] = [];
  private expandedFolders: Set<string> = new Set();

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;
  }

  setProfiles(profiles: ProfileNode[]): void {
    this.profiles = profiles;
    this.render();
  }

  onProfileDoubleClick(listener: TreeListener): void {
    this.listeners.push(listener);
  }

  private render(): void {
    this.container.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'profile-tree';
    this.renderNodes(this.profiles, ul);
    this.container.appendChild(ul);
  }

  private renderNodes(nodes: ProfileNode[], parent: HTMLElement): void {
    for (const node of nodes) {
      const li = document.createElement('li');
      li.dataset.nodeId = node.id;

      if (node.type === 'folder') {
        li.className = 'folder';
        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-header';
        const icon = document.createElement('span');
        icon.className = 'folder-icon';
        icon.textContent = this.expandedFolders.has(node.id) ? '📂' : '📁';
        const name = document.createElement('span');
        name.className = 'folder-name';
        name.textContent = node.name;
        folderHeader.appendChild(icon);
        folderHeader.appendChild(name);

        folderHeader.addEventListener('click', () => {
          this.toggleFolder(node.id, icon);
        });

        li.appendChild(folderHeader);

        if (this.expandedFolders.has(node.id) && node.children) {
          const childUl = document.createElement('ul');
          childUl.className = 'folder-children';
          this.renderNodes(node.children, childUl);
          li.appendChild(childUl);
        }
      } else {
        li.className = 'profile';
        const profileContent = document.createElement('div');
        profileContent.className = 'profile-content';

        const icon = document.createElement('span');
        icon.className = 'profile-icon';
        icon.textContent = this.getShellIcon(node.config?.shell);

        const name = document.createElement('span');
        name.className = 'profile-name';
        name.textContent = node.name;

        profileContent.appendChild(icon);
        profileContent.appendChild(name);

        profileContent.addEventListener('dblclick', () => {
          this.listeners.forEach(l => l(node));
        });

        li.appendChild(profileContent);
      }

      parent.appendChild(li);
    }
  }

  private toggleFolder(id: string, icon: HTMLElement): void {
    if (this.expandedFolders.has(id)) {
      this.expandedFolders.delete(id);
      icon.textContent = '📁';
    } else {
      this.expandedFolders.add(id);
      icon.textContent = '📂';
    }
    this.render();
  }

  private getShellIcon(shell?: string): string {
    if (!shell) return '📦';
    const shellLower = shell.toLowerCase();
    if (shellLower.includes('powershell')) return '⬜';
    if (shellLower.includes('cmd')) return '📝';
    if (shellLower.includes('bash')) return '🐚';
    if (shellLower.includes('wsl') || shellLower.includes('ubuntu')) return '🐧';
    return '📦';
  }
}
```

- [ ] **Step 1: Create src/renderer/components/ProfileTree.ts**

```bash
cat > src/renderer/components/ProfileTree.ts << 'EOF'
interface ProfileNode {
  id: string;
  name: string;
  type: 'folder' | 'profile';
  icon?: string | null;
  children?: ProfileNode[];
  config?: {
    shell: string;
    args: string[];
    cwd: string;
    autoScripts: Array<{ command: string; waitFor: string | null }>;
  };
}

type TreeListener = (node: ProfileNode) => void;

export class ProfileTree {
  private container: HTMLElement;
  private profiles: ProfileNode[] = [];
  private listeners: TreeListener[] = [];
  private expandedFolders: Set<string> = new Set();

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;
  }

  setProfiles(profiles: ProfileNode[]): void {
    this.profiles = profiles;
    this.render();
  }

  onProfileDoubleClick(listener: TreeListener): void {
    this.listeners.push(listener);
  }

  private render(): void {
    this.container.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'profile-tree';
    this.renderNodes(this.profiles, ul);
    this.container.appendChild(ul);
  }

  private renderNodes(nodes: ProfileNode[], parent: HTMLElement): void {
    for (const node of nodes) {
      const li = document.createElement('li');
      li.dataset.nodeId = node.id;

      if (node.type === 'folder') {
        li.className = 'folder';
        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-header';
        const icon = document.createElement('span');
        icon.className = 'folder-icon';
        icon.textContent = this.expandedFolders.has(node.id) ? '📂' : '📁';
        const name = document.createElement('span');
        name.className = 'folder-name';
        name.textContent = node.name;
        folderHeader.appendChild(icon);
        folderHeader.appendChild(name);

        folderHeader.addEventListener('click', () => {
          this.toggleFolder(node.id, icon);
        });

        li.appendChild(folderHeader);

        if (this.expandedFolders.has(node.id) && node.children) {
          const childUl = document.createElement('ul');
          childUl.className = 'folder-children';
          this.renderNodes(node.children, childUl);
          li.appendChild(childUl);
        }
      } else {
        li.className = 'profile';
        const profileContent = document.createElement('div');
        profileContent.className = 'profile-content';

        const icon = document.createElement('span');
        icon.className = 'profile-icon';
        icon.textContent = this.getShellIcon(node.config?.shell);

        const name = document.createElement('span');
        name.className = 'profile-name';
        name.textContent = node.name;

        profileContent.appendChild(icon);
        profileContent.appendChild(name);

        profileContent.addEventListener('dblclick', () => {
          this.listeners.forEach(l => l(node));
        });

        li.appendChild(profileContent);
      }

      parent.appendChild(li);
    }
  }

  private toggleFolder(id: string, icon: HTMLElement): void {
    if (this.expandedFolders.has(id)) {
      this.expandedFolders.delete(id);
      icon.textContent = '📁';
    } else {
      this.expandedFolders.add(id);
      icon.textContent = '📂';
    }
    this.render();
  }

  private getShellIcon(shell?: string): string {
    if (!shell) return '📦';
    const shellLower = shell.toLowerCase();
    if (shellLower.includes('powershell')) return '⬜';
    if (shellLower.includes('cmd')) return '📝';
    if (shellLower.includes('bash')) return '🐚';
    if (shellLower.includes('wsl') || shellLower.includes('ubuntu')) return '🐧';
    return '📦';
  }
}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/ProfileTree.ts && git commit -m "feat: add ProfileTree component"
```

---

### 5.2 TabBar 组件

**Files:**
- Create: `src/renderer/components/TabBar.ts`

```typescript
interface Tab {
  id: string;
  name: string;
  shellIcon: string;
  isActive: boolean;
  isOutputting: boolean;
  isDisconnected: boolean;
}

type TabListener = (tabId: string) => void;

export class TabBar {
  private container: HTMLElement;
  private tabs: Tab[] = [];
  private activeTabId: string | null = null;
  private onTabClickListeners: TabListener[] = [];
  private onTabCloseListeners: TabListener[] = [];

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;
  }

  addTab(tab: Tab): void {
    this.tabs.push(tab);
    this.render();
  }

  removeTab(tabId: string): void {
    this.tabs = this.tabs.filter(t => t.id !== tabId);
    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs.length > 0 ? this.tabs[0].id : null;
    }
    this.render();
  }

  setActiveTab(tabId: string): void {
    this.activeTabId = tabId;
    this.tabs.forEach(t => t.isActive = t.id === tabId);
    this.render();
  }

  setTabOutputting(tabId: string, isOutputting: boolean): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.isOutputting = isOutputting;
      this.render();
    }
  }

  setTabDisconnected(tabId: string, disconnected: boolean): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.isDisconnected = disconnected;
      this.render();
    }
  }

  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  onClick(listener: TabListener): void {
    this.onTabClickListeners.push(listener);
  }

  onClose(listener: TabListener): void {
    this.onTabCloseListeners.push(listener);
  }

  private render(): void {
    this.container.innerHTML = '';
    for (const tab of this.tabs) {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab';
      if (tab.isActive) tabEl.classList.add('active');
      if (tab.isOutputting) tabEl.classList.add('outputting');
      if (tab.isDisconnected) tabEl.classList.add('disconnected');

      const icon = document.createElement('span');
      icon.className = 'tab-icon';
      icon.textContent = tab.shellIcon;

      const name = document.createElement('span');
      name.className = 'tab-name';
      name.textContent = tab.name;

      const closeBtn = document.createElement('span');
      closeBtn.className = 'tab-close';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onTabCloseListeners.forEach(l => l(tab.id));
      });

      tabEl.appendChild(icon);
      tabEl.appendChild(name);
      tabEl.appendChild(closeBtn);

      tabEl.addEventListener('click', () => {
        this.onTabClickListeners.forEach(l => l(tab.id));
      });

      this.container.appendChild(tabEl);
    }
  }
}
```

- [ ] **Step 1: Create src/renderer/components/TabBar.ts**

```bash
cat > src/renderer/components/TabBar.ts << 'EOF'
interface Tab {
  id: string;
  name: string;
  shellIcon: string;
  isActive: boolean;
  isOutputting: boolean;
  isDisconnected: boolean;
}

type TabListener = (tabId: string) => void;

export class TabBar {
  private container: HTMLElement;
  private tabs: Tab[] = [];
  private activeTabId: string | null = null;
  private onTabClickListeners: TabListener[] = [];
  private onTabCloseListeners: TabListener[] = [];

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;
  }

  addTab(tab: Tab): void {
    this.tabs.push(tab);
    this.render();
  }

  removeTab(tabId: string): void {
    this.tabs = this.tabs.filter(t => t.id !== tabId);
    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs.length > 0 ? this.tabs[0].id : null;
    }
    this.render();
  }

  setActiveTab(tabId: string): void {
    this.activeTabId = tabId;
    this.tabs.forEach(t => t.isActive = t.id === tabId);
    this.render();
  }

  setTabOutputting(tabId: string, isOutputting: boolean): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.isOutputting = isOutputting;
      this.render();
    }
  }

  setTabDisconnected(tabId: string, disconnected: boolean): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.isDisconnected = disconnected;
      this.render();
    }
  }

  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  onClick(listener: TabListener): void {
    this.onTabClickListeners.push(listener);
  }

  onClose(listener: TabListener): void {
    this.onTabCloseListeners.push(listener);
  }

  private render(): void {
    this.container.innerHTML = '';
    for (const tab of this.tabs) {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab';
      if (tab.isActive) tabEl.classList.add('active');
      if (tab.isOutputting) tabEl.classList.add('outputting');
      if (tab.isDisconnected) tabEl.classList.add('disconnected');

      const icon = document.createElement('span');
      icon.className = 'tab-icon';
      icon.textContent = tab.shellIcon;

      const name = document.createElement('span');
      name.className = 'tab-name';
      name.textContent = tab.name;

      const closeBtn = document.createElement('span');
      closeBtn.className = 'tab-close';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onTabCloseListeners.forEach(l => l(tab.id));
      });

      tabEl.appendChild(icon);
      tabEl.appendChild(name);
      tabEl.appendChild(closeBtn);

      tabEl.addEventListener('click', () => {
        this.onTabClickListeners.forEach(l => l(tab.id));
      });

      this.container.appendChild(tabEl);
    }
  }
}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/TabBar.ts && git commit -m "feat: add TabBar component"
```

---

### 5.3 TerminalView 组件

**Files:**
- Create: `src/renderer/components/TerminalView.ts`

```typescript
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export class TerminalView {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private container: HTMLElement;
  private shellId: string;

  constructor(containerId: string, shellId: string) {
    this.shellId = shellId;
    this.container = document.getElementById(containerId)!;
    this.terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
    });
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(this.container);
    this.fitAddon.fit();
  }

  getShellId(): string {
    return this.shellId;
  }

  write(data: string): void {
    this.terminal.write(data);
  }

  onData(callback: (data: string) => void): void {
    this.terminal.onData(callback);
  }

  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows);
  }

  fit(): void {
    this.fitAddon.fit();
  }

  dispose(): void {
    this.terminal.dispose();
  }
}
```

- [ ] **Step 1: Create src/renderer/components/TerminalView.ts**

```bash
cat > src/renderer/components/TerminalView.ts << 'EOF'
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export class TerminalView {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private container: HTMLElement;
  private shellId: string;

  constructor(containerId: string, shellId: string) {
    this.shellId = shellId;
    this.container = document.getElementById(containerId)!;
    this.terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
    });
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(this.container);
    this.fitAddon.fit();
  }

  getShellId(): string {
    return this.shellId;
  }

  write(data: string): void {
    this.terminal.write(data);
  }

  onData(callback: (data: string) => void): void {
    this.terminal.onData(callback);
  }

  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows);
  }

  fit(): void {
    this.fitAddon.fit();
  }

  dispose(): void {
    this.terminal.dispose();
  }
}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/TerminalView.ts && git commit -m "feat: add TerminalView component with xterm.js"
```

---

## 6. 主渲染进程入口

### 6.1 renderer/index.ts

**Files:**
- Create: `src/renderer/index.ts`

```typescript
import { ProfileTree } from './components/ProfileTree';
import { TabBar } from './components/TabBar';
import { TerminalView } from './components/TerminalView';

interface ProfileNode {
  id: string;
  name: string;
  type: 'folder' | 'profile';
  icon?: string | null;
  children?: ProfileNode[];
  config?: {
    shell: string;
    args: string[];
    cwd: string;
    autoScripts: Array<{ command: string; waitFor: string | null }>;
  };
}

declare global {
  interface Window {
    shellAPI: {
      createShell: (profileId: string, config: ProfileNode['config']) => Promise<string>;
      writeToShell: (shellId: string, data: string) => void;
      resizeShell: (shellId: string, cols: number, rows: number) => void;
      closeShell: (shellId: string) => void;
      onShellData: (callback: (shellId: string, data: string) => void) => void;
      onShellExit: (callback: (shellId: string, exitCode: number) => void) => void;
      onShellOutputStart: (callback: (shellId: string) => void) => void;
      onShellOutputEnd: (callback: (shellId: string) => void) => void;
      loadProfiles: () => Promise<ProfileNode[]>;
      saveProfiles: (profiles: ProfileNode[]) => Promise<void>;
    };
  }
}

class App {
  private profileTree!: ProfileTree;
  private tabBar!: TabBar;
  private terminals: Map<string, TerminalView> = new Map();
  private tabCounter = 0;

  async init(): Promise<void> {
    this.profileTree = new ProfileTree('profile-tree');
    this.tabBar = new TabBar('tab-bar');

    const profiles = await window.shellAPI.loadProfiles();
    this.profileTree.setProfiles(profiles);

    this.profileTree.onProfileDoubleClick(async (node) => {
      if (node.type === 'profile' && node.config) {
        await this.createShell(node);
      }
    });

    this.tabBar.onClick((tabId) => {
      this.tabBar.setActiveTab(tabId);
      const terminal = this.terminals.get(tabId);
      if (terminal) {
        terminal.fit();
      }
    });

    this.tabBar.onClose((tabId) => {
      this.closeTab(tabId);
    });

    window.shellAPI.onShellData((shellId, data) => {
      const terminal = this.terminals.get(shellId);
      if (terminal) {
        terminal.write(data);
      }
    });

    window.shellAPI.onShellExit((shellId, exitCode) => {
      this.tabBar.setTabDisconnected(shellId, true);
    });

    window.shellAPI.onShellOutputStart((shellId) => {
      this.tabBar.setTabOutputting(shellId, true);
    });

    window.shellAPI.onShellOutputEnd((shellId) => {
      this.tabBar.setTabOutputting(shellId, false);
    });

    window.addEventListener('resize', () => {
      const activeTabId = this.tabBar.getActiveTabId();
      if (activeTabId) {
        const terminal = this.terminals.get(activeTabId);
        if (terminal) {
          terminal.fit();
        }
      }
    });
  }

  private async createShell(node: ProfileNode): Promise<void> {
    const tabId = await window.shellAPI.createShell(node.id, node.config);
    const tabName = `${node.name} ${++this.tabCounter}`;

    this.tabBar.addTab({
      id: tabId,
      name: tabName,
      shellIcon: this.getShellIcon(node.config?.shell),
      isActive: true,
      isOutputting: false,
      isDisconnected: false,
    });

    const terminalView = new TerminalView('terminal-container', tabId);
    terminalView.onData((data) => {
      window.shellAPI.writeToShell(tabId, data);
    });

    this.terminals.set(tabId, terminalView);

    // Resize after a short delay to ensure container is rendered
    setTimeout(() => {
      terminalView.fit();
    }, 100);
  }

  private closeTab(tabId: string): void {
    window.shellAPI.closeShell(tabId);
    const terminal = this.terminals.get(tabId);
    if (terminal) {
      terminal.dispose();
      this.terminals.delete(tabId);
    }
    this.tabBar.removeTab(tabId);
  }

  private getShellIcon(shell?: string): string {
    if (!shell) return '📦';
    const shellLower = shell.toLowerCase();
    if (shellLower.includes('powershell')) return '⬜';
    if (shellLower.includes('cmd')) return '📝';
    if (shellLower.includes('bash')) return '🐚';
    if (shellLower.includes('wsl') || shellLower.includes('ubuntu')) return '🐧';
    return '📦';
  }
}

const app = new App();
app.init().catch(console.error);
```

- [ ] **Step 1: Create src/renderer/index.ts**

```bash
cat > src/renderer/index.ts << 'EOF'
import { ProfileTree } from './components/ProfileTree';
import { TabBar } from './components/TabBar';
import { TerminalView } from './components/TerminalView';

interface ProfileNode {
  id: string;
  name: string;
  type: 'folder' | 'profile';
  icon?: string | null;
  children?: ProfileNode[];
  config?: {
    shell: string;
    args: string[];
    cwd: string;
    autoScripts: Array<{ command: string; waitFor: string | null }>;
  };
}

declare global {
  interface Window {
    shellAPI: {
      createShell: (profileId: string, config: ProfileNode['config']) => Promise<string>;
      writeToShell: (shellId: string, data: string) => void;
      resizeShell: (shellId: string, cols: number, rows: number) => void;
      closeShell: (shellId: string) => void;
      onShellData: (callback: (shellId: string, data: string) => void) => void;
      onShellExit: (callback: (shellId: string, exitCode: number) => void) => void;
      onShellOutputStart: (callback: (shellId: string) => void) => void;
      onShellOutputEnd: (callback: (shellId: string) => void) => void;
      loadProfiles: () => Promise<ProfileNode[]>;
      saveProfiles: (profiles: ProfileNode[]) => Promise<void>;
    };
  }
}

class App {
  private profileTree!: ProfileTree;
  private tabBar!: TabBar;
  private terminals: Map<string, TerminalView> = new Map();
  private tabCounter = 0;

  async init(): Promise<void> {
    this.profileTree = new ProfileTree('profile-tree');
    this.tabBar = new TabBar('tab-bar');

    const profiles = await window.shellAPI.loadProfiles();
    this.profileTree.setProfiles(profiles);

    this.profileTree.onProfileDoubleClick(async (node) => {
      if (node.type === 'profile' && node.config) {
        await this.createShell(node);
      }
    });

    this.tabBar.onClick((tabId) => {
      this.tabBar.setActiveTab(tabId);
      const terminal = this.terminals.get(tabId);
      if (terminal) {
        terminal.fit();
      }
    });

    this.tabBar.onClose((tabId) => {
      this.closeTab(tabId);
    });

    window.shellAPI.onShellData((shellId, data) => {
      const terminal = this.terminals.get(shellId);
      if (terminal) {
        terminal.write(data);
      }
    });

    window.shellAPI.onShellExit((shellId, exitCode) => {
      this.tabBar.setTabDisconnected(shellId, true);
    });

    window.shellAPI.onShellOutputStart((shellId) => {
      this.tabBar.setTabOutputting(shellId, true);
    });

    window.shellAPI.onShellOutputEnd((shellId) => {
      this.tabBar.setTabOutputting(shellId, false);
    });

    window.addEventListener('resize', () => {
      const activeTabId = this.tabBar.getActiveTabId();
      if (activeTabId) {
        const terminal = this.terminals.get(activeTabId);
        if (terminal) {
          terminal.fit();
        }
      }
    });
  }

  private async createShell(node: ProfileNode): Promise<void> {
    const tabId = await window.shellAPI.createShell(node.id, node.config);
    const tabName = `${node.name} ${++this.tabCounter}`;

    this.tabBar.addTab({
      id: tabId,
      name: tabName,
      shellIcon: this.getShellIcon(node.config?.shell),
      isActive: true,
      isOutputting: false,
      isDisconnected: false,
    });

    const terminalView = new TerminalView('terminal-container', tabId);
    terminalView.onData((data) => {
      window.shellAPI.writeToShell(tabId, data);
    });

    this.terminals.set(tabId, terminalView);

    // Resize after a short delay to ensure container is rendered
    setTimeout(() => {
      terminalView.fit();
    }, 100);
  }

  private closeTab(tabId: string): void {
    window.shellAPI.closeShell(tabId);
    const terminal = this.terminals.get(tabId);
    if (terminal) {
      terminal.dispose();
      this.terminals.delete(tabId);
    }
    this.tabBar.removeTab(tabId);
  }

  private getShellIcon(shell?: string): string {
    if (!shell) return '📦';
    const shellLower = shell.toLowerCase();
    if (shellLower.includes('powershell')) return '⬜';
    if (shellLower.includes('cmd')) return '📝';
    if (shellLower.includes('bash')) return '🐚';
    if (shellLower.includes('wsl') || shellLower.includes('ubuntu')) return '🐧';
    return '📦';
  }
}

const app = new App();
app.init().catch(console.error);
EOF
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/index.ts && git commit -m "feat: add renderer entry point with app initialization"
```

---

## 7. HTML 和样式

### 7.1 HTML 入口

**Files:**
- Create: `src/renderer/index.html`

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'">
  <title>Local Terminal</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="app-container">
    <div class="sidebar">
      <div class="sidebar-header">
        <span>Profiles</span>
      </div>
      <div id="profile-tree" class="profile-tree-container"></div>
    </div>
    <div class="main-content">
      <div id="tab-bar" class="tab-bar"></div>
      <div id="terminal-container" class="terminal-container"></div>
    </div>
  </div>
  <script src="index.js"></script>
</body>
</html>
```

- [ ] **Step 1: Create src/renderer/index.html**

```bash
cat > src/renderer/index.html << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'">
  <title>Local Terminal</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="app-container">
    <div class="sidebar">
      <div class="sidebar-header">
        <span>Profiles</span>
      </div>
      <div id="profile-tree" class="profile-tree-container"></div>
    </div>
    <div class="main-content">
      <div id="tab-bar" class="tab-bar"></div>
      <div id="terminal-container" class="terminal-container"></div>
    </div>
  </div>
  <script src="index.js"></script>
</body>
</html>
EOF
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/index.html && git commit -m "feat: add HTML entry point"
```

---

### 7.2 样式文件

**Files:**
- Create: `src/renderer/styles.css`

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1e1e1e;
  color: #cccccc;
  overflow: hidden;
  height: 100vh;
}

.app-container {
  display: flex;
  height: 100vh;
}

/* Sidebar */
.sidebar {
  width: 250px;
  background: #252526;
  border-right: 1px solid #3c3c3c;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 12px 16px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #969696;
  border-bottom: 1px solid #3c3c3c;
}

.profile-tree-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

/* Profile Tree */
.profile-tree {
  list-style: none;
}

.profile-tree ul {
  list-style: none;
  padding-left: 16px;
}

.folder-header {
  padding: 6px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}

.folder-header:hover {
  background: #2a2d2e;
}

.folder-icon {
  font-size: 14px;
}

.folder-name {
  font-size: 13px;
}

.profile-content {
  padding: 6px 12px 6px 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}

.profile-content:hover {
  background: #2a2d2e;
}

.profile-icon {
  font-size: 14px;
}

.profile-name {
  font-size: 13px;
}

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Tab Bar */
.tab-bar {
  display: flex;
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
  min-height: 35px;
  overflow-x: auto;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  min-width: 120px;
  max-width: 200px;
  height: 35px;
  background: #2d2d2d;
  border-right: 1px solid #3c3c3c;
  cursor: pointer;
  user-select: none;
  position: relative;
}

.tab.active {
  background: #2d2d2d;
  border-top: 2px solid #0078d4;
}

.tab.outputting::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #1e6a4a;
}

.tab.disconnected::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #dc3545;
}

.tab-icon {
  font-size: 14px;
}

.tab-name {
  font-size: 12px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-close {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  border-radius: 3px;
  opacity: 0.6;
}

.tab-close:hover {
  opacity: 1;
  background: #3c3c3c;
}

/* Terminal Container */
.terminal-container {
  flex: 1;
  background: #1e1e1e;
  padding: 8px;
  overflow: hidden;
}

.terminal-container .xterm {
  height: 100%;
}

.terminal-container .xterm-viewport {
  overflow-y: auto;
}
```

- [ ] **Step 1: Create src/renderer/styles.css**

```bash
cat > src/renderer/styles.css << 'EOF'
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1e1e1e;
  color: #cccccc;
  overflow: hidden;
  height: 100vh;
}

.app-container {
  display: flex;
  height: 100vh;
}

/* Sidebar */
.sidebar {
  width: 250px;
  background: #252526;
  border-right: 1px solid #3c3c3c;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 12px 16px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #969696;
  border-bottom: 1px solid #3c3c3c;
}

.profile-tree-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

/* Profile Tree */
.profile-tree {
  list-style: none;
}

.profile-tree ul {
  list-style: none;
  padding-left: 16px;
}

.folder-header {
  padding: 6px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}

.folder-header:hover {
  background: #2a2d2e;
}

.folder-icon {
  font-size: 14px;
}

.folder-name {
  font-size: 13px;
}

.profile-content {
  padding: 6px 12px 6px 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}

.profile-content:hover {
  background: #2a2d2e;
}

.profile-icon {
  font-size: 14px;
}

.profile-name {
  font-size: 13px;
}

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Tab Bar */
.tab-bar {
  display: flex;
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
  min-height: 35px;
  overflow-x: auto;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  min-width: 120px;
  max-width: 200px;
  height: 35px;
  background: #2d2d2d;
  border-right: 1px solid #3c3c3c;
  cursor: pointer;
  user-select: none;
  position: relative;
}

.tab.active {
  background: #2d2d2d;
  border-top: 2px solid #0078d4;
}

.tab.outputting::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #1e6a4a;
}

.tab.disconnected::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #dc3545;
}

.tab-icon {
  font-size: 14px;
}

.tab-name {
  font-size: 12px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-close {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  border-radius: 3px;
  opacity: 0.6;
}

.tab-close:hover {
  opacity: 1;
  background: #3c3c3c;
}

/* Terminal Container */
.terminal-container {
  flex: 1;
  background: #1e1e1e;
  padding: 8px;
  overflow: hidden;
}

.terminal-container .xterm {
  height: 100%;
}

.terminal-container .xterm-viewport {
  overflow-y: auto;
}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/styles.css && git commit -m "feat: add styles for terminal manager UI"
```

---

## 8. 默认 profiles.json

**Files:**
- Create: `profiles.json`

```json
{
  "profileTree": [
    {
      "id": "folder-dev",
      "name": "开发环境",
      "type": "folder",
      "children": [
        {
          "id": "profile-powershell",
          "name": "PowerShell",
          "type": "profile",
          "icon": null,
          "config": {
            "shell": "powershell.exe",
            "args": [],
            "cwd": "%USERPROFILE%",
            "autoScripts": []
          }
        },
        {
          "id": "profile-cmd",
          "name": "CMD",
          "type": "profile",
          "icon": null,
          "config": {
            "shell": "cmd.exe",
            "args": [],
            "cwd": "%USERPROFILE%",
            "autoScripts": []
          }
        },
        {
          "id": "profile-git-bash",
          "name": "Git Bash",
          "type": "profile",
          "icon": null,
          "config": {
            "shell": "C:\\Program Files\\Git\\bin\\bash.exe",
            "args": [],
            "cwd": "%USERPROFILE%",
            "autoScripts": []
          }
        }
      ]
    }
  ]
}
```

- [ ] **Step 1: Create profiles.json**

```bash
cat > profiles.json << 'EOF'
{
  "profileTree": [
    {
      "id": "folder-dev",
      "name": "开发环境",
      "type": "folder",
      "children": [
        {
          "id": "profile-powershell",
          "name": "PowerShell",
          "type": "profile",
          "icon": null,
          "config": {
            "shell": "powershell.exe",
            "args": [],
            "cwd": "%USERPROFILE%",
            "autoScripts": []
          }
        },
        {
          "id": "profile-cmd",
          "name": "CMD",
          "type": "profile",
          "icon": null,
          "config": {
            "shell": "cmd.exe",
            "args": [],
            "cwd": "%USERPROFILE%",
            "autoScripts": []
          }
        },
        {
          "id": "profile-git-bash",
          "name": "Git Bash",
          "type": "profile",
          "icon": null,
          "config": {
            "shell": "C:\\Program Files\\Git\\bin\\bash.exe",
            "args": [],
            "cwd": "%USERPROFILE%",
            "autoScripts": []
          }
        }
      ]
    }
  ]
}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add profiles.json && git commit -m "feat: add default profiles.json"
```

---

## 9. 构建和运行

### 9.1 复制静态文件到 dist

需要在构建后将 HTML 和 CSS 文件复制到 dist 目录。

**Modify: package.json**

```json
{
  "scripts": {
    "dev": "npm run build && electron .",
    "build": "tsc && npm run copy-assets",
    "copy-assets": "node scripts/copy-assets.js",
    "start": "electron ."
  }
}
```

- [ ] **Step 1: Update package.json scripts**

```bash
cat > package.json << 'EOF'
{
  "name": "local-terminal",
  "version": "1.0.0",
  "description": "Local Terminal Manager with profile management",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "npm run build && electron .",
    "build": "tsc && npm run copy-assets",
    "copy-assets": "node scripts/copy-assets.js",
    "start": "electron ."
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "typescript": "^5.3.0"
  },
  "dependencies": {
    "electron-store": "^8.1.0",
    "node-pty": "^1.0.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0"
  }
}
EOF
```

- [ ] **Step 2: Create scripts/copy-assets.js**

```bash
mkdir -p scripts
cat > scripts/copy-assets.js << 'EOF'
const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir('src/renderer', 'dist/renderer');
EOF
```

- [ ] **Step 3: Commit**

```bash
git add package.json scripts/copy-assets.js && git commit -m "chore: add build scripts for assets copying"
```

---

## 实现顺序

1. ✅ 项目脚手架 (package.json, tsconfig.json)
2. ✅ 主进程基础 (main/index.ts)
3. ✅ Preload 脚本
4. ✅ PTY Manager
5. ✅ IPC Handlers
6. ✅ ProfileTree 组件
7. ✅ TabBar 组件
8. ✅ TerminalView 组件
9. ✅ 渲染进程入口
10. ✅ HTML 和 CSS
11. ✅ profiles.json
12. ✅ 构建配置

---

**Plan complete.** 保存至 `docs/superpowers/plans/2026-06-02-local-terminal-manager-plan.md`
