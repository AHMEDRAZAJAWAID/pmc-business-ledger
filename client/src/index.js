import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// Safe fallback taake agar window.api load na ho toh app crash na ho
if (!window.api) {
  window.api = {
    isSetup: () => Promise.resolve({ done: true }),
    setup: () => Promise.resolve({ ok: true }),
    login: () => Promise.resolve({ ok: true }),
    getParties: () => Promise.resolve([]),
    addParty: () => Promise.resolve({}),
    deleteParty: () => Promise.resolve({ ok: true }),
    getPartyLedger: () => Promise.resolve([]),
    addEntry: () => Promise.resolve({}),
    deleteEntry: () => Promise.resolve({ ok: true }),
    getDashStats: () => Promise.resolve({ todaySales: 0, todayCollected: 0, overdue: [] }),
    getMonthlyReport: () => Promise.resolve({ sales: 0, purchases: 0, collected: 0, profit: 0 }),
    getAllBalances: () => Promise.resolve([]),
    exportBackup: () => Promise.resolve({ ok: false })
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)