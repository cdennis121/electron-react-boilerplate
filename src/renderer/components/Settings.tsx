import { useState, useEffect } from 'react';
import { saveApiSettings, getApiSettings, ApiAuthSettings, saveAppFeatures, getAppFeatures } from '../utils/storage';

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
  const [enableRecordingDownload, setEnableRecordingDownload] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    // Load existing settings
    const existingSettings = getApiSettings();
    if (existingSettings) {
      setSettings(existingSettings);
    }
    
    // Load feature settings
    const features = getAppFeatures();
    setEnableRecordingDownload(features.enableCallRecordingDownload);
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
    saveAppFeatures({ enableCallRecordingDownload: enableRecordingDownload });
    
    // Update API client with new settings
    if (window.electron?.api) {
      window.electron.api.setSettings(settings);
    }
    
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
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
              placeholder="https://api.callswitchone.com/voip/user"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="authFor">X-Auth-For:</label>
            <input
              type="text"
              id="authFor"
              name="authFor"
              value={settings.authFor}
              onChange={handleInputChange}
              className="input-field"
              placeholder="Enter X-Auth-For value"
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

          <h2 style={{ marginTop: '30px' }}>Feature Settings</h2>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={enableRecordingDownload}
                onChange={(e) => setEnableRecordingDownload(e.target.checked)}
              />
              <span>Enable Call Recording Downloads</span>
            </label>
            <p className="help-text">
              When enabled, users can download call recordings. When disabled, only an indicator shows if a recording exists.
            </p>
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
