import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const AdminLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load system logs');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>System Audit Logs</h2>
        <button className="btn btn-secondary" onClick={fetchLogs}>
          🔄 Refresh
        </button>
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
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Loading logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No audit logs available.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{log.username}</span>
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold',
                        ...getActionBadgeStyle(log.action)
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {log.details}
                    </td>
                  </tr>
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
