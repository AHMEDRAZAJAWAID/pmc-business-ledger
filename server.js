const express = require('express')
const cors    = require('cors')
const path    = require('path')
const fs      = require('fs')
const { exec } = require('child_process')
const Database = require('better-sqlite3')

const app = express()
app.use(cors())
app.use(express.json())

// --- LOCAL / USB DATABASE PATH (Bina USB ke local folder mein chalega) ---
const dbDir = process.env.PMC_DB_DIR || process.env.PMC_DATA_DIR || __dirname

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const dbPath = process.env.PMC_DB_PATH || path.join(dbDir, 'pmc-data.db')
console.log('Active Database Path:', dbPath)

const db = new Database(dbPath)

db.pragma('journal_mode = DELETE')
db.pragma('synchronous = FULL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, type TEXT NOT NULL,
    phone TEXT, credit_days INTEGER DEFAULT 0,
    notes TEXT, active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (date('now'))
  );
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_id INTEGER NOT NULL REFERENCES parties(id),
    entry_type TEXT NOT NULL, item_name TEXT,
    qty REAL, rate REAL, amount REAL NOT NULL,
    entry_date TEXT NOT NULL, delivery_date TEXT,
    due_date TEXT, notes TEXT, deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`)

// --- BACKUP EXPORT ROUTE ---
app.get('/api/backup/export', (req, res) => {
  try {
    const backupDir = process.env.PMC_DB_DIR || process.env.PMC_DATA_DIR || path.dirname(dbPath)
    const backupPath = path.join(backupDir, `pmc_backup_${Date.now()}.db`)
    fs.copyFileSync(dbPath, backupPath)
    exec(`explorer.exe /select,"${backupPath}"`)
    res.json({ success: true, path: backupPath })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.get('/api/parties', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT p.*,
        COALESCE(SUM(CASE WHEN e.entry_type='sale' THEN e.amount ELSE 0 END),0)
- COALESCE(SUM(CASE WHEN e.entry_type='payment_in' THEN e.amount ELSE 0 END),0) AS cust_balance,
        COALESCE(SUM(CASE WHEN e.entry_type='purchase' THEN e.amount ELSE 0 END),0)
- COALESCE(SUM(CASE WHEN e.entry_type='payment_out' THEN e.amount ELSE 0 END),0) AS supp_balance
      FROM parties p
      LEFT JOIN entries e ON e.party_id=p.id AND e.deleted=0
      WHERE p.active=1 GROUP BY p.id ORDER BY p.name
    `).all()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/parties', (req, res) => {
  try {
    const { name, type, phone, credit_days, notes } = req.body
    const r = db.prepare('INSERT INTO parties (name,type,phone,credit_days,notes) VALUES (?,?,?,?,?)')
      .run(name, type, phone || '', credit_days ?? 0, notes || '')
    res.json({ id: r.lastInsertRowid })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/parties/:id', (req, res) => {
  try {
    const { name, type, phone, credit_days, notes } = req.body
    db.prepare(`
      UPDATE parties
      SET name = ?, type = ?, phone = ?, credit_days = ?, notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(name, type, phone || '', credit_days ?? 0, notes ?? null, req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/parties/:id', (req, res) => {
  try {
    db.prepare('UPDATE parties SET active=0 WHERE id=?').run(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/entries/:partyId', (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT e.* FROM entries e
       JOIN parties p ON p.id = e.party_id
       WHERE e.party_id=? AND e.deleted=0 AND p.active=1
       ORDER BY e.entry_date ASC, e.id ASC`
    ).all(req.params.partyId)
    let bal = 0
    res.json(rows.map(r => {
      if (r.entry_type === 'sale' || r.entry_type === 'purchase') bal += Number(r.amount || 0)
      else bal -= Number(r.amount || 0)
      return { ...r, balance: bal }
    }))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/entries', (req, res) => {
  try {
    const { party_id, entry_type, item_name, qty, rate, amount,
            entry_date, delivery_date, due_date, notes } = req.body
    const r = db.prepare(`
      INSERT INTO entries (party_id,entry_type,item_name,qty,rate,amount,entry_date,delivery_date,due_date,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(party_id, entry_type, item_name || '', qty ?? null, rate ?? null,
           Number(amount || 0), entry_date, delivery_date || null, due_date || null, notes || '')
    res.json({ id: r.lastInsertRowid })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- EDIT / UPDATE ENTRY ROUTE (Amount, Item, Dates, Notes) ---
app.put('/api/entries/:id', (req, res) => {
  try {
    const { entry_type, item_name, qty, rate, amount,
            entry_date, delivery_date, due_date, notes } = req.body
    db.prepare(`
      UPDATE entries
      SET entry_type = COALESCE(?, entry_type),
          item_name = ?,
          qty = ?,
          rate = ?,
          amount = ?,
          entry_date = ?,
          delivery_date = ?,
          due_date = ?,
          notes = ?
      WHERE id = ? AND deleted = 0
    `).run(
      entry_type || null,
      item_name || '',
      qty ?? null,
      rate ?? null,
      Number(amount || 0),
      entry_date,
      delivery_date || null,
      due_date || null,
      notes || '',
      req.params.id
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/entries/:id', (req, res) => {
  try {
    db.prepare('UPDATE entries SET deleted=1 WHERE id=?').run(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/dashboard', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const todaySales = db.prepare(
      `SELECT COALESCE(SUM(e.qty),0) v
       FROM entries e
       JOIN parties p ON p.id = e.party_id
       WHERE e.entry_type='sale' AND e.entry_date=? AND e.deleted=0 AND p.active=1`
    ).get(today).v
    const todayCollected = db.prepare(
      `SELECT COALESCE(SUM(e.amount),0) v
       FROM entries e
       JOIN parties p ON p.id = e.party_id
       WHERE e.entry_type='payment_in' AND e.entry_date=? AND e.deleted=0 AND p.active=1`
    ).get(today).v
    const overdue = db.prepare(`
      SELECT e.id,e.amount,e.due_date,e.item_name,e.party_id,p.name AS party_name
      FROM entries e JOIN parties p ON p.id=e.party_id
      WHERE e.entry_type='sale' AND e.due_date IS NOT NULL AND e.due_date < ?
        AND e.deleted=0 AND p.active=1
      ORDER BY e.due_date ASC LIMIT 20
    `).all(today)
    res.json({ todaySales, todayCollected, overdue })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/reports/monthly/:ym', (req, res) => {
  try {
    const ym = req.params.ym
    const get = t => db.prepare(
      `SELECT COALESCE(SUM(e.amount),0) v
       FROM entries e
       JOIN parties p ON p.id = e.party_id
       WHERE e.entry_type=? AND strftime('%Y-%m',e.entry_date)=? AND e.deleted=0 AND p.active=1`
    ).get(t, ym).v
    const sales = get('sale'), purchases = get('purchase'), collected = get('payment_in')
    res.json({ sales, purchases, collected, profit: sales - purchases })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/reports/balances', (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT p.id,p.name,p.type,p.phone,
        COALESCE(SUM(CASE WHEN e.entry_type='sale' THEN e.amount ELSE 0 END),0)
- COALESCE(SUM(CASE WHEN e.entry_type='payment_in' THEN e.amount ELSE 0 END),0) AS balance,
        COALESCE(SUM(CASE WHEN e.entry_type='purchase' THEN e.amount ELSE 0 END),0)
- COALESCE(SUM(CASE WHEN e.entry_type='payment_out' THEN e.amount ELSE 0 END),0) AS supp_balance
      FROM parties p LEFT JOIN entries e ON e.party_id=p.id AND e.deleted=0
      WHERE p.active=1 GROUP BY p.id ORDER BY p.name ASC
    `).all())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/reports/all-ledger', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT e.*, p.name AS party_name, p.type AS party_type, p.phone AS party_phone
      FROM entries e
      JOIN parties p ON p.id = e.party_id
      WHERE e.deleted = 0 AND p.active = 1
      ORDER BY p.name ASC, e.entry_date ASC, e.id ASC
    `).all()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(3001, () => console.log('PMC Server running on port 3001'))