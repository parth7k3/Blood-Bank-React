
async function testMassiveImport() {
  // Login to get token
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  }).then(r => r.json());

  const token = loginRes.token;
  
  const donors = [];
  for (let i = 0; i < 5500; i++) {
    donors.push({
      id: `D-9000${i}`,
      name: `Test Donor ${i}`,
      relativeName: 'Father',
      age: 25,
      gender: 'Male',
      bloodGroup: 'B+',
      contact: '1234567890',
      email: `test${i}@example.com`,
      address: 'Test City',
      lastDonationDate: '2024-01-01',
      diseasePositive: false,
      diseases: '',
      notes: '',
      financialYear: '2023-24',
      camp: 'Camp A'
    });
  }

  const payload = { donors };

  try {
    const importRes = await fetch('http://localhost:3001/api/donors/bulk', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    
    console.log('Status:', importRes.status);
    const json = await importRes.json();
    console.log('Bulk Import Result:', json);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testMassiveImport();
