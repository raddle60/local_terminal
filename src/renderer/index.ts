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
      onWindowTitleChanged: (callback: (title: string) => void) => void;
      loadProfiles: () => Promise<ProfileNode[]>;
      saveProfiles: (profiles: ProfileNode[]) => Promise<void>;
      createProfile: (profile: ProfileNode, parentId?: string) => Promise<boolean>;
      updateProfile: (profile: ProfileNode) => Promise<boolean>;
      deleteProfile: (id: string) => Promise<boolean>;
      getHomeDir: () => Promise<string>;
      validateProfileConfig: (input: { name?: string; icon?: string | null; shell?: string; cwd?: string }) => Promise<{
        name: 'ok' | 'missing';
        icon: 'ok' | 'missing' | 'not-executable' | 'not-found' | null;
        shell: 'ok' | 'missing' | 'not-executable' | 'not-found';
        cwd: 'ok' | 'missing' | 'not-executable' | 'not-found' | null;
      }>;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
    };
  }
}

type FieldStatus = 'ok' | 'missing' | 'not-executable' | 'not-found' | null;
type ValidationResult = {
  name: 'ok' | 'missing';
  icon: FieldStatus;
  shell: 'ok' | 'missing' | 'not-executable' | 'not-found';
  cwd: FieldStatus;
};

class App {
  private profileTree!: ProfileTree;
  private tabBar!: TabBar;
  private terminals: Map<string, TerminalView> = new Map();
  private tabCounter = 0;
  private resizeTimeout: number | null = null;
  private validationTimeout: number | null = null;
  private lastValidation: ValidationResult = { name: 'missing', icon: null, shell: 'missing', cwd: null };

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

    this.profileTree.onContextMenu((node, action) => {
      if (action === 'edit') {
        this.showEditProfileDialog(node);
      } else if (action === 'delete') {
        this.handleProfileDelete(node);
      } else if (action === 'copy') {
        this.showCopyProfileDialog(node);
      }
    });

    this.tabBar.onClick((tabId) => {
      // Clear selection on all terminals and set active state
      this.terminals.forEach((t, id) => {
        t.clearSelection();
        t.setActive(id === tabId);
      });
      this.tabBar.setActiveTab(tabId);
      const terminal = this.terminals.get(tabId);
      if (terminal) {
        terminal.focus();
        terminal.fit();
      }
    });

    this.tabBar.onClose((tabId) => {
      this.closeTab(tabId);
    });

    this.tabBar.onActivate((tabId) => {
      // Auto-focus the newly activated tab's terminal, mirroring the
      // focus-after-create pattern used in createShell.
      const terminal = this.terminals.get(tabId);
      if (terminal) {
        requestAnimationFrame(() => terminal.focus());
      }
    });

    window.shellAPI.onShellData((shellId, data) => {
      const terminal = this.terminals.get(shellId);
      if (terminal) {
        terminal.write(data);
      }
    });

    window.shellAPI.onShellExit((shellId, exitCode) => {
      this.closeTab(shellId);
    });

    window.shellAPI.onShellOutputStart((shellId) => {
      this.tabBar.setTabOutputting(shellId, true);
    });

    window.shellAPI.onShellOutputEnd((shellId) => {
      this.tabBar.setTabOutputting(shellId, false);
    });

    window.shellAPI.onWindowTitleChanged((title) => {
      const titleEl = document.querySelector('.title-bar-title');
      if (titleEl) {
        titleEl.textContent = title;
      }
    });

    window.addEventListener('resize', () => {
      // Debounce resize to prevent fit() from being called too frequently
      if (this.resizeTimeout !== null) {
        clearTimeout(this.resizeTimeout);
      }
      this.resizeTimeout = window.setTimeout(() => {
        this.resizeTimeout = null;
        const activeTabId = this.tabBar.getActiveTabId();
        if (activeTabId) {
          const terminal = this.terminals.get(activeTabId);
          if (terminal) {
            terminal.fit();
            const dims = terminal.getDimensions();
            window.shellAPI.resizeShell(activeTabId, dims.cols, dims.rows);
          }
        }
      }, 100);
    });

    // Add profile button handler
    const addProfileBtn = document.getElementById('add-profile-btn');
    if (addProfileBtn) {
      addProfileBtn.addEventListener('click', async () => {
        await this.showAddProfileDialog();
      });
    }

    // Title bar controls
    const btnMinimize = document.getElementById('btn-minimize');
    const btnMaximize = document.getElementById('btn-maximize');
    const btnClose = document.getElementById('btn-close');

    if (btnMinimize) {
      btnMinimize.addEventListener('click', () => window.shellAPI.minimizeWindow());
    }
    if (btnMaximize) {
      btnMaximize.addEventListener('click', () => window.shellAPI.maximizeWindow());
    }
    if (btnClose) {
      btnClose.addEventListener('click', () => window.shellAPI.closeWindow());
    }

    // Dialog event handlers
    const dialog = document.getElementById('profile-dialog')!;
    const dialogClose = document.getElementById('dialog-close')!;
    const dialogCancel = document.getElementById('dialog-cancel')!;
    const dialogSave = document.getElementById('dialog-save')!;

    dialogClose.addEventListener('click', () => this.hideDialog());
    dialogCancel.addEventListener('click', () => this.hideDialog());

    dialogSave.addEventListener('click', () => this.saveProfileDialog());

    // Live validation for name/icon/shell/cwd fields
    const nameInput = document.getElementById('profile-name') as HTMLInputElement;
    const iconInput = document.getElementById('profile-icon') as HTMLInputElement;
    const shellInput = document.getElementById('profile-shell') as HTMLInputElement;
    const cwdInput = document.getElementById('profile-cwd') as HTMLInputElement;
    nameInput.addEventListener('input', () => this.scheduleValidation());
    iconInput.addEventListener('input', () => this.scheduleValidation());
    shellInput.addEventListener('input', () => this.scheduleValidation());
    cwdInput.addEventListener('input', () => this.scheduleValidation());

    // Auto-scripts event handler
    const addScriptBtn = document.getElementById('add-script-btn')!;
    addScriptBtn.addEventListener('click', () => this.addAutoScript());

    // Confirm dialog event handlers
    const confirmDialog = document.getElementById('confirm-dialog')!;
    const confirmCancel = document.getElementById('confirm-cancel')!;
    const confirmOk = document.getElementById('confirm-ok')!;

    confirmCancel.addEventListener('click', () => this.hideConfirmDialog(false));
    confirmOk.addEventListener('click', () => this.hideConfirmDialog(true));
  }

  private confirmResolve: ((result: boolean) => void) | null = null;

  private showConfirmDialog(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmResolve = resolve;
      document.getElementById('confirm-title')!.textContent = title;
      document.getElementById('confirm-message')!.textContent = message;
      document.getElementById('confirm-dialog')!.classList.remove('hidden');
    });
  }

  private hideConfirmDialog(result: boolean): void {
    document.getElementById('confirm-dialog')!.classList.add('hidden');
    if (this.confirmResolve) {
      this.confirmResolve(result);
      this.confirmResolve = null;
    }
  }

  private dialogMode: 'add' | 'edit' | 'copy' = 'add';
  private editingProfile: ProfileNode | null = null;

  private async showAddProfileDialog(): Promise<void> {
    this.dialogMode = 'add';
    this.editingProfile = null;
    document.getElementById('dialog-title')!.textContent = '新增 Profile';
    (document.getElementById('profile-name') as HTMLInputElement).value = '';
    (document.getElementById('profile-icon') as HTMLInputElement).value = '';
    (document.getElementById('profile-shell') as HTMLInputElement).value = '';
    const homeDir = await window.shellAPI.getHomeDir();
    (document.getElementById('profile-cwd') as HTMLInputElement).value = homeDir;
    this.renderAutoScripts([]);
    document.getElementById('profile-dialog')!.classList.remove('hidden');
    this.scheduleValidation();
  }

  private showEditProfileDialog(node: ProfileNode): void {
    this.dialogMode = 'edit';
    this.editingProfile = node;
    document.getElementById('dialog-title')!.textContent = '编辑 Profile';
    (document.getElementById('profile-name') as HTMLInputElement).value = node.name;
    (document.getElementById('profile-icon') as HTMLInputElement).value = node.icon || '';
    (document.getElementById('profile-shell') as HTMLInputElement).value = node.config?.shell || '';
    (document.getElementById('profile-cwd') as HTMLInputElement).value = node.config?.cwd || '';
    this.renderAutoScripts(node.config?.autoScripts || []);
    document.getElementById('profile-dialog')!.classList.remove('hidden');
    this.scheduleValidation();
  }

  private showCopyProfileDialog(node: ProfileNode): void {
    this.dialogMode = 'copy';
    this.editingProfile = null;
    document.getElementById('dialog-title')!.textContent = '复制 Profile';
    (document.getElementById('profile-name') as HTMLInputElement).value = `Copy of ${node.name}`;
    (document.getElementById('profile-icon') as HTMLInputElement).value = node.icon || '';
    (document.getElementById('profile-shell') as HTMLInputElement).value = node.config?.shell || '';
    (document.getElementById('profile-cwd') as HTMLInputElement).value = node.config?.cwd || '';
    this.renderAutoScripts(node.config?.autoScripts || []);
    document.getElementById('profile-dialog')!.classList.remove('hidden');
    this.scheduleValidation();
  }

  private hideDialog(): void {
    document.getElementById('profile-dialog')!.classList.add('hidden');
    this.editingProfile = null;
  }

  private scheduleValidation(): void {
    // Show "checking" state immediately for snappy UI feedback
    this.setFieldStatus('profile-name-status', 'checking');
    this.setFieldStatus('profile-icon-status', 'checking');
    this.setFieldStatus('profile-shell-status', 'checking');
    this.setFieldStatus('profile-cwd-status', 'checking');
    this.setSaveEnabled(false);

    if (this.validationTimeout !== null) {
      clearTimeout(this.validationTimeout);
    }
    this.validationTimeout = window.setTimeout(() => {
      this.validationTimeout = null;
      void this.runValidation();
    }, 250);
  }

  private async runValidation(): Promise<void> {
    const name = (document.getElementById('profile-name') as HTMLInputElement).value;
    const icon = (document.getElementById('profile-icon') as HTMLInputElement).value;
    const shell = (document.getElementById('profile-shell') as HTMLInputElement).value;
    const cwd = (document.getElementById('profile-cwd') as HTMLInputElement).value;

    const result = await window.shellAPI.validateProfileConfig({ name, icon, shell, cwd });
    this.lastValidation = result;
    this.renderValidationStatus(result);
    this.setSaveEnabled(this.isValid(result));
  }

  private renderValidationStatus(result: ValidationResult): void {
    this.setFieldStatus('profile-name-status', result.name === 'ok' ? 'ok' : 'error');
    this.setFieldStatus('profile-icon-status', result.icon === 'ok' ? 'ok' : (result.icon === null ? null : 'error'));
    this.setFieldStatus('profile-shell-status', result.shell === 'ok' ? 'ok' : 'error');
    this.setFieldStatus('profile-cwd-status', result.cwd === 'ok' ? 'ok' : (result.cwd === null ? 'error' : 'error'));
  }

  private setFieldStatus(elementId: string, status: 'ok' | 'error' | 'checking' | null): void {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.className = 'field-status';
    if (status) el.classList.add(status);
    el.title = this.statusTitle(elementId, status);
  }

  private statusTitle(elementId: string, status: 'ok' | 'error' | 'checking' | null): string {
    const labels: Record<string, string> = {
      'profile-name-status': '名称',
      'profile-icon-status': '图标',
      'profile-shell-status': 'Shell 程序',
      'profile-cwd-status': '启动目录',
    };
    const label = labels[elementId] ?? '';
    if (status === 'ok') return `${label}：校验通过`;
    if (status === 'error') return `${label}：${label === '名称' ? '不能为空' : '文件不存在或路径错误'}`;
    if (status === 'checking') return `${label}：校验中…`;
    return '';
  }

  private isValid(result: ValidationResult): boolean {
    if (result.name !== 'ok') return false;
    // icon is optional; if provided it must exist
    if (result.icon !== null && result.icon !== 'ok') return false;
    // shell is required
    if (result.shell !== 'ok') return false;
    // cwd is required
    if (result.cwd !== 'ok') return false;
    return true;
  }

  private setSaveEnabled(enabled: boolean): void {
    const btn = document.getElementById('dialog-save') as HTMLButtonElement | null;
    if (btn) btn.disabled = !enabled;
  }

  private renderAutoScripts(scripts: Array<{ command: string; waitFor: string | null }>): void {
    const container = document.getElementById('auto-scripts-container')!;
    container.innerHTML = '';

    if (scripts.length === 0) {
      container.innerHTML = '<div class="auto-script-empty">暂无自动脚本</div>';
      return;
    }

    scripts.forEach((script, index) => {
      const item = document.createElement('div');
      item.className = 'auto-script-item';
      item.innerHTML = `
        <input type="text" class="form-input script-command" placeholder="命令" value="${this.escapeHtml(script.command)}">
        <input type="text" class="form-input script-wait-for" placeholder="等待输出(可选)" value="${this.escapeHtml(script.waitFor || '')}">
        <button class="auto-script-remove">删除</button>
      `;

      const removeBtn = item.querySelector('.auto-script-remove')!;
      removeBtn.addEventListener('click', () => {
        item.remove();
        if (container.children.length === 0) {
          container.innerHTML = '<div class="auto-script-empty">暂无自动脚本</div>';
        }
      });

      container.appendChild(item);
    });
  }

  private addAutoScript(): void {
    const container = document.getElementById('auto-scripts-container')!;
    const emptyMsg = container.querySelector('.auto-script-empty');
    if (emptyMsg) {
      emptyMsg.remove();
    }

    const item = document.createElement('div');
    item.className = 'auto-script-item';
    item.innerHTML = `
      <input type="text" class="form-input script-command" placeholder="命令" value="">
      <input type="text" class="form-input script-wait-for" placeholder="等待输出(可选)" value="">
      <button class="auto-script-remove">删除</button>
    `;

    const removeBtn = item.querySelector('.auto-script-remove')!;
    removeBtn.addEventListener('click', () => {
      item.remove();
      if (container.children.length === 0) {
        container.innerHTML = '<div class="auto-script-empty">暂无自动脚本</div>';
      }
    });

    container.appendChild(item);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private getAutoScriptsFromUI(): Array<{ command: string; waitFor: string | null }> {
    const container = document.getElementById('auto-scripts-container')!;
    const items = container.querySelectorAll('.auto-script-item');
    const scripts: Array<{ command: string; waitFor: string | null }> = [];

    items.forEach(item => {
      const commandInput = item.querySelector('.script-command') as HTMLInputElement;
      const waitForInput = item.querySelector('.script-wait-for') as HTMLInputElement;
      if (commandInput && commandInput.value.trim()) {
        scripts.push({
          command: commandInput.value.trim(),
          waitFor: waitForInput.value.trim() || null,
        });
      }
    });

    return scripts;
  }

  private async saveProfileDialog(): Promise<void> {
    const name = (document.getElementById('profile-name') as HTMLInputElement).value.trim();
    const icon = (document.getElementById('profile-icon') as HTMLInputElement).value.trim() || null;
    const shell = (document.getElementById('profile-shell') as HTMLInputElement).value.trim();
    const cwd = (document.getElementById('profile-cwd') as HTMLInputElement).value.trim();

    if (!this.isValid(this.lastValidation)) {
      // Re-run validation in case the user clicked save before debounce fired
      await this.runValidation();
      if (!this.isValid(this.lastValidation)) return;
    }

    const autoScripts = this.getAutoScriptsFromUI();

    if (this.dialogMode === 'add' || this.dialogMode === 'copy') {
      const newProfile: ProfileNode = {
        id: `profile-${Date.now()}`,
        name,
        type: 'profile',
        icon,
        config: {
          shell,
          args: [],
          cwd,
          autoScripts,
        },
      };
      await window.shellAPI.createProfile(newProfile);
    } else if (this.editingProfile) {
      const updatedProfile: ProfileNode = {
        ...this.editingProfile,
        name,
        icon,
        config: {
          ...this.editingProfile.config!,
          shell,
          cwd,
          autoScripts,
        },
      };
      await window.shellAPI.updateProfile(updatedProfile);
    }

    this.hideDialog();
    await this.reloadProfiles();
  }

  private async handleProfileDelete(node: ProfileNode): Promise<void> {
    const confirmed = await this.showConfirmDialog('确认', `确定要删除 Profile "${node.name}" 吗？`);
    if (confirmed) {
      await window.shellAPI.deleteProfile(node.id);
      await this.reloadProfiles();
    }
  }

  private async reloadProfiles(): Promise<void> {
    const profiles = await window.shellAPI.loadProfiles();
    this.profileTree.setProfiles(profiles);
  }

  private async createShell(node: ProfileNode): Promise<void> {
    const tabId = await window.shellAPI.createShell(node.id, node.config);
    const tabName = `${node.name} ${++this.tabCounter}`;

    // Deactivate all existing terminals
    this.terminals.forEach((t) => {
      t.setActive(false);
    });

    this.tabBar.addTab({
      id: tabId,
      name: tabName,
      shellIcon: node.icon || this.getShellIcon(node.config?.shell),
      isActive: true,
      isOutputting: false,
      isDisconnected: false,
    });

    // Set new tab as active (this also clears previous active tab)
    this.tabBar.setActiveTab(tabId);

    const terminalView = new TerminalView('terminal-container', tabId);
    terminalView.onData((data) => {
      window.shellAPI.writeToShell(tabId, data);
    });
    terminalView.setActive(true);

    this.terminals.set(tabId, terminalView);

    // Auto-focus the new shell so the user can start typing right
    // after the double-click. requestAnimationFrame defers the focus
    // call until the dblclick event has fully finished and the new
    // terminal is in the DOM focus order, mirroring the pattern used
    // after the paste dialog closes.
    requestAnimationFrame(() => terminalView.focus());

    // Resize after a short delay to ensure container is rendered
    setTimeout(() => {
      terminalView.fit();
      const dims = terminalView.getDimensions();
      window.shellAPI.resizeShell(tabId, dims.cols, dims.rows);
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
