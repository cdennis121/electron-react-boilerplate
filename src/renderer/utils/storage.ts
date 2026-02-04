// Utility functions for storing API auth details
const STORAGE_KEY = 'api_auth_settings';
const FEATURES_KEY = 'app_features';
const CUSTOMER_KEY = 'selected_customer';

export interface ApiAuthSettings {
  apiUrl: string;
  authFor: string;
  authReseller: string;
  authPassword: string;
  authUser: string;
}

export interface AppFeatures {
  enableCallRecordingDownload: boolean;
  enableAutoRefresh: boolean;
  enableUserAvailability: boolean;
  enableUserStatus: boolean;
  showCallCost: boolean;
  enableAudioUpload: boolean;
  enablePlaylistManagement: boolean;
  showTimezoneInfo: boolean;
  enableAdvancedFilters: boolean;
}

export const saveApiSettings = (settings: ApiAuthSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving API settings:', error);
  }
};

export const getApiSettings = (): ApiAuthSettings | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error loading API settings:', error);
    return null;
  }
};

export const clearApiSettings = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing API settings:', error);
  }
};

export const saveAppFeatures = (features: AppFeatures): void => {
  try {
    localStorage.setItem(FEATURES_KEY, JSON.stringify(features));
  } catch (error) {
    console.error('Error saving app features:', error);
  }
};

export const getAppFeatures = (): AppFeatures => {
  try {
    const stored = localStorage.getItem(FEATURES_KEY);
    const defaultFeatures: AppFeatures = {
      enableCallRecordingDownload: false,
      enableAutoRefresh: true,
      enableUserAvailability: true,
      enableUserStatus: true,
      showCallCost: false,
      enableAudioUpload: true,
      enablePlaylistManagement: true,
      showTimezoneInfo: true,
      enableAdvancedFilters: true,
    };
    return stored ? { ...defaultFeatures, ...JSON.parse(stored) } : defaultFeatures;
  } catch (error) {
    console.error('Error loading app features:', error);
    return {
      enableCallRecordingDownload: false,
      enableAutoRefresh: true,
      enableUserAvailability: true,
      enableUserStatus: true,
      showCallCost: false,
      enableAudioUpload: true,
      enablePlaylistManagement: true,
      showTimezoneInfo: true,
      enableAdvancedFilters: true,
    };
  }
};

export const saveSelectedCustomer = (customerUuid: string): void => {
  try {
    localStorage.setItem(CUSTOMER_KEY, customerUuid);
  } catch (error) {
    console.error('Error saving selected customer:', error);
  }
};

export const getSelectedCustomer = (): string | null => {
  try {
    return localStorage.getItem(CUSTOMER_KEY);
  } catch (error) {
    console.error('Error loading selected customer:', error);
    return null;
  }
};

export const clearSelectedCustomer = (): void => {
  try {
    localStorage.removeItem(CUSTOMER_KEY);
  } catch (error) {
    console.error('Error clearing selected customer:', error);
  }
};
