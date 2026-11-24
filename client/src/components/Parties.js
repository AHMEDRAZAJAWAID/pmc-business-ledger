import React, { useState, useEffect } from 'react'
import { api } from '../api'

export default function Parties({ onPartyClick }) {
  const [parties,  setParties]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter,   setFilter]   = useState('all')
  const [form, setForm] = useState({
    name:'', type:'customer', phone:'', notes:''
  })

  const load = async () => {
    setLoading(true)
    setParties(await api.getParties())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return alert('Party ka naam likhein!')
    await api.addParty({
      name: form.name.trim(),
      type: form.type,
      phone: form.phone,
      credit_days: 0,
      notes: form.notes
    })
    setForm({ name:'', type:'customer', phone:'', notes:'' })
    setShowForm(false)
    load()
  }

  const del = async (id, name) => {
    if (!window.confirm(`"${name}" delete karein?`)) return
    await api.delParty(id)
    load()
  }

  const customers = parties.filter(p => p.type==='customer')
  const suppliers = parties.filter(p => p.type==='supplier')
  const filtered  = filter==='all' ? parties : parties.filter(p => p.type===filter)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Parties</div>
          <div className="page-sub">Customers & Suppliers</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Add Party'}
        </button>
      </div>

      {/* Stats */}
      <div className="stat-cards" style={{marginBottom:24}}>
        <div className="card-sm">
          <div className="stat-label">Total Customers</div>
          <div className="stat-value blue">{customers.length}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Customers Se Lena</div>
          <div className="stat-value green">
            Rs. {customers.reduce((s,p)=>s+(p.cust_balance||0),0).toLocaleString()}
          </div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Suppliers Ko Dena</div>
          <div className="stat-value red">
            Rs. {suppliers.reduce((s,p)=>s+(p.supp_balance||0),0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card" style={{marginBottom:24}}>
          <div style={{fontWeight:700,marginBottom:16,fontSize:16}}>New Party</div>
          <form onSubmit={save}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Party Name *</label>
                <input className="form-input" placeholder="e.g. Ahmed Traders"
                  value={form.name} onChange={e=>setForm({...form,name:e.target.value})} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type}
                  onChange={e=>setForm({...form,type:e.target.value})}>
                  <option value="customer">Customer (jinko bechte hain)</option>
                  <option value="supplier">Supplier (jinse khareedtey hain)</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" placeholder="03XX-XXXXXXX"
                  value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
              </div>
            </div>
            <div style={{display:'flex',gap:12}}>
              <button type="submit" className="btn btn-success">✅ Save</button>
              <button type="button" className="btn btn-ghost" onClick={()=>setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {['all','customer','supplier'].map(f=>(
          <button key={f} className={`btn btn-sm ${filter===f?'btn-primary':'btn-ghost'}`}
            onClick={()=>setFilter(f)}>
            {f==='all'?`All (${parties.length})`:f==='customer'?`Customers (${customers.length})`:`Suppliers (${suppliers.length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{textAlign:'center',color:'#64748b',padding:40}}>Loading...</div>
      ) : filtered.length===0 ? (
        <div className="card" style={{textAlign:'center',padding:40,color:'#64748b'}}>
          <div style={{fontSize:40,marginBottom:12}}>👥</div>
          <div>Koi party nahi — upar se add karein</div>
        </div>
      ) : (
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <table>
            <thead>
              <tr>
                <th>Party Name</th>
                <th>Type</th>
                <th>Phone</th>
                <th style={{textAlign:'right'}}>Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const bal = p.type==='customer'?(p.cust_balance||0):(p.supp_balance||0)
                return (
                  <tr key={p.id}>
                    <td>
                      <span style={{color:'#38bdf8',cursor:'pointer',fontWeight:600}}
                        onClick={()=>onPartyClick(p)}>{p.name}</span>
                    </td>
                    <td>
                      <span className={`badge ${p.type==='customer'?'badge-sale':'badge-purchase'}`}>
                        {p.type==='customer'?'Customer':'Supplier'}
                      </span>
                    </td>
                    <td style={{color:'#64748b'}}>{p.phone||'—'}</td>
                    <td style={{textAlign:'right',fontWeight:700}}>
                      <span className={bal>0?'red':bal<0?'green':''}>
                        Rs. {Math.abs(bal).toLocaleString()}
                        {bal>0?' (Due)':bal<0?' (Advance)':' ✓'}
                      </span>
                    </td>
                    <td>
                      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                        <button className="btn btn-sm btn-ghost"
                          onClick={()=>onPartyClick(p)}>📒 Khata</button>
                        <button className="btn btn-sm btn-danger"
                          onClick={()=>del(p.id,p.name)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}