// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example';

export interface ApiAuthSettings {
  apiUrl: string;
  authFor: string;
  authReseller: string;
  authPassword: string;
  authUser: string;
}

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
  api: {
    async setSettings(settings: ApiAuthSettings) {
      return ipcRenderer.invoke('api-set-settings', settings);
    },
    async get<T = any>(url: string): Promise<T> {
      const result = await ipcRenderer.invoke('api-get', url);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    async post<T = any>(url: string, data?: any): Promise<T> {
      const result = await ipcRenderer.invoke('api-post', url, data);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    async put<T = any>(url: string, data?: any): Promise<T> {
      const result = await ipcRenderer.invoke('api-put', url, data);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    async delete<T = any>(url: string): Promise<T> {
      const result = await ipcRenderer.invoke('api-delete', url);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    async patch<T = any>(url: string, data?: any): Promise<T> {
      const result = await ipcRenderer.invoke('api-patch', url, data);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    async downloadFile(url: string, filename: string): Promise<void> {
      const result = await ipcRenderer.invoke('download-file', url, filename);
      if (!result.success) {
        throw new Error(result.error);
      }
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
