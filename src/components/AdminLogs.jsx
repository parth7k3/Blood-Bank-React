import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';

const AdminLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Default to today's date
  const todayStr = new Date().toISOString().substring(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    fetchLogs(selectedDate);
  }, [selectedDate]);

  const fetchLogs = async (date) => {
    try {
      setLoading(true);
      const data = await api.getLogs(date);
      setLogs(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load system logs');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const groupedLogs = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    
    // Group by username and action
    const groupsMap = {};
    const result = [];
    
    logs.forEach(log => {
      const key = `${log.username}-${log.action}`;
      if (!groupsMap[key]) {
        groupsMap[key] = {
          id: key,
          username: log.username,
          action: log.action,
          timestamp: log.timestamp, // latest timestamp (assuming DESC order)
          items: []
        };
        result.push(groupsMap[key]);
      }
      groupsMap[key].items.push(log);
    });
    
    return result;
  }, [logs]);

  const getActionBadgeStyle = (action) => {
    switch (action) {
      case 'LOGIN': return { background: '#2563eb', color: '#fff' };
      case 'ADD_DONOR':
      case 'ADD_CAMP': return { background: '#16a34a', color: '#fff' };
      case 'UPDATE_DONOR':
      case 'UPDATE_CAMP': return { background: '#d97706', color: '#fff' };
      case 'DELETE_DONOR':
      case 'DELETE_CAMP':
      case 'RESET_DB': return { background: '#dc2626', color: '#fff' };
      case 'BULK_IMPORT': return { background: '#9333ea', color: '#fff' };
      default: return { background: '#475569', color: '#fff' };
    }
  };

  const formatActionMessage = (action, username, count) => {
    const name = username;
    switch(action) {
      case 'ADD_DONOR': return `${name} inputed ${count} donor${count > 1 ? 's' : ''}`;
      case 'UPDATE_DONOR': return `${name} edited ${count} donor record${count > 1 ? 's' : ''}`;
      case 'DELETE_DONOR': return `${name} deleted ${count} donor record${count > 1 ? 's' : ''}`;
      case 'LOGIN': return `${name} logged in ${count} time${count > 1 ? 's' : ''}`;
      default: return `${name} performed ${action} ${count} time${count > 1 ? 's' : ''}`;
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>System Audit Logs</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="date" 
            className="input-field" 
            style={{ width: 'auto' }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button className="btn btn-secondary" onClick={() => fetchLogs(selectedDate)}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="registry-table">
            <thead>
              <tr>
                <th>Summary</th>
                <th>Action</th>
                <th>Latest Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>Loading logs...</td>
                </tr>
              ) : groupedLogs.length === 0 ? (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No audit logs available for this date.
                  </td>
                </tr>
              ) : (
                groupedLogs.map(group => (
                  <React.Fragment key={group.id}>
                    <tr 
                      onClick={() => toggleGroup(group.id)} 
                      style={{ cursor: 'pointer', background: expandedGroups[group.id] ? 'rgba(0,0,0,0.02)' : 'transparent' }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ transform: expandedGroups[group.id] ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>
                            ▶
                          </span>
                          <span style={{ fontWeight: 600 }}>
                            {formatActionMessage(group.action, group.username, group.items.length)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          fontSize: '0.75rem', 
                          fontWeight: 'bold',
                          ...getActionBadgeStyle(group.action)
                        }}>
                          {group.action}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(group.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                    
                    {/* Render raw logs when expanded */}
                    {expandedGroups[group.id] && (
                      <tr>
                        <td colSpan="3" style={{ padding: 0 }}>
                          <div style={{ background: '#1e293b', borderTop: '1px solid #334155', padding: '1rem', fontSize: '0.9rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                                  <th style={{ padding: '8px', textAlign: 'left' }}>Time</th>
                                  <th style={{ padding: '8px', textAlign: 'left' }}>Details</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.items.map(log => (
                                  <tr key={log.id} style={{ borderBottom: '1px solid #334155' }}>
                                    <td style={{ padding: '8px', width: '150px', color: '#cbd5e1' }}>
                                      {new Date(log.timestamp).toLocaleTimeString()}
                                    </td>
                                    <td style={{ padding: '8px', color: '#cbd5e1' }}>
                                      {log.details}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminLogs;
