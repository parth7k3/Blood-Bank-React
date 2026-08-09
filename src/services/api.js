const API_BASE_URL = window.location.protocol === 'file:' 
  ? 'http://localhost:3001/api' 
  : window.location.origin + '/api';

const getHeaders = () => {
  const token = localStorage.getItem('bloodbank_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const api = {
  getNetworkInfo: async () => {
    const res = await fetch(`${API_BASE_URL}/network`);
    if (!res.ok) throw new Error('Failed to fetch network info');
    return res.json();
  },

  login: async (username, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error('Invalid credentials');
    return res.json();
  },
  
  requestOtp: async (username, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/register/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to request OTP');
    return data;
  },

  verifyOtp: async (username, otp) => {
    const res = await fetch(`${API_BASE_URL}/auth/register/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, otp })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invalid OTP');
    return data;
  },
  
  requestRecoveryOtp: async (username) => {
    const res = await fetch(`${API_BASE_URL}/auth/recover/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to request OTP');
    return data;
  },

  resetPassword: async (username, otp, newPassword) => {
    const res = await fetch(`${API_BASE_URL}/auth/recover/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, otp, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reset password');
    return data;
  },
  
  // Donors
  getDonors: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE_URL}/donors?${query}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch donors');
    return res.json();
  },

  getStats: async (fy = '') => {
    const res = await fetch(`${API_BASE_URL}/donors/stats?fy=${fy}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  getExportUrl: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const token = localStorage.getItem('bloodbank_token');
    return `${API_BASE_URL}/donors/export?${query}&token=${token}`; // Assuming token auth in query params is supported, or we can fetch as blob
  },

  getFinancialYears: async () => {
    const res = await fetch(`${API_BASE_URL}/donors/fys`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch financial years');
    return res.json();
  },
  
  createDonor: async (donorData) => {
    const res = await fetch(`${API_BASE_URL}/donors`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(donorData)
    });
    if (!res.ok) throw new Error('Failed to create donor');
    return res.json();
  },

  bulkImportDonors: async (donors) => {
    const res = await fetch(`${API_BASE_URL}/donors/bulk`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ donors })
    });
    if (!res.ok) throw new Error('Failed to bulk import donors');
    return res.json();
  },
  
  updateDonor: async (id, donorData) => {
    const res = await fetch(`${API_BASE_URL}/donors/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(donorData)
    });
    if (!res.ok) throw new Error('Failed to update donor');
    return res.json();
  },
  
  deleteDonor: async (id) => {
    const res = await fetch(`${API_BASE_URL}/donors/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete donor');
    return res.json();
  },

  // Camps
  getCamps: async () => {
    const res = await fetch(`${API_BASE_URL}/camps`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch camps');
    return res.json();
  },
  
  createCamp: async (data) => {
    const res = await fetch(`${API_BASE_URL}/camps`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create camp');
    return res.json();
  },
  
  updateCamp: async (id, data) => {
    const res = await fetch(`${API_BASE_URL}/camps/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update camp');
    return res.json();
  },
  
  deleteCamp: async (id) => {
    const res = await fetch(`${API_BASE_URL}/camps/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete camp');
    return res.json();
  },

  // SMS
  sendSMS: async (phone, message) => {
    const res = await fetch(`${API_BASE_URL}/sms/send`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ phone, message })
    });
    if (!res.ok) throw new Error('Failed to send SMS');
    return res.json();
  },

  // --- System API ---
  getSystemInfo: async () => {
    const res = await fetch(`${API_BASE_URL}/system/info`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch system info');
    return res.json();
  },

  // Logs
  getLogs: async (date = '') => {
    let url = `${API_BASE_URL}/logs`;
    if (date) url += `?date=${encodeURIComponent(date)}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json();
  },

  getBackupUrl: () => {
    return `${API_BASE_URL}/system/backup`;
  },

  resetDatabase: async () => {
    const res = await fetch(`${API_BASE_URL}/reset`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to reset database');
    return res.json();
  }
};
