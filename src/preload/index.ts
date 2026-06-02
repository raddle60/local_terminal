import { contextBridge, ipcRenderer } from 'electron';

export interface ProfileConfig {
  id: string;
  name: string;
  type: 'folder' | 'profile';
  icon?: string | null;
  children?: ProfileConfig[];
  config?: {
    shell: string;
    args: string[];
    cwd: string;
    autoScripts: Array<{ command: string; waitFor: string | null }>;
  };
}

export interface ShellAPI {
  createShell: (profileId: string, config: ProfileConfig['config']) => Promise<string>;
  writeToShell: (shellId: string, data: string) => void;
  resizeShell: (shellId: string, cols: number, rows: number) => void;
  closeShell: (shellId: string) => void;
  onShellData: (callback: (shellId: string, data: string) => void) => void;
  onShellExit: (callback: (shellId: string, exitCode: number) => void) => void;
  onShellOutputStart: (callback: (shellId: string) => void) => void;
  onShellOutputEnd: (callback: (shellId: string) => void) => void;
  loadProfiles: () => Promise<ProfileConfig[]>;
  saveProfiles: (profiles: ProfileConfig[]) => Promise<void>;
}

const shellAPI: ShellAPI = {
  createShell: (profileId, config) => ipcRenderer.invoke('shell:create', profileId, config),
  writeToShell: (shellId, data) => ipcRenderer.send('shell:write', shellId, data),
  resizeShell: (shellId, cols, rows) => ipcRenderer.send('shell:resize', shellId, cols, rows),
  closeShell: (shellId) => ipcRenderer.send('shell:close', shellId),
  onShellData: (callback) => {
    ipcRenderer.on('shell:data', (_event, shellId, data) => callback(shellId, data));
  },
  onShellExit: (callback) => {
    ipcRenderer.on('shell:exit', (_event, shellId, exitCode) => callback(shellId, exitCode));
  },
  onShellOutputStart: (callback) => {
    ipcRenderer.on('shell:output-start', (_event, shellId) => callback(shellId));
  },
  onShellOutputEnd: (callback) => {
    ipcRenderer.on('shell:output-end', (_event, shellId) => callback(shellId));
  },
  loadProfiles: () => ipcRenderer.invoke('profile:load'),
  saveProfiles: (profiles) => ipcRenderer.invoke('profile:save', profiles),
};

contextBridge.exposeInMainWorld('shellAPI', shellAPI);
