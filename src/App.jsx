import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import DonorRegistry from './components/DonorRegistry';
import ImportExport from './components/ImportExport';
import { useDonors } from './hooks/useDonors';
import { getFinancialYear } from './utils/helpers';

function App() {
  const { 
    donors, 
    loading, 
    addDonor, 
    updateDonor, 
    deleteDonor, 
    processImportedDonorsList, 
    resetDatabase 
  } = useDonors();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [financialYear, setFinancialYear] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  
  // Custom user admin session state (starts as null to prompt login)
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('bloodbank_admin_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

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
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setLoginError('');

    if (loginUsername.trim().toLowerCase() === 'anil' && loginPassword === 'Anil_@123') {
      const activeUser = { name: 'Anil Kumar', role: 'Administrator' };
      setUser(activeUser);
      localStorage.setItem('bloodbank_admin_user', JSON.stringify(activeUser));
      setIsLoginOpen(false);
      setLoginUsername('');
      setLoginPassword('');
    } else {
      setLoginError('Invalid username or administrator password.');
    }
  };

  // Logout handler
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('bloodbank_admin_user');
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
    const fySet = new Set();
    parsedList.forEach(d => {
      if (d.financialYear) fySet.add(d.financialYear);
    });
    const sortedFYs = Array.from(fySet).sort((a, b) => b.localeCompare(a));
    if (sortedFYs.length > 0) {
      setFinancialYear(sortedFYs[0]);
    }
    return result;
  }, [processImportedDonorsList]);

  // Helper for sequential ID calculation
  const getNextDonorId = useCallback(() => {
    return donors.reduce((max, d) => {
      const match = d.id.match(/^D-(\d+)$/);
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
          />
        )}

        {activeTab === 'registry' && (
          <DonorRegistry 
            donors={donors}
            financialYear={financialYear}
            addDonor={handleAddDonor}
            updateDonor={handleUpdateDonor}
            deleteDonor={deleteDonor}
            user={user}
            onLoginClick={() => setIsLoginOpen(true)}
          />
        )}

        {activeTab === 'importexport' && (
          <ImportExport 
            donors={donors}
            processImportedDonorsList={handleProcessImportedDonorsList}
            getNextDonorId={getNextDonorId}
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
  );
}

export default App;
