import * as pty from 'node-pty';
import * as path from 'path';
import { getMainWindow } from './index';

function expandEnvVars(p: string): string {
  return p.replace(/%([^%]+)%/g, (_, name) => process.env[name] || '');
}

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
      cwd: expandEnvVars(config.cwd),
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

    let currentTimeout: NodeJS.Timeout | null = null;
    let currentInterval: NodeJS.Timeout | null = null;

    const runNext = () => {
      if (instance.currentScriptIndex >= instance.autoScripts.length) {
        return;
      }

      // Clear previous timer/interval
      if (currentTimeout) {
        clearTimeout(currentTimeout);
        currentTimeout = null;
      }
      if (currentInterval) {
        clearInterval(currentInterval);
        currentInterval = null;
      }

      const script = instance.autoScripts[instance.currentScriptIndex++];

      // If script has waitFor, wait for pattern first, then execute
      if (script.waitFor !== null && script.waitFor !== undefined && script.waitFor !== '') {
        instance.pendingData = '';

        // Timeout - give up waiting
        currentTimeout = setTimeout(() => {
          currentInterval = null;
          currentTimeout = null;
          instance.pendingData = '';
          runNext();
        }, 10000);

        // Check for pattern periodically
        currentInterval = setInterval(() => {
          if (instance.pendingData.includes(script.waitFor!)) {
            if (currentTimeout) {
              clearTimeout(currentTimeout);
              currentTimeout = null;
            }
            if (currentInterval) clearInterval(currentInterval);
            currentInterval = null;
            instance.pendingData = '';

            // Now execute the command
            instance.pty.write(script.command + '\r');

            // After executing, wait 100ms then continue to next
            setTimeout(runNext, 100);
          }
        }, 100);
      } else {
        // No waitFor - execute immediately
        instance.pty.write(script.command + '\r');
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
    }, 1000);
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
      ? 'Terminal ● 输出中'
      : 'Terminal';
    mainWindow.setTitle(title);
    mainWindow.webContents.send('window:titleChanged', title);
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

  closeAll(): void {
    for (const [shellId, instance] of this.shells) {
      instance.pty.kill();
      if (instance.outputTimer) {
        clearTimeout(instance.outputTimer);
      }
    }
    this.shells.clear();
  }
}

export const ptyManager = new PtyManager();
