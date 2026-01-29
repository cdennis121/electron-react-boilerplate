import { useState, useEffect } from 'react';
import { initializeApiClient } from '../utils/apiClient';

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
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchUserStatuses();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      fetchUserAvailabilities();
    }
  }, [users]);

  // Update status and availability every 60 seconds
  useEffect(() => {
    const statusInterval = setInterval(() => {
      fetchUserStatuses();
    }, 60000);

    return () => clearInterval(statusInterval);
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      const availabilityInterval = setInterval(() => {
        fetchUserAvailabilities();
      }, 60000);

      return () => clearInterval(availabilityInterval);
    }
  }, [users]);

  const fetchUsers = async () => {
    if (!initializeApiClient()) {
      setError('API settings not configured. Please configure in Settings.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await window.electron.api.get<ApiResponse>('/voip/user');
      
      if (response.status_code === 200 && response.result) {
        setUsers(response.result);
      } else {
        setError(`Failed to load users: ${response.status_message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStatuses = async () => {
    if (!initializeApiClient()) {
      return;
    }

    try {
      const response = await window.electron.api.get<{ result: UserStatus[]; status_code: number; status_message: string; }>('/voip/user-status');
      
      if (response.status_code === 200 && response.result) {
        setUserStatuses(response.result);
      }
    } catch (err: any) {
      console.error('Error fetching user statuses:', err);
    }
  };

  const getUserStatus = (uuid: string): string => {
    const userStatus = userStatuses.find(s => s.uuid === uuid);
    return userStatus ? userStatus.status : 'unknown';
  };

  const fetchUserAvailabilities = async () => {
    if (!initializeApiClient()) {
      return;
    }

    try {
      const availabilities = await Promise.all(
        users.map(async (user) => {
          try {
            const response = await window.electron.api.get<{ result: { available: boolean }; status_code: number; }>(
              `/voip/user/${user.uuid}/availability`
            );
            console.log(`Availability for ${user.display_name} (${user.uuid}):`, response);
            return {
              uuid: user.uuid,
              available: response.status_code === 200 ? response.result.available : false
            };
          } catch (err) {
            console.error(`Error fetching availability for ${user.display_name}:`, err);
            return { uuid: user.uuid, available: false };
          }
        })
      );
      console.log('All availabilities:', availabilities);
      setUserAvailabilities(availabilities);
    } catch (err: any) {
      console.error('Error fetching user availabilities:', err);
    }
  };

  const getUserAvailability = (uuid: string): boolean => {
    const userAvail = userAvailabilities.find(a => a.uuid === uuid);
    return userAvail ? userAvail.available : false;
  };

  const filteredUsers = users.filter(user => {
    const search = searchTerm.toLowerCase();
    return (
      user.display_name.toLowerCase().includes(search) ||
      user.extension.toString().includes(search) ||
      user.user_name.toLowerCase().includes(search) ||
      user.timezone?.toLowerCase().includes(search) ||
      user.country_code?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Users</h1>
        <p>View and manage user accounts</p>
      </div>

      {error && <div className="error-message">{error}</div>}

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
                    <span className={`status-badge status-${getUserStatus(user.uuid)}`}>
                      {getUserStatus(user.uuid)}
                    </span>
                    <span className="extension-badge">Ext {user.extension}</span>
                  </div>
                </div>
                <div className="user-details">
                  <div className="detail-row">
                    <span className="detail-label">Username:</span>
                    <span className="detail-value">{user.user_name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Timezone:</span>
                    <span className="detail-value">{user.timezone}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Country:</span>
                    <span className="detail-value">{user.country_code}</span>
                  </div>
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
