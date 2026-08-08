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
  
  // Donors
  getDonors: async () => {
    const res = await fetch(`${API_BASE_URL}/donors`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch donors');
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
