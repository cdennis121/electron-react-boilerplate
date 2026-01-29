// Hook to use the API client in React components
import { useEffect } from 'react';
import { getApiSettings } from './storage';

export const useApiClient = () => {
  useEffect(() => {
    // Initialize API client with saved settings
    const settings = getApiSettings();
    if (settings && window.electron?.api) {
      window.electron.api.setSettings(settings);
    }
  }, []);

  return window.electron?.api;
};

// Helper function to ensure API is configured
export const initializeApiClient = () => {
  const settings = getApiSettings();
  if (settings && window.electron?.api) {
    window.electron.api.setSettings(settings);
    return true;
  }
  return false;
};
