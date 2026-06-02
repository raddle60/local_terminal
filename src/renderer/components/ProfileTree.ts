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

type TreeListener = (node: ProfileNode) => void;

export class ProfileTree {
  private container: HTMLElement;
  private profiles: ProfileNode[] = [];
  private listeners: TreeListener[] = [];
  private expandedFolders: Set<string> = new Set();

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;
  }

  setProfiles(profiles: ProfileNode[]): void {
    this.profiles = profiles;
    this.render();
  }

  onProfileDoubleClick(listener: TreeListener): void {
    this.listeners.push(listener);
  }

  private render(): void {
    this.container.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'profile-tree';
    this.renderNodes(this.profiles, ul);
    this.container.appendChild(ul);
  }

  private renderNodes(nodes: ProfileNode[], parent: HTMLElement): void {
    for (const node of nodes) {
      const li = document.createElement('li');
      li.dataset.nodeId = node.id;

      if (node.type === 'folder') {
        li.className = 'folder';
        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-header';
        const icon = document.createElement('span');
        icon.className = 'folder-icon';
        icon.textContent = this.expandedFolders.has(node.id) ? '📂' : '📁';
        const name = document.createElement('span');
        name.className = 'folder-name';
        name.textContent = node.name;
        folderHeader.appendChild(icon);
        folderHeader.appendChild(name);

        folderHeader.addEventListener('click', () => {
          this.toggleFolder(node.id, icon);
        });

        li.appendChild(folderHeader);

        if (this.expandedFolders.has(node.id) && node.children) {
          const childUl = document.createElement('ul');
          childUl.className = 'folder-children';
          this.renderNodes(node.children, childUl);
          li.appendChild(childUl);
        }
      } else {
        li.className = 'profile';
        const profileContent = document.createElement('div');
        profileContent.className = 'profile-content';

        const icon = document.createElement('span');
        icon.className = 'profile-icon';
        icon.textContent = this.getShellIcon(node.config?.shell);

        const name = document.createElement('span');
        name.className = 'profile-name';
        name.textContent = node.name;

        profileContent.appendChild(icon);
        profileContent.appendChild(name);

        profileContent.addEventListener('dblclick', () => {
          this.listeners.forEach(l => l(node));
        });

        li.appendChild(profileContent);
      }

      parent.appendChild(li);
    }
  }

  private toggleFolder(id: string, icon: HTMLElement): void {
    if (this.expandedFolders.has(id)) {
      this.expandedFolders.delete(id);
      icon.textContent = '📁';
    } else {
      this.expandedFolders.add(id);
      icon.textContent = '📂';
    }
    this.render();
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
