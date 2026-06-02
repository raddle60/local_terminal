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

    // Add profile button handler
    const addProfileBtn = document.getElementById('add-profile-btn');
    if (addProfileBtn) {
      addProfileBtn.addEventListener('click', () => {
        this.addNewProfile();
      });
    }
  }

  private addNewProfile(): void {
    const newProfile = {
      id: `profile-${Date.now()}`,
      name: 'New Profile',
      type: 'profile' as const,
      icon: null,
      config: {
        shell: 'powershell.exe',
        args: [],
        cwd: process.env.USERPROFILE || 'C:\\Users\\' + (process.env.USERNAME || 'User'),
        autoScripts: [],
      },
    };

    // Add to first folder found, or create a folder
    const profiles = window.shellAPI.loadProfiles ? [] : [];
    // For now, just reload profiles - the new profile won't persist until saved
    console.log('Add new profile:', newProfile);
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
