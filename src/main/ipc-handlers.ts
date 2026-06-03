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
            shell: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
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
            shell: 'C:\\Windows\\System32\\cmd.exe',
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
            shell: 'C:\\Program Files\\Git\\git-bash.exe',
            args: [],
            cwd: process.env.USERPROFILE || 'C:\\Users\\' + process.env.USERNAME,
            autoScripts: [],
          },
        },
      ],
    },
  ];
}

function findProfileById(profiles: ProfileConfig[], id: string): ProfileConfig | null {
  for (const profile of profiles) {
    if (profile.id === id) {
      return profile;
    }
    if (profile.children) {
      const found = findProfileById(profile.children, id);
      if (found) return found;
    }
  }
  return null;
}

function updateProfile(profiles: ProfileConfig[], updatedProfile: ProfileConfig): boolean {
  for (let i = 0; i < profiles.length; i++) {
    if (profiles[i].id === updatedProfile.id) {
      profiles[i] = updatedProfile;
      return true;
    }
    if (profiles[i].children) {
      if (updateProfile(profiles[i].children!, updatedProfile)) {
        return true;
      }
    }
  }
  return false;
}

function deleteProfile(profiles: ProfileConfig[], id: string): boolean {
  for (let i = 0; i < profiles.length; i++) {
    if (profiles[i].id === id) {
      profiles.splice(i, 1);
      return true;
    }
    if (profiles[i].children) {
      if (deleteProfile(profiles[i].children!, id)) {
        return true;
      }
    }
  }
  return false;
}

function addProfile(profiles: ProfileConfig[], newProfile: ProfileConfig, parentId?: string): boolean {
  if (!parentId) {
    // Add to root level
    profiles.push(newProfile);
    return true;
  }
  const parent = findProfileById(profiles, parentId);
  if (parent && parent.type === 'folder') {
    if (!parent.children) parent.children = [];
    parent.children.push(newProfile);
    return true;
  }
  return false;
}

export function setupIpcHandlers(): void {
  ipcMain.handle('profile:load', () => {
    return loadProfiles();
  });

  ipcMain.handle('profile:save', (_event, profiles: ProfileConfig[]) => {
    saveProfiles(profiles);
  });

  ipcMain.handle('profile:create', (_event, newProfile: ProfileConfig, parentId?: string) => {
    const profiles = loadProfiles();
    if (addProfile(profiles, newProfile, parentId)) {
      saveProfiles(profiles);
      return true;
    }
    return false;
  });

  ipcMain.handle('profile:update', (_event, updatedProfile: ProfileConfig) => {
    const profiles = loadProfiles();
    if (updateProfile(profiles, updatedProfile)) {
      saveProfiles(profiles);
      return true;
    }
    return false;
  });

  ipcMain.handle('profile:delete', (_event, id: string) => {
    const profiles = loadProfiles();
    if (deleteProfile(profiles, id)) {
      saveProfiles(profiles);
      return true;
    }
    return false;
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
