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
      createProfile: (profile: ProfileNode, parentId?: string) => Promise<boolean>;
      updateProfile: (profile: ProfileNode) => Promise<boolean>;
      deleteProfile: (id: string) => Promise<boolean>;
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

    this.profileTree.onContextMenu((node, action) => {
      if (action === 'edit') {
        this.showEditProfileDialog(node);
      } else if (action === 'delete') {
        this.handleProfileDelete(node);
      }
    });

    this.tabBar.onClick((tabId) => {
      // Clear selection on all terminals and hide them
      this.terminals.forEach((t, id) => {
        t.clearSelection();
        t.getElement().style.display = id === tabId ? 'block' : 'none';
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

    // Add profile button handler
    const addProfileBtn = document.getElementById('add-profile-btn');
    if (addProfileBtn) {
      addProfileBtn.addEventListener('click', () => {
        this.showAddProfileDialog();
      });
    }

    // Dialog event handlers
    const dialog = document.getElementById('profile-dialog')!;
    const dialogClose = document.getElementById('dialog-close')!;
    const dialogCancel = document.getElementById('dialog-cancel')!;
    const dialogSave = document.getElementById('dialog-save')!;

    dialogClose.addEventListener('click', () => this.hideDialog());
    dialogCancel.addEventListener('click', () => this.hideDialog());
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) this.hideDialog();
    });

    dialogSave.addEventListener('click', () => this.saveProfileDialog());
  }

  private dialogMode: 'add' | 'edit' = 'add';
  private editingProfile: ProfileNode | null = null;

  private showAddProfileDialog(): void {
    this.dialogMode = 'add';
    this.editingProfile = null;
    document.getElementById('dialog-title')!.textContent = '新增 Profile';
    (document.getElementById('profile-name') as HTMLInputElement).value = '';
    (document.getElementById('profile-shell') as HTMLInputElement).value = 'powershell.exe';
    (document.getElementById('profile-cwd') as HTMLInputElement).value = process.env.USERPROFILE || 'C:\\';
    document.getElementById('profile-dialog')!.classList.remove('hidden');
  }

  private showEditProfileDialog(node: ProfileNode): void {
    this.dialogMode = 'edit';
    this.editingProfile = node;
    document.getElementById('dialog-title')!.textContent = '编辑 Profile';
    (document.getElementById('profile-name') as HTMLInputElement).value = node.name;
    (document.getElementById('profile-shell') as HTMLInputElement).value = node.config?.shell || '';
    (document.getElementById('profile-cwd') as HTMLInputElement).value = node.config?.cwd || '';
    document.getElementById('profile-dialog')!.classList.remove('hidden');
  }

  private hideDialog(): void {
    document.getElementById('profile-dialog')!.classList.add('hidden');
    this.editingProfile = null;
  }

  private async saveProfileDialog(): Promise<void> {
    const name = (document.getElementById('profile-name') as HTMLInputElement).value.trim();
    const shell = (document.getElementById('profile-shell') as HTMLInputElement).value.trim();
    const cwd = (document.getElementById('profile-cwd') as HTMLInputElement).value.trim();

    if (!name || !shell || !cwd) {
      return;
    }

    if (this.dialogMode === 'add') {
      const newProfile: ProfileNode = {
        id: `profile-${Date.now()}`,
        name,
        type: 'profile',
        icon: null,
        config: {
          shell,
          args: [],
          cwd,
          autoScripts: [],
        },
      };
      await window.shellAPI.createProfile(newProfile);
    } else if (this.editingProfile) {
      const updatedProfile: ProfileNode = {
        ...this.editingProfile,
        name,
        config: {
          ...this.editingProfile.config!,
          shell,
          cwd,
        },
      };
      await window.shellAPI.updateProfile(updatedProfile);
    }

    this.hideDialog();
    await this.reloadProfiles();
  }

  private async handleProfileDelete(node: ProfileNode): Promise<void> {
    if (confirm(`确定要删除 Profile "${node.name}" 吗？`)) {
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

    // Hide all existing terminals
    this.terminals.forEach((t) => {
      t.getElement().style.display = 'none';
    });

    this.tabBar.addTab({
      id: tabId,
      name: tabName,
      shellIcon: this.getShellIcon(node.config?.shell),
      isActive: true,
      isOutputting: false,
      isDisconnected: false,
    });

    const terminalView = new TerminalView('terminal-container', tabId);
    terminalView.getElement().style.display = 'block';
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
