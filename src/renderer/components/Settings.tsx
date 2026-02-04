import { useState, useEffect } from 'react';
import { saveApiSettings, getApiSettings, ApiAuthSettings, saveAppFeatures, getAppFeatures, AppFeatures } from '../utils/storage';

const ADMIN_CODE = '1234';

function Settings() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [settings, setSettings] = useState<ApiAuthSettings>({
    apiUrl: '',
    authFor: '',
    authReseller: '',
    authPassword: '',
    authUser: '',
  });
  const [features, setFeatures] = useState<AppFeatures>({
    enableCallRecordingDownload: false,
    enableAutoRefresh: true,
    enableUserAvailability: true,
    enableUserStatus: true,
    showCallCost: false,
    enableAudioUpload: true,
    enablePlaylistManagement: true,
    showTimezoneInfo: true,
    enableAdvancedFilters: true,
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    // Load existing settings
    const existingSettings = getApiSettings();
    if (existingSettings) {
      setSettings(existingSettings);
    }
    
    // Load feature settings
    const loadedFeatures = getAppFeatures();
    setFeatures(loadedFeatures);
  }, []);

  const handleAdminCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminCode === ADMIN_CODE) {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Invalid admin code');
      setAdminCode('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
    setSaveSuccess(false);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveApiSettings(settings);
    
    // Save feature settings
    saveAppFeatures(features);
    
    // Update API client with new settings
    if (window.electron?.api) {
      window.electron.api.setSettings(settings);
    }
    
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleFeatureToggle = (featureName: keyof AppFeatures) => {
    setFeatures(prev => ({
      ...prev,
      [featureName]: !prev[featureName]
    }));
    setSaveSuccess(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="content-page">
        <h1>Settings</h1>
        <div className="auth-container">
          <form onSubmit={handleAdminCodeSubmit} className="auth-form">
            <h2>Admin Authentication Required</h2>
            <p>Please enter the admin code to access settings.</p>
            <div className="form-group">
              <label htmlFor="adminCode">Admin Code:</label>
              <input
                type="password"
                id="adminCode"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                className="input-field"
                autoFocus
              />
            </div>
            {authError && <div className="error-message">{authError}</div>}
            <button type="submit" className="btn-primary">
              Unlock Settings
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="content-page">
      <h1>Settings</h1>
      <div className="settings-container">
        <form onSubmit={handleSaveSettings} className="settings-form">
          <h2>API Authentication Details</h2>
          <p>Configure your API connection settings below.</p>

          <div className="form-group">
            <label htmlFor="apiUrl">API URL:</label>
            <input
              type="text"
              id="apiUrl"
              name="apiUrl"
              value={settings.apiUrl}
              onChange={handleInputChange}
              className="input-field"
              placeholder="https://api.callswitchone.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="authReseller">X-Auth-Reseller:</label>
            <input
              type="text"
              id="authReseller"
              name="authReseller"
              value={settings.authReseller}
              onChange={handleInputChange}
              className="input-field"
              placeholder="Enter X-Auth-Reseller value"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="authPassword">X-Auth-Password:</label>
            <input
              type="password"
              id="authPassword"
              name="authPassword"
              value={settings.authPassword}
              onChange={handleInputChange}
              className="input-field"
              placeholder="Enter X-Auth-Password"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="authUser">X-Auth-User:</label>
            <input
              type="text"
              id="authUser"
              name="authUser"
              value={settings.authUser}
              onChange={handleInputChange}
              className="input-field"
              placeholder="Enter X-Auth-User"
              required
            />
          </div>

          <h2 style={{ marginTop: '40px', marginBottom: '10px' }}>Feature Settings</h2>
          <p style={{ marginBottom: '20px', color: '#7f8c8d' }}>
            Enable or disable application features to customize your experience.
          </p>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-header">
                <div className="feature-info">
                  <h3>Call Recording Downloads</h3>
                  <p className="feature-description">
                    Allow users to download call recordings from the call history
                  </p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={features.enableCallRecordingDownload}
                    onChange={() => handleFeatureToggle('enableCallRecordingDownload')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-header">
                <div className="feature-info">
                  <h3>Auto Refresh</h3>
                  <p className="feature-description">
                    Automatically refresh data every 60 seconds
                  </p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={features.enableAutoRefresh}
                    onChange={() => handleFeatureToggle('enableAutoRefresh')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-header">
                <div className="feature-info">
                  <h3>User Availability</h3>
                  <p className="feature-description">
                    Display real-time user availability status
                  </p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={features.enableUserAvailability}
                    onChange={() => handleFeatureToggle('enableUserAvailability')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-header">
                <div className="feature-info">
                  <h3>User Status</h3>
                  <p className="feature-description">
                    Show user online/offline status indicators
                  </p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={features.enableUserStatus}
                    onChange={() => handleFeatureToggle('enableUserStatus')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-header">
                <div className="feature-info">
                  <h3>Call Cost Display</h3>
                  <p className="feature-description">
                    Display call cost information in call history
                  </p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={features.showCallCost}
                    onChange={() => handleFeatureToggle('showCallCost')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-header">
                <div className="feature-info">
                  <h3>Audio Upload</h3>
                  <p className="feature-description">
                    Enable uploading custom audio files
                  </p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={features.enableAudioUpload}
                    onChange={() => handleFeatureToggle('enableAudioUpload')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-header">
                <div className="feature-info">
                  <h3>Playlist Management</h3>
                  <p className="feature-description">
                    Allow creation and management of audio playlists
                  </p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={features.enablePlaylistManagement}
                    onChange={() => handleFeatureToggle('enablePlaylistManagement')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-header">
                <div className="feature-info">
                  <h3>Timezone Information</h3>
                  <p className="feature-description">
                    Display timezone details for users
                  </p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={features.showTimezoneInfo}
                    onChange={() => handleFeatureToggle('showTimezoneInfo')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-header">
                <div className="feature-info">
                  <h3>Advanced Filters</h3>
                  <p className="feature-description">
                    Enable advanced filtering options in lists
                  </p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={features.enableAdvancedFilters}
                    onChange={() => handleFeatureToggle('enableAdvancedFilters')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          {saveSuccess && (
            <div className="success-message">
              Settings saved successfully!
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Save Settings
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsAuthenticated(false)}
            >
              Lock Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Settings;
