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
type ContextMenuListener = (node: ProfileNode, action: 'edit' | 'delete' | 'copy') => void;

export class ProfileTree {
  private container: HTMLElement;
  private profiles: ProfileNode[] = [];
  private listeners: TreeListener[] = [];
  private contextMenuListeners: ContextMenuListener[] = [];
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

  onContextMenu(listener: ContextMenuListener): void {
    this.contextMenuListeners.push(listener);
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

        profileContent.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.showContextMenu(e.clientX, e.clientY, node);
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

  private contextMenu: HTMLElement | null = null;

  private showContextMenu(x: number, y: number, node: ProfileNode): void {
    this.hideContextMenu();

    this.contextMenu = document.createElement('div');
    this.contextMenu.className = 'context-menu';

    const editItem = document.createElement('div');
    editItem.className = 'context-menu-item';
    editItem.textContent = '编辑';
    editItem.addEventListener('click', () => {
      this.contextMenuListeners.forEach(l => l(node, 'edit'));
      this.hideContextMenu();
    });

    const copyItem = document.createElement('div');
    copyItem.className = 'context-menu-item';
    copyItem.textContent = '复制';
    copyItem.addEventListener('click', () => {
      this.contextMenuListeners.forEach(l => l(node, 'copy'));
      this.hideContextMenu();
    });

    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item danger';
    deleteItem.textContent = '删除';
    deleteItem.addEventListener('click', () => {
      this.contextMenuListeners.forEach(l => l(node, 'delete'));
      this.hideContextMenu();
    });

    this.contextMenu.appendChild(editItem);
    this.contextMenu.appendChild(copyItem);
    this.contextMenu.appendChild(deleteItem);
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    document.body.appendChild(this.contextMenu);

    // Close on click outside
    const closeHandler = () => {
      this.hideContextMenu();
      document.removeEventListener('click', closeHandler);
    };
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
    }, 0);
  }

  private hideContextMenu(): void {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
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
