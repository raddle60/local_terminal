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
