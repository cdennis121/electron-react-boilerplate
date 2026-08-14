import { useState, useEffect, useMemo, useRef } from 'react';
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

type DownloadStatus = 'queued' | 'downloading' | 'completed' | 'failed';

interface DownloadQueueItem {
  uuid: string;
  filename: string;
  label: string;
  status: DownloadStatus;
  error?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

const toDateTimeLocal = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const getDefaultRange = () => {
  const end = new Date();
  const start = new Date(end.getTime() - 48 * 60 * 60 * 1000);
  return { start: toDateTimeLocal(start), end: toDateTimeLocal(end) };
};

const toApiTime = (dateTimeLocal: string): string =>
  new Date(dateTimeLocal).toISOString().replace(/\.\d{3}Z$/, 'Z');

const buildFilename = (call: CallRecord): string => {
  const date = new Date(call.call_start_time);
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const from = (call.from?.number || 'unknown').replace(/[^\w+]/g, '');
  return `recording_${from}_${ymd}_${call.uuid.slice(0, 8)}.mp3`;
};

const callLabel = (call: CallRecord): string => {
  const from = call.from?.number || 'Unknown';
  const to = call.to?.number || 'N/A';
  return `${from} → ${to}`;
};

function CallHistory() {
  const defaults = getDefaultRange();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [startDateTime, setStartDateTime] = useState(defaults.start);
  const [endDateTime, setEndDateTime] = useState(defaults.end);
  const [appliedRange, setAppliedRange] = useState({ start: defaults.start, end: defaults.end });
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAnswered, setFilterAnswered] = useState('all');
  const [features, setFeatures] = useState(getAppFeatures());
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set());
  const [downloadQueue, setDownloadQueue] = useState<DownloadQueueItem[]>([]);

  const mountedRef = useRef(true);
  const downloadQueueRef = useRef<DownloadQueueItem[]>([]);
  const processingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    const loadedFeatures = getAppFeatures();
    setFeatures(loadedFeatures);

    if (initializeApiClient()) {
      fetchCallHistory(defaults.start, defaults.end);
    } else {
      setError('API settings not configured. Please configure in Settings.');
    }

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCallHistory = async (startOverride?: string, endOverride?: string) => {
    const startVal = startOverride ?? startDateTime;
    const endVal = endOverride ?? endDateTime;

    if (!startVal || !endVal) {
      setError('Please choose both a start and end date.');
      return;
    }

    const startDate = new Date(startVal);
    const endDate = new Date(endVal);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setError('Invalid date range.');
      return;
    }
    if (startDate >= endDate) {
      setError('Start date must be before end date.');
      return;
    }

    setLoading(true);
    setError('');
    setSelectedUuids(new Set());

    try {
      const startTime = toApiTime(startVal);
      const endTime = toApiTime(endVal);

      const response = await window.electron.api.get<ApiResponse>(
        `/voip/call?start=${encodeURIComponent(startTime)}&end=${encodeURIComponent(endTime)}&limit=1000`
      );

      if (response.status_code === 200 && response.result) {
        if (mountedRef.current) {
          setCalls(response.result);
          setAppliedRange({ start: startVal, end: endVal });
        }
      } else if (mountedRef.current) {
        setError(`Failed to load call history: ${response.status_message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error fetching call history:', err);
      if (mountedRef.current) {
        setError(err.message || 'Failed to fetch call history');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const applyPreset = (hours: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    const startVal = toDateTimeLocal(start);
    const endVal = toDateTimeLocal(end);
    setStartDateTime(startVal);
    setEndDateTime(endVal);
    fetchCallHistory(startVal, endVal);
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

  const uniqueFromNumbers = useMemo(() => {
    const values = new Set<string>();
    calls.forEach((call) => {
      if (call.from?.number) values.add(call.from.number);
      if (call.from?.nickname) values.add(call.from.nickname);
    });
    return Array.from(values).sort();
  }, [calls]);

  const filteredCalls = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const fromLower = filterFrom.toLowerCase();

    return calls.filter((call) => {
      const matchesSearch =
        !searchTerm ||
        call.from?.number?.toLowerCase().includes(searchLower) ||
        call.to?.number?.toLowerCase().includes(searchLower) ||
        call.from?.nickname?.toLowerCase().includes(searchLower) ||
        call.to?.nickname?.toLowerCase().includes(searchLower);

      const matchesFrom =
        !filterFrom ||
        call.from?.number?.toLowerCase().includes(fromLower) ||
        call.from?.nickname?.toLowerCase().includes(fromLower);

      const matchesType =
        filterType === 'all' || call.call_type?.toLowerCase() === filterType.toLowerCase();

      const callStatus = (call.status || call.disposition)?.toLowerCase();
      const matchesStatus = filterStatus === 'all' || callStatus === filterStatus.toLowerCase();

      const matchesAnswered =
        filterAnswered === 'all' ||
        (filterAnswered === 'answered' && call.answered) ||
        (filterAnswered === 'unanswered' && !call.answered);

      return matchesSearch && matchesFrom && matchesType && matchesStatus && matchesAnswered;
    });
  }, [calls, searchTerm, filterFrom, filterType, filterStatus, filterAnswered]);

  const downloadableCalls = useMemo(
    () => filteredCalls.filter((call) => call.has_recording),
    [filteredCalls]
  );

  const selectedDownloadable = useMemo(
    () => downloadableCalls.filter((call) => selectedUuids.has(call.uuid)),
    [downloadableCalls, selectedUuids]
  );

  const allDownloadableSelected =
    downloadableCalls.length > 0 && selectedDownloadable.length === downloadableCalls.length;

  const queueStatusByUuid = useMemo(() => {
    const map = new Map<string, DownloadStatus>();
    downloadQueue.forEach((item) => {
      if (!map.has(item.uuid) || item.status === 'downloading' || item.status === 'queued') {
        map.set(item.uuid, item.status);
      }
    });
    return map;
  }, [downloadQueue]);

  const updateQueueItem = (uuid: string, patch: Partial<DownloadQueueItem>) => {
    downloadQueueRef.current = downloadQueueRef.current.map((item) =>
      item.uuid === uuid ? { ...item, ...patch } : item
    );
    setDownloadQueue([...downloadQueueRef.current]);
  };

  const processQueue = async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      while (mountedRef.current) {
        const next = downloadQueueRef.current.find((item) => item.status === 'queued');
        if (!next) break;

        updateQueueItem(next.uuid, { status: 'downloading', error: undefined });

        try {
          const response = await window.electron.api.get<{
            result: { recording: string };
            status_code: number;
            status_message: string;
          }>(`/voip/call/${next.uuid}/audio`);

          if (response.status_code === 200 && response.result?.recording) {
            await window.electron.api.downloadFile(response.result.recording, next.filename);
            updateQueueItem(next.uuid, { status: 'completed' });
          } else {
            updateQueueItem(next.uuid, {
              status: 'failed',
              error: response.status_message || 'Failed to get recording URL',
            });
          }
        } catch (err: any) {
          console.error('Error downloading recording:', err);
          updateQueueItem(next.uuid, {
            status: 'failed',
            error: err.message || 'Failed to download recording',
          });
        }
      }
    } finally {
      processingRef.current = false;
      if (
        mountedRef.current &&
        downloadQueueRef.current.some((item) => item.status === 'queued')
      ) {
        processQueue();
      }
    }
  };

  const enqueueDownloads = (callsToDownload: CallRecord[]) => {
    if (callsToDownload.length === 0) return;

    const active = new Set(
      downloadQueueRef.current
        .filter((item) => item.status === 'queued' || item.status === 'downloading')
        .map((item) => item.uuid)
    );

    const newItems: DownloadQueueItem[] = [];
    callsToDownload.forEach((call) => {
      if (active.has(call.uuid)) return;

      downloadQueueRef.current = downloadQueueRef.current.filter(
        (item) =>
          !(item.uuid === call.uuid && (item.status === 'completed' || item.status === 'failed'))
      );

      newItems.push({
        uuid: call.uuid,
        filename: buildFilename(call),
        label: `${callLabel(call)} · ${formatDateTime(call.call_start_time)}`,
        status: 'queued',
      });
      active.add(call.uuid);
    });

    if (newItems.length === 0) return;

    downloadQueueRef.current = [...downloadQueueRef.current, ...newItems];
    setDownloadQueue([...downloadQueueRef.current]);
    setSelectedUuids(new Set());
    processQueue();
  };

  const toggleSelected = (uuid: string) => {
    setSelectedUuids((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allDownloadableSelected) {
      setSelectedUuids(new Set());
      return;
    }
    setSelectedUuids(new Set(downloadableCalls.map((call) => call.uuid)));
  };

  const retryFailedDownloads = () => {
    downloadQueueRef.current = downloadQueueRef.current.map((item) =>
      item.status === 'failed' ? { ...item, status: 'queued', error: undefined } : item
    );
    setDownloadQueue([...downloadQueueRef.current]);
    processQueue();
  };

  const clearFinishedDownloads = () => {
    downloadQueueRef.current = downloadQueueRef.current.filter(
      (item) => item.status === 'queued' || item.status === 'downloading'
    );
    setDownloadQueue([...downloadQueueRef.current]);
  };

  const queuedCount = downloadQueue.filter((item) => item.status === 'queued').length;
  const downloadingCount = downloadQueue.filter((item) => item.status === 'downloading').length;
  const completedCount = downloadQueue.filter((item) => item.status === 'completed').length;
  const failedCount = downloadQueue.filter((item) => item.status === 'failed').length;
  const showCheckboxColumn = features.enableCallRecordingDownload;
  const columnCount = 7 + (features.showCallCost ? 1 : 0) + (showCheckboxColumn ? 1 : 0);
  const hasActiveFilters =
    searchTerm ||
    filterFrom ||
    filterType !== 'all' ||
    filterStatus !== 'all' ||
    filterAnswered !== 'all';

  const formatRangeLabel = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  };

  return (
    <div className="content-page">
      <h1>Call History</h1>
      <p>
        Showing calls from {formatRangeLabel(appliedRange.start)} to{' '}
        {formatRangeLabel(appliedRange.end)} (up to 1000 results).
      </p>

      {error && <div className="error-message">{error}</div>}

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

        <div className="filter-controls date-range-filters">
          <div className="filter-field">
            <label htmlFor="call-from-filter">Call From</label>
            <input
              id="call-from-filter"
              type="text"
              list="call-from-options"
              placeholder="Number or name..."
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="input-field"
            />
            <datalist id="call-from-options">
              {uniqueFromNumbers.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </div>
          <div className="filter-field">
            <label htmlFor="start-datetime">Start</label>
            <input
              id="start-datetime"
              type="datetime-local"
              value={startDateTime}
              onChange={(e) => setStartDateTime(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="filter-field">
            <label htmlFor="end-datetime">End</label>
            <input
              id="end-datetime"
              type="datetime-local"
              value={endDateTime}
              onChange={(e) => setEndDateTime(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="filter-field filter-field-actions">
            <label>&nbsp;</label>
            <button type="button" className="btn-primary" onClick={() => fetchCallHistory()}>
              Apply Range
            </button>
          </div>
        </div>

        <div className="date-presets">
          <button type="button" className="preset-btn" onClick={() => applyPreset(24)}>
            Last 24 hours
          </button>
          <button type="button" className="preset-btn" onClick={() => applyPreset(48)}>
            Last 48 hours
          </button>
          <button type="button" className="preset-btn" onClick={() => applyPreset(24 * 7)}>
            Last 7 days
          </button>
          <button type="button" className="preset-btn" onClick={() => applyPreset(24 * 30)}>
            Last 30 days
          </button>
        </div>

        {features.enableAdvancedFilters && (
          <div className="filter-controls">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="dropdown"
            >
              <option value="all">All Types</option>
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
              <option value="internal">Internal</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="dropdown"
            >
              <option value="all">All Status</option>
              <option value="answered">Answered</option>
              <option value="busy">Busy</option>
              <option value="no_answer">No Answer</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={filterAnswered}
              onChange={(e) => setFilterAnswered(e.target.value)}
              className="dropdown"
            >
              <option value="all">All Calls</option>
              <option value="answered">Answered Only</option>
              <option value="unanswered">Unanswered Only</option>
            </select>
          </div>
        )}

        {showCheckboxColumn && (
          <div className="download-toolbar">
            <button
              type="button"
              className="btn-primary"
              onClick={() => enqueueDownloads(selectedDownloadable)}
              disabled={selectedDownloadable.length === 0}
            >
              Download selected ({selectedDownloadable.length})
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => enqueueDownloads(downloadableCalls)}
              disabled={downloadableCalls.length === 0}
            >
              Queue all recordings ({downloadableCalls.length})
            </button>
          </div>
        )}
      </div>

      {downloadQueue.length > 0 && (
        <div className="download-queue-panel">
          <div className="download-queue-header">
            <h3>Download Queue</h3>
            <span className="download-queue-summary">
              {completedCount} completed
              {queuedCount > 0 ? ` · ${queuedCount} queued` : ''}
              {downloadingCount > 0 ? ` · ${downloadingCount} downloading` : ''}
              {failedCount > 0 ? ` · ${failedCount} failed` : ''}
            </span>
            <div className="download-queue-actions">
              {failedCount > 0 && (
                <button type="button" className="preset-btn" onClick={retryFailedDownloads}>
                  Retry failed
                </button>
              )}
              <button type="button" className="preset-btn" onClick={clearFinishedDownloads}>
                Clear finished
              </button>
            </div>
          </div>
          <div className="download-queue-progress">
            <div
              className="download-queue-progress-bar"
              style={{
                width: `${downloadQueue.length ? (completedCount / downloadQueue.length) * 100 : 0}%`,
              }}
            />
          </div>
          <ul className="download-queue-list">
            {downloadQueue.map((item) => (
              <li key={`${item.uuid}-${item.filename}`} className={`queue-item status-${item.status}`}>
                <span className="queue-item-label">{item.label}</span>
                <span className={`queue-item-status badge badge-queue-${item.status}`}>
                  {item.status === 'downloading'
                    ? 'Downloading'
                    : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </span>
                {item.error && <span className="queue-item-error">{item.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p>Loading call history...</p>
      ) : (
        <>
          <div className="results-count">
            Showing {filteredCalls.length} of {calls.length} calls
            {downloadableCalls.length > 0 ? ` · ${downloadableCalls.length} with recordings` : ''}
          </div>
          <div className="table-container">
            <table className="call-history-table">
              <thead>
                <tr>
                  {showCheckboxColumn && (
                    <th className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={allDownloadableSelected}
                        onChange={toggleSelectAll}
                        disabled={downloadableCalls.length === 0}
                        title="Select all recordings"
                        aria-label="Select all recordings"
                      />
                    </th>
                  )}
                  <th>Date & Time</th>
                  <th>Duration</th>
                  <th>Number</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Answered</th>
                  {features.showCallCost && <th>Cost</th>}
                  <th>Recording</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalls.length > 0 ? (
                  filteredCalls.map((call) => {
                    const queueStatus = queueStatusByUuid.get(call.uuid);
                    const isBusy = queueStatus === 'queued' || queueStatus === 'downloading';
                    return (
                      <tr
                        key={call.uuid}
                        className={selectedUuids.has(call.uuid) ? 'row-selected' : ''}
                      >
                        {showCheckboxColumn && (
                          <td className="checkbox-col">
                            {call.has_recording ? (
                              <input
                                type="checkbox"
                                checked={selectedUuids.has(call.uuid)}
                                onChange={() => toggleSelected(call.uuid)}
                                aria-label={`Select recording ${call.uuid}`}
                              />
                            ) : null}
                          </td>
                        )}
                        <td>{formatDateTime(call.call_start_time)}</td>
                        <td>{formatDuration(call.call_duration)}</td>
                        <td>
                          {call.call_type?.toLowerCase() === 'outbound'
                            ? `Ext ${call.from?.number || '?'} → ${call.to?.number || 'N/A'}`
                            : call.from?.number || 'N/A'}
                        </td>
                        <td>
                          <span className={`badge badge-${call.call_type?.toLowerCase() || 'unknown'}`}>
                            {call.call_type || 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge badge-${(call.status || call.disposition)?.toLowerCase() || 'unknown'}`}
                          >
                            {call.status || call.disposition || 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span className={call.answered ? 'status-yes' : 'status-no'}>
                            {call.answered ? '✓' : '✗'}
                          </span>
                        </td>
                        {features.showCallCost && <td>${call.cost.toFixed(2)}</td>}
                        <td>
                          {call.has_recording ? (
                            features.enableCallRecordingDownload ? (
                              <button
                                type="button"
                                className="download-icon-btn"
                                onClick={() => enqueueDownloads([call])}
                                disabled={isBusy}
                                title={
                                  queueStatus === 'downloading'
                                    ? 'Downloading...'
                                    : queueStatus === 'queued'
                                      ? 'Queued'
                                      : 'Add to download queue'
                                }
                              >
                                {queueStatus === 'downloading'
                                  ? '…'
                                  : queueStatus === 'queued'
                                    ? '◷'
                                    : '⬇'}
                              </button>
                            ) : (
                              <span className="status-yes">✓</span>
                            )
                          ) : (
                            <span className="status-no">✗</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={columnCount} style={{ textAlign: 'center' }}>
                      {hasActiveFilters
                        ? 'No calls match your filters.'
                        : 'No call history available for the selected date range.'}
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
