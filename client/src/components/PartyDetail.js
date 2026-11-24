import React, { useEffect, useState } from 'react'
import { api } from '../api'

export default function PartyDetail({ party, onBack, onPartyUpdated }) {
  const [currentParty, setCurrentParty] = useState(party)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    name: party?.name || '',
    type: party?.type || 'customer',
    phone: party?.phone || '',
    credit_days: party?.credit_days ?? 0
  })

  useEffect(() => {
    setCurrentParty(party)
    setEditForm({
      name: party?.name || '',
      type: party?.type || 'customer',
      phone: party?.phone || '',
      credit_days: party?.credit_days ?? 0
    })
  }, [party])

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!party?.id) {
        setEntries([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')
        const data = await api.getEntries(party.id)

        if (active) {
          setEntries(data || [])
        }
      } catch (err) {
        if (active) setError('Entries load nahi ho sakin.')
        console.error(err)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [party?.id])

  const del = async (id) => {
    if (!window.confirm('Yeh entry delete karein?')) return

    try {
      await api.delEntry(id)
      const data = await api.getEntries(currentParty.id)
      setEntries(data || [])
    } catch (err) {
      alert('Entry delete nahi ho saki.')
      console.error(err)
    }
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editForm.name.trim()) return alert('Party ka naam likhein!')
    if (!currentParty?.id) return

    setSavingEdit(true)
    try {
      const payload = {
        id: currentParty.id,
        name: editForm.name.trim(),
        type: editForm.type,
        phone: editForm.phone.trim(),
        credit_days: parseInt(editForm.credit_days) || 0
      }

      if (typeof api.updateParty === 'function') {
        await api.updateParty(currentParty.id, payload)
      } else if (typeof api.editParty === 'function') {
        await api.editParty(currentParty.id, payload)
      } else {
        throw new Error('api.updateParty method missing')
      }

      const updated = { ...currentParty, ...payload }
      setCurrentParty(updated)
      setIsEditing(false)
      if (onPartyUpdated) onPartyUpdated(updated)
      alert('Party update ho gayi! ✅')
    } catch (err) {
      console.error(err)
      alert('Party update nahi ho saki. Backend route (`updateParty`) check karein.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handlePrint = () => window.print()

  if (!currentParty) {
    return (
      <div className="card" style={{ padding: 30, textAlign: 'center' }}>
        <h3>Party select nahi hui!</h3>
        <p>Wapas ja kar party dobara select karein.</p>
        <button className="btn btn-primary" onClick={onBack}>
          ← Back
        </button>
      </div>
    )
  }

  const typeLabel = {
    sale: 'Sale',
    purchase: 'Purchase',
    payment_in: 'Payment In',
    payment_out: 'Payment Out'
  }

  const typeBadge = {
    sale: 'badge-sale',
    purchase: 'badge-purchase',
    payment_in: 'badge-pay-in',
    payment_out: 'badge-pay-out'
  }

  const finalBalance = entries.length
    ? Number(entries[entries.length - 1].balance || 0)
    : 0

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <div className="page-title">{currentParty.name}</div>
          <div className="page-sub">
            {currentParty.type === 'customer' ? 'Customer' : 'Supplier'}
            {currentParty.phone ? ` · ${currentParty.phone}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? '✕ Cancel Edit' : '✏️ Edit Party'}
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            🖨️ Print Khata
          </button>
          <button className="btn btn-ghost" onClick={onBack}>
            ← Back
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="card no-print" style={{ marginBottom: 20, border: '1px solid #38bdf8' }}>
          <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 15 }}>Edit Party Details</div>
          <form onSubmit={saveEdit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Party Name *</label>
                <input
                  className="form-input"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={editForm.type}
                  onChange={e => setEditForm({ ...editForm, type: e.target.value })}
                >
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  className="form-input"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-success" disabled={savingEdit}>
                {savingEdit ? 'Saving...' : '💾 Save Changes'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="stat-cards no-print" style={{ marginBottom: 24 }}>
        <div className="card-sm">
          <div className="stat-label">Total Entries</div>
          <div className="stat-value blue">{entries.length}</div>
        </div>

        <div className="card-sm">
          <div className="stat-label">Final Balance</div>
          <div className={`stat-value ${finalBalance > 0 ? 'red' : finalBalance < 0 ? 'green' : ''}`}>
            Rs. {Math.abs(finalBalance).toLocaleString()}
            {finalBalance > 0 ? ' (Lena Hai)' : finalBalance < 0 ? ' (Dena Hai)' : ' ✓ Clear'}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          Loading...
        </div>
      ) : error ? (
        <div className="card" style={{ padding: 30, color: 'red' }}>
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📒</div>
          <div>Koi entry nahi — New Entry se add karein</div>
        </div>
      ) : (
        <div className="card print-area" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
            <span>{currentParty.name} — Khata Statement</span>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>
              {currentParty.phone ? `Phone: ${currentParty.phone}` : ''}
            </span>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Item</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Rate</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th className="no-print"></th>
              </tr>
            </thead>

            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td>{e.entry_date}</td>
                  <td>
                    <span className={`badge ${typeBadge[e.entry_type] || ''}`}>
                      {typeLabel[e.entry_type] || e.entry_type}
                    </span>
                  </td>
                  <td>{e.item_name || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{e.qty || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {e.rate ? `Rs.${e.rate}` : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    Rs. {Number(e.amount || 0).toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    Rs. {Math.abs(Number(e.balance || 0)).toLocaleString()}
                  </td>
                  <td className="no-print">
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => del(e.id)}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}