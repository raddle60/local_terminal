import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ptyManager } from './pty-manager';

const profilesPath = path.join(__dirname, '../../profiles.json');

interface ProfileConfig {
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

function loadProfiles(): ProfileConfig[] {
  try {
    if (fs.existsSync(profilesPath)) {
      const data = fs.readFileSync(profilesPath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.profileTree || [];
    }
  } catch (e) {
    console.error('Failed to load profiles:', e);
  }
  return getDefaultProfiles();
}

function saveProfiles(profiles: ProfileConfig[]): void {
  try {
    fs.writeFileSync(profilesPath, JSON.stringify({ profileTree: profiles }, null, 2));
  } catch (e) {
    console.error('Failed to save profiles:', e);
  }
}

function getDefaultProfiles(): ProfileConfig[] {
  return [
    {
      id: 'folder-dev',
      name: '开发环境',
      type: 'folder',
      children: [
        {
          id: 'profile-powershell',
          name: 'PowerShell',
          type: 'profile',
          icon: null,
          config: {
            shell: 'powershell.exe',
            args: [],
            cwd: process.env.USERPROFILE || 'C:\\Users\\' + process.env.USERNAME,
            autoScripts: [],
          },
        },
        {
          id: 'profile-cmd',
          name: 'CMD',
          type: 'profile',
          icon: null,
          config: {
            shell: 'cmd.exe',
            args: [],
            cwd: process.env.USERPROFILE || 'C:\\Users\\' + process.env.USERNAME,
            autoScripts: [],
          },
        },
        {
          id: 'profile-git-bash',
          name: 'Git Bash',
          type: 'profile',
          icon: null,
          config: {
            shell: 'C:\\Program Files\\Git\\bin\\bash.exe',
            args: [],
            cwd: process.env.USERPROFILE || 'C:\\Users\\' + process.env.USERNAME,
            autoScripts: [],
          },
        },
      ],
    },
  ];
}

export function setupIpcHandlers(): void {
  ipcMain.handle('profile:load', () => {
    return loadProfiles();
  });

  ipcMain.handle('profile:save', (_event, profiles: ProfileConfig[]) => {
    saveProfiles(profiles);
  });

  ipcMain.handle('shell:create', (_event, profileId: string, config: ProfileConfig['config']) => {
    return ptyManager.createShell(profileId, config!);
  });

  ipcMain.on('shell:write', (_event, shellId: string, data: string) => {
    ptyManager.write(shellId, data);
  });

  ipcMain.on('shell:resize', (_event, shellId: string, cols: number, rows: number) => {
    ptyManager.resize(shellId, cols, rows);
  });

  ipcMain.on('shell:close', (_event, shellId: string) => {
    ptyManager.close(shellId);
  });
}
