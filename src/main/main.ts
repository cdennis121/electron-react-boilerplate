/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import axios from 'axios';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { apiClient } from './apiClient';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

// API IPC Handlers
ipcMain.handle('api-set-settings', async (_event, settings) => {
  apiClient.setSettings(settings);
  return { success: true };
});

ipcMain.handle('api-get', async (_event, url) => {
  try {
    const data = await apiClient.get(url);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api-post', async (_event, url, data) => {
  try {
    const response = await apiClient.post(url, data);
    return { success: true, data: response };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api-put', async (_event, url, data) => {
  try {
    const response = await apiClient.put(url, data);
    return { success: true, data: response };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api-delete', async (_event, url) => {
  try {
    const data = await apiClient.delete(url);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api-patch', async (_event, url, data) => {
  try {
    const response = await apiClient.patch(url, data);
    return { success: true, data: response };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api-get-customers', async (_event) => {
  try {
    const data = await apiClient.getWithoutAuthFor('/account/reseller');
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

const sanitizeFilename = (name: string): string =>
  String(name || 'recording.mp3')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/[. ]+$/, '') || 'recording.mp3';

const uniqueFilePath = (directory: string, filename: string): string => {
  const safeName = sanitizeFilename(filename);
  let savePath = path.join(directory, safeName);
  if (!fs.existsSync(savePath)) {
    return savePath;
  }

  const ext = path.extname(safeName);
  const base = path.basename(safeName, ext);
  let counter = 1;
  while (fs.existsSync(savePath)) {
    savePath = path.join(directory, `${base} (${counter})${ext}`);
    counter += 1;
  }
  return savePath;
};

ipcMain.handle('download-file', async (_event, url, filename) => {
  try {
    const downloadDir = app.getPath('downloads');
    const savePath = uniqueFilePath(downloadDir, filename);
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 0,
    });
    await pipeline(response.data, fs.createWriteStream(savePath));
    return { success: true, path: savePath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
