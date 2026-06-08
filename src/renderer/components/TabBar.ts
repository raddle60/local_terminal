interface Tab {
  id: string;
  name: string;
  shellIcon: string;
  isActive: boolean;
  isOutputting: boolean;
  isDisconnected: boolean;
}

type TabListener = (tabId: string) => void;

export class TabBar {
  private container: HTMLElement;
  private tabs: Tab[] = [];
  private activeTabId: string | null = null;
  private onTabClickListeners: TabListener[] = [];
  private onTabCloseListeners: TabListener[] = [];
  private onTabActivateListeners: TabListener[] = [];

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;
  }

  addTab(tab: Tab): void {
    this.tabs.push(tab);
    this.render();
  }

  removeTab(tabId: string): void {
    const closingActive = this.activeTabId === tabId;
    this.tabs = this.tabs.filter(t => t.id !== tabId);
    if (closingActive) {
      this.activeTabId = this.tabs.length > 0 ? this.tabs[0].id : null;
      this.tabs.forEach(t => t.isActive = t.id === this.activeTabId);
      this.onTabActivateListeners.forEach(l => l(this.activeTabId!));
    }
    this.render();
  }

  setActiveTab(tabId: string): void {
    this.activeTabId = tabId;
    this.tabs.forEach(t => t.isActive = t.id === tabId);
    this.render();
  }

  setTabOutputting(tabId: string, isOutputting: boolean): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.isOutputting = isOutputting;
      this.render();
    }
  }

  setTabDisconnected(tabId: string, disconnected: boolean): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.isDisconnected = disconnected;
      this.render();
    }
  }

  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  onClick(listener: TabListener): void {
    this.onTabClickListeners.push(listener);
  }

  onClose(listener: TabListener): void {
    this.onTabCloseListeners.push(listener);
  }

  onActivate(listener: TabListener): void {
    this.onTabActivateListeners.push(listener);
  }

  private render(): void {
    this.container.innerHTML = '';
    for (const tab of this.tabs) {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab';
      if (tab.isActive) tabEl.classList.add('active');
      if (tab.isOutputting) tabEl.classList.add('outputting');
      if (tab.isDisconnected) tabEl.classList.add('disconnected');

      const icon = document.createElement('span');
      icon.className = 'tab-icon';

      // Check if shellIcon is an image path (URL, data URI, or local file path)
      const isImagePath = tab.shellIcon && (
        tab.shellIcon.startsWith('http') ||
        tab.shellIcon.startsWith('data:') ||
        tab.shellIcon.startsWith('file:') ||
        /^[a-zA-Z]:[/\\]/.test(tab.shellIcon) // Windows path like C:\ or D:\
      );

      if (isImagePath) {
        const iconImg = document.createElement('img');
        iconImg.src = tab.shellIcon;
        iconImg.alt = 'icon';
        iconImg.style.width = '16px';
        iconImg.style.height = '16px';
        icon.appendChild(iconImg);
      } else {
        icon.textContent = tab.shellIcon;
      }

      const name = document.createElement('span');
      name.className = 'tab-name';
      name.textContent = tab.name;

      const closeBtn = document.createElement('span');
      closeBtn.className = 'tab-close';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onTabCloseListeners.forEach(l => l(tab.id));
      });

      tabEl.appendChild(icon);
      tabEl.appendChild(name);
      tabEl.appendChild(closeBtn);

      tabEl.addEventListener('click', () => {
        this.onTabClickListeners.forEach(l => l(tab.id));
      });

      this.container.appendChild(tabEl);
    }
  }
}
