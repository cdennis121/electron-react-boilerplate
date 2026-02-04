import { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Users from './Users';
import HuntGroups from './HuntGroups';
import CallQueues from './CallQueues';
import CallHistory from './CallHistory';
import CallFlows from './CallFlows';
import Audio from './Audio';
import Settings from './Settings';
import Login from './Login';
import { getSelectedCustomer, clearSelectedCustomer, getApiSettings } from '../utils/storage';

function Layout() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<string | null>(null);
  const [currentCustomerName, setCurrentCustomerName] = useState<string>('');

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Check if customer is already selected
      const selectedCustomer = getSelectedCustomer();
      if (selectedCustomer) {
        setCurrentCustomer(selectedCustomer);
        
        // Initialize API client with saved settings including authFor
        const settings = getApiSettings();
        if (settings) {
          // Make sure authFor is set to the selected customer name
          const updatedSettings = {
            ...settings,
            authFor: selectedCustomer // This is the customer name
          };
          await window.electron.api.setSettings(updatedSettings);
          
          // Wait a bit for settings to propagate
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        setIsLoggedIn(true);
        
        // Fetch customer name after initialization
        fetchCustomerName(selectedCustomer);
      }
    } catch (err) {
      console.error('Error initializing app:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  const fetchCustomerName = async (name: string) => {
    try {
      const settings = getApiSettings();
      if (settings) {
        await window.electron.api.setSettings(settings);
        const response = await window.electron.api.getCustomers();
        if (response?.result) {
          const customer = response.result.find((c: any) => c.name === name);
          if (customer) {
            setCurrentCustomerName(customer.contact_name || '');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching customer name:', err);
    }
  };

  const handleLogin = () => {
    const selectedCustomer = getSelectedCustomer();
    setCurrentCustomer(selectedCustomer);
    setIsLoggedIn(true);
    setIsInitializing(false);
    if (selectedCustomer) {
      fetchCustomerName(selectedCustomer);
    }
  };

  const handleLogout = () => {
    clearSelectedCustomer();
    setCurrentCustomer(null);
    setCurrentCustomerName('');
    setIsLoggedIn(false);
  };

  // Show loading screen while initializing
  if (isInitializing) {
    return (
      <div className="loading-container" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>
          <div className="spinner"></div>
          <p>Initializing...</p>
        </div>
      </div>
    );
  }

  // Show login page if not logged in
  if (!isLoggedIn) {
    if (showSettings) {
      return (
        <div className="settings-standalone">
          <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <button 
              className="btn-secondary" 
              onClick={() => setShowSettings(false)}
              style={{ marginBottom: '20px' }}
            >
              ← Back to Login
            </button>
            <Settings />
          </div>
        </div>
      );
    }
    return <Login onLogin={handleLogin} onOpenSettings={() => setShowSettings(true)} />;
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>CS1 Management</h2>
          {currentCustomerName && (
            <div className="customer-info">
              <span className="customer-label">Customer:</span>
              <span className="customer-name">{currentCustomerName}</span>
            </div>
          )}
          {currentCustomer && (
            <button 
              className="logout-btn" 
              onClick={handleLogout}
              title="Switch Customer"
            >
              🔄 Switch Customer
            </button>
          )}
        </div>
        <nav className="sidebar-nav">
          <Link to="/users" className="nav-link">
            Users
          </Link>
          <Link to="/hunt-groups" className="nav-link">
            Hunt Groups
          </Link>
          <Link to="/call-queues" className="nav-link">
            Call Queues
          </Link>
          <Link to="/call-history" className="nav-link">
            Call History
          </Link>
          <Link to="/call-flows" className="nav-link">
            Call Flows
          </Link>
          <Link to="/audio" className="nav-link">
            Audio
          </Link>
        </nav>
        <nav className="sidebar-nav-bottom">
          <Link to="/settings" className="nav-link">
            ⚙️ Settings
          </Link>
        </nav>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Users />} />
          <Route path="/users" element={<Users />} />
          <Route path="/hunt-groups" element={<HuntGroups />} />
          <Route path="/call-queues" element={<CallQueues />} />
          <Route path="/call-history" element={<CallHistory />} />
          <Route path="/call-flows" element={<CallFlows />} />
          <Route path="/audio" element={<Audio />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

export default Layout;
