import { useState, useEffect } from 'react';
import { initializeApiClient } from '../utils/apiClient';

interface Sound {
  name: string;
  shared: boolean;
  file_name: string;
  tag: string;
  audio_type: number;
  uuid: string;
}

interface Playlist {
  name: string;
  random: boolean;
  default: boolean;
  sounds?: string[];
  uuid: string;
}

interface ApiResponse<T> {
  result: T[];
  status_code: number;
  status_message: string;
}

interface UploadItem {
  id: string;
  file: File;
  name: string;
  tag: string;
  audio_type: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

function Audio() {
  const [activeTab, setActiveTab] = useState<'sounds' | 'playlists'>('sounds');
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [newPlaylist, setNewPlaylist] = useState({
    name: '',
    random: false,
    default: false,
    sounds: [] as string[]
  });
  const [soundSearchTerm, setSoundSearchTerm] = useState('');

  useEffect(() => {
    if (activeTab === 'sounds') {
      fetchSounds();
    } else {
      fetchPlaylists();
    }
  }, [activeTab]);

  const fetchSounds = async () => {
    if (!initializeApiClient()) {
      setError('API settings not configured. Please configure in Settings.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await window.electron.api.get<ApiResponse<Sound>>('/voip/sound');
      
      if (response.status_code === 200 && response.result) {
        setSounds(response.result);
      } else {
        setError(`Failed to load sounds: ${response.status_message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error fetching sounds:', err);
      setError(err.message || 'Failed to fetch sounds');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaylists = async () => {
    if (!initializeApiClient()) {
      setError('API settings not configured. Please configure in Settings.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await window.electron.api.get<ApiResponse<Playlist>>('/voip/playlist');
      
      if (response.status_code === 200 && response.result) {
        setPlaylists(response.result);
      } else {
        setError(`Failed to load playlists: ${response.status_message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error fetching playlists:', err);
      setError(err.message || 'Failed to fetch playlists');
    } finally {
      setLoading(false);
    }
  };

  const getSoundNameByUuid = (uuid: string): string => {
    const sound = sounds.find(s => s.uuid === uuid);
    return sound ? sound.name : 'Unknown';
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newItems: UploadItem[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for name
      tag: 'Hold Music',
      audio_type: 1,
      status: 'pending'
    }));

    setUploadQueue(prev => [...prev, ...newItems]);
    setShowUploadModal(true);
    event.target.value = ''; // Reset input
  };

  const updateUploadItem = (id: string, updates: Partial<UploadItem>) => {
    setUploadQueue(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const removeUploadItem = (id: string) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove the data:audio/...;base64, prefix
        const base64Content = base64.split(',')[1];
        resolve(base64Content);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadFile = async (item: UploadItem): Promise<void> => {
    updateUploadItem(item.id, { status: 'uploading' });

    try {
      const content = await fileToBase64(item.file);
      
      const payload = {
        name: item.name,
        file_name: item.file.name,
        tag: item.tag,
        audio_type: item.audio_type,
        content
      };

      const response = await window.electron.api.post('/voip/sound', payload);
      
      if (response.status_code === 200 || response.status_code === 201) {
        updateUploadItem(item.id, { status: 'success' });
      } else {
        updateUploadItem(item.id, { 
          status: 'error', 
          error: response.status_message || 'Upload failed' 
        });
      }
    } catch (err: any) {
      updateUploadItem(item.id, { 
        status: 'error', 
        error: err.message || 'Upload failed' 
      });
    }
  };

  const startUpload = async () => {
    if (isUploading) return;
    
    if (!initializeApiClient()) {
      setError('API settings not configured. Please configure in Settings.');
      return;
    }

    setIsUploading(true);

    const pendingItems = uploadQueue.filter(item => item.status === 'pending');
    
    for (const item of pendingItems) {
      await uploadFile(item);
    }

    setIsUploading(false);
    
    // Refresh sounds list after upload
    await fetchSounds();
  };

  const closeModal = () => {
    if (!isUploading) {
      setShowUploadModal(false);
      setUploadQueue([]);
    }
  };

  const handleDeleteSound = async (uuid: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    if (!initializeApiClient()) {
      setError('API settings not configured. Please configure in Settings.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await window.electron.api.delete(`/voip/sound/${uuid}`);
      
      if (response.status_code === 204 || response.status_code === 200) {
        // Refresh sounds list after deletion
        await fetchSounds();
      } else {
        setError(`Failed to delete sound: ${response.status_message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error deleting sound:', err);
      setError(err.message || 'Failed to delete sound');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylist.name.trim()) {
      setError('Playlist name is required');
      return;
    }

    if (!initializeApiClient()) {
      setError('API settings not configured. Please configure in Settings.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        name: newPlaylist.name,
        random: newPlaylist.random,
        default: newPlaylist.default,
        sounds: newPlaylist.sounds
      };

      const response = await window.electron.api.post('/voip/playlist', payload);
      
      if (response.status_code === 200 || response.status_code === 201) {
        await fetchPlaylists();
        setShowNewPlaylistModal(false);
        setNewPlaylist({
          name: '',
          random: false,
          default: false,
          sounds: []
        });
        setSoundSearchTerm('');
      } else {
        setError(`Failed to create playlist: ${response.status_message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error creating playlist:', err);
      setError(err.message || 'Failed to create playlist');
    } finally {
      setLoading(false);
    }
  };

  const toggleSoundInPlaylist = (soundUuid: string) => {
    setNewPlaylist(prev => ({
      ...prev,
      sounds: prev.sounds.includes(soundUuid)
        ? prev.sounds.filter(uuid => uuid !== soundUuid)
        : [...prev.sounds, soundUuid]
    }));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Audio Management</h1>
        <p>Manage sounds and playlists for your call system</p>
      </div>

      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'sounds' ? 'active' : ''}`}
            onClick={() => setActiveTab('sounds')}
          >
            Sounds
          </button>
          <button
            className={`tab ${activeTab === 'playlists' ? 'active' : ''}`}
            onClick={() => setActiveTab('playlists')}
          >
            Playlists
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading {activeTab}...</p>
        </div>
      ) : (
        <div className="tab-content">
          {activeTab === 'sounds' && (
            <>
              <div className="upload-section">
                <input
                  type="file"
                  id="audio-upload"
                  accept="audio/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <button 
                  className="btn-primary"
                  onClick={() => document.getElementById('audio-upload')?.click()}
                >
                  Upload Audio Files
                </button>
              </div>
              <div className="sounds-grid">
              {sounds.length > 0 ? (
                sounds.map((sound) => (
                  <div key={sound.uuid} className="sound-card">
                    <div className="sound-header">
                      <h3>{sound.name}</h3>
                      <div className="sound-actions">
                        {sound.shared && <span className="badge badge-shared">Shared</span>}
                        <button 
                          className="delete-btn"
                          onClick={() => handleDeleteSound(sound.uuid, sound.name)}
                          title="Delete sound"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="sound-details">
                      <div className="detail-row">
                        <span className="detail-label">File:</span>
                        <span className="detail-value">{sound.file_name}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Tag:</span>
                        <span className="detail-value">{sound.tag}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Type:</span>
                        <span className="detail-value">{sound.audio_type}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <p>No sounds found</p>
                </div>
              )}
              </div>
            </>
          )}

          {activeTab === 'playlists' && (
            <>
              <div className="upload-section">
                <button 
                  className="btn-primary"
                  onClick={() => setShowNewPlaylistModal(true)}
                >
                  Create New Playlist
                </button>
              </div>
              <div className="playlists-list">
              {playlists.length > 0 ? (
                playlists.map((playlist) => (
                  <div key={playlist.uuid} className="playlist-card">
                    <div className="playlist-header">
                      <h3>{playlist.name}</h3>
                      <div className="playlist-badges">
                        {playlist.default && <span className="badge badge-default">Default</span>}
                        {playlist.random && <span className="badge badge-random">Random</span>}
                      </div>
                    </div>
                    <div className="playlist-details">
                      <div className="detail-row">
                        <span className="detail-label">Total Sounds:</span>
                        <span className="detail-value">{playlist.sounds?.length || 0}</span>
                      </div>
                      {(playlist.sounds?.length || 0) > 0 && (
                        <div className="playlist-sounds">
                          <span className="detail-label">Sounds:</span>
                          <ul className="sounds-list">
                            {playlist.sounds?.map((soundUuid, index) => (
                              <li key={index}>
                                {sounds.length > 0 ? getSoundNameByUuid(soundUuid) : soundUuid}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <p>No playlists found</p>
                </div>
              )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload Audio Files</h2>
              <button className="close-btn" onClick={closeModal} disabled={isUploading}>×</button>
            </div>
            <div className="modal-body">
              <div className="upload-queue">
                {uploadQueue.map((item) => (
                  <div key={item.id} className={`upload-item upload-${item.status}`}>
                    <div className="upload-item-header">
                      <span className="file-name">{item.file.name}</span>
                      {item.status === 'pending' && !isUploading && (
                        <button 
                          className="remove-btn"
                          onClick={() => removeUploadItem(item.id)}
                        >
                          ×
                        </button>
                      )}
                      {item.status === 'uploading' && <span className="status-badge">Uploading...</span>}
                      {item.status === 'success' && <span className="status-badge success">✓ Success</span>}
                      {item.status === 'error' && <span className="status-badge error">✗ Failed</span>}
                    </div>
                    {item.status === 'pending' && (
                      <div className="upload-item-fields">
                        <div className="field-group">
                          <label>Name:</label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateUploadItem(item.id, { name: e.target.value })}
                            disabled={isUploading}
                          />
                        </div>
                        <div className="field-group">
                          <label>Tag:</label>
                          <input
                            type="text"
                            value={item.tag}
                            onChange={(e) => updateUploadItem(item.id, { tag: e.target.value })}
                            disabled={isUploading}
                          />
                        </div>
                        <div className="field-group">
                          <label>Audio Type:</label>
                          <input
                            type="number"
                            value={item.audio_type}
                            onChange={(e) => updateUploadItem(item.id, { audio_type: parseInt(e.target.value) })}
                            disabled={isUploading}
                          />
                        </div>
                      </div>
                    )}
                    {item.status === 'error' && item.error && (
                      <div className="error-text">{item.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={closeModal}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Close'}
              </button>
              <button 
                className="btn-primary" 
                onClick={startUpload}
                disabled={isUploading || uploadQueue.filter(i => i.status === 'pending').length === 0}
              >
                {isUploading ? 'Uploading...' : `Upload ${uploadQueue.filter(i => i.status === 'pending').length} File(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Playlist Modal */}
      {showNewPlaylistModal && (
        <div className="modal-overlay" onClick={() => !loading && setShowNewPlaylistModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Playlist</h2>
              <button className="close-btn" onClick={() => setShowNewPlaylistModal(false)} disabled={loading}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Playlist Name:</label>
                <input
                  type="text"
                  value={newPlaylist.name}
                  onChange={(e) => setNewPlaylist({ ...newPlaylist, name: e.target.value })}
                  className="input-field"
                  placeholder="Enter playlist name"
                  disabled={loading}
                />
              </div>
              
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newPlaylist.random}
                    onChange={(e) => setNewPlaylist({ ...newPlaylist, random: e.target.checked })}
                    disabled={loading}
                  />
                  <span>Random Playback</span>
                </label>
              </div>

              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newPlaylist.default}
                    onChange={(e) => setNewPlaylist({ ...newPlaylist, default: e.target.checked })}
                    disabled={loading}
                  />
                  <span>Set as Default</span>
                </label>
              </div>

              <div className="form-group">
                <label>Select Sounds:</label>
                {sounds.length > 0 && (
                  <input
                    type="text"
                    placeholder="Search sounds..."
                    value={soundSearchTerm}
                    onChange={(e) => setSoundSearchTerm(e.target.value)}
                    className="input-field"
                    style={{ marginBottom: '10px' }}
                    disabled={loading}
                  />
                )}
                <div className="sounds-selection">
                  {sounds.length > 0 ? (
                    sounds
                      .filter(sound => sound.name.toLowerCase().includes(soundSearchTerm.toLowerCase()))
                      .map((sound) => (
                      <div key={sound.uuid} className="sound-checkbox-item">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={newPlaylist.sounds.includes(sound.uuid)}
                            onChange={() => toggleSoundInPlaylist(sound.uuid)}
                            disabled={loading}
                          />
                          <span>{sound.name}</span>
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="no-sounds-message">No sounds available. Upload sounds first.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowNewPlaylistModal(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleCreatePlaylist}
                disabled={loading || !newPlaylist.name.trim()}
              >
                {loading ? 'Creating...' : 'Create Playlist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Audio;
