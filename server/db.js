const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Define database file path
let dbPath;
try {
  const { app } = require('electron');
  // When running inside Electron, store the database in the appData folder
  // so it isn't inside the read-only ASAR archive
  if (app && app.getPath) {
    dbPath = path.join(app.getPath('userData'), 'database.sqlite');
  } else {
    throw new Error('Not running inside Electron app context');
  }
} catch (err) {
  // Fallback for standalone Node.js development mode
  dbPath = path.resolve(__dirname, 'database.sqlite');
}

// Initialize database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Create tables
    db.serialize(() => {
      // Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
      )`);

      // Donors table - Match exact frontend schema
      db.run(`CREATE TABLE IF NOT EXISTS donors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        donorId TEXT,
        name TEXT,
        relativeName TEXT,
        age INTEGER,
        gender TEXT,
        bloodGroup TEXT,
        contact TEXT,
        email TEXT,
        address TEXT,
        lastDonationDate TEXT,
        diseasePositive BOOLEAN,
        diseases TEXT,
        notes TEXT,
        financialYear TEXT,
        donationHistory TEXT,
        camp TEXT
      )`, (err) => {
        if (!err) {
          // Check if table needs migration (missing 'contact' col)
          db.all("PRAGMA table_info(donors)", (err, columns) => {
            if (!err && columns.length > 0) {
              const hasContact = columns.some(c => c.name === 'contact');
              if (!hasContact) {
                console.log("Migrating donors table schema...");
                db.run("DROP TABLE donors", () => {
                  db.run(`CREATE TABLE donors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    donorId TEXT,
                    name TEXT,
                    relativeName TEXT,
                    age INTEGER,
                    gender TEXT,
                    bloodGroup TEXT,
                    contact TEXT,
                    email TEXT,
                    address TEXT,
                    lastDonationDate TEXT,
                    diseasePositive BOOLEAN,
                    diseases TEXT,
                    notes TEXT,
                    financialYear TEXT,
                    donationHistory TEXT,
                    camp TEXT
                  )`);
                });
              }
            }
          });
        }
      });

      // Camps table
      db.run(`CREATE TABLE IF NOT EXISTS camps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        location TEXT,
        date TEXT,
        status TEXT
      )`);

      // Logs table for Audit Trail
      db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        username TEXT,
        action TEXT,
        details TEXT
      )`);

      // Insert default admin user if none exists
      db.get(`SELECT * FROM users WHERE role = ?`, ['admin'], (err, row) => {
        if (!row) {
          const salt = bcrypt.genSaltSync(10);
          const hash = bcrypt.hashSync('admin123', salt);
          db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, 
            ['admin', hash, 'admin'], 
            (insertErr) => {
              if (insertErr) {
                console.error('Error creating default admin', insertErr);
              } else {
                console.log('Created default admin user: admin / admin123');
              }
            });
        }
      });
    });
  }
});

module.exports = db;
