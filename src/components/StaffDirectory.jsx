import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const StaffDirectory = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userLogs, setUserLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load staff directory');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserLogs = async (username) => {
    try {
      setLogsLoading(true);
      const data = await api.getLogs('', username);
      setUserLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };
  const handleRoleChange = async (username, newRole) => {
    try {
      await api.updateUserRole(username, newRole);
      setUsers(users.map(u => u.username === username ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to update user role');
    }
  };

  const handleUserClick = (user) => {
    if (selectedUser?.username === user.username) {
      setSelectedUser(null);
      setUserLogs([]);
    } else {
      setSelectedUser(user);
      fetchUserLogs(user.username);
    }
  };

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'admin': return { background: 'rgba(220, 38, 38, 0.1)', color: '#ef4444', border: '1px solid rgba(220, 38, 38, 0.2)' };
      case 'manager': return { background: 'rgba(217, 119, 6, 0.1)', color: '#f59e0b', border: '1px solid rgba(217, 119, 6, 0.2)' };
      case 'staff': return { background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' };
      default: return { background: 'var(--bg-lighter)', color: 'var(--text-muted)' };
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
      <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>Staff Directory</h2>
      
      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading staff...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {users.map(u => (
            <div 
              key={u.id}
              onClick={() => handleUserClick(u)}
              style={{
                background: selectedUser?.username === u.username ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-main)',
                border: selectedUser?.username === u.username ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                alignItems: 'center',
                boxShadow: selectedUser?.username === u.username ? '0 0 0 1px #3b82f6' : 'none'
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                {u.role === 'admin' ? '👑' : u.role === 'manager' ? '🧑‍💼' : '🧑‍💻'}
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {u.username}
              </div>
              <select 
                value={u.role}
                onChange={(e) => {
                  e.stopPropagation(); // prevent clicking the card
                  handleRoleChange(u.username, e.target.value);
                }}
                disabled={u.username === currentUser?.name || u.id === 1}
                style={{
                  ...getRoleBadgeStyle(u.role),
                  padding: '0.2rem 0.6rem', 
                  borderRadius: '4px', 
                  fontSize: '0.75rem', 
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  border: '1px solid var(--border-color)',
                  cursor: (u.username === currentUser?.name || u.id === 1) ? 'not-allowed' : 'pointer',
                  appearance: 'none',
                  textAlign: 'center',
                  outline: 'none'
                }}
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {selectedUser && (
        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Activity Logs for <strong>{selectedUser.username}</strong></span>
          </h3>
          
          {logsLoading ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>Loading logs...</div>
          ) : userLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', background: 'var(--bg-lighter)', borderRadius: '6px' }}>
              No activity recorded for this user.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '500px', overflowY: 'auto' }}>
              {userLogs.map((log) => {
                const dateObj = new Date(log.timestamp);
                const dateStr = dateObj.toLocaleDateString();
                const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={log.id} style={{ 
                    display: 'flex', 
                    gap: '1rem', 
                    padding: '0.75rem 1rem', 
                    background: 'var(--bg-lighter)', 
                    borderRadius: '6px',
                    alignItems: 'flex-start'
                  }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap', minWidth: '130px' }}>
                      {dateStr} <br/> {timeStr}
                    </div>
                    <div>
                      <span className="badge" style={{ ...getActionBadgeStyle(log.action), marginBottom: '0.25rem' }}>
                        {log.action}
                      </span>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginTop: '0.25rem' }}>
                        {log.details}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StaffDirectory;
