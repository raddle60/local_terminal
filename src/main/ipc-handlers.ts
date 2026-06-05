import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ptyManager } from './pty-manager';

const profilesPath = path.join(os.homedir(), '.local_terminal_profiles.json');

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
  const homeDir = os.homedir();
  return [

  ];
}

// --- Validation helpers (used by validate:profileConfig IPC) ---

type FieldStatus = 'ok' | 'missing' | 'not-executable' | 'not-found';

interface ValidationResult {
  name: 'ok' | 'missing';
  icon: FieldStatus | null;   // null = not provided
  shell: FieldStatus;
  cwd: FieldStatus | null;    // null = not provided (will be treated as error by UI)
}

function checkFile(p: string): FieldStatus {
  try {
    const stat = fs.statSync(p);
    return stat.isFile() ? 'ok' : 'missing';
  } catch {
    return 'missing';
  }
}

function checkDir(p: string): FieldStatus {
  try {
    const stat = fs.statSync(p);
    return stat.isDirectory() ? 'ok' : 'missing';
  } catch {
    return 'missing';
  }
}

/**
 * Check whether `command` is invocable on the current platform.
 * - If it looks like an absolute path (has separator or drive letter),
 *   verify the file exists and is executable.
 * - Otherwise, look it up in PATH, with PATHEXT-aware fallback on Windows.
 */
function checkShell(command: string): FieldStatus {
  if (!command) return 'missing';

  const stripped = command.replace(/^["']|["']$/g, '').trim();
  const isAbsolute = path.isAbsolute(stripped) || /[\\/]/.test(stripped);

  if (isAbsolute) {
    const status = checkFile(stripped);
    if (status !== 'ok') return 'missing';
    // On POSIX, also verify the executable bit
    if (process.platform !== 'win32') {
      try {
        const stat = fs.statSync(stripped);
        if ((stat.mode & 0o111) === 0) return 'not-executable';
      } catch {
        return 'missing';
      }
    }
    return 'ok';
  }

  const pathEnv = process.env.PATH || process.env.Path || '';
  const dirs = pathEnv.split(path.delimiter).filter(Boolean);

  if (process.platform === 'win32') {
    const pathext = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD;.VBS;.JS;.WSF;.MSC')
      .split(';')
      .map(e => e.toLowerCase())
      .filter(Boolean);
    // Also try the bare name in case a file without extension is on PATH
    const candidates = ['', ...pathext];

    for (const dir of dirs) {
      for (const ext of candidates) {
        const candidate = path.join(dir, stripped + ext);
        if (checkFile(candidate) === 'ok') return 'ok';
      }
    }
    return 'not-found';
  } else {
    for (const dir of dirs) {
      const candidate = path.join(dir, stripped);
      try {
        const stat = fs.statSync(candidate);
        if (stat.isFile() && (stat.mode & 0o111) !== 0) return 'ok';
      } catch {
        // continue
      }
    }
    return 'not-found';
  }
}

function validateProfileConfig(input: {
  name?: string;
  icon?: string | null;
  shell?: string;
  cwd?: string;
}): ValidationResult {
  const nameInput = (input.name ?? '').toString().trim();
  const iconInput = (input.icon ?? '').toString().trim();
  const shellInput = (input.shell ?? '').toString().trim();
  const cwdInput = (input.cwd ?? '').toString().trim();

  return {
    name: nameInput ? 'ok' : 'missing',
    icon: iconInput ? checkFile(iconInput) : null,
    shell: shellInput ? checkShell(shellInput) : 'missing',
    cwd: cwdInput ? checkDir(cwdInput) : null,
  };
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

  ipcMain.handle('app:getHomeDir', () => {
    return process.env.USERPROFILE || process.env.HOME || 'C:\\';
  });

  ipcMain.handle(
    'validate:profileConfig',
    (_event, input: { name?: string; icon?: string | null; shell?: string; cwd?: string }) => {
      return validateProfileConfig(input);
    }
  );

  ipcMain.on('window:minimize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.minimize();
  });

  ipcMain.on('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on('window:close', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.close();
  });
}
