import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApiClient } from '../utils/apiClient';

interface HuntGroup {
  name: string;
  extension_number: number;
  members: string[];
  uuid: string;
}

interface User {
  uuid: string;
  display_name: string;
  extension: number;
  linked_emails?: string[];
  user_name: string;
}

interface ApiResponse {
  result: HuntGroup[];
  status_code: number;
  status_message: string;
}

interface UsersApiResponse {
  result: User[];
  status_code: number;
  status_message: string;
}

function HuntGroups() {
  const [huntGroups, setHuntGroups] = useState<HuntGroup[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [togglingUser, setTogglingUser] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  
  const mountedRef = useRef(true);
  const usersLoadedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    
    const fetchHuntGroups = async () => {
      // Initialize API client with saved settings
      if (!initializeApiClient()) {
        setError('API settings not configured. Please configure in Settings.');
        return;
      }

      setLoading(true);
      setError('');
      
      try {
        // Make API call to get hunt groups
        const response = await window.electron.api.get<ApiResponse>('/voip/group');
        
        if (response.status_code === 200 && response.result) {
          if (mountedRef.current) {
            setHuntGroups(response.result);
          }
        } else {
          if (mountedRef.current) {
            setError(`API Error: ${response.status_message || 'Unknown error'}`);
          }
        }
      } catch (err: any) {
        console.error('Error fetching hunt groups:', err);
        if (mountedRef.current) {
          setError(err.message || 'Failed to fetch hunt groups');
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchHuntGroups();
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleGroupChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const groupUuid = event.target.value;
    setSelectedGroup(groupUuid);
    
    if (groupUuid && !usersLoadedRef.current) {
      fetchUsers();
    }
  };

  const fetchUsers = async () => {
    if (usersLoadedRef.current && users.length > 0) return;
    
    setLoadingUsers(true);
    setError('');
    
    try {
      const response = await window.electron.api.get<UsersApiResponse>('/voip/user');
      
      if (response.status_code === 200 && response.result) {
        if (mountedRef.current) {
          setUsers(response.result);
          usersLoadedRef.current = true;
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
        setLoadingUsers(false);
      }
    }
  };

  const isUserInGroup = (userUuid: string): boolean => {
    const group = huntGroups.find(g => g.uuid === selectedGroup);
    return group ? group.members.includes(userUuid) : false;
  };

  const handleToggleUser = async (userUuid: string) => {
    if (!selectedGroup) return;
    
    const group = huntGroups.find(g => g.uuid === selectedGroup);
    if (!group) return;
    
    setTogglingUser(userUuid);
    setError('');
    
    try {
      // Determine if adding or removing user
      const isCurrentlyInGroup = group.members.includes(userUuid);
      const updatedMembers = isCurrentlyInGroup
        ? group.members.filter(id => id !== userUuid) // Remove user
        : [...group.members, userUuid]; // Add user
      
      // Prepare the updated group data
      const updatedGroup = {
        name: group.name,
        extension_number: group.extension_number,
        members: updatedMembers,
      };
      
      // Make PUT request to update the group
      const response = await window.electron.api.put<ApiResponse>(
        `/voip/group/${selectedGroup}`,
        updatedGroup
      );
      
      if (response.status_code === 200) {
        // Update local state with the new members list
        setHuntGroups(prevGroups =>
          prevGroups.map(g =>
            g.uuid === selectedGroup
              ? { ...g, members: updatedMembers }
              : g
          )
        );
      } else {
        setError(`Failed to update group: ${response.status_message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error updating group:', err);
      setError(err.message || 'Failed to update group membership');
    } finally {
      setTogglingUser(null);
    }
  };

  return (
    <div className="content-page">
      <h1>Hunt Groups</h1>
      <p>Manage your hunt groups here.</p>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="form-group">
        <label htmlFor="huntGroupSelect">Select Hunt Group:</label>
        <select
          id="huntGroupSelect"
          value={selectedGroup}
          onChange={handleGroupChange}
          disabled={loading}
          className="dropdown"
        >
          <option value="">
            {loading ? 'Loading...' : '-- Select a Hunt Group --'}
          </option>
          {huntGroups.map((group) => (
            <option key={group.uuid} value={group.uuid}>
              {group.name} (Ext: {group.extension_number})
            </option>
          ))}
        </select>
      </div>

      {selectedGroup && (
        <>
          <div className="selected-info">
            <p>Selected Group: {huntGroups.find(g => g.uuid === selectedGroup)?.name}</p>
            <p>Members: {huntGroups.find(g => g.uuid === selectedGroup)?.members.length || 0}</p>
          </div>

          <div className="users-section">
            <h2>Users</h2>
            {loadingUsers ? (
              <p>Loading users...</p>
            ) : users.length > 0 ? (
              <div className="users-grid">
                {users.map((user) => {
                  const isInGroup = isUserInGroup(user.uuid);
                  const isToggling = togglingUser === user.uuid;
                  return (
                    <div key={user.uuid} className="user-tile">
                      <div className="user-tile-header">
                        <span className="user-name">
                          {user.display_name}
                        </span>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={isInGroup}
                            onChange={() => handleToggleUser(user.uuid)}
                            disabled={isToggling}
                          />
                          <span className={`slider ${isInGroup ? 'active' : ''} ${isToggling ? 'loading' : ''}`}></span>
                        </label>
                      </div>
                      <div className="user-tile-details">
                        <span>Ext: {user.extension}</span>
                        {user.linked_emails && user.linked_emails.length > 0 && (
                          <span className="user-email">{user.linked_emails[0]}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p>No users available</p>
            )}
          </div>
        </>
      )}
      
      {togglingUser && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
}

export default HuntGroups;
