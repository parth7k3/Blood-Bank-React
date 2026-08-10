import React from 'react';

function Sidebar({ 
  activeTab, 
  setActiveTab, 
  financialYear, 
  setFinancialYear, 
  uniqueFYs, 
  onResetDatabase,
  user,
  onLogout,
  onLoginClick
}) {
  return (
    <aside className="sidebar">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
        <div>
          {/* Brand Header */}
          <div className="brand">
            <div className="brand-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              🩸
            </div>
            <span className="brand-name" style={{ fontSize: '1.35rem', lineHeight: '1.2', fontWeight: 800 }}>
              Vardaan Blood Bank
            </span>
          </div>
          
          {/* Navigation Links */}
          <nav>
            <ul className="nav-links">
              <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
                <a href="#dashboard" onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }}>
                  <span className="nav-icon">📊</span> Dashboard
                </a>
              </li>
              <li className={`nav-item ${activeTab === 'registry' ? 'active' : ''}`}>
                <a href="#registry" onClick={(e) => { e.preventDefault(); setActiveTab('registry'); }}>
                  <span className="nav-icon">👥</span> Donor Registry
                </a>
              </li>
              <li className={`nav-item ${activeTab === 'importexport' ? 'active' : ''}`}>
                <a href="#importexport" onClick={(e) => { e.preventDefault(); setActiveTab('importexport'); }}>
                  <span className="nav-icon">🔄</span> Import & Export
                </a>
              </li>
              <li className={`nav-item ${activeTab === 'camps' ? 'active' : ''}`}>
                <a href="#camps" onClick={(e) => { e.preventDefault(); setActiveTab('camps'); }}>
                  <span className="nav-icon">⛺</span> Blood Camps
                </a>
              </li>
              {user && user.role === 'admin' && (
                <>
                  <li className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`}>
                    <a href="#logs" onClick={(e) => { e.preventDefault(); setActiveTab('logs'); }}>
                      <span className="nav-icon">📝</span> System Logs
                    </a>
                  </li>
                  <li className={`nav-item ${activeTab === 'staff' ? 'active' : ''}`}>
                    <a href="#staff" onClick={(e) => { e.preventDefault(); setActiveTab('staff'); }}>
                      <span className="nav-icon">🪪</span> Staff Directory
                    </a>
                  </li>
                </>
              )}
            </ul>
          </nav>

          {/* Sidebar Financial Year Selector */}
          <div className="sidebar-fy-container">
            <label htmlFor="sidebar-fy-select">📅 Financial Year</label>
            <select 
              id="sidebar-fy-select" 
              className="select-input sidebar-fy-select"
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
            >
              <option value="">All Years</option>
              {uniqueFYs.map(fy => (
                <option key={fy} value={fy}>FY {fy}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Footer Area with Reset & User Session */}
        <div className="sidebar-footer" style={{ marginTop: 'auto' }}>
          {/* Admin / Staff Session Section */}
          <div className="user-session-card" style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {user ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.25rem' }}>👤</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#f8fafc' }}>{user.name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>{user.role}</div>
                  </div>
                </div>
                <button 
                  onClick={onLogout}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', fontSize: '0.75rem', padding: '4px' }}
                >
                  Logout
                </button>
              </>
            ) : (
              <button 
                onClick={onLoginClick}
                className="btn btn-primary btn-sm"
                style={{ width: '100%', fontSize: '0.8rem', background: '#991b1b' }}
              >
                🔐 Staff Login
              </button>
            )}
          </div>

          {user && user.role === 'admin' && (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={onResetDatabase}
              style={{ marginBottom: '0.5rem', width: '100%', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontSize: '0.72rem' }}
            >
              ⚠️ Reset to Default Data
            </button>
          )}
          <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>Vardaan Blood Bank v1.0.0</p>
          <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>Secure React Instance</p>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
