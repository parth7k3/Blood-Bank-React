import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import DonorRegistry from './components/DonorRegistry';
import ImportExport from './components/ImportExport';
import Camps from './components/Camps';
import AdminLogs from './components/AdminLogs';
import StaffDirectory from './components/StaffDirectory';
import { api } from './services/api';
import { useDonors } from './hooks/useDonors';
import { getFinancialYear } from './utils/helpers';
import { Toaster } from 'react-hot-toast';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('bloodbank_admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  const { 
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
  const [authTab, setAuthTab] = useState('login'); // 'login' or 'register'
  
  // Login states
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Registration states
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [registerMessage, setRegisterMessage] = useState('');
  
  // Recovery states
  const [recoverUsername, setRecoverUsername] = useState('');
  const [recoverPassword, setRecoverPassword] = useState('');
  const [recoverOtpStep, setRecoverOtpStep] = useState(false);
  const [recoverOtpCode, setRecoverOtpCode] = useState('');
  const [recoverError, setRecoverError] = useState('');
  const [recoverMessage, setRecoverMessage] = useState('');
  
  const [registryFilters, setRegistryFilters] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);

  // Reset DB modal states
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');

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

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeydown = (e) => {
      // Ctrl+F or Cmd+F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (activeTab !== 'registry') {
          setActiveTab('registry');
        }
        // Small delay to allow tab to render if it wasn't active
        setTimeout(() => {
          const searchInput = document.querySelector('.search-input');
          if (searchInput) {
            searchInput.focus();
            e.preventDefault();
          }
        }, 100);
      }
    };
    window.addEventListener('keydown', handleGlobalKeydown);
    return () => window.removeEventListener('keydown', handleGlobalKeydown);
  }, [activeTab]);

  // Handle body theme changes
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const [uniqueFYs, setUniqueFYs] = useState([]);

  const loadFys = useCallback(async () => {
    if (user) {
      try {
        const fys = await api.getFinancialYears();
        setUniqueFYs(fys);
        return fys;
      } catch (err) {
        console.error(err);
      }
    }
    return [];
  }, [user]);

  useEffect(() => {
    loadFys();
  }, [loadFys]);

  // Toggle Theme helper
  const handleToggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Reset database handler
  const handleResetDatabase = async () => {
    if (!user) {
      toast.error("Please login as Admin to reset the database.");
      setIsLoginOpen(true);
      return;
    }
    setResetPassword('');
    setResetError('');
    setIsResetModalOpen(true);
  };

  const executeResetDatabase = async (e) => {
    e.preventDefault();
    if (!resetPassword) return;
    
    setResetError('');
    try {
      await resetDatabase(resetPassword);
      setIsResetModalOpen(false);
      toast.success("Database reset successfully.");
    } catch (err) {
      setResetError(err.message || "Invalid password");
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

  // Register handlers
  const handleRegisterRequest = async (e) => {
    e.preventDefault();
    setRegisterError('');
    setRegisterMessage('');
    try {
      const res = await api.requestOtp(registerUsername, registerPassword);
      setRegisterMessage(res.message);
      setOtpStep(true);
    } catch (err) {
      setRegisterError(err.message || 'Failed to request OTP');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setRegisterError('');
    try {
      const data = await api.verifyOtp(registerUsername, otpCode);
      const activeUser = { name: data.username, role: data.role, token: data.token };
      setUser(activeUser);
      localStorage.setItem('bloodbank_admin_user', JSON.stringify(activeUser));
      localStorage.setItem('bloodbank_token', data.token);
      
      setIsLoginOpen(false);
      setRegisterUsername('');
      setRegisterPassword('');
      setOtpCode('');
      setOtpStep(false);
      setRegisterMessage('');
      setAuthTab('login');
      toast.success("Registration successful! You are now logged in.");
    } catch (err) {
      setRegisterError(err.message || 'Invalid OTP');
      if (err.message && (err.message.toLowerCase().includes('expired') || err.message.toLowerCase().includes('pending'))) {
        setOtpStep(false);
      }
    }
  };

  // Recovery handlers
  const handleRecoverRequest = async (e) => {
    e.preventDefault();
    setRecoverError('');
    setRecoverMessage('');
    try {
      const res = await api.requestRecoveryOtp(recoverUsername);
      setRecoverMessage(res.message);
      setRecoverOtpStep(true);
    } catch (err) {
      setRecoverError(err.message || 'Failed to request OTP');
    }
  };

  const handleRecoverReset = async (e) => {
    e.preventDefault();
    setRecoverError('');
    try {
      await api.resetPassword(recoverUsername, recoverOtpCode, recoverPassword);
      setRecoverUsername('');
      setRecoverPassword('');
      setRecoverOtpCode('');
      setRecoverMessage('');
      setRecoverOtpStep(false);
      setAuthTab('login');
      toast.success("Password reset successfully! You can now log in.");
    } catch (err) {
      setRecoverError(err.message || 'Failed to reset password');
      if (err.message && (err.message.toLowerCase().includes('expired') || err.message.toLowerCase().includes('pending'))) {
        setRecoverOtpStep(false);
      }
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
    const payload = {
      ...donorData,
      financialYear: donorData.financialYear || getFinancialYear(donorData.lastDonationDate || new Date())
    };
    const newDonor = await addDonor(payload);
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
      await loadFys();
      if (sortedFYs.length > 0) {
        setFinancialYear(sortedFYs[0]);
      }
    }
    return result;
  }, [processImportedDonorsList, loadFys]);

  // Handle Dashboard stat card redirection
  const handleNavigateToRegistry = useCallback((filters) => {
    setRegistryFilters(filters);
    setActiveTab('registry');
  }, []);

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
            http://{systemInfo.hostname}:{systemInfo.port}
          </span>
        </div>
      )}
      <div className={`app-container ${theme}-theme`}>
      <Toaster position="bottom-right" />
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
            financialYear={financialYear}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onNavigateToRegistry={handleNavigateToRegistry}
          />
        )}

        {activeTab === 'registry' && (
          <DonorRegistry 
            camps={camps} 
            addDonor={handleAddDonor} 
            updateDonor={handleUpdateDonor} 
            deleteDonor={deleteDonor} 
            financialYear={financialYear}
            setFinancialYear={setFinancialYear}
            refreshFys={loadFys}
            user={user}
            onLoginClick={() => setIsLoginOpen(true)}
            registryFilters={registryFilters}
            setRegistryFilters={setRegistryFilters}
          />
        )}

        {activeTab === 'importexport' && (
          <ImportExport 
            processImportedDonorsList={handleProcessImportedDonorsList}
          />
        )}

        {activeTab === 'camps' && (
          <Camps 
            camps={camps}
            onAddCamp={addCamp}
            onEditCamp={editCamp}
            onDeleteCamp={deleteCamp}
            onSelectDonor={() => setActiveTab('registry')}
          />
        )}

        {activeTab === 'logs' && user && user.role === 'admin' && (
          <AdminLogs />
        )}
        {activeTab === 'staff' && user && user.role === 'admin' && (
          <StaffDirectory currentUser={user} />
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
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setAuthTab('login')}
                style={{
                  flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: authTab === 'login' ? '#991b1b' : 'rgba(255,255,255,0.1)',
                  color: authTab === 'login' ? '#fff' : '#94a3b8',
                  fontWeight: authTab === 'login' ? 600 : 400
                }}
              >Login</button>
              <button
                type="button"
                onClick={() => setAuthTab('register')}
                style={{
                  flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: authTab === 'register' ? '#991b1b' : 'rgba(255,255,255,0.1)',
                  color: authTab === 'register' ? '#fff' : '#94a3b8',
                  fontWeight: authTab === 'register' ? 600 : 400
                }}
              >Register</button>
            </div>

            {authTab === 'login' && (
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
                    background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#fca5a5', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center'
                  }}>
                    ⚠️ {loginError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Username</label>
                  <input 
                    type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter 'admin'" required
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(0,0,0,0.25)', color: '#fff', outline: 'none', fontSize: '0.95rem'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Password</label>
                  <input 
                    type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password" required
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(0,0,0,0.25)', color: '#fff', outline: 'none', fontSize: '0.95rem'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setIsLoginOpen(false)} className="btn btn-secondary" style={{ flex: 1, padding: '10px' }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '10px', background: '#991b1b' }}>🔐 Authorize</button>
                </div>
                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setAuthTab('recover')} style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}>Forgot Password?</button>
                </div>
              </form>
            )}

            {authTab === 'register' && (
              <form onSubmit={otpStep ? handleVerifyOtp : handleRegisterRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: '0 0 6px 0', color: '#f8fafc', fontSize: '1.25rem', fontWeight: 700 }}>
                    Register New Staff
                  </h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                    Approval required by Administrator
                  </p>
                </div>

                {registerError && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center' }}>
                    ⚠️ {registerError}
                  </div>
                )}
                
                {registerMessage && (
                  <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', color: '#86efac', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center' }}>
                    ✅ {registerMessage}
                  </div>
                )}

                {!otpStep ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Desired Username</label>
                      <input 
                        type="text" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)}
                        placeholder="Choose username" required
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', color: '#fff', outline: 'none', fontSize: '0.95rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Password</label>
                      <input 
                        type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)}
                        placeholder="Choose password" required
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', color: '#fff', outline: 'none', fontSize: '0.95rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem' }}>
                      <button type="button" onClick={() => setIsLoginOpen(false)} className="btn btn-secondary" style={{ flex: 1, padding: '10px' }}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '10px', background: '#2563eb' }}>Request OTP</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>6-Digit OTP Code</label>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '8px' }}>Ask the administrator (neelu.jan01@gmail.com) for the OTP sent to their email.</p>
                      <input 
                        type="text" value={otpCode} onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="e.g. 123456" required maxLength={6}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', color: '#fff', outline: 'none', fontSize: '0.95rem', letterSpacing: '2px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem' }}>
                      <button type="button" onClick={() => setOtpStep(false)} className="btn btn-secondary" style={{ flex: 1, padding: '10px' }}>Back</button>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '10px', background: '#16a34a' }}>Verify & Register</button>
                    </div>
                  </>
                )}
              </form>
            )}

            {authTab === 'recover' && (
              <form onSubmit={recoverOtpStep ? handleRecoverReset : handleRecoverRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: '0 0 6px 0', color: '#f8fafc', fontSize: '1.25rem', fontWeight: 700 }}>
                    Account Recovery
                  </h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                    Reset your staff password
                  </p>
                </div>

                {recoverError && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center' }}>
                    ⚠️ {recoverError}
                  </div>
                )}
                
                {recoverMessage && (
                  <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', color: '#86efac', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center' }}>
                    ✅ {recoverMessage}
                  </div>
                )}

                {!recoverOtpStep ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Your Username</label>
                      <input 
                        type="text" value={recoverUsername} onChange={(e) => setRecoverUsername(e.target.value)}
                        placeholder="Enter username" required
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', color: '#fff', outline: 'none', fontSize: '0.95rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem' }}>
                      <button type="button" onClick={() => setAuthTab('login')} className="btn btn-secondary" style={{ flex: 1, padding: '10px' }}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '10px', background: '#2563eb' }}>Request OTP</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>6-Digit OTP Code</label>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '8px' }}>Ask the administrator for the OTP sent to their email.</p>
                      <input 
                        type="text" value={recoverOtpCode} onChange={(e) => setRecoverOtpCode(e.target.value)}
                        placeholder="e.g. 123456" required maxLength={6}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', color: '#fff', outline: 'none', fontSize: '0.95rem', letterSpacing: '2px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>New Password</label>
                      <input 
                        type="password" value={recoverPassword} onChange={(e) => setRecoverPassword(e.target.value)}
                        placeholder="Enter new password" required
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', color: '#fff', outline: 'none', fontSize: '0.95rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem' }}>
                      <button type="button" onClick={() => setRecoverOtpStep(false)} className="btn btn-secondary" style={{ flex: 1, padding: '10px' }}>Back</button>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '10px', background: '#16a34a' }}>Reset Password</button>
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* Database Reset Password Modal */}
      {isResetModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: '#ef4444' }}>⚠️ Security Check</h3>
              <button className="close-btn" onClick={() => setIsResetModalOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <p style={{ color: 'var(--text-main)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                Are you sure you want to completely clear the entire database? This action cannot be undone.
              </p>
              <form onSubmit={executeResetDatabase} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {resetError && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center' }}>
                    {resetError}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Admin Password</label>
                  <input 
                    type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Enter admin password to proceed" required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', color: '#fff', outline: 'none', fontSize: '0.95rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setIsResetModalOpen(false)} className="btn btn-secondary" style={{ flex: 1, padding: '10px' }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '10px', background: '#ef4444' }}>Wipe Database</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

export default App;
