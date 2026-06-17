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
      theme: {
        background: '#2d2d2d',
      },
      scrollback: 10000,
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    // Open terminal in xterm-host element
    this.terminal.open(this.xtermHostElement);
    this.fitAddon.fit();

    // Fix cursor-position desync after window-focus change and IME input.
    // When focus returns to the window, or after IME composition, xterm's
    // internal cursor state can diverge from the TUI app's rendered cursor.
    // Sending ← then → with a gap forces the shell to emit fresh
    // cursor-movement sequences that resync xterm's idea of the column.
    // Note: xterm.js 5.5's public API only exposes focus()/blur() methods,
    // not events, so we listen on the underlying textarea DOM element.
    const textarea = this.xtermHostElement.querySelector('textarea') as HTMLTextAreaElement | null;
    if (textarea) {
      // Dispatch keyboard events on the textarea to simulate arrow-key presses.
      // xterm's internal input handler listens to these DOM keyboard events and
      // converts them to ANSI escape sequences (\x1b[D / \x1b[C) which are then
      // sent to the PTY.  The shell echoes them back, and xterm uses the
      // returned cursor-movement sequences to resync its internal cursor state.
      const sendKey = (key: string, keyCode: number) => {
        textarea.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, bubbles: true }));
        textarea.dispatchEvent(new KeyboardEvent('keyup', { key, keyCode, bubbles: true }));
      };
      const resyncCursor = () => {
        setTimeout(() => sendKey('ArrowLeft', 37), 0);    // ←
        setTimeout(() => sendKey('ArrowRight', 39), 15);  // →
      };

      // Resync on focus/blur to handle cursor desync with shell
      // Focus events on textarea are more reliable for xterm input
      textarea.addEventListener('focus', () => {
        resyncCursor();
      });
      textarea.addEventListener('blur', () => {
        resyncCursor();
      });

      // Resync on mouse click - clicking in the terminal can desync
      // the cursor position between xterm and the shell
      this.xtermHostElement.addEventListener('click', () => {
        resyncCursor();
      });

      // Also resync after composition end - IME can leave cursor out of sync
      textarea.addEventListener('compositionend', () => {
        // Small delay to let the composed character be processed
        setTimeout(resyncCursor, 10);
      });
    }

    // Fix IME composition view positioning in TUI apps
    // Issue: When in alternate screen buffer (Claude Code), xterm's
    // composition-view position calculation becomes incorrect.
    // Solution: Manually reposition composition view to match the
    // xterm-cursor's actual rendered position before IME shows.
    setTimeout(() => {
      this.setupImePositionFix();
    }, 0);

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
      await this.pasteFromClipboard();
    });

    // Ctrl+V / Cmd+V paste with bracketed paste mode.
    // Use xterm's official `attachCustomKeyEventHandler` so xterm
    // itself skips Ctrl+V entirely (returning false makes xterm
    // emit no data for the key). Our own handler then writes the
    // bracketed paste via onData. This avoids the double-paste
    // that happens when we only intercept the DOM event, because
    // xterm's internal key evaluation also runs and would otherwise
    // emit the paste a second time.
    this.terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === 'v') {
        e.preventDefault();
        this.pasteFromClipboard();
        return false;
      }
      return true;
    });
  }

  private async pasteFromClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      // Bracketed paste mode - filter out any existing paste markers
      const cleanText = text.replace(/\x1b\[200~/g, '');
      if (!cleanText) return;

      // Multi-line text: ask the user how to paste. Single-line pastes
      // are always bracketed — there's no auto-execute risk, and the
      // dialog would be needless friction.
      if (/[\r\n]/.test(cleanText)) {
        const choice = await this.showPasteDialog(cleanText);
        if (choice === 'cancel') return;
        if (choice === 'bracketed') {
          this.writeBracketed(cleanText);
        } else {
          this.writePlain(cleanText);
        }
        return;
      }

      this.writeBracketed(cleanText);
    } catch (err) {
      // Clipboard API failed (e.g., no permission); silently ignore
    } finally {
      // The paste dialog (or even the clipboard read) can steal focus
      // from the terminal. Restore it so the user can keep typing in
      // the shell after the paste starts streaming. rAF is used to
      // defer until the click event has fully finished and the dialog
      // is no longer in the DOM focus order.
      requestAnimationFrame(() => this.terminal.focus());
    }
  }

  private pasteDialogOpen = false;

  private showPasteDialog(text: string): Promise<'bracketed' | 'plain' | 'cancel'> {
    // If a paste dialog is already showing, ignore the new paste
    // request rather than stacking dialogs over each other.
    if (this.pasteDialogOpen) {
      return Promise.resolve('cancel');
    }
    this.pasteDialogOpen = true;

    return new Promise((resolve) => {
      const dialog = document.getElementById('paste-dialog')!;
      const preview = document.getElementById('paste-preview')!;
      const bracketedBtn = document.getElementById('paste-bracketed')!;
      const plainBtn = document.getElementById('paste-plain')!;
      const cancelBtn = document.getElementById('paste-cancel')!;

      // Show a trimmed preview so the user knows what they're pasting
      // without overflowing the dialog.
      const MAX_PREVIEW = 500;
      preview.textContent =
        text.length > MAX_PREVIEW
          ? text.slice(0, MAX_PREVIEW) + '\n…(已截断)'
          : text;

      const finish = (choice: 'bracketed' | 'plain' | 'cancel') => {
        bracketedBtn.removeEventListener('click', onBracketed);
        plainBtn.removeEventListener('click', onPlain);
        cancelBtn.removeEventListener('click', onCancel);
        dialog.classList.add('hidden');
        this.pasteDialogOpen = false;
        resolve(choice);
      };

      const onBracketed = () => finish('bracketed');
      const onPlain = () => finish('plain');
      const onCancel = () => finish('cancel');

      bracketedBtn.addEventListener('click', onBracketed);
      plainBtn.addEventListener('click', onPlain);
      cancelBtn.addEventListener('click', onCancel);

      dialog.classList.remove('hidden');
    });
  }

  // Large pastes are split into small chunks with a delay between
  // them so the TUI (e.g. Claude Code) can consume the data
  // incrementally. Without this, a ~2K paste is truncated to
  // roughly half: the TUI's paste handler / line buffer fills
  // up before it can process the leading characters, and only
  // the tail is rendered.
  //
  // Chunking strategy: Use 512-byte IPC-safe chunks with 20ms delay.
  // Small enough to avoid IPC limits, large enough to not be too slow.
  // The final PASTE_END is sent after a 50ms delay to ensure all data
  // is processed by the TUI before we close the bracketed paste mode.
  private writeBracketed(text: string): void {
    const PASTE_START = '\x1b[200~';
    const PASTE_END = '\x1b[201~';
    const CHUNK_SIZE = 512;
    const CHUNK_DELAY_MS = 20;

    if (text.length <= CHUNK_SIZE) {
      this.onDataCallback(PASTE_START + text + PASTE_END);
      return;
    }

    // Begin bracketed paste with the first chunk
    this.onDataCallback(PASTE_START + text.slice(0, CHUNK_SIZE));

    let offset = CHUNK_SIZE;
    const flushChunk = () => {
      if (offset >= text.length) {
        // Final chunk sent - wait before closing bracket to give TUI
        // time to process all data
        setTimeout(() => {
          this.onDataCallback(PASTE_END);
        }, 50);
        return;
      }
      const end = Math.min(offset + CHUNK_SIZE, text.length);
      this.onDataCallback(text.slice(offset, end));
      offset = end;
      setTimeout(flushChunk, CHUNK_DELAY_MS);
    };
    setTimeout(flushChunk, CHUNK_DELAY_MS);
  }

  // Plain (non-bracketed) paste: write text as if typed. The TUI/shell
  // sees raw characters with no paste markers, so each line is treated
  // as a separate command and submitted.
  //
  // Line endings are normalized to CR (\r) before sending. Reason:
  // Windows ConPTY does not translate LF→CR on input — only CR
  // triggers Enter, so a raw LF leaves the shell prompt waiting.
  // On Unix the terminal driver converts CR→LF via ICRNL, so the
  // same encoding works for both platforms.
  //
  // Same chunking strategy as bracketed to avoid TUI input buffer
  // overflow on large pastes.
  private writePlain(text: string): void {
    const CHUNK_SIZE = 512;
    const CHUNK_DELAY_MS = 20;
    const normalized = text.replace(/\r\n|\n|\r/g, '\r');

    if (normalized.length <= CHUNK_SIZE) {
      this.onDataCallback(normalized);
      return;
    }

    this.onDataCallback(normalized.slice(0, CHUNK_SIZE));

    let offset = CHUNK_SIZE;
    const flushChunk = () => {
      if (offset >= normalized.length) return;
      const end = Math.min(offset + CHUNK_SIZE, normalized.length);
      this.onDataCallback(normalized.slice(offset, end));
      offset = end;
      setTimeout(flushChunk, CHUNK_DELAY_MS);
    };
    setTimeout(flushChunk, CHUNK_DELAY_MS);
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
    this.terminal.onData(this.onDataCallback);
  }

  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows);
  }

  fit(): void {
    // Account for padding in the container when fitting
    const style = getComputedStyle(this.element);
    const paddingX = parseInt(style.paddingLeft, 10) + parseInt(style.paddingRight, 10);
    const paddingY = parseInt(style.paddingTop, 10) + parseInt(style.paddingBottom, 10);
    const availableWidth = this.element.clientWidth - paddingX;
    // Extra paddingY to prevent bottom row from being cut off
    const availableHeight = this.element.clientHeight - paddingY - 3;

    // Temporarily resize the element to account for padding
    const originalWidth = this.element.style.width;
    const originalHeight = this.element.style.height;
    this.element.style.width = `${availableWidth}px`;
    this.element.style.height = `${availableHeight}px`;

    this.fitAddon.fit();

    // Restore original dimensions
    this.element.style.width = originalWidth;
    this.element.style.height = originalHeight;
  }

  setActive(active: boolean): void {
    this.element.classList.toggle('active', active);
  }

  private setupImePositionFix(): void {
    // The bug: xterm's IME composition view positioning uses internal
    // coordinates that are incorrect in TUI apps (like Claude Code)
    // that use alternate screen buffer and custom cursor rendering.
    //
    // Fix: Find the actual rendered cursor (a span with xterm-bg class
    // in the .xterm-rows) and align the composition view to it.
    // Also reposition the helper textarea (which OS uses to position
    // the IME candidate window) to follow the real cursor.
    const helperTextarea = this.xtermHostElement.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement;
    if (!helperTextarea) return;

    const reposition = () => {
      const compositionView = this.xtermHostElement.querySelector('.composition-view') as HTMLElement;
      const hostRect = this.xtermHostElement.getBoundingClientRect();
      const cursorEl = this.findActualCursor();

      if (!cursorEl) return;
      const rect = cursorEl.getBoundingClientRect();
      // xterm's internal content is offset by the host's padding,
      // so we need to add it back to get correct composition view position
      const style = getComputedStyle(this.xtermHostElement);
      const paddingLeft = parseInt(style.paddingLeft, 10);
      const paddingTop = parseInt(style.paddingTop, 10);
      const left = rect.left - hostRect.left + paddingLeft;
      const top = rect.top - hostRect.top + paddingTop;
      const height = rect.height || 17;

      // Position composition view (the rendered composing text)
      if (compositionView && compositionView.classList.contains('active')) {
        compositionView.style.setProperty('position', 'absolute', 'important');
        compositionView.style.setProperty('left', `${left}px`, 'important');
        compositionView.style.setProperty('top', `${top}px`, 'important');
        compositionView.style.setProperty('right', 'auto', 'important');
        compositionView.style.setProperty('bottom', 'auto', 'important');
      }

      // Position helper textarea (this is what OS uses to place IME
      // candidate window). xterm sets it to position:absolute with
      // left: -9999em. We override with the actual cursor position.
      // Use !important via setProperty to override xterm's inline styles.
      if (compositionView?.classList.contains('active') || document.activeElement === helperTextarea) {
        helperTextarea.style.setProperty('position', 'absolute', 'important');
        helperTextarea.style.setProperty('left', `${left}px`, 'important');
        helperTextarea.style.setProperty('top', `${top}px`, 'important');
        helperTextarea.style.setProperty('height', `${height}px`, 'important');
        helperTextarea.style.setProperty('opacity', '0', 'important');
      }
    };

    // Continuously reposition during composition, since xterm resets
    // the helper textarea position on every render. We use a rAF loop
    // that runs only while IME is active.
    let rafId: number | null = null;
    const loop = () => {
      const compositionView = this.xtermHostElement.querySelector('.composition-view') as HTMLElement;
      if (compositionView?.classList.contains('active')) {
        reposition();
        rafId = requestAnimationFrame(loop);
      } else {
        rafId = null;
      }
    };

    // Watch DOM changes
    const screen = this.xtermHostElement.querySelector('.xterm-screen');
    if (screen) {
      const observer = new MutationObserver(() => {
        const compositionView = this.xtermHostElement.querySelector('.composition-view') as HTMLElement;
        if (compositionView?.classList.contains('active')) {
          reposition();
          // Start the continuous loop if not already running
          if (rafId === null) {
            rafId = requestAnimationFrame(loop);
          }
        }
      });
      observer.observe(screen, {
        attributes: true,
        subtree: true,
        childList: true,
        characterData: true,
        attributeFilter: ['style', 'class']
      });
    }

    // Also reposition on keydown (Backspace, characters) - this catches
    // the case where shell hasn't echoed back yet but cursor moved
    helperTextarea.addEventListener('keydown', () => {
      requestAnimationFrame(reposition);
    });
    helperTextarea.addEventListener('compositionstart', () => {
      requestAnimationFrame(() => requestAnimationFrame(reposition));
      // Start continuous repositioning loop
      if (rafId === null) {
        rafId = requestAnimationFrame(loop);
      }
    });
    helperTextarea.addEventListener('compositionend', () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    });
  }

  private findActualCursor(): HTMLElement | null {
    // The cursor in xterm is rendered as a span with class xterm-bg-7
    // and xterm-fg-0. In TUI apps (Claude Code), xterm's internal
    // cursor state becomes wrong, so we look at the actual DOM to
    // find the cursor. We pick the lowest one in the visible area,
    // and on the same row, the rightmost one (where new text will be).
    const cursorSpans = Array.from(this.xtermHostElement.querySelectorAll('span.xterm-bg-7.xterm-fg-0'));
    if (cursorSpans.length === 0) return null;

    const hostRect = this.xtermHostElement.getBoundingClientRect();
    let best: HTMLElement | null = null;
    let bestTop = -Infinity;
    let bestLeft = -Infinity;

    for (const span of cursorSpans) {
      const rect = span.getBoundingClientRect();
      if (rect.top < hostRect.top - 5 || rect.top >= hostRect.bottom) continue;
      if (rect.top > bestTop + 5 ||
          (Math.abs(rect.top - bestTop) <= 5 && rect.left > bestLeft)) {
        best = span as HTMLElement;
        bestTop = rect.top;
        bestLeft = rect.left;
      }
    }

    return best;
  }

  getDimensions(): { cols: number; rows: number } {
    return {
      cols: this.terminal.cols,
      rows: this.terminal.rows
    };
  }

  dispose(): void {
    this.terminal.dispose();
    this.element.remove();
  }
}
