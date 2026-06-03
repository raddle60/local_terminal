import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export class TerminalView {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private wrapperElement: HTMLElement;
  private xtermHostElement: HTMLElement;
  private shellId: string;
  private onDataCallback: (data: string) => void = () => {};
  private parentContainerId: string;

  constructor(parentContainerId: string, shellId: string) {
    this.shellId = shellId;
    this.parentContainerId = parentContainerId;

    // Create wrapper element (like VSCode's .terminal-wrapper)
    this.wrapperElement = document.createElement('div');
    this.wrapperElement.className = 'terminal-wrapper';
    this.wrapperElement.style.width = '100%';
    this.wrapperElement.style.height = '100%';

    // Create xterm-host element (like VSCode's .terminal-xterm-host)
    this.xtermHostElement = document.createElement('div');
    this.xtermHostElement.className = 'terminal-xterm-host';
    this.wrapperElement.appendChild(this.xtermHostElement);

    // Add wrapper to parent
    const parent = document.getElementById(parentContainerId)!;
    parent.appendChild(this.wrapperElement);

    // Create terminal with VSCode-like options
    this.terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      windowsMode: true,
      convertEol: true,
      rightClickSelectsWord: true,
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    // Open terminal in xterm-host element
    this.terminal.open(this.xtermHostElement);
    this.fitAddon.fit();

    // Auto-copy on selection
    this.terminal.onSelectionChange(() => {
      if (this.terminal.hasSelection()) {
        const selection = this.terminal.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection).catch(() => {});
        }
      }
    });

    // Right-click paste with bracketed paste mode
    this.xtermHostElement.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      try {
        const text = await navigator.clipboard.readText();
        // Bracketed paste mode
        this.onDataCallback('\x1b[200~' + text.replace(/\x1b\[200~/g, '') + '\x1b[201~');
      } catch (err) {
        // Fallback: read clipboard via prompt if clipboard API fails
      }
    });
  }

  getShellId(): string {
    return this.shellId;
  }

  getElement(): HTMLElement {
    return this.wrapperElement;
  }

  getXtermHostElement(): HTMLElement {
    return this.xtermHostElement;
  }

  focus(): void {
    this.terminal.focus();
  }

  clearSelection(): void {
    this.terminal.clearSelection();
  }

  write(data: string): void {
    this.terminal.write(data);
  }

  onData(callback: (data: string) => void): void {
    this.onDataCallback = callback;
    this.terminal.onData(callback);
  }

  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows);
  }

  fit(): void {
    this.fitAddon.fit();
  }

  setActive(active: boolean): void {
    this.wrapperElement.classList.toggle('active', active);
  }

  dispose(): void {
    this.terminal.dispose();
    this.wrapperElement.remove();
  }
}
