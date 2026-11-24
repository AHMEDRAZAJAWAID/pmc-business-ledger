import React, { useEffect, useState } from 'react'
import { api } from '../api'

export default function Dashboard({ onPartyClick }) {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const load = async () => {
    setLoading(true)
    const s = await api.getDash()
    setStats(s)
    setLoading(false)
  }

  // Backup Export Function
  const handleExportBackup = async () => {
    try {
      setExporting(true)
      const res = await fetch('http://localhost:3001/api/backup/export')
      const data = await res.json()
      if (data.success) {
        alert('Backup kamyabi se ban gaya hai!\nFile yahan save hui hai: ' + data.path)
      } else {
        alert('Backup nahi ban saka: ' + data.error)
      }
    } catch (err) {
      alert('Server ke sath connection ka masla hai.')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',color:'#64748b',fontSize:18}}>
      Loading...
    </div>
  )

  const today = new Date().toLocaleDateString('en-PK', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">{today}</div>
        </div>
        <div style={{display:'flex', gap:'8px'}}>
          <button 
            className="btn btn-sm" 
            style={{background:'#059669', color:'#fff'}} 
            onClick={handleExportBackup}
            disabled={exporting}
          >
            {exporting ? 'Saving...' : '📥 Export Backup'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={load}>🔄 Refresh</button>
        </div>
      </div>

      <div className="stat-cards">
        <div className="card-sm">
          <div className="stat-label">Aaj ki Sales</div>
          <div className="stat-value green">Rs. {stats.todaySales.toLocaleString()}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Aaj Collection Aaya</div>
          <div className="stat-value blue">Rs. {stats.todayCollected.toLocaleString()}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Overdue Parties</div>
          <div className="stat-value red">{stats.overdue.length}</div>
        </div>
      </div>

      {stats.overdue.length > 0 ? (
        <div className="card">
          <div style={{fontWeight:700,color:'#f87171',fontSize:16,marginBottom:16}}>
            🔴 Overdue — Payment Due Aa Gayi ({stats.overdue.length})
          </div>
          {stats.overdue.map(d => {
            const days = Math.floor((new Date() - new Date(d.due_date)) / 86400000)
            return (
              <div key={d.id} className="due-item" style={{cursor:'pointer'}}
                onClick={() => onPartyClick({id:d.party_id, name:d.party_name})}>
                <div>
                  <div style={{fontWeight:600}}>{d.party_name}</div>
                  <div style={{fontSize:12,color:'#64748b',marginTop:2}}>
                    Due: {d.due_date} · Item: {d.item_name||'—'}
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontWeight:700,color:'#f87171'}}>Rs. {d.amount.toLocaleString()}</div>
                  <div style={{fontSize:12,color:'#f87171',marginTop:2}}>{days} din se due</div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card" style={{textAlign:'center',padding:'40px',color:'#34d399'}}>
          <div style={{fontSize:40,marginBottom:12}}>✅</div>
          <div style={{fontWeight:600,fontSize:16}}>Koi overdue nahi!</div>
          <div style={{color:'#64748b',marginTop:4,fontSize:14}}>Sab payments time pe hain</div>
        </div>
      )}
    </div>
  )
}