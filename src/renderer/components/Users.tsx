import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { initializeApiClient } from '../utils/apiClient';
import { getAppFeatures } from '../utils/storage';

interface UserStatus {
  uuid: string;
  status: string;
}

interface UserAvailability {
  uuid: string;
  available: boolean;
}

interface User {
  uuid: string;
  extension: number;
  user_name: string;
  display_name: string;
  call_recording: boolean;
  call_encryption: boolean;
  caller_id: string;
  personal_mailbox: string;
  hold_playlist: string;
  use_default_playlist: boolean;
  show_missed_calls: boolean;
  can_listen: boolean;
  can_whisper: boolean;
  can_barge: boolean;
  can_pickup: boolean;
  can_be_listened: boolean;
  can_be_whispered: boolean;
  can_be_barged: boolean;
  can_be_picked_up: boolean;
  can_invite_anonymously: boolean;
  ring_duration: number;
  use_mailbox_on_transfer: boolean;
  transfer_backup_extension: number;
  country_code: string;
  restrict_caller_id: boolean;
  type: number;
  emergency_caller_id: string;
  allow_direct_calls: boolean;
  use_direct_calls: boolean;
  restrict_outbound: boolean;
  timezone: string;
  can_auto_deploy: boolean;
  chat_enabled: boolean;
  mute_chat_notifications: boolean;
  mobile_dnd: boolean;
  mobile_dnd_allow_internal: boolean;
  allow_multi_device: boolean;
  related_product: string;
  allowed_caller_ids: string[];
}

interface ApiResponse {
  result: User[];
  status_code: number;
  status_message: string;
}

function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [userStatuses, setUserStatuses] = useState<UserStatus[]>([]);
  const [userAvailabilities, setUserAvailabilities] = useState<UserAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [settingsNotConfigured, setSettingsNotConfigured] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [features, setFeatures] = useState(getAppFeatures());
  
  // Refs to avoid stale closures in intervals
  const featuresRef = useRef(features);
  const usersRef = useRef(users);
  const mountedRef = useRef(true);
  
  // Keep refs in sync
  useEffect(() => {
    featuresRef.current = features;
  }, [features]);
  
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Load feature settings
    const loadedFeatures = getAppFeatures();
    setFeatures(loadedFeatures);
    
    // Initialize once and fetch data
    if (initializeApiClient()) {
      fetchUsers();
      if (loadedFeatures.enableUserStatus) {
        fetchUserStatuses();
      }
    } else {
      setError('API settings not configured. Please configure in Settings.');
      setSettingsNotConfigured(true);
    }
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (users.length > 0 && features.enableUserAvailability) {
      fetchUserAvailabilities();
    }
  }, [users, features.enableUserAvailability]);

  // Update status and availability every 60 seconds if auto-refresh is enabled
  useEffect(() => {
    if (!features.enableAutoRefresh) return;
    
    const statusInterval = setInterval(() => {
      if (featuresRef.current.enableUserStatus) {
        fetchUserStatuses();
      }
    }, 60000);

    return () => clearInterval(statusInterval);
  }, [features.enableAutoRefresh]);

  useEffect(() => {
    if (!features.enableAutoRefresh || users.length === 0) return;
    
    const availabilityInterval = setInterval(() => {
      if (featuresRef.current.enableUserAvailability && usersRef.current.length > 0) {
        fetchUserAvailabilities();
      }
    }, 60000);

    return () => clearInterval(availabilityInterval);
  }, [features.enableAutoRefresh, users.length > 0]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await window.electron.api.get<ApiResponse>('/voip/user');
      
      if (response.status_code === 200 && response.result) {
        if (mountedRef.current) {
          setUsers(response.result);
        }
      } else {
        if (mountedRef.current) {
          setError(`Failed to load users: ${response.status_message || 'Unknown error'}`);
        }
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      if (mountedRef.current) {
        setError(err.message || 'Failed to fetch users');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const fetchUserStatuses = async () => {
    try {
      const response = await window.electron.api.get<{ result: UserStatus[]; status_code: number; status_message: string; }>('/voip/user-status');
      
      if (response.status_code === 200 && response.result) {
        if (mountedRef.current) {
          setUserStatuses(response.result);
        }
      }
    } catch (err: any) {
      console.error('Error fetching user statuses:', err);
    }
  };

  const getUserStatus = useCallback((uuid: string): string => {
    const userStatus = userStatuses.find(s => s.uuid === uuid);
    return userStatus ? userStatus.status : 'unknown';
  }, [userStatuses]);

  const fetchUserAvailabilities = async () => {
    const currentUsers = usersRef.current;
    if (currentUsers.length === 0) return;
    
    try {
      // Batch requests in groups of 10 to avoid overwhelming the API
      const batchSize = 10;
      const allAvailabilities: UserAvailability[] = [];
      
      for (let i = 0; i < currentUsers.length; i += batchSize) {
        const batch = currentUsers.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (user) => {
            try {
              const response = await window.electron.api.get<{ result: { available: boolean }; status_code: number; }>(
                `/voip/user/${user.uuid}/availability`
              );
              return {
                uuid: user.uuid,
                available: response.status_code === 200 ? response.result.available : false
              };
            } catch (err) {
              return { uuid: user.uuid, available: false };
            }
          })
        );
        allAvailabilities.push(...batchResults);
      }
      
      if (mountedRef.current) {
        setUserAvailabilities(allAvailabilities);
      }
    } catch (err: any) {
      console.error('Error fetching user availabilities:', err);
    }
  };
  const getUserAvailability = useCallback((uuid: string): boolean => {
    const userAvail = userAvailabilities.find(a => a.uuid === uuid);
    return userAvail ? userAvail.available : false;
  }, [userAvailabilities]);

  // Memoize filtered users to prevent recalculation on every render
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const search = searchTerm.toLowerCase();
      return (
        user.display_name.toLowerCase().includes(search) ||
        user.extension.toString().includes(search) ||
        user.user_name.toLowerCase().includes(search) ||
        user.timezone?.toLowerCase().includes(search) ||
        user.country_code?.toLowerCase().includes(search)
      );
    });
  }, [users, searchTerm]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Users</h1>
        <p>View and manage user accounts</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          {settingsNotConfigured && (
            <Link to="/settings" className="btn-primary" style={{ marginLeft: '15px', display: 'inline-block', textDecoration: 'none' }}>
              Open Settings
            </Link>
          )}
        </div>
      )}

      <div className="filters-container">
        <input
          type="text"
          placeholder="Search by name, extension, username, timezone, or country..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-box"
        />
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading users...</p>
        </div>
      ) : (
        <div className="users-grid">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <div key={user.uuid} className="user-card">
                <div className="user-header">
                  <h3>{user.display_name}</h3>
                  <div className="user-header-badges">
                    {features.enableUserStatus && (
                      <span className={`status-badge status-${getUserStatus(user.uuid)}`}>
                        {getUserStatus(user.uuid)}
                      </span>
                    )}
                    <span className="extension-badge">Ext {user.extension}</span>
                  </div>
                </div>
                <div className="user-details">
                  <div className="detail-row">
                    <span className="detail-label">Username:</span>
                    <span className="detail-value">{user.user_name}</span>
                  </div>
                  {features.showTimezoneInfo && (
                    <>
                      <div className="detail-row">
                        <span className="detail-label">Timezone:</span>
                        <span className="detail-value">{user.timezone}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Country:</span>
                        <span className="detail-value">{user.country_code}</span>
                      </div>
                    </>
                  )}
                  <div className="user-features">
                    {user.call_recording && <span className="feature-badge">Recording</span>}
                    {user.call_encryption && <span className="feature-badge">Encrypted</span>}
                    {user.chat_enabled && <span className="feature-badge">Chat</span>}
                    {user.allow_multi_device && <span className="feature-badge">Multi-Device</span>}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <p>{searchTerm ? 'No users found matching your search' : 'No users found'}</p>
            </div>
          )}
        </div>
      )}

      {!loading && filteredUsers.length > 0 && (
        <div className="results-info">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      )}
    </div>
  );
}

export default Users;
