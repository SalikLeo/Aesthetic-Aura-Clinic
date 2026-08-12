const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db;

function initDb() {
  const dbPath = path.join(app.getPath('userData'), 'aesthetic_aura.db');
  db = new Database(dbPath, { verbose: console.log });
  console.log('Connected to SQLite database at:', dbPath);

  // Initialize Schema
  const schema = `
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      blood_group TEXT,
      medical_history TEXT,
      weight REAL,
      allergies TEXT,
      chronic_diseases TEXT,
      laser TEXT,
      session TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department TEXT,
      specialization TEXT,
      mobile TEXT,
      visit_fee REAL,
      status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department TEXT,
      cost REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      doctor_id INTEGER,
      date TEXT,
      time TEXT,
      reason TEXT,
      status TEXT CHECK(status IN ('confirmed', 'pending', 'completed', 'cancelled')) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE,
      patient_id INTEGER,
      date TEXT,
      total REAL,
      discount REAL DEFAULT 0,
      item_discount REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'Cash',
      cash_amount REAL DEFAULT 0,
      online_amount REAL DEFAULT 0,
      address TEXT,
      status TEXT CHECK(status IN ('paid', 'unpaid')) DEFAULT 'unpaid',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS invoice_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      service_id INTEGER,
      quantity INTEGER DEFAULT 1,
      price REAL,
      discount REAL DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id),
      FOREIGN KEY (service_id) REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL,
      stock INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoice_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      product_id INTEGER,
      quantity INTEGER DEFAULT 1,
      price REAL,
      discount REAL DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT,
      phone TEXT,
      salary REAL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      amount REAL,
      category TEXT,
      date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoice_doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      doctor_id INTEGER,
      price REAL,
      discount REAL DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      date TEXT,
      description TEXT,
      products TEXT,
      advices TEXT,
      diseases TEXT,
      laser TEXT,
      session TEXT,
      energy INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employee_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.exec(schema);

  // Seed default settings
  try {
    const actionPassCount = db.prepare("SELECT COUNT(*) as count FROM settings WHERE key='action_password'").get().count;
    if (actionPassCount === 0) {
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('action_password', '');
    }
  } catch (e) { console.error("Settings seed failed:", e.message); }

  // Explicitly create tables just in case db.exec(schema) had issues
  db.exec(`
    CREATE TABLE IF NOT EXISTS expense_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS employee_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, value TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `);

  // Seed default categories/roles if empty
  try {
    const catCount = db.prepare("SELECT COUNT(*) as count FROM expense_categories").get().count;
    if (catCount === 0) {
      const defaultCats = ['General', 'Rent', 'Utility', 'Salary', 'Supplies', 'Marketing'];
      const insertCat = db.prepare("INSERT INTO expense_categories (name) VALUES (?)");
      defaultCats.forEach(cat => insertCat.run(cat));
    }
  } catch (e) { console.error("Expense categories seed failed:", e.message); }

  try {
    const roleCount = db.prepare("SELECT COUNT(*) as count FROM employee_roles").get().count;
    if (roleCount === 0) {
      const defaultRoles = ['Doctor', 'Receptionist', 'Nurse', 'Manager', 'Accountant', 'IT Man'];
      const insertRole = db.prepare("INSERT INTO employee_roles (name) VALUES (?)");
      defaultRoles.forEach(role => insertRole.run(role));
    }
  } catch (e) { console.error("Employee roles seed failed:", e.message); }

  // Migration: Add weight, allergies, and chronic_diseases columns if they don't exist
  const patientTableInfo = db.prepare("PRAGMA table_info(patients)").all();
  const columns = patientTableInfo.map(c => c.name);

  if (!columns.includes('weight')) {
    db.prepare("ALTER TABLE patients ADD COLUMN weight REAL").run();
  }
  if (!columns.includes('allergies')) {
    db.prepare("ALTER TABLE patients ADD COLUMN allergies TEXT").run();
  }
  if (!columns.includes('chronic_diseases')) {
    db.prepare("ALTER TABLE patients ADD COLUMN chronic_diseases TEXT").run();
  }
  if (!columns.includes('email')) {
    db.prepare("ALTER TABLE patients ADD COLUMN email TEXT").run();
  }
  if (!columns.includes('laser')) {
    db.prepare("ALTER TABLE patients ADD COLUMN laser TEXT").run();
  }
  if (!columns.includes('session')) {
    db.prepare("ALTER TABLE patients ADD COLUMN session TEXT").run();
  }

  const invoiceTableInfo = db.prepare("PRAGMA table_info(invoices)").all();
  const invoiceColumns = invoiceTableInfo.map(c => c.name);

  if (!invoiceColumns.includes('discount')) {
    db.prepare("ALTER TABLE invoices ADD COLUMN discount REAL DEFAULT 0").run();
  }
  if (!invoiceColumns.includes('address')) {
    db.prepare("ALTER TABLE invoices ADD COLUMN address TEXT").run();
  }
  if (!invoiceColumns.includes('payment_method')) {
    db.prepare("ALTER TABLE invoices ADD COLUMN payment_method TEXT DEFAULT 'Cash'").run();
  }
  if (!invoiceColumns.includes('cash_amount')) {
    db.prepare("ALTER TABLE invoices ADD COLUMN cash_amount REAL DEFAULT 0").run();
  }
  if (!invoiceColumns.includes('online_amount')) {
    db.prepare("ALTER TABLE invoices ADD COLUMN online_amount REAL DEFAULT 0").run();
  }
  if (!invoiceColumns.includes('item_discount')) {
    db.prepare("ALTER TABLE invoices ADD COLUMN item_discount REAL DEFAULT 0").run();
  }

  // Item-wise migrations:
  const servTableInfo = db.prepare("PRAGMA table_info(invoice_services)").all();
  const servColumns = servTableInfo.map(c => c.name);
  if (!servColumns.includes('discount')) {
    db.prepare("ALTER TABLE invoice_services ADD COLUMN discount REAL DEFAULT 0").run();
  }

  const prodTableInfo = db.prepare("PRAGMA table_info(invoice_products)").all();
  const prodColumns = prodTableInfo.map(c => c.name);
  if (!prodColumns.includes('discount')) {
    db.prepare("ALTER TABLE invoice_products ADD COLUMN discount REAL DEFAULT 0").run();
  }

  const docTableInfo = db.prepare("PRAGMA table_info(invoice_doctors)").all();
  const docColumns = docTableInfo.map(c => c.name);
  if (!docColumns.includes('discount')) {
    db.prepare("ALTER TABLE invoice_doctors ADD COLUMN discount REAL DEFAULT 0").run();
  }

  // Migration: Add doctor_id column to sessions table if it doesn't exist
  const sessionTableInfo = db.prepare("PRAGMA table_info(sessions)").all();
  const sessionColumns = sessionTableInfo.map(c => c.name);

  if (!sessionColumns.includes('doctor_id')) {
    db.prepare("ALTER TABLE sessions ADD COLUMN doctor_id INTEGER REFERENCES doctors(id)").run();
  }
  if (!sessionColumns.includes('laser')) {
    db.prepare("ALTER TABLE sessions ADD COLUMN laser TEXT").run();
  }
  if (!sessionColumns.includes('session')) {
    db.prepare("ALTER TABLE sessions ADD COLUMN session TEXT").run();
  }
  if (!sessionColumns.includes('energy')) {
    db.prepare("ALTER TABLE sessions ADD COLUMN energy INTEGER").run();
  }

  return db;
}

function getDb() {
  if (!db) return initDb();
  return db;
}

module.exports = { initDb, getDb };
