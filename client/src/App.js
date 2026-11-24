import React, { useState } from 'react'
import Dashboard from './components/Dashboard'
import Khata from './components/Khata'
import Parties from './components/Parties'
import NewEntry from './components/NewEntry'
import PartyDetail from './components/PartyDetail'
import Reports from './components/Reports'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [tab, setTab] = useState('dashboard')
  const [selectedParty, setSelectedParty] = useState(null)

  const handlePartyClick = (party) => {
    setSelectedParty(party)
    setTab('partyDetail')
  }

  // Password Check karne ka function
  const handleLogin = (e) => {
    e.preventDefault()
    // Yahan aap apna pasandeeda password rakh sakte hain (Abhi '1234' set hai)
    const MY_PASSWORD = '1234'

    if (passwordInput === MY_PASSWORD) {
      setIsAuthenticated(true)
      setErrorMsg('')
    } else {
      setErrorMsg('Ghalat Password! Dobara koshish karein.')
    }
  }

  // Agar password match nahi hua toh sirf yeh Login Screen nazar aayegi
  if (!isAuthenticated) {
    return (
      <div style={{display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0f172a'}}>
        <form onSubmit={handleLogin} style={{background: '#1e293b', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', width: '320px', textAlign: 'center'}}>
          <h2 style={{color: '#fff', marginBottom: '20px'}}>🔒 PMC Business Login</h2>
          <input 
            type="password" 
            placeholder="Apna Password Dalein" 
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            style={{width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#fff', fontSize: '16px'}}
            autoFocus
          />
          <button type="submit" style={{width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px'}}>
            Login Karein
          </button>
          {errorMsg && <div style={{color: '#f87171', marginTop: '12px', fontSize: '14px'}}>{errorMsg}</div>}
        </form>
      </div>
    )
  }

  // Jab password theek ho jayega tab aapka poora software khul jayega
  return (
    <div className="layout">
      {/* Sidebar */}
      <div className="sidebar no-print">
        <div className="sidebar-logo">
          <h2>PMC Business</h2>
          <p>Khata Manager</p>
        </div>
        <div className="sidebar-nav">
          <div className={`nav-item ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
            <span className="nav-icon">📊</span> Dashboard
          </div>
          <div className={`nav-item ${tab === 'khata' ? 'active' : ''}`} onClick={() => { setSelectedParty(null); setTab('khata'); }}>
            <span className="nav-icon">📒</span> Khata
          </div>
          <div className={`nav-item ${tab === 'parties' ? 'active' : ''}`} onClick={() => { setSelectedParty(null); setTab('parties'); }}>
            <span className="nav-icon">👥</span> Parties
          </div>
          <div className={`nav-item ${tab === 'newEntry' ? 'active' : ''}`} onClick={() => setTab('newEntry')}>
            <span className="nav-icon">➕</span> New Entry
          </div>
          <div className={`nav-item ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
            <span className="nav-icon">📈</span> Reports
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        {tab === 'dashboard' && <Dashboard onPartyClick={handlePartyClick} />}
        {tab === 'khata' && <Khata />}
        {tab === 'parties' && <Parties />}
        {tab === 'newEntry' && <NewEntry />}
        {tab === 'reports' && <Reports />}
        {tab === 'partyDetail' && selectedParty && (
          <PartyDetail party={selectedParty} onBack={() => setTab('parties')} />
        )}
      </div>
    </div>
  )
}