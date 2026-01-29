import { useState, useEffect } from 'react';
import { initializeApiClient } from '../utils/apiClient';

interface CallQueue {
  uuid: string;
  name: string;
  ring_timeout: number;
  ring_progressively: number;
  answer_wait: number;
  no_answer_wait: number;
  reject_wait: number;
  max_no_answer: number;
  strategy: string;
  duration: number;
  members: string[];
}

interface ApiResponse {
  result: CallQueue[];
  status_code: number;
  status_message: string;
}

function CallQueues() {
  const [callQueues, setCallQueues] = useState<CallQueue[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // Form fields
  const [name, setName] = useState('');
  const [ringTimeout, setRingTimeout] = useState(15);
  const [ringProgressively, setRingProgressively] = useState(15);
  const [answerWait, setAnswerWait] = useState(60);
  const [noAnswerWait, setNoAnswerWait] = useState(60);
  const [rejectWait, setRejectWait] = useState(60);
  const [maxNoAnswer, setMaxNoAnswer] = useState(60);
  const [strategy, setStrategy] = useState('ringall');
  const [duration, setDuration] = useState(15);

  useEffect(() => {
    const fetchCallQueues = async () => {
      // Initialize API client with saved settings
      if (!initializeApiClient()) {
        setError('API settings not configured. Please configure in Settings.');
        return;
      }

      setLoading(true);
      setError('');
      
      try {
        const response = await window.electron.api.get<ApiResponse>('/voip/queue-group');
        
        if (response.status_code === 200 && response.result) {
          setCallQueues(response.result);
        } else {
          setError(`Failed to load call queues: ${response.status_message || 'Unknown error'}`);
        }
      } catch (err: any) {
        console.error('Error fetching call queues:', err);
        setError(err.message || 'Failed to fetch call queues');
      } finally {
        setLoading(false);
      }
    };

    fetchCallQueues();
  }, []);

  const handleQueueChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const queueUuid = event.target.value;
    setSelectedQueue(queueUuid);
    
    if (queueUuid) {
      const queue = callQueues.find(q => q.uuid === queueUuid);
      if (queue) {
        // Populate form with selected queue data
        setName(queue.name);
        setRingTimeout(queue.ring_timeout);
        setRingProgressively(queue.ring_progressively);
        setAnswerWait(queue.answer_wait);
        setNoAnswerWait(queue.no_answer_wait);
        setRejectWait(queue.reject_wait);
        setMaxNoAnswer(queue.max_no_answer);
        setStrategy(queue.strategy);
        setDuration(queue.duration);
      }
    }
    setSuccess('');
    setError('');
  };

  const handleSave = async () => {
    if (!selectedQueue) return;
    
    const queue = callQueues.find(q => q.uuid === selectedQueue);
    if (!queue) return;
    
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      // Prepare the updated queue data with ALL required fields
      const updatedQueue = {
        name,
        ring_timeout: ringTimeout,
        ring_progressively: ringProgressively,
        answer_wait: answerWait,
        no_answer_wait: noAnswerWait,
        reject_wait: rejectWait,
        max_no_answer: maxNoAnswer,
        strategy,
        duration,
        members: queue.members, // Keep existing members
      };
      
      // Make PUT request to update the queue
      const response = await window.electron.api.put<ApiResponse>(
        `/voip/queue-group/${selectedQueue}`,
        updatedQueue
      );
      
      if (response.status_code === 200) {
        // Update local state
        setCallQueues(prevQueues =>
          prevQueues.map(q =>
            q.uuid === selectedQueue
              ? { ...q, ...updatedQueue }
              : q
          )
        );
        setSuccess('Queue settings saved successfully!');
      } else {
        setError(`Failed to update queue: ${response.status_message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error updating queue:', err);
      setError(err.message || 'Failed to update queue settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="content-page">
      <h1>Call Queues</h1>
      <p>Manage your call queue settings here. User membership is managed via Hunt Groups.</p>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {success && (
        <div className="success-message">
          {success}
        </div>
      )}
      
      <div className="form-group">
        <label htmlFor="callQueueSelect">Select Call Queue:</label>
        <select
          id="callQueueSelect"
          value={selectedQueue}
          onChange={handleQueueChange}
          className="dropdown"
        >
          <option value="">
            {loading ? 'Loading...' : '-- Select a Call Queue --'}
          </option>
          {callQueues.map((queue) => (
            <option key={queue.uuid} value={queue.uuid}>
              {queue.name} (Strategy: {queue.strategy})
            </option>
          ))}
        </select>
      </div>

      {selectedQueue && (
        <div className="queue-settings">
          <h2>Queue Group Details</h2>
          
          <div className="form-group">
            <label htmlFor="name">Queue Group Nickname:</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="strategy">Member Ring Order:</label>
            <select
              id="strategy"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="dropdown"
            >
              <option value="ringall">Ring all</option>
              <option value="roundrobin">Round Robin</option>
              <option value="leastrecent">Least Recent</option>
              <option value="fewestcalls">Fewest Calls</option>
              <option value="random">Random</option>
              <option value="rrmemory">Round Robin Memory</option>
            </select>
          </div>

          <h3>Queue Group Rules</h3>

          <h4>If Call in Queue Un-Answered by Member</h4>
          <div className="form-group">
            <label htmlFor="ringTimeout">Timeout Before Moving to Next Member (Seconds):</label>
            <input
              type="number"
              id="ringTimeout"
              value={ringTimeout}
              onChange={(e) => setRingTimeout(Number(e.target.value))}
              className="input-field"
              min="0"
            />
          </div>

          <div className="form-group">
            <label htmlFor="ringProgressively">Keep Ringing Previous Member? (Seconds):</label>
            <input
              type="number"
              id="ringProgressively"
              value={ringProgressively}
              onChange={(e) => setRingProgressively(Number(e.target.value))}
              className="input-field"
              min="0"
            />
          </div>

          <div className="form-group">
            <label htmlFor="noAnswerWait">Time Before Ringing This Member Again (Seconds):</label>
            <input
              type="number"
              id="noAnswerWait"
              value={noAnswerWait}
              onChange={(e) => setNoAnswerWait(Number(e.target.value))}
              className="input-field"
              min="0"
            />
          </div>

          <h4>If Call in Queue is Rejected by Member</h4>
          <div className="form-group">
            <label htmlFor="rejectWait">Time Before Ringing This Member Again (Seconds):</label>
            <input
              type="number"
              id="rejectWait"
              value={rejectWait}
              onChange={(e) => setRejectWait(Number(e.target.value))}
              className="input-field"
              min="0"
            />
          </div>

          <h4>When Call is Finished by Member (Wrap up time)</h4>
          <div className="form-group">
            <label htmlFor="duration">Time Before Ringing This Member Again (Seconds):</label>
            <input
              type="number"
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="input-field"
              min="0"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="answerWait">Answer Wait (Seconds):</label>
              <input
                type="number"
                id="answerWait"
                value={answerWait}
                onChange={(e) => setAnswerWait(Number(e.target.value))}
                className="input-field"
                min="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="maxNoAnswer">Max No Answer:</label>
              <input
                type="number"
                id="maxNoAnswer"
                value={maxNoAnswer}
                onChange={(e) => setMaxNoAnswer(Number(e.target.value))}
                className="input-field"
                min="0"
              />
            </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={saving}
            className="save-button"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
      
      {saving && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
}

export default CallQueues;
