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
type FolderContextMenuListener = (node: ProfileNode, action: 'add-profile' | 'add-folder' | 'delete') => void;
type MoveListener = (movedId: string, targetId: string | null, position: 'before' | 'after' | 'inside') => void;
type FolderToggleListener = (folderId: string, expanded: boolean) => void;

export class ProfileTree {
  private container: HTMLElement;
  private profiles: ProfileNode[] = [];
  private listeners: TreeListener[] = [];
  private contextMenuListeners: ContextMenuListener[] = [];
  private folderContextMenuListeners: FolderContextMenuListener[] = [];
  private moveListeners: MoveListener[] = [];
  private folderToggleListeners: FolderToggleListener[] = [];
  private expandedFolders: Set<string> = new Set();
  private dragSourceId: string | null = null;
  private currentDragTargetId: string | null = null; // Track current drag target to prevent parent highlighting

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;
  }

  setProfiles(profiles: ProfileNode[]): void {
    // Clear drag state when profiles change (e.g., after drop)
    this.dragSourceId = null;
    this.clearDropIndicators();
    this.profiles = profiles;
    this.render();
  }

  setExpandedFolders(expandedIds: string[], shouldRender = false): void {
    this.expandedFolders = new Set(expandedIds);
    if (shouldRender) {
      this.render();
    }
  }

  getExpandedFolders(): string[] {
    return Array.from(this.expandedFolders);
  }

  onProfileDoubleClick(listener: TreeListener): void {
    this.listeners.push(listener);
  }

  onContextMenu(listener: ContextMenuListener): void {
    this.contextMenuListeners.push(listener);
  }

  onFolderContextMenu(listener: FolderContextMenuListener): void {
    this.folderContextMenuListeners.push(listener);
  }

  onMove(listener: MoveListener): void {
    this.moveListeners.push(listener);
  }

  onFolderToggle(listener: FolderToggleListener): void {
    this.folderToggleListeners.push(listener);
  }

  private render(): void {
    this.container.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'profile-tree';
    this.addContainerDropListeners(ul);
    this.renderNodes(this.profiles, ul);
    this.container.appendChild(ul);
  }

  private addContainerDropListeners(ul: HTMLElement): void {
    ul.addEventListener('dragover', (e) => {
      if (!this.dragSourceId) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';
    });

    ul.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!this.dragSourceId) return;
      this.moveListeners.forEach(l => l(this.dragSourceId!, null, 'after'));
    });
  }

  private renderNodes(nodes: ProfileNode[], parent: HTMLElement): void {
    for (const node of nodes) {
      const li = document.createElement('li');
      li.dataset.nodeId = node.id;

      if (node.type === 'folder') {
        li.className = 'folder';
        li.draggable = true;
        this.addDragListeners(li, node.id);

        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-header';
        const icon = document.createElement('span');
        icon.className = 'folder-icon';
        icon.innerHTML = this.expandedFolders.has(node.id)
          ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M2 10h20"/></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
        const name = document.createElement('span');
        name.className = 'folder-name';
        name.textContent = node.name;
        folderHeader.appendChild(icon);
        folderHeader.appendChild(name);

        folderHeader.addEventListener('click', () => {
          this.toggleFolder(node.id, icon);
        });

        folderHeader.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.showFolderContextMenu(e.clientX, e.clientY, node);
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
        li.draggable = true;
        this.addDragListeners(li, node.id);

        const profileContent = document.createElement('div');
        profileContent.className = 'profile-content';

        const iconSpan = document.createElement('span');
        iconSpan.className = 'profile-icon';

        if (node.icon) {
          const iconImg = document.createElement('img');
          iconImg.src = node.icon;
          iconImg.alt = 'icon';
          iconImg.style.width = '16px';
          iconImg.style.height = '16px';
          iconSpan.appendChild(iconImg);
        } else {
          iconSpan.textContent = this.getShellIcon(node.config?.shell);
        }

        const name = document.createElement('span');
        name.className = 'profile-name';
        name.textContent = node.name;

        profileContent.appendChild(iconSpan);
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
    const isExpanding = !this.expandedFolders.has(id);
    if (this.expandedFolders.has(id)) {
      this.expandedFolders.delete(id);
      icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
    } else {
      this.expandedFolders.add(id);
      icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M2 10h20"/></svg>';
    }
    this.folderToggleListeners.forEach(l => l(id, isExpanding));
    this.render();
  }

  private addDragListeners(li: HTMLElement, nodeId: string): void {
    li.addEventListener('dragstart', (e) => {
      e.stopImmediatePropagation();
      this.dragSourceId = nodeId;
      this.currentDragTargetId = null;
      li.classList.add('dragging');
      e.dataTransfer!.effectAllowed = 'move';
      e.dataTransfer!.setData('text/plain', nodeId);
    });

    li.addEventListener('dragend', () => {
      this.dragSourceId = null;
      this.currentDragTargetId = null;
      li.classList.remove('dragging');
      this.clearDropIndicators();
    });

    li.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (!this.dragSourceId || this.dragSourceId === nodeId) return;
      // Set this as the current target if it's deeper than existing target
      // We use dragenter to track the deepest element
      if (!this.currentDragTargetId || this.isDescendant(this.currentDragTargetId, nodeId)) {
        this.currentDragTargetId = nodeId;
      }
    });

    li.addEventListener('dragleave', (e) => {
      // Only process if leaving to outside our subtree
      if (e.relatedTarget && li.contains(e.relatedTarget as Node)) return;
      if (this.currentDragTargetId === nodeId) {
        this.currentDragTargetId = null;
      }
    });

    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!this.dragSourceId || this.dragSourceId === nodeId) return;
      // Only show indicator for the deepest (current) target
      if (this.currentDragTargetId !== nodeId) return;
      e.dataTransfer!.dropEffect = 'move';

      this.clearDropIndicators();

      const rect = li.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;

      if (li.classList.contains('folder')) {
        // For folders: top/bottom 25% = before/after, middle = inside
        if (y < height * 0.25) {
          li.classList.add('drop-above');
        } else if (y > height * 0.75) {
          li.classList.add('drop-below');
        } else {
          li.classList.add('drop-inside');
        }
      } else {
        // For profiles: top half = before, bottom half = after
        if (y < height * 0.5) {
          li.classList.add('drop-above');
        } else {
          li.classList.add('drop-below');
        }
      }
    });

    li.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.dragSourceId || this.dragSourceId === nodeId) return;
      // Only handle drop on the deepest target
      if (this.currentDragTargetId !== nodeId) return;

      const rect = li.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;

      let position: 'before' | 'after' | 'inside';
      if (li.classList.contains('folder')) {
        if (y < height * 0.25) {
          position = 'before';
        } else if (y > height * 0.75) {
          position = 'after';
        } else {
          position = 'inside';
        }
      } else {
        position = y < height * 0.5 ? 'before' : 'after';
      }

      this.clearDropIndicators();
      this.currentDragTargetId = null;
      this.moveListeners.forEach(l => l(this.dragSourceId!, nodeId, position));
    });
  }

  // Check if potentialDescendant is inside ancestorId in the DOM tree
  private isDescendant(ancestorId: string, potentialDescendantId: string): boolean {
    const ancestor = this.container.querySelector(`[data-node-id="${ancestorId}"]`);
    if (!ancestor) return false;
    const descendant = ancestor.querySelector(`[data-node-id="${potentialDescendantId}"]`);
    return descendant !== null;
  }

  private clearDropIndicators(): void {
    this.container.querySelectorAll('.drop-above, .drop-below, .drop-inside').forEach(el => {
      el.classList.remove('drop-above', 'drop-below', 'drop-inside');
    });
  }

  private contextMenu: HTMLElement | null = null;
  private folderContextMenu: HTMLElement | null = null;

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
    if (this.folderContextMenu) {
      this.folderContextMenu.remove();
      this.folderContextMenu = null;
    }
  }

  private showFolderContextMenu(x: number, y: number, node: ProfileNode): void {
    this.hideContextMenu();

    this.folderContextMenu = document.createElement('div');
    this.folderContextMenu.className = 'context-menu';

    const addProfileItem = document.createElement('div');
    addProfileItem.className = 'context-menu-item';
    addProfileItem.textContent = '新增 Profile';
    addProfileItem.addEventListener('click', () => {
      this.folderContextMenuListeners.forEach(l => l(node, 'add-profile'));
      this.hideContextMenu();
    });

    const addFolderItem = document.createElement('div');
    addFolderItem.className = 'context-menu-item';
    addFolderItem.textContent = '新增子文件夹';
    addFolderItem.addEventListener('click', () => {
      this.folderContextMenuListeners.forEach(l => l(node, 'add-folder'));
      this.hideContextMenu();
    });

    const separator = document.createElement('div');
    separator.className = 'context-menu-separator';

    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item danger';
    deleteItem.textContent = '删除文件夹';
    deleteItem.addEventListener('click', () => {
      this.folderContextMenuListeners.forEach(l => l(node, 'delete'));
      this.hideContextMenu();
    });

    this.folderContextMenu.appendChild(addProfileItem);
    this.folderContextMenu.appendChild(addFolderItem);
    this.folderContextMenu.appendChild(separator);
    this.folderContextMenu.appendChild(deleteItem);
    this.folderContextMenu.style.left = `${x}px`;
    this.folderContextMenu.style.top = `${y}px`;
    document.body.appendChild(this.folderContextMenu);

    const closeHandler = () => {
      this.hideContextMenu();
      document.removeEventListener('click', closeHandler);
    };
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
    }, 0);
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
