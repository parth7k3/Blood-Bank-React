import React, { useMemo } from 'react';
import { checkEligibility } from '../utils/helpers';

function Dashboard({ donors, financialYear, theme, onToggleTheme }) {
  // 1. Filter donors by the active financial year for stats & metrics
  const fyDonors = useMemo(() => {
    if (!financialYear) return donors;
    return donors.filter(d => d.financialYear === financialYear);
  }, [donors, financialYear]);

  // 2. Compute metrics based on active donors
  const metrics = useMemo(() => {
    let total = fyDonors.length;
    let eligible = 0;
    let deferred = 0;
    let pending = 0;

    fyDonors.forEach(donor => {
      const statusObj = checkEligibility(donor, donors);
      if (statusObj.status === 'safe') eligible++;
      else if (statusObj.status === 'deferred') deferred++;
      else if (statusObj.status === 'pending') pending++;
    });

    return { total, eligible, deferred, pending };
  }, [fyDonors, donors]);

  // 3. Compute blood group counts from eligible donors in the selected financial year
  const bloodInventory = useMemo(() => {
    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const counts = {};
    
    bloodGroups.forEach(bg => {
      counts[bg] = 0;
    });

    fyDonors.forEach(donor => {
      const statusObj = checkEligibility(donor, donors);
      if (statusObj.status === 'safe' && bloodGroups.includes(donor.bloodGroup)) {
        counts[donor.bloodGroup]++;
      }
    });

    return counts;
  }, [fyDonors, donors]);

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

      {/* Stats Quick Grid widgets */}
      <div className="dashboard-grid">
        
        <div className="stat-card">
          <div className="stat-details">
            <h3>Total Donors</h3>
            <div className="stat-number">{metrics.total}</div>
            <div className="stat-desc">Registered profiles</div>
          </div>
          <div className="stat-icon">👥</div>
        </div>

        <div className="stat-card success-card">
          <div className="stat-details">
            <h3>Eligible Donors</h3>
            <div className="stat-number">{metrics.eligible}</div>
            <div className="stat-desc">Cleared for donation</div>
          </div>
          <div className="stat-icon">✅</div>
        </div>

        <div className="stat-card warning-card">
          <div className="stat-details">
            <h3>Deferred Donors</h3>
            <div className="stat-number">{metrics.deferred}</div>
            <div className="stat-desc">Screened positive / blocked</div>
          </div>
          <div className="stat-icon">⚠️</div>
        </div>

        <div className="stat-card pending-card" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
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
                style={isEmpty ? { border: '1px dashed rgba(239, 68, 68, 0.4)' } : undefined}
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
