import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

export class TerminalView {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private element: HTMLElement;
  private xtermHostElement: HTMLElement;
  private shellId: string;
  private onDataCallback: (data: string) => void = () => {};

  constructor(parentContainerId: string, shellId: string) {
    this.shellId = shellId;

    // Create terminal instance container
    this.element = document.createElement('div');
    this.element.className = 'terminal-instance';
    this.element.style.width = '100%';
    this.element.style.height = '100%';
    this.element.style.position = 'absolute';
    this.element.style.top = '0';
    this.element.style.left = '0';
    this.element.style.bottom = '0';
    this.element.style.right = '0';

    // Create xterm-host element
    this.xtermHostElement = document.createElement('div');
    this.xtermHostElement.className = 'terminal-xterm-host';
    this.element.appendChild(this.xtermHostElement);

    // Add to parent
    const parent = document.getElementById(parentContainerId)!;
    parent.appendChild(this.element);

    // Create terminal
    this.terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      convertEol: true,
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    // Open terminal in xterm-host element
    this.terminal.open(this.xtermHostElement);
    this.fitAddon.fit();

    // Auto-copy on selection change
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
    return this.element;
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
    this.element.classList.toggle('active', active);
  }

  dispose(): void {
    this.terminal.dispose();
    this.element.remove();
  }
}
