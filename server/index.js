const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const os = require('os');
const db = require('./db');
const nodemailer = require('nodemailer');
const fs = require('fs');
const readline = require('readline');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

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
  
  // 1. Log to Database
  db.run(`INSERT INTO logs (timestamp, username, action, details) VALUES (?, ?, ?, ?)`, 
    [timestamp, username, action, details], (err) => {
      if (err) console.error("Failed to insert log to DB:", err.message);
    });
    
  // 2. Log to Flat File
  const logEntry = `[${timestamp}] [${action}] USER: ${username} - DETAILS: ${details}\n`;
  const auditFile = path.join(__dirname, 'audit.log');
  fs.appendFile(auditFile, logEntry, (err) => {
    if (err) console.error("Failed to write to audit.log:", err.message);
  });
};

const cleanupOldLogs = () => {
  const thresholdDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  
  // Delete from DB
  db.run(`DELETE FROM logs WHERE timestamp < ?`, [thresholdDate], function(err) {
    if (err) console.error("Error cleaning old DB logs:", err.message);
    else if (this.changes > 0) console.log(`Cleaned up ${this.changes} old logs from DB.`);
  });
  
  // Clean flat file
  const auditFile = path.join(__dirname, 'audit.log');
  const tempFile = path.join(__dirname, 'audit.tmp.log');
  
  if (fs.existsSync(auditFile)) {
    const rl = readline.createInterface({
      input: fs.createReadStream(auditFile),
      crlfDelay: Infinity
    });
    const writeStream = fs.createWriteStream(tempFile);
    
    rl.on('line', (line) => {
      const match = line.match(/^\[(.*?)\]/);
      if (match && match[1]) {
        if (match[1] >= thresholdDate) {
          writeStream.write(line + '\n');
        }
      } else {
        writeStream.write(line + '\n');
      }
    });
    
    rl.on('close', () => {
      writeStream.end();
      fs.rename(tempFile, auditFile, (err) => {
        if (err) console.error("Failed to rename temp audit file:", err.message);
      });
    });
  }
};

// Run cleanup on startup, then every 24 hours
cleanupOldLogs();
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve the React frontend statically
app.use(express.static(path.join(__dirname, '../dist')));

// React Router fallback (must be placed before generic error handlers, but after API routes)
// Wait, this needs to be at the very bottom of the file!

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  if (!token && req.query.token) {
    token = req.query.token;
  }
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

app.get('/api/network', (req, res) => {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  const hostname = os.hostname();
  res.json({ ips: results, hostname, port: PORT });
});

// --- Auth Routes ---
app.post('/api/auth/register/request-otp', (req, res) => {
  let { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  username = username.toLowerCase();
  
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
  let { username, otp } = req.body;
  if (username) username = username.toLowerCase();
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
// --- Password Recovery Routes ---
app.post('/api/auth/recover/request-otp', (req, res) => {
  let { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  username = username.toLowerCase();
  
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: 'Username not found' });
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    pendingOtps[username] = { otp, expires: Date.now() + 10 * 60000, recovery: true };
    
    const mailOptions = {
      from: '"Vardaan Blood Centre" <no-reply@vardaan.org>',
      to: 'neelu.jan01@gmail.com',
      subject: 'OTP for Account Recovery',
      text: `Account recovery requested for username "${username}".\n\nThe OTP to reset their password is: ${otp}\n\nThis OTP expires in 10 minutes.`
    };
    
    if (transporter) {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending OTP email:', error);
          return res.status(500).json({ error: 'Failed to send OTP email' });
        }
        res.json({ success: true, message: 'OTP sent to admin email' });
      });
    } else {
      res.status(500).json({ error: 'Mail transporter not ready yet' });
    }
  });
});

app.post('/api/auth/recover/reset-password', (req, res) => {
  let { username, otp, newPassword } = req.body;
  if (username) username = username.toLowerCase();
  const record = pendingOtps[username];
  
  if (!record || !record.recovery) return res.status(400).json({ error: 'No pending recovery found' });
  if (Date.now() > record.expires) {
    delete pendingOtps[username];
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }
  if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
  if (!newPassword) return res.status(400).json({ error: 'New password required' });
  
  const hash = bcrypt.hashSync(newPassword, 8);
  db.run(`UPDATE users SET password = ? WHERE username = ?`, [hash, username], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    delete pendingOtps[username];
    insertLog(username, 'RECOVER_ACCOUNT', 'User reset their password via OTP');
    res.json({ success: true, message: 'Password reset successfully' });
  });
});

app.post('/api/auth/login', (req, res) => {
  let { username, password } = req.body;
  if (username) username = username.toLowerCase();
  
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
  const { date } = req.query;
  let query = `SELECT * FROM logs`;
  let params = [];
  if (date) {
    query += ` WHERE timestamp LIKE ?`;
    params.push(`${date}%`);
  }
  query += ` ORDER BY id DESC`;

  db.all(query, params, (err, rows) => {
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
  const { page = 1, limit = 50, search = '', bloodGroup = '', fy = '', camp = '', status = '', date = '' } = req.query;
  const offset = (page - 1) * limit;

  let query = `SELECT * FROM donors WHERE 1=1`;
  let countQuery = `SELECT COUNT(*) as total FROM donors WHERE 1=1`;
  const params = [];

  if (search) {
    query += ` AND (name LIKE ? OR contact LIKE ? OR donorId LIKE ?)`;
    countQuery += ` AND (name LIKE ? OR contact LIKE ? OR donorId LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (bloodGroup) {
    query += ` AND bloodGroup = ?`;
    countQuery += ` AND bloodGroup = ?`;
    params.push(bloodGroup);
  }
  if (fy) {
    query += ` AND financialYear = ?`;
    countQuery += ` AND financialYear = ?`;
    params.push(fy);
  }
  if (camp) {
    query += ` AND camp = ?`;
    countQuery += ` AND camp = ?`;
    params.push(camp);
  }
  if (date) {
    query += ` AND lastDonationDate = ?`;
    countQuery += ` AND lastDonationDate = ?`;
    params.push(date);
  }
  
  if (status) {
    if (status === 'eligible') {
      const cond = ` AND (diseasePositive = 0 OR diseasePositive = 'false' OR diseasePositive IS NULL) AND (lastDonationDate IS NULL OR lastDonationDate <= date('now', '-90 days'))`;
      query += cond; countQuery += cond;
    } else if (status === 'deferred') {
      const cond = ` AND (diseasePositive = 1 OR diseasePositive = 'true' OR diseases != '')`;
      query += cond; countQuery += cond;
    } else if (status === 'pending' || status === 'ineligible') {
      const cond = ` AND (diseasePositive = 0 OR diseasePositive = 'false' OR diseasePositive IS NULL) AND (lastDonationDate > date('now', '-90 days'))`;
      query += cond; countQuery += cond;
    }
  }

  const orderStr = req.query.sort === 'oldest' ? 'ASC' : 'DESC';
  query += ` ORDER BY id ${orderStr} LIMIT ? OFFSET ?`;
  const dataParams = [...params, parseInt(limit), parseInt(offset)];

  db.get(countQuery, params, (err, countRow) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all(query, dataParams, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const formattedRows = rows.map(r => ({
        ...r,
        id: r.donorId || `D-${r.id}`
      }));
      
      res.json({
        donors: formattedRows,
        total: countRow.total,
        page: parseInt(page),
        totalPages: Math.ceil(countRow.total / limit)
      });
    });
  });
});

app.get('/api/donors/stats', authenticateToken, (req, res) => {
  const fy = req.query.fy;
  const filter = fy ? `WHERE financialYear = ?` : ``;
  const params = fy ? [fy] : [];

  const queries = {
    total: `SELECT COUNT(*) as count FROM donors ${filter}`,
    eligible: `SELECT COUNT(*) as count FROM donors WHERE (diseasePositive = 0 OR diseasePositive = 'false' OR diseasePositive IS NULL) AND (lastDonationDate IS NULL OR lastDonationDate <= date('now', '-90 days')) ${fy ? 'AND financialYear = ?' : ''}`,
    deferred: `SELECT COUNT(*) as count FROM donors WHERE (diseasePositive = 1 OR diseasePositive = 'true' OR diseases != '') ${fy ? 'AND financialYear = ?' : ''}`,
    pending: `SELECT COUNT(*) as count FROM donors WHERE (diseasePositive = 0 OR diseasePositive = 'false' OR diseasePositive IS NULL) AND (lastDonationDate > date('now', '-90 days')) ${fy ? 'AND financialYear = ?' : ''}`,
    byBloodGroup: `SELECT bloodGroup, COUNT(*) as count FROM donors WHERE (diseasePositive = 0 OR diseasePositive = 'false' OR diseasePositive IS NULL) AND (lastDonationDate IS NULL OR lastDonationDate <= date('now', '-90 days')) ${fy ? 'AND financialYear = ?' : ''} GROUP BY bloodGroup`
  };

  const results = {};
  let completed = 0;
  const queryKeys = Object.keys(queries);

  queryKeys.forEach(key => {
    const q = queries[key];
    if (key === 'byBloodGroup') {
      db.all(q, params, (err, rows) => {
        results[key] = rows || [];
        checkDone();
      });
    } else {
      db.get(q, params, (err, row) => {
        results[key] = row ? row.count : 0;
        checkDone();
      });
    }
  });

  function checkDone() {
    completed++;
    if (completed === queryKeys.length) {
      res.json(results);
    }
  }
});

app.get('/api/donors/fys', authenticateToken, (req, res) => {
  db.all(`SELECT DISTINCT financialYear FROM donors WHERE financialYear IS NOT NULL ORDER BY financialYear DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => r.financialYear));
  });
});

app.get('/api/donors/export', authenticateToken, (req, res) => {
  const { search = '', bloodGroup = '', fy = '', camp = '' } = req.query;

  let query = `SELECT * FROM donors WHERE 1=1`;
  const params = [];

  if (search) {
    query += ` AND (name LIKE ? OR contact LIKE ? OR donorId LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (bloodGroup) {
    query += ` AND bloodGroup = ?`;
    params.push(bloodGroup);
  }
  if (fy) {
    query += ` AND financialYear = ?`;
    params.push(fy);
  }
  if (camp) {
    query += ` AND camp = ?`;
    params.push(camp);
  }

  query += ` ORDER BY id DESC`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="donors_export.csv"');

  // Write CSV header
  res.write('ID,Donor ID,Name,Relative Name,Age,Gender,Blood Group,Contact,Email,Address,Last Donation Date,Disease Positive,Diseases,Notes,Financial Year,Camp\n');

  db.each(query, params, (err, row) => {
    if (err) return; 
    const escapeCsv = (str) => {
      if (!str) return '';
      const s = String(str);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    
    const line = [
      row.id, row.donorId, row.name, row.relativeName, row.age, row.gender, row.bloodGroup,
      row.contact, row.email, row.address, row.lastDonationDate, row.diseasePositive ? 'Yes' : 'No',
      row.diseases, row.notes, row.financialYear, row.camp
    ].map(escapeCsv).join(',');
    
    res.write(line + '\n');
  }, (err, count) => {
    res.end();
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
app.post('/api/reset', authenticateToken, requireAdmin, (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Admin password is required to reset database' });
  }

  db.get(`SELECT password FROM users WHERE username = ?`, [req.user.username], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Admin user not found' });

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid admin password' });

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
