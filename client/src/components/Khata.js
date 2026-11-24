import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { printAllPartiesSummary, printSinglePartyLedger } from '../printLedger'

export default function Khata() {
  const [parties,  setParties]  = useState([])
  const [allEntries, setAllEntries] = useState([])
  const [open,     setOpen]     = useState(null)
  const [entries,  setEntries]  = useState({})
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)
  const [filter,   setFilter]   = useState('all')
  const [form, setForm] = useState({ name:'', type:'customer', phone:'', credit_days:'0' })

  // Edit party state
  const [editingParty, setEditingParty] = useState(null)
  const [editForm, setEditForm] = useState({ name:'', type:'customer', phone:'', credit_days:'0' })
  const [savingEdit, setSavingEdit] = useState(false)

  // Edit entry state (amount, item, qty, rate, dates, notes)
  const [editingEntry, setEditingEntry] = useState(null) // { partyId, entry }
  const [entryForm, setEntryForm] = useState({
    entry_type: 'sale',
    item_name: '',
    qty: '',
    rate: '',
    amount: '',
    entry_date: '',
    delivery_date: '',
    due_date: '',
    notes: ''
  })
  const [savingEntry, setSavingEntry] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [pList, eList] = await Promise.all([
        api.getParties().catch(() => []),
        api.getAllLedger ? api.getAllLedger().catch(() => []) : Promise.resolve([])
      ])
      setParties(Array.isArray(pList) ? pList : [])
      setAllEntries(Array.isArray(eList) ? eList : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggleParty = async (id) => {
    if (open === id) { setOpen(null); return }
    setOpen(id)
    if (!entries[id]) {
      const data = await api.getEntries(id).catch(() => [])
      setEntries(e => ({ ...e, [id]: Array.isArray(data) ? data : [] }))
    }
  }

  const delEntry = async (partyId, entryId) => {
    if (!window.confirm('Yeh entry delete karein?')) return
    await api.delEntry(entryId)
    const data = await api.getEntries(partyId).catch(() => [])
    setEntries(e => ({ ...e, [partyId]: Array.isArray(data) ? data : [] }))
    load()
  }

  const startEditEntry = (ev, partyId, entry) => {
    ev.stopPropagation()
    setEditingEntry({ partyId, entry })
    setEntryForm({
      entry_type: entry.entry_type || 'sale',
      item_name: entry.item_name || '',
      qty: entry.qty ?? '',
      rate: entry.rate ?? '',
      amount: entry.amount ?? '',
      entry_date: (entry.entry_date || '').slice(0, 10),
      delivery_date: (entry.delivery_date || '').slice(0, 10),
      due_date: (entry.due_date || '').slice(0, 10),
      notes: entry.notes || ''
    })
  }

  const saveEditEntry = async (ev) => {
    ev.preventDefault()
    if (!editingEntry?.entry?.id) return
    if (entryForm.amount === '' || Number.isNaN(Number(entryForm.amount))) {
      return alert('Sahi amount likhein!')
    }

    setSavingEntry(true)
    try {
      await api.updateEntry(editingEntry.entry.id, {
        entry_type: entryForm.entry_type,
        item_name: entryForm.item_name,
        qty: entryForm.qty !== '' ? parseFloat(entryForm.qty) : null,
        rate: entryForm.rate !== '' ? parseFloat(entryForm.rate) : null,
        amount: parseFloat(entryForm.amount),
        entry_date: entryForm.entry_date,
        delivery_date: entryForm.delivery_date || null,
        due_date: entryForm.due_date || null,
        notes: entryForm.notes
      })
      const updatedRows = await api.getEntries(editingEntry.partyId).catch(() => [])
      setEntries(prev => ({
        ...prev,
        [editingEntry.partyId]: Array.isArray(updatedRows) ? updatedRows : []
      }))
      setEditingEntry(null)
      await load()
      alert('Entry / Amount update ho gayi! ✅')
    } catch (err) {
      console.error(err)
      alert('Entry update nahi ho saki.')
    } finally {
      setSavingEntry(false)
    }
  }

  const delParty = async (id, name) => {
    if (!window.confirm(`"${name}" delete karein? Sab entries bhi hategi.`)) return
    await api.delParty(id)
    setOpen(null)
    load()
  }

  const addParty = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return alert('Naam likhein!')
    await api.addParty({
      name: form.name.trim(),
      type: form.type,
      phone: form.phone,
      credit_days: parseInt(form.credit_days) || 0
    })
    setForm({ name:'', type:'customer', phone:'', credit_days:'0' })
    setShowAdd(false)
    load()
  }

  const startEdit = (e, party) => {
    e.stopPropagation()
    setEditingParty(party)
    setEditForm({
      name: party.name || '',
      type: party.type || 'customer',
      phone: party.phone || '',
      credit_days: party.credit_days ?? 0
    })
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editForm.name.trim()) return alert('Party ka naam likhein!')
    if (!editingParty?.id) return

    setSavingEdit(true)
    try {
      const payload = {
        id: editingParty.id,
        name: editForm.name.trim(),
        type: editForm.type,
        phone: editForm.phone.trim(),
        credit_days: parseInt(editForm.credit_days) || 0
      }
      await api.updateParty(editingParty.id, payload)
      setEditingParty(null)
      await load()
      alert('Party edit ho gayi! ✅')
    } catch (err) {
      console.error(err)
      alert('Party update nahi ho saki.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handlePrintSingle = async (e, party) => {
    e.stopPropagation()
    let partyRows = entries[party.id]
    if (!partyRows) {
      partyRows = await api.getEntries(party.id).catch(() => [])
      setEntries(prev => ({ ...prev, [party.id]: partyRows }))
    }
    printSinglePartyLedger(party, partyRows || [])
  }

  const typeLabel = { sale:'Sale', purchase:'Purchase', payment_in:'Payment In', payment_out:'Payment Out' }
  const typeBadge = { sale:'badge-sale', purchase:'badge-purchase', payment_in:'badge-pay-in', payment_out:'badge-pay-out' }

  const filtered = filter==='all' ? parties : parties.filter(p=>p.type===filter)
  const totalLena = parties.filter(p=>p.type==='customer').reduce((s,p)=>s+(p.cust_balance>0?p.cust_balance:0),0)
  const totalDena = parties.filter(p=>p.type==='supplier').reduce((s,p)=>s+(p.supp_balance>0?p.supp_balance:0),0)

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header no-print">
        <div>
          <div className="page-title">📒 Sab Parties ka Khata</div>
          <div className="page-sub">Party pe click karo — khata, edit aur print option khul jaye ga</div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button
            className="btn btn-success"
            onClick={() => printAllPartiesSummary(filtered, allEntries)}
          >
            🖨️ Print Sab Parties
          </button>
          <button className="btn btn-primary" onClick={()=>setShowAdd(!showAdd)}>
            {showAdd ? '✕ Cancel' : '+ New Party'}
          </button>
        </div>
      </div>

      {/* ── Summary ── */}
      <div className="stat-cards no-print" style={{marginBottom:20}}>
        <div className="card-sm">
          <div className="stat-label">Total Parties</div>
          <div className="stat-value blue">{parties.length}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Customers Se Lena</div>
          <div className="stat-value green">Rs. {totalLena.toLocaleString()}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Suppliers Ko Dena</div>
          <div className="stat-value red">Rs. {totalDena.toLocaleString()}</div>
        </div>
      </div>

      {/* ── Edit Entry Form (Amount / Details Edit) ── */}
      {editingEntry && (
        <div className="card no-print" style={{
          marginBottom: 20,
          border: '1px solid #22c55e',
          background: '#0f172a'
        }}>
          <div style={{fontWeight:700, marginBottom:14, fontSize:15, color:'#22c55e'}}>
            ✏️ Edit Entry / Amount (#{editingEntry.entry.id})
          </div>
          <form onSubmit={saveEditEntry}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount (Rs) *</label>
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  value={entryForm.amount}
                  onChange={e => setEntryForm({...entryForm, amount: e.target.value})}
                  style={{fontWeight:700, color:'#22c55e'}}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Item / Mode</label>
                <input
                  className="form-input"
                  value={entryForm.item_name}
                  onChange={e => setEntryForm({...entryForm, item_name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Qty (Bags)</label>
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  value={entryForm.qty}
                  onChange={e => setEntryForm({...entryForm, qty: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Rate</label>
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  value={entryForm.rate}
                  onChange={e => setEntryForm({...entryForm, rate: e.target.value})}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Entry Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={entryForm.entry_date}
                  onChange={e => setEntryForm({...entryForm, entry_date: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={entryForm.due_date}
                  onChange={e => setEntryForm({...entryForm, due_date: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Detail / Cheque / Notes</label>
                <input
                  className="form-input"
                  value={entryForm.notes}
                  onChange={e => setEntryForm({...entryForm, notes: e.target.value})}
                />
              </div>
            </div>
            <div style={{display:'flex', gap:10}}>
              <button type="submit" className="btn btn-success" disabled={savingEntry}>
                {savingEntry ? 'Saving...' : '💾 Save Entry Changes'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={()=>setEditingEntry(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Edit Party Form ── */}
      {editingParty && (
        <div className="card no-print" style={{
          marginBottom: 20,
          border: '1px solid #38bdf8',
          background: '#0f172a'
        }}>
          <div style={{fontWeight:700, marginBottom:14, fontSize:15, color:'#38bdf8'}}>
            ✏️ Edit Party — {editingParty.name}
          </div>
          <form onSubmit={saveEdit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Party Name *</label>
                <input
                  className="form-input"
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={editForm.type}
                  onChange={e => setEditForm({...editForm, type: e.target.value})}
                >
                  <option value="customer">Customer (jinko bechte hain)</option>
                  <option value="supplier">Supplier (jinse khareedtey hain)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  className="form-input"
                  placeholder="03XX-XXXXXXX"
                  value={editForm.phone}
                  onChange={e => setEditForm({...editForm, phone: e.target.value})}
                />
              </div>
            </div>
            <div style={{display:'flex', gap:10}}>
              <button type="submit" className="btn btn-success" disabled={savingEdit}>
                {savingEdit ? 'Saving...' : '💾 Save Changes'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={()=>setEditingParty(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Add Party Form ── */}
      {showAdd && (
        <div className="card no-print" style={{marginBottom:20}}>
          <div style={{fontWeight:700,marginBottom:14,fontSize:15}}>New Party</div>
          <form onSubmit={addParty}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Party Name *</label>
                <input className="form-input" placeholder="e.g. Ahmed Traders" autoFocus
                  value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
                  <option value="customer">Customer (jinko bechte hain)</option>
                  <option value="supplier">Supplier (jinse khareedtey hain)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" placeholder="03XX-XXXXXXX"
                  value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
              </div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button type="submit" className="btn btn-success">✅ Save</button>
              <button type="button" className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filter ── */}
      <div className="no-print" style={{display:'flex',gap:8,marginBottom:14}}>
        {['all','customer','supplier'].map(f=>(
          <button key={f} className={`btn btn-sm ${filter===f?'btn-primary':'btn-ghost'}`}
            onClick={()=>setFilter(f)}>
            {f==='all'?`Sab (${parties.length})`:f==='customer'?`Customers (${parties.filter(p=>p.type==='customer').length})`:`Suppliers (${parties.filter(p=>p.type==='supplier').length})`}
          </button>
        ))}
      </div>

      {/* ── Parties List ── */}
      {loading ? (
        <div style={{textAlign:'center',color:'#64748b',padding:40}}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{textAlign:'center',padding:40,color:'#64748b'}}>
          <div style={{fontSize:40,marginBottom:12}}>📒</div>
          <div>Koi party nahi — upar se add karein</div>
        </div>
      ) : (
        filtered.map(party => {
          const bal   = party.type==='customer' ? (party.cust_balance||0) : (party.supp_balance||0)
          const isOpen = open === party.id
          const pEntries = entries[party.id] || []

          return (
            <div key={party.id} className="party-card" style={{
              marginBottom: 12,
              border: `1px solid ${isOpen ? '#38bdf8' : '#334155'}`,
              borderRadius: 10,
              overflow: 'hidden',
              background: '#1e293b'
            }}>
              {/* Party Row */}
              <div onClick={()=>toggleParty(party.id)} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'14px 20px', cursor:'pointer',
                background: isOpen ? '#0f2744' : '#1e293b'
              }}>
                <div style={{display:'flex',alignItems:'center',gap:14}}>
                  <span style={{fontSize:22}}>{party.type==='customer'?'👤':'🏭'}</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:16,color:'#f1f5f9'}}>{party.name}</div>
                    <div style={{fontSize:12,color:'#64748b',marginTop:2}}>
                      {party.type==='customer'?'Customer':'Supplier'}
                      {party.phone ? ` · ${party.phone}` : ''}
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm no-print"
                    onClick={(e)=>startEdit(e, party)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm no-print"
                    onClick={(e)=>handlePrintSingle(e, party)}
                  >
                    🖨️ Print Data
                  </button>
                  <div style={{textAlign:'right'}}>
                    <div style={{
                      fontSize:18, fontWeight:800,
                      color: bal>0 ? '#f87171' : bal<0 ? '#34d399' : '#64748b'
                    }}>
                      Rs. {Math.abs(bal).toLocaleString()}
                    </div>
                    <div style={{fontSize:11,color:'#64748b',marginTop:2}}>
                      {bal>0 ? '⚠️ Due' : bal<0 ? '✅ Advance' : '✓ Clear'}
                    </div>
                  </div>
                  <span style={{color:'#64748b',fontSize:18}}>{isOpen?'▲':'▼'}</span>
                </div>
              </div>

              {/* Expanded Khata */}
              {isOpen && (
                <div style={{borderTop:'1px solid #334155'}}>
                  {pEntries.length === 0 ? (
                    <div style={{textAlign:'center',padding:'24px',color:'#64748b'}}>
                      Koi entry nahi — New Entry se add karein
                    </div>
                  ) : (
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead>
                        <tr style={{background:'#0f172a'}}>
                          <th style={th}>Date</th>
                          <th style={th}>Type</th>
                          <th style={th}>Item / Mode</th>
                          <th style={th}>Detail / Notes</th>
                          <th style={{...th,textAlign:'right'}}>Qty</th>
                          <th style={{...th,textAlign:'right'}}>Rate</th>
                          <th style={{...th,textAlign:'right'}}>Amount</th>
                          <th style={{...th,textAlign:'right'}}>Balance</th>
                          <th style={{...th,textAlign:'center'}} className="no-print">Edit / Del</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pEntries.map(e => (
                          <tr key={e.id} style={{borderBottom:'1px solid #1e293b'}}>
                            <td style={td}>{e.entry_date}</td>
                            <td style={td}><span className={`badge ${typeBadge[e.entry_type]}`}>{typeLabel[e.entry_type]}</span></td>
                            <td style={td}>{e.item_name||'—'}</td>
                            <td style={{...td,color:'#94a3b8'}}>{e.notes||'—'}</td>
                            <td style={{...td,textAlign:'right',color:'#94a3b8'}}>{e.qty||'—'}</td>
                            <td style={{...td,textAlign:'right',color:'#94a3b8'}}>{e.rate?`${e.rate}`:'—'}</td>
                            <td style={{...td,textAlign:'right',fontWeight:600}}>Rs. {Number(e.amount||0).toLocaleString()}</td>
                            <td style={{...td,textAlign:'right',fontWeight:700,
                              color:e.balance>0?'#f87171':e.balance<0?'#34d399':'#94a3b8'}}>
                              Rs. {Math.abs(Number(e.balance||0)).toLocaleString()}
                            </td>
                            <td style={{...td,textAlign:'center'}} className="no-print">
                              <div style={{display:'flex',gap:6,justifyContent:'center'}}>
                                <button className="btn btn-sm btn-ghost"
                                  onClick={(ev)=>startEditEntry(ev, party.id, e)}>✏️</button>
                                <button className="btn btn-sm btn-danger"
                                  onClick={(ev)=>{ev.stopPropagation();delEntry(party.id,e.id)}}>🗑</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{background:'#0f172a',fontWeight:700}}>
                          <td colSpan={6} style={{...td,color:'#94a3b8'}}>Final Balance</td>
                          <td style={{...td,textAlign:'right'}}>
                            Rs. {pEntries.reduce((s,e)=>s+Number(e.amount||0),0).toLocaleString()}
                          </td>
                          <td style={{...td,textAlign:'right',fontSize:16,
                            color:bal>0?'#f87171':bal<0?'#34d399':'#64748b'}}>
                            Rs. {Math.abs(bal).toLocaleString()}
                            <div style={{fontSize:11,fontWeight:400}}>
                              {bal>0?'Due':bal<0?'Advance':'Clear'}
                            </div>
                          </td>
                          <td className="no-print"></td>
                        </tr>
                      </tfoot>
                    </table>
                  )}

                  {/* Party actions inside expanded party */}
                  <div className="no-print" style={{
                    display:'flex',gap:10,padding:'12px 20px',
                    borderTop:'1px solid #334155',background:'#0f172a'
                  }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={(e)=>handlePrintSingle(e, party)}
                    >
                      🖨️ Print Is Party Ka Data
                    </button>
                    <button className="btn btn-ghost btn-sm"
                      onClick={(e)=>startEdit(e, party)}>✏️ Edit Party</button>
                    <button className="btn btn-danger btn-sm"
                      onClick={()=>delParty(party.id,party.name)}>🗑 Party Delete</button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

const th = {
  padding:'10px 14px', textAlign:'left',
  color:'#64748b', fontSize:11,
  textTransform:'uppercase', letterSpacing:'0.5px',
  fontWeight:600
}
const td = {
  padding:'10px 14px', fontSize:13, color:'#e2e8f0'
}