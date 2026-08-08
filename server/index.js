const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const os = require('os');
const db = require('./db');
const nodemailer = require('nodemailer');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = 'super-secret-blood-bank-key-change-in-prod';

// Configure Real SMTP Transporter using .env credentials
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const pendingOtps = {}; // In-memory OTP store

const insertLog = (username, action, details) => {
  const timestamp = new Date().toISOString();
  db.run(`INSERT INTO logs (timestamp, username, action, details) VALUES (?, ?, ?, ?)`, 
    [timestamp, username, action, details], (err) => {
      if (err) console.error("Failed to insert log:", err.message);
    });
};

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve the React frontend statically
app.use(express.static(path.join(__dirname, '../dist')));

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// --- Auth Routes ---
app.post('/api/auth/register/request-otp', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (user) return res.status(400).json({ error: 'Username already taken' });
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = bcrypt.hashSync(password, 8);
    
    pendingOtps[username] = { otp, hash, expires: Date.now() + 10 * 60000 };
    
    const mailOptions = {
      from: '"Vardaan Blood Centre" <no-reply@vardaan.org>',
      to: 'neelu.jan01@gmail.com',
      subject: 'OTP for New Staff Registration',
      text: `A new staff member is trying to register with the username "${username}".\n\nThe OTP to complete their registration is: ${otp}\n\nThis OTP expires in 10 minutes. If you did not authorize this, please ignore this email.`
    };
    
    if (transporter) {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending OTP email:', error);
          return res.status(500).json({ error: 'Failed to send OTP email' });
        }
        console.log('Real OTP Email successfully sent to admin!');
        res.json({ success: true, message: 'OTP sent to admin email' });
      });
    } else {
      res.status(500).json({ error: 'Mail transporter not ready yet' });
    }
  });
});

app.post('/api/auth/register/verify-otp', (req, res) => {
  const { username, otp } = req.body;
  const record = pendingOtps[username];
  
  if (!record) return res.status(400).json({ error: 'No pending registration found' });
  if (Date.now() > record.expires) {
    delete pendingOtps[username];
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }
  if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
  
  db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, [username, record.hash, 'staff'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    delete pendingOtps[username];
    const token = jwt.sign({ id: this.lastID, username, role: 'staff' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, role: 'staff', username });
  });
});
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid username or password' });
    
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    insertLog(user.username, 'LOGIN', 'User logged in successfully');
    res.json({ token, role: user.role, username: user.username });
  });
});

app.get('/api/logs', authenticateToken, requireAdmin, (req, res) => {
  db.all(`SELECT * FROM logs ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Add bulk import donors
app.post('/api/donors/bulk', authenticateToken, (req, res) => {
  const { donors } = req.body;
  if (!Array.isArray(donors)) return res.status(400).json({ error: 'Expected array of donors' });

  // Use a transaction for bulk insert
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    const stmt = db.prepare(`INSERT INTO donors (donorId, name, relativeName, age, gender, bloodGroup, contact, email, address, lastDonationDate, diseasePositive, diseases, notes, financialYear, donationHistory, camp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    
    donors.forEach(donor => {
      stmt.run(
        donor.id || null, donor.name, donor.relativeName, donor.age, donor.gender, donor.bloodGroup, donor.contact, donor.email, donor.address, donor.lastDonationDate, donor.diseasePositive, donor.diseases, donor.notes, donor.financialYear, donor.donationHistory ? JSON.stringify(donor.donationHistory) : null, donor.camp
      );
    });
    
    stmt.finalize();
    db.run("COMMIT", (err) => {
      if (err) {
        console.error("Bulk insert failed:", err);
        return res.status(500).json({ error: 'Bulk insert failed' });
      }
      insertLog(req.user.username, 'BULK_IMPORT', `Imported ${donors.length} donors`);
      res.json({ success: true, count: donors.length });
    });
  });
});

// --- Donors Routes ---
app.get('/api/donors', authenticateToken, (req, res) => {
  db.all(`SELECT * FROM donors`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // Map donorId to id for frontend compatibility
    const formattedRows = rows.map(r => ({
      ...r,
      id: r.donorId || `D-${r.id}`
    }));
    res.json(formattedRows);
  });
});

app.post('/api/donors', authenticateToken, (req, res) => {
  const { id, name, relativeName, age, gender, bloodGroup, contact, email, address, lastDonationDate, diseasePositive, diseases, notes, financialYear, donationHistory, camp } = req.body;
  
  db.run(`INSERT INTO donors (donorId, name, relativeName, age, gender, bloodGroup, contact, email, address, lastDonationDate, diseasePositive, diseases, notes, financialYear, donationHistory, camp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, relativeName, age, gender, bloodGroup, contact, email, address, lastDonationDate, diseasePositive, diseases, notes, financialYear, donationHistory ? JSON.stringify(donationHistory) : null, camp],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      insertLog(req.user.username, 'ADD_DONOR', `Added donor: ${name} (${id})`);
      res.json({ id: this.lastID, donorId: id, name, relativeName, age, gender, bloodGroup, contact, email, address, lastDonationDate, diseasePositive, diseases, notes, financialYear, donationHistory, camp });
    });
});

app.put('/api/donors/:id', authenticateToken, (req, res) => {
  const donorIdParam = req.params.id;
  const { name, relativeName, age, gender, bloodGroup, contact, email, address, lastDonationDate, diseasePositive, diseases, notes, financialYear, donationHistory, camp } = req.body;
  
  db.run(`UPDATE donors SET name = ?, relativeName = ?, age = ?, gender = ?, bloodGroup = ?, contact = ?, email = ?, address = ?, lastDonationDate = ?, diseasePositive = ?, diseases = ?, notes = ?, financialYear = ?, donationHistory = ?, camp = ? WHERE donorId = ?`,
    [name, relativeName, age, gender, bloodGroup, contact, email, address, lastDonationDate, diseasePositive, diseases, notes, financialYear, donationHistory ? JSON.stringify(donationHistory) : null, camp, donorIdParam],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      insertLog(req.user.username, 'UPDATE_DONOR', `Updated donor ID: ${donorIdParam}`);
      res.json({ success: true, changes: this.changes });
    });
});

app.delete('/api/donors/:id', authenticateToken, (req, res) => {
  db.run(`DELETE FROM donors WHERE donorId = ?`, req.params.id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    insertLog(req.user.username, 'DELETE_DONOR', `Deleted donor ID: ${req.params.id}`);
    res.json({ success: true, changes: this.changes });
  });
});

// --- Camps Routes ---
app.get('/api/camps', authenticateToken, (req, res) => {
  db.all(`SELECT * FROM camps`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/camps', authenticateToken, requireAdmin, (req, res) => {
  const { name, location, date, status } = req.body;
  
  db.run(`INSERT INTO camps (name, location, date, status) VALUES (?, ?, ?, ?)`,
    [name, location, date, status || 'upcoming'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      insertLog(req.user.username, 'ADD_CAMP', `Added camp: ${name}`);
      res.json({ id: this.lastID, ...req.body });
    });
});

app.put('/api/camps/:id', authenticateToken, requireAdmin, (req, res) => {
  const { name, location, date, status } = req.body;
  
  db.run(`UPDATE camps SET name = ?, location = ?, date = ?, status = ? WHERE id = ?`,
    [name, location, date, status, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      insertLog(req.user.username, 'UPDATE_CAMP', `Updated camp ID: ${req.params.id}`);
      res.json({ message: 'Updated successfully' });
    });
});

app.delete('/api/camps/:id', authenticateToken, requireAdmin, (req, res) => {
  db.run(`DELETE FROM camps WHERE id = ?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    insertLog(req.user.username, 'DELETE_CAMP', `Deleted camp ID: ${req.params.id}`);
    res.json({ message: 'Deleted successfully' });
  });
});

// --- SMS Routes ---
app.post('/api/sms/send', authenticateToken, (req, res) => {
  const { phone, message } = req.body;
  
  // TODO: Integrate actual SMS Provider here (Twilio, Fast2SMS, etc.)
  console.log(`[SMS STUB] Sending to ${phone}: ${message}`);
  
  // Simulate network delay
  setTimeout(() => {
    res.json({ success: true, message: 'SMS Sent Successfully (Stub)' });
  }, 1000);
});

// --- System & Backup API ---
app.get('/api/system/info', (req, res) => {
  let ipAddress = 'localhost';
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal && !alias.address.startsWith('169.254')) {
        ipAddress = alias.address;
        break;
      }
    }
  }

  res.json({
    hostname: os.hostname(),
    ip: ipAddress,
    platform: os.platform(),
    port: PORT
  });
});

app.get('/api/system/backup', authenticateToken, (req, res) => {
  try {
    const { app: electronApp } = require('electron');
    let dbPath;
    if (electronApp && electronApp.getPath) {
      dbPath = path.join(electronApp.getPath('userData'), 'database.sqlite');
    } else {
      dbPath = path.resolve(__dirname, 'database.sqlite');
    }
    res.download(dbPath, `BloodBank_Backup_${new Date().toISOString().split('T')[0]}.sqlite`);
  } catch (err) {
    const dbPath = path.resolve(__dirname, 'database.sqlite');
    res.download(dbPath, `BloodBank_Backup_${new Date().toISOString().split('T')[0]}.sqlite`);
  }
});

// Fallback to index.html for React Router / SPA routing
app.delete('/api/reset', authenticateToken, requireAdmin, (req, res) => {
  db.serialize(() => {
    db.run(`DELETE FROM donors`, (err) => {
      if (err) console.error("Error clearing donors:", err);
    });
    db.run(`DELETE FROM camps`, (err) => {
      if (err) console.error("Error clearing camps:", err);
    });
    db.run(`DELETE FROM sqlite_sequence WHERE name='donors' OR name='camps'`, (err) => {
      if (err) console.error("Error resetting sequence:", err);
    });
    insertLog(req.user.username, 'RESET_DB', 'Database was completely reset');
    res.json({ success: true, message: "Database reset successfully" });
  });
});

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  } else {
    next();
  }
});

// Start Server with EADDRINUSE handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.warn(`[WARNING] Port ${PORT} is already in use. The Express server is likely already running in the background. Continuing...`);
    // We don't crash, we just let Electron use the existing server running on 3001!
  } else {
    console.error('Express Server Error:', e);
  }
});
