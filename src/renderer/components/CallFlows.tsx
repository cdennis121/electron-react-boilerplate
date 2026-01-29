import { useState, useEffect } from 'react';
import { initializeApiClient } from '../utils/apiClient';

interface FlowModule {
  module: string;
  next?: string | Record<string, string>;
  extensions?: Array<{ type: string; uuid: string }>;
  timeout?: string;
  [key: string]: any;
}

interface CallFlow {
  name: string;
  extension: number;
  show_call_route_name: boolean;
  show_original_caller_id: boolean;
  flow: Record<string, FlowModule>;
  uuid: string;
}

interface ApiResponse {
  result: CallFlow[];
  status_code: number;
  status_message: string;
}

interface HuntGroup {
  name: string;
  uuid: string;
  extension_number: string;
  members: string[];
}

interface CallQueue {
  name: string;
  uuid: string;
  extension_number?: string;
  members: string[];
  ring_timeout?: number;
  ring_progressively?: number;
  answer_wait?: number;
  no_answer_wait?: number;
  reject_wait?: number;
  max_no_answer?: number;
  strategy?: string;
  duration?: number;
}

interface GroupResponse {
  result: HuntGroup[];
  status_code: number;
  status_message: string;
}

interface QueueResponse {
  result: CallQueue[];
  status_code: number;
  status_message: string;
}

interface Voicemail {
  name: string;
  uuid: string;
  mailbox: string;
}

interface VoicemailResponse {
  result: Voicemail[];
  status_code: number;
  status_message: string;
}

function CallFlows() {
  const [callFlows, setCallFlows] = useState<CallFlow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<CallFlow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [huntGroups, setHuntGroups] = useState<HuntGroup[]>([]);
  const [callQueues, setCallQueues] = useState<CallQueue[]>([]);
  const [voicemails, setVoicemails] = useState<Voicemail[]>([]);

  useEffect(() => {
    fetchCallFlows();
    fetchHuntGroups();
    fetchCallQueues();
    fetchVoicemails();
  }, []);

  const fetchCallFlows = async () => {
    if (!initializeApiClient()) {
      setError('API settings not configured. Please configure in Settings.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await window.electron.api.get<ApiResponse>('/voip/flow');
      
      if (response.status_code === 200 && response.result) {
        setCallFlows(response.result);
      } else {
        setError(`Failed to load call flows: ${response.status_message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error fetching call flows:', err);
      setError(err.message || 'Failed to fetch call flows');
    } finally {
      setLoading(false);
    }
  };

  const fetchHuntGroups = async () => {
    if (!initializeApiClient()) return;
    
    try {
      const response = await window.electron.api.get<GroupResponse>('/voip/group');
      if (response.status_code === 200 && response.result) {
        setHuntGroups(response.result);
      }
    } catch (err: any) {
      console.error('Error fetching hunt groups:', err);
    }
  };

  const fetchCallQueues = async () => {
    if (!initializeApiClient()) return;
    
    try {
      const response = await window.electron.api.get<QueueResponse>('/voip/queue-group');
      if (response.status_code === 200 && response.result) {
        setCallQueues(response.result);
      }
    } catch (err: any) {
      console.error('Error fetching call queues:', err);
    }
  };

  const fetchVoicemails = async () => {
    if (!initializeApiClient()) return;
    
    try {
      const response = await window.electron.api.get<VoicemailResponse>('/voip/mailbox');
      if (response.status_code === 200 && response.result) {
        setVoicemails(response.result);
      }
    } catch (err: any) {
      console.error('Error fetching mailboxes:', err);
    }
  };

  const getGroupName = (uuid: string): string => {
    const huntGroup = huntGroups.find(g => g.uuid === uuid);
    if (huntGroup) return huntGroup.name;
    
    const queue = callQueues.find(q => q.uuid === uuid);
    if (queue) return queue.name;
    
    const voicemail = voicemails.find(v => v.uuid === uuid);
    if (voicemail) return voicemail.name;
    
    return uuid;
  };

  const getQueueDetails = (uuid: string): CallQueue | null => {
    return callQueues.find(q => q.uuid === uuid) || null;
  };

  const handleFlowClick = (flow: CallFlow) => {
    setSelectedFlow(flow);
  };

  const handleBackToList = () => {
    setSelectedFlow(null);
  };

  const filteredFlows = callFlows.filter(flow => {
    // Hide flows with "Ext" in the name
    if (flow.name.includes('Ext')) {
      return false;
    }
    
    const search = searchTerm.toLowerCase();
    return (
      flow.name.toLowerCase().includes(search) ||
      flow.extension.toString().includes(search)
    );
  });

  if (selectedFlow) {
    return (
      <div className="page-container">
        <div className="page-header">
          <button className="btn-back" onClick={handleBackToList}>
            ← Back to Call Flows
          </button>
          <h1>{selectedFlow.name}</h1>
          <p>Extension: {selectedFlow.extension}</p>
        </div>

        <div className="flow-editor">
          <div className="flow-settings">
            <h3>Flow Settings</h3>
            <div className="form-group">
              <label>Flow Name:</label>
              <input
                type="text"
                value={selectedFlow.name}
                className="input-field"
                readOnly
              />
            </div>
            <div className="form-group">
              <label>Extension:</label>
              <input
                type="number"
                value={selectedFlow.extension}
                className="input-field"
                readOnly
              />
            </div>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedFlow.show_call_route_name}
                  readOnly
                />
                <span>Show Call Route Name</span>
              </label>
            </div>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedFlow.show_original_caller_id}
                  readOnly
                />
                <span>Show Original Caller ID</span>
              </label>
            </div>
          </div>

          <div className="flow-modules-section">
            <h3>Flow Modules</h3>
            <div className="modules-timeline">
              {Object.entries(selectedFlow.flow).map(([key, module], index) => (
                <div key={key} className="module-timeline-item">
                  <div className="module-timeline-number">{index + 1}</div>
                  <div className="module-timeline-content">
                    <div className="module-timeline-header">
                      <span className="module-timeline-type">{module.module}</span>
                      <span className="module-timeline-id">{key}</span>
                    </div>
                    <div className="module-timeline-details">
                      {Object.entries(module).map(([propKey, propValue]) => {
                        if (propKey === 'module') return null;
                        
                        let displayValue: string;
                        
                        if (propKey === 'groups' && Array.isArray(propValue)) {
                          displayValue = propValue.map(uuid => getGroupName(uuid)).join(', ');
                        } else if (typeof propValue === 'object' && propValue !== null) {
                          // Handle objects (like next with multiple keys)
                          if (typeof propValue === 'object' && !Array.isArray(propValue)) {
                            const resolved: any = {};
                            for (const [k, v] of Object.entries(propValue)) {
                              if (typeof v === 'string' && v.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
                                resolved[k] = getGroupName(v);
                              } else {
                                resolved[k] = v;
                              }
                            }
                            displayValue = JSON.stringify(resolved, null, 2);
                          } else {
                            displayValue = JSON.stringify(propValue);
                          }
                        } else if (typeof propValue === 'string' && propValue.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
                          // If it looks like a UUID, try to resolve it
                          displayValue = getGroupName(propValue);
                        } else {
                          displayValue = String(propValue);
                        }
                        
                        return (
                          <div key={propKey} className="module-property">
                            <span className="property-key">{propKey}:</span>
                            <span className="property-value">{displayValue}</span>
                          </div>
                        );
                      })}
                      
                      {/* Show queue details if this module places calls into a queue */}
                      {module.module === 'place_call_into_queue' && module.queue && (
                        (() => {
                          const queueDetails = getQueueDetails(module.queue as string);
                          if (queueDetails) {
                            return (
                              <div className="queue-details-section">
                                <div className="queue-details-header">Queue Settings:</div>
                                <div className="queue-details-grid">
                                  <div className="queue-detail-item">
                                    <span className="property-key">Strategy:</span>
                                    <span className="property-value">{queueDetails.strategy || 'N/A'}</span>
                                  </div>
                                  <div className="queue-detail-item">
                                    <span className="property-key">Ring Timeout:</span>
                                    <span className="property-value">{queueDetails.ring_timeout || 'N/A'}s</span>
                                  </div>
                                  <div className="queue-detail-item">
                                    <span className="property-key">Ring Progressively:</span>
                                    <span className="property-value">{queueDetails.ring_progressively || 'N/A'}s</span>
                                  </div>
                                  <div className="queue-detail-item">
                                    <span className="property-key">Answer Wait:</span>
                                    <span className="property-value">{queueDetails.answer_wait || 'N/A'}s</span>
                                  </div>
                                  <div className="queue-detail-item">
                                    <span className="property-key">No Answer Wait:</span>
                                    <span className="property-value">{queueDetails.no_answer_wait || 'N/A'}s</span>
                                  </div>
                                  <div className="queue-detail-item">
                                    <span className="property-key">Reject Wait:</span>
                                    <span className="property-value">{queueDetails.reject_wait || 'N/A'}s</span>
                                  </div>
                                  <div className="queue-detail-item">
                                    <span className="property-key">Max No Answer:</span>
                                    <span className="property-value">{queueDetails.max_no_answer || 'N/A'}s</span>
                                  </div>
                                  <div className="queue-detail-item">
                                    <span className="property-key">Duration:</span>
                                    <span className="property-value">{queueDetails.duration || 'N/A'}s</span>
                                  </div>
                                  <div className="queue-detail-item">
                                    <span className="property-key">Members:</span>
                                    <span className="property-value">{queueDetails.members?.length || 0}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Call Flows</h1>
        <p>Select a call flow to view and edit</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="filters-container">
        <input
          type="text"
          placeholder="Search by name or extension..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-box"
        />
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading call flows...</p>
        </div>
      ) : (
        <div className="flows-list">
          {filteredFlows.length > 0 ? (
            filteredFlows.map((flow) => (
              <div 
                key={flow.uuid} 
                className="flow-list-item"
                onClick={() => handleFlowClick(flow)}
              >
                <div className="flow-list-name">{flow.name}</div>
                <div className="flow-list-meta">
                  <span className="extension-badge">Ext {flow.extension}</span>
                  <span className="arrow">→</span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <p>{searchTerm ? 'No call flows found matching your search' : 'No call flows found'}</p>
            </div>
          )}
        </div>
      )}

      {!loading && filteredFlows.length > 0 && (
        <div className="results-info">
          Showing {filteredFlows.length} of {callFlows.length} call flows
        </div>
      )}
    </div>
  );
}

export default CallFlows;
