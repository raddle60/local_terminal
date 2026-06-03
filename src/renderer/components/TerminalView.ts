import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export class TerminalView {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private element: HTMLElement;
  private shellId: string;

  constructor(parentContainerId: string, shellId: string) {
    this.shellId = shellId;

    // Create a unique container for this terminal
    this.element = document.createElement('div');
    this.element.id = `terminal-${shellId}`;
    this.element.style.width = '100%';
    this.element.style.height = '100%';
    this.element.style.position = 'absolute';
    this.element.style.top = '0';
    this.element.style.left = '0';

    const parent = document.getElementById(parentContainerId)!;
    parent.appendChild(this.element);

    this.terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      windowsMode: true,
      convertEol: true,
    });

    // Hide xterm.js selection highlight via CSS
    // Selection functionality still works but no visible highlight
    const style = document.createElement('style');
    style.textContent = `
      #terminal-${shellId} .xterm-selection {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(this.element);
    this.fitAddon.fit();
  }

  getShellId(): string {
    return this.shellId;
  }

  getElement(): HTMLElement {
    return this.element;
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
    this.element.remove();
  }
}
