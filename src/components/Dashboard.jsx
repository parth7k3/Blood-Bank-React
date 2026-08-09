import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

function Dashboard({ financialYear, theme, onToggleTheme, onNavigateToRegistry }) {
  const [metrics, setMetrics] = useState({ total: 0, eligible: 0, deferred: 0, pending: 0 });
  const [bloodInventory, setBloodInventory] = useState({
    'A+': 0, 'A-': 0, 'B+': 0, 'B-': 0, 'AB+': 0, 'AB-': 0, 'O+': 0, 'O-': 0
  });
  const [loading, setLoading] = useState(true);
  const [networkInfo, setNetworkInfo] = useState(null);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const stats = await api.getStats(financialYear);
        
        setMetrics({
          total: stats.total || 0,
          eligible: stats.eligible || 0,
          deferred: stats.deferred || 0,
          pending: stats.pending || 0
        });

        const newInventory = { 'A+': 0, 'A-': 0, 'B+': 0, 'B-': 0, 'AB+': 0, 'AB-': 0, 'O+': 0, 'O-': 0 };
        if (stats.byBloodGroup) {
          stats.byBloodGroup.forEach(item => {
            if (newInventory[item.bloodGroup] !== undefined) {
              newInventory[item.bloodGroup] = item.count;
            }
          });
        }
        setBloodInventory(newInventory);
        
        // Load network info
        try {
          const netData = await api.getNetworkInfo();
          setNetworkInfo(netData);
        } catch (e) {
          console.error('Failed to load network info', e);
        }
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [financialYear]);

  return (
    <div>
      {/* Top action and page title bar */}
      <header className="top-bar">
        <div className="page-title">
          <h2>Blood Bank Dashboard</h2>
          <p>Real-time donor monitoring, safety screening, and data transfer.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={onToggleTheme}
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            title="Toggle Light/Dark Theme"
          >
            🌓 Theme
          </button>
          <div className="system-status" id="system-status-indicator">
            <span className="status-dot"></span>
            <span>Database Active</span>
          </div>
        </div>
      </header>

      {/* Network Access Info */}
      {networkInfo && (
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontWeight: 600, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🌐</span> Connect other devices on your network using:
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            <div style={{ background: 'var(--bg-main)', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.9rem', border: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>Option 1 (Hostname):</span>
              <strong>http://{networkInfo.hostname}:{networkInfo.port}</strong>
            </div>
            {networkInfo.ips && networkInfo.ips.length > 0 && (
              <div style={{ background: 'var(--bg-main)', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.9rem', border: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>Option 2 (IP Address):</span>
                <strong>http://{networkInfo.ips[0]}:{networkInfo.port}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Quick Grid widgets */}
      <div className="dashboard-grid">
        
        <div className="stat-card" onClick={() => onNavigateToRegistry && onNavigateToRegistry({ status: '' })} style={{ cursor: 'pointer' }}>
          <div className="stat-details">
            <h3>Total Donors</h3>
            <div className="stat-number">{metrics.total}</div>
            <div className="stat-desc">Registered profiles</div>
          </div>
          <div className="stat-icon">👥</div>
        </div>

        <div className="stat-card success-card" onClick={() => onNavigateToRegistry && onNavigateToRegistry({ status: 'eligible' })} style={{ cursor: 'pointer' }}>
          <div className="stat-details">
            <h3>Eligible Donors</h3>
            <div className="stat-number">{metrics.eligible}</div>
            <div className="stat-desc">Cleared for donation</div>
          </div>
          <div className="stat-icon">✅</div>
        </div>

        <div className="stat-card warning-card" onClick={() => onNavigateToRegistry && onNavigateToRegistry({ status: 'deferred' })} style={{ cursor: 'pointer' }}>
          <div className="stat-details">
            <h3>Deferred Donors</h3>
            <div className="stat-number">{metrics.deferred}</div>
            <div className="stat-desc">Screened positive / blocked</div>
          </div>
          <div className="stat-icon">⚠️</div>
        </div>

        <div className="stat-card pending-card" onClick={() => onNavigateToRegistry && onNavigateToRegistry({ status: 'pending' })} style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)', cursor: 'pointer' }}>
          <div className="stat-details">
            <h3>Recent Donors</h3>
            <div className="stat-number" style={{ color: '#3b82f6' }}>{metrics.pending}</div>
            <div className="stat-desc">In cooldown period</div>
          </div>
          <div className="stat-icon" style={{ opacity: 0.8 }}>⏳</div>
        </div>

      </div>

      {/* Blood Inventory Stocks */}
      <div style={{ marginTop: '2.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.2rem', color: 'var(--text-main)' }}>
          Active Blood Inventory Stocks
        </h3>
        
        <div className="inventory-grid" id="inventory-grid">
          {Object.entries(bloodInventory).map(([bg, count]) => {
            const isEmpty = count === 0;
            return (
              <div 
                key={bg} 
                className="inventory-box"
                style={Object.assign({ cursor: 'pointer' }, isEmpty ? { border: '1px dashed rgba(239, 68, 68, 0.4)' } : {})}
                onClick={() => onNavigateToRegistry && onNavigateToRegistry({ blood: bg })}
              >
                <div className="inventory-group">{bg}</div>
                <div className="inventory-count">{count}</div>
                <div className="inventory-unit">Active Donors</div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

export default Dashboard;
