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
