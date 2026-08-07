import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import DonorRegistry from './components/DonorRegistry';
import ImportExport from './components/ImportExport';
import Camps from './components/Camps';
import { api } from './services/api';
import { useDonors } from './hooks/useDonors';
import { getFinancialYear } from './utils/helpers';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('bloodbank_admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  const { 
    donors,
    camps,
    loading, 
    addDonor, 
    updateDonor, 
    deleteDonor,
    addCamp,
    editCamp,
    deleteCamp,
    processImportedDonorsList, 
    resetDatabase 
  } = useDonors(user);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [financialYear, setFinancialYear] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registryFilters, setRegistryFilters] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);

  // Fetch system info for network banner
  useEffect(() => {
    async function fetchSysInfo() {
      try {
        const info = await api.getSystemInfo();
        setSystemInfo(info);
      } catch (err) {
        console.error("Failed to load system info", err);
      }
    }
    fetchSysInfo();
  }, []);

  // Handle body theme changes
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Extract unique financial years dynamically
  const uniqueFYs = useMemo(() => {
    const fySet = new Set();
    donors.forEach(d => {
      if (d.financialYear) {
        fySet.add(d.financialYear);
      }
    });
    return Array.from(fySet).sort((a, b) => b.localeCompare(a));
  }, [donors]);

  // Toggle Theme helper
  const handleToggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Reset database handler
  const handleResetDatabase = async () => {
    if (!user) {
      alert("Please login as Admin to reset the database.");
      setIsLoginOpen(true);
      return;
    }
    const confirmPass = prompt("Type Admin Password to confirm database reset:");
    if (confirmPass !== "Anil_@123") {
      alert("Incorrect password. Reset cancelled.");
      return;
    }
    if (window.confirm("Are you sure you want to clear the entire database?")) {
      await resetDatabase();
      alert("Database reset successfully.");
    }
  };

  // Login handler
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const data = await api.login(loginUsername, loginPassword);
      const activeUser = { name: data.username, role: data.role, token: data.token };
      setUser(activeUser);
      localStorage.setItem('bloodbank_admin_user', JSON.stringify(activeUser));
      localStorage.setItem('bloodbank_token', data.token);
      setIsLoginOpen(false);
      setLoginUsername('');
      setLoginPassword('');
    } catch (err) {
      setLoginError('Invalid username or password.');
    }
  };

  // Logout handler
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('bloodbank_admin_user');
    localStorage.removeItem('bloodbank_token');
  };

  // Wrappers to automatically select/sync the active financial year on new data entry or import
  const handleAddDonor = useCallback(async (donorData) => {
    const newDonor = await addDonor(donorData);
    if (newDonor && newDonor.financialYear) {
      setFinancialYear(newDonor.financialYear);
    }
    return newDonor;
  }, [addDonor]);

  const handleUpdateDonor = useCallback(async (id, donorData, isEditMode) => {
    const success = await updateDonor(id, donorData, isEditMode);
    if (success) {
      const newFY = getFinancialYear(donorData.lastDonationDate);
      if (newFY) {
        setFinancialYear(newFY);
      }
    }
    return success;
  }, [updateDonor]);

  const handleProcessImportedDonorsList = useCallback(async (parsedList) => {
    const result = await processImportedDonorsList(parsedList);
    if (result.addedCount > 0 || result.mergedCount > 0) {
      const fySet = new Set();
      parsedList.forEach(d => {
        if (d.financialYear) fySet.add(d.financialYear);
      });
      const sortedFYs = Array.from(fySet).sort((a, b) => b.localeCompare(a));
      if (sortedFYs.length > 0) {
        setFinancialYear(sortedFYs[0]);
      }
    }
    return result;
  }, [processImportedDonorsList]);

  // Handle Dashboard stat card redirection
  const handleNavigateToRegistry = useCallback((filters) => {
    setRegistryFilters(filters);
    setActiveTab('registry');
  }, []);

  // Helper for sequential ID calculation
  const getNextDonorId = useCallback(() => {
    return donors.reduce((max, d) => {
      const idStr = String(d.id || '');
      const match = idStr.match(/^D-(\d+)$/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 1000) + 1;
  }, [donors]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#16181f',
        color: '#f8fafc',
        fontFamily: 'sans-serif'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid rgba(225, 29, 72, 0.1)',
          borderTopColor: '#e11d48',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem'
        }} />
        <div style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.5px' }}>
          Loading offline databases...
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      {systemInfo && window.location.protocol === 'file:' && (
        <div style={{
          background: 'var(--primary)',
          color: 'white',
          textAlign: 'center',
          padding: '8px',
          fontSize: '0.85rem',
          fontWeight: 600,
          zIndex: 1000
        }}>
          🌐 To connect from mobile devices on Wi-Fi, open your browser to: 
          <span style={{ marginLeft: '8px', marginRight: '12px', background: 'rgba(0,0,0,0.3)', padding: '3px 8px', borderRadius: '4px', userSelect: 'all' }}>
            http://{systemInfo.ip}:{systemInfo.port}
          </span>
          or
          <span style={{ marginLeft: '8px', background: 'rgba(0,0,0,0.3)', padding: '3px 8px', borderRadius: '4px', userSelect: 'all' }}>
            http://{systemInfo.hostname}.local:{systemInfo.port}
          </span>
        </div>
      )}
      <div className="app-container">
      {/* Sidebar navigation */}
      <Sidebar 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        financialYear={financialYear}
        setFinancialYear={setFinancialYear}
        uniqueFYs={uniqueFYs}
        onResetDatabase={handleResetDatabase}
        user={user}
        onLogout={handleLogout}
        onLoginClick={() => setIsLoginOpen(true)}
      />

      {/* Main panel view */}
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard 
            donors={donors}
            financialYear={financialYear}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onNavigateToRegistry={handleNavigateToRegistry}
          />
        )}

        {activeTab === 'registry' && (
          <DonorRegistry 
            donors={donors}
            camps={camps}
            financialYear={financialYear}
            addDonor={handleAddDonor}
            updateDonor={handleUpdateDonor}
            deleteDonor={deleteDonor}
            user={user}
            onLoginClick={() => setIsLoginOpen(true)}
            registryFilters={registryFilters}
            setRegistryFilters={setRegistryFilters}
          />
        )}

        {activeTab === 'importexport' && (
          <ImportExport 
            donors={donors}
            processImportedDonorsList={handleProcessImportedDonorsList}
            getNextDonorId={getNextDonorId}
          />
        )}

        {activeTab === 'camps' && (
          <Camps 
            camps={camps}
            donors={donors}
            onAddCamp={addCamp}
            onEditCamp={editCamp}
            onDeleteCamp={deleteCamp}
            onSelectDonor={() => setActiveTab('registry')}
          />
        )}
      </main>

      {/* Login Custom Dialog Modal */}
      {isLoginOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }} onClick={() => setIsLoginOpen(false)}>
          <div style={{
            background: '#1e2028',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '2rem',
            width: '90%',
            maxWidth: '380px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }} onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: '0 0 6px 0', color: '#f8fafc', fontSize: '1.25rem', fontWeight: 700 }}>
                  Staff Administration Login
                </h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                  Secure portal authorization
                </p>
              </div>

              {loginError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#fca5a5',
                  padding: '10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  textAlign: 'center'
                }}>
                  ⚠️ {loginError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                  Username
                </label>
                <input 
                  type="text" 
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Enter 'anil'" 
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.25)',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                  Password
                </label>
                <input 
                  type="password" 
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter 'Anil_@123'" 
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.25)',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsLoginOpen(false)}
                  className="btn btn-secondary" 
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1, padding: '10px', background: '#991b1b' }}
                >
                  🔐 Authorize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

export default App;
