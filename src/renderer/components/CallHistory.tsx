import { useState, useEffect } from 'react';
import { initializeApiClient } from '../utils/apiClient';
import { getAppFeatures } from '../utils/storage';

interface CallRecord {
  uuid: string;
  call_start_time: number;
  call_duration: number;
  status?: string;
  disposition?: string;
  call_type: string;
  answered: boolean;
  has_recording: boolean;
  parent_uuid?: string;
  child_uuid?: string;
  next_leg?: any;
  cost: number;
  from?: {
    number: string;
    nickname?: string;
  };
  to?: {
    number: string;
    nickname?: string;
  };
}

interface ApiResponse {
  result: CallRecord[];
  status_code: number;
  status_message: string;
}

function CallHistory() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAnswered, setFilterAnswered] = useState('all');
  const [downloadEnabled, setDownloadEnabled] = useState(false);

  useEffect(() => {
    // Load feature settings
    const features = getAppFeatures();
    setDownloadEnabled(features.enableCallRecordingDownload);
    
    fetchCallHistory();
  }, []);

  const fetchCallHistory = async () => {
    // Initialize API client with saved settings
    if (!initializeApiClient()) {
      setError('API settings not configured. Please configure in Settings.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Calculate start and end times (last 48 hours)
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (48 * 60 * 60 * 1000)); // 48 hours ago
      
      // Format as 2015-01-31T09:00:00Z (ISO 8601 without milliseconds)
      const startTime = startDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
      const endTime = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');

      const response = await window.electron.api.get<ApiResponse>(
        `/voip/call?start=${encodeURIComponent(startTime)}&end=${encodeURIComponent(endTime)}&limit=1000`
      );
      
      if (response.status_code === 200 && response.result) {
        setCalls(response.result);
      } else {
        setError(`Failed to load call history: ${response.status_message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error fetching call history:', err);
      setError(err.message || 'Failed to fetch call history');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const filteredCalls = calls.filter(call => {
    // Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      call.from?.number?.toLowerCase().includes(searchLower) ||
      call.to?.number?.toLowerCase().includes(searchLower) ||
      call.from?.nickname?.toLowerCase().includes(searchLower) ||
      call.to?.nickname?.toLowerCase().includes(searchLower);

    // Type filter
    const matchesType = filterType === 'all' || call.call_type?.toLowerCase() === filterType.toLowerCase();

    // Status filter
    const callStatus = (call.status || call.disposition)?.toLowerCase();
    const matchesStatus = filterStatus === 'all' || callStatus === filterStatus.toLowerCase();

    // Answered filter
    const matchesAnswered = filterAnswered === 'all' || 
      (filterAnswered === 'answered' && call.answered) ||
      (filterAnswered === 'unanswered' && !call.answered);

    return matchesSearch && matchesType && matchesStatus && matchesAnswered;
  });

  const handleDownloadRecording = async (callUuid: string) => {
    try {
      const response = await window.electron.api.get<{ result: { recording: string }; status_code: number; status_message: string }>(
        `/voip/call/${callUuid}/audio`
      );
      
      if (response.status_code === 200 && response.result?.recording) {
        // Use Electron's download functionality
        await window.electron.api.downloadFile(
          response.result.recording,
          `recording-${callUuid}.mp3`
        );
      } else {
        setError(`Failed to get recording URL: ${response.status_message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error downloading recording:', err);
      setError(err.message || 'Failed to download recording');
    }
  };

  return (
    <div className="content-page">
      <h1>Call History</h1>
      <p>View call history from the last 48 hours.</p>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="filters-container">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by number or extension..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
          />
        </div>
        <div className="filter-controls">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="dropdown">
            <option value="all">All Types</option>
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
            <option value="internal">Internal</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="dropdown">
            <option value="all">All Status</option>
            <option value="answered">Answered</option>
            <option value="busy">Busy</option>
            <option value="no_answer">No Answer</option>
            <option value="failed">Failed</option>
          </select>
          <select value={filterAnswered} onChange={(e) => setFilterAnswered(e.target.value)} className="dropdown">
            <option value="all">All Calls</option>
            <option value="answered">Answered Only</option>
            <option value="unanswered">Unanswered Only</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p>Loading call history...</p>
      ) : (
        <>
          <div className="results-count">
            Showing {filteredCalls.length} of {calls.length} calls
          </div>
          <div className="table-container">
            <table className="call-history-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Duration</th>
                  <th>Number</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Answered</th>
                  <th>Recording</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalls.length > 0 ? (
                  filteredCalls.map((call) => (
                  <tr key={call.uuid}>
                    <td>{formatDateTime(call.call_start_time)}</td>
                    <td>{formatDuration(call.call_duration)}</td>
                    <td>
                      {call.call_type?.toLowerCase() === 'outbound' 
                        ? `Ext ${call.from?.number || '?'} → ${call.to?.number || 'N/A'}`
                        : call.from?.number || 'N/A'
                      }
                    </td>
                    <td>
                      <span className={`badge badge-${call.call_type?.toLowerCase() || 'unknown'}`}>
                        {call.call_type || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${(call.status || call.disposition)?.toLowerCase() || 'unknown'}`}>
                        {call.status || call.disposition || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className={call.answered ? 'status-yes' : 'status-no'}>
                        {call.answered ? '✓' : '✗'}
                      </span>
                    </td>
                    <td>
                      {call.has_recording ? (
                        downloadEnabled ? (
                          <button 
                            className="download-icon-btn"
                            onClick={() => handleDownloadRecording(call.uuid)}
                            title="Download Recording"
                          >
                            ⬇
                          </button>
                        ) : (
                          <span className="status-yes">✓</span>
                        )
                      ) : (
                        <span className="status-no">✗</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center' }}>
                    {searchTerm || filterType !== 'all' || filterStatus !== 'all' || filterAnswered !== 'all'
                      ? 'No calls match your filters.'
                      : 'No call history available for the last 48 hours.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

export default CallHistory;
