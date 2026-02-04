import { useState, useEffect } from 'react';
import { saveSelectedCustomer, getSelectedCustomer, getApiSettings, saveApiSettings } from '../utils/storage';

interface Customer {
  contact_name: string;
  uuid: string;
  name: string;
}

interface ApiResponse {
  result: Customer[];
  status_code: number;
  status_message: string;
}

interface LoginProps {
  onLogin: () => void;
  onOpenSettings: () => void;
}

function Login({ onLogin, onOpenSettings }: LoginProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>(''); // This will store the name
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [fetchingCustomers, setFetchingCustomers] = useState(false);

  useEffect(() => {
    // Check if API settings are configured
    const settings = getApiSettings();
    if (!settings || !settings.apiUrl) {
      setError('API settings not configured. Please configure in Settings first.');
      return;
    }

    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setFetchingCustomers(true);
    setError('');

    try {
      // Initialize API client with settings before making request
      const settings = getApiSettings();
      if (settings) {
        await window.electron.api.setSettings(settings);
      }
      
      const response = await window.electron.api.getCustomers<ApiResponse>();
      
      if (response.status_code === 200 && response.result && response.result.length > 0) {
        setCustomers(response.result);
        
        // Check if there's a previously selected customer (by name)
        const previouslySelected = getSelectedCustomer();
        if (previouslySelected) {
          const customerExists = response.result.find(c => c.name === previouslySelected);
          if (customerExists) {
            setSelectedCustomer(previouslySelected);
          }
        }
      } else {
        setError(`Failed to load customers: ${response.status_message || 'No customers found'}`);
      }
    } catch (err: any) {
      console.error('Error fetching customers:', err);
      setError(err.message || 'Failed to fetch customers. Please check your API settings.');
    } finally {
      setFetchingCustomers(false);
    }
  };

  const handleLogin = async () => {
    if (!selectedCustomer) {
      setError('Please select a customer');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Save selected customer name
      saveSelectedCustomer(selectedCustomer);
      
      // Update API settings with the selected customer name in authFor
      const settings = getApiSettings();
      if (settings) {
        const updatedSettings = {
          ...settings,
          authFor: selectedCustomer // Using name instead of uuid
        };
        // Save updated settings to localStorage
        saveApiSettings(updatedSettings);
        // Update the API client in main process
        await window.electron.api.setSettings(updatedSettings);
        
        // Small delay to ensure settings are fully propagated
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Notify parent component
      onLogin();
    } catch (err: any) {
      console.error('Error during login:', err);
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const getCustomerName = (name: string): string => {
    const customer = customers.find(c => c.name === name);
    return customer ? customer.contact_name : '';
  };

  const filteredCustomers = customers.filter(customer => 
    customer.contact_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>CS1 Management</h1>
          <p>Select a customer to continue</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {error && error.includes('API settings not configured') && (
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button className="btn-primary" onClick={onOpenSettings}>
              Open Settings
            </button>
          </div>
        )}

        {fetchingCustomers ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading customers...</p>
          </div>
        ) : customers.length > 0 ? (
          <div className="login-form">
            <div className="form-group">
              <label htmlFor="customer-search">Search Customers:</label>
              <input
                id="customer-search"
                type="text"
                placeholder="Type to search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="customer-select">Select Customer:</label>
              <select
                id="customer-select"
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="dropdown"
                disabled={loading}
              >
                <option value="">-- Select a customer --</option>
                {filteredCustomers.map((customer) => (
                  <option key={customer.uuid} value={customer.name}>
                    {customer.contact_name}
                  </option>
                ))}
              </select>
              {searchTerm && filteredCustomers.length === 0 && (
                <p className="no-results">No customers found matching "{searchTerm}"</p>
              )}
            </div>

            <button
              className="btn-primary login-btn"
              onClick={handleLogin}
              disabled={loading || !selectedCustomer}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>

            {selectedCustomer && (
              <div className="selected-info">
                <p>Selected: <strong>{getCustomerName(selectedCustomer)}</strong></p>
              </div>
            )}
          </div>
        ) : (
          !error && (
            <div className="empty-state">
              <p>No customers available</p>
              <button className="btn-secondary" onClick={fetchCustomers}>
                Retry
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default Login;
