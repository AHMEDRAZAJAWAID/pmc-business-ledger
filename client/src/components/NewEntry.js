import React, { useState, useEffect } from 'react'
import { api } from '../api'

const todayStr = () => new Date().toISOString().slice(0, 10)
const BAG_WEIGHT = 55

const calcDueDate = (baseDateStr, paymentTerm) => {
  if (!baseDateStr) return ''
  const parts = baseDateStr.split('-').map(Number)
  if (parts.length !== 3) return ''
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  const daysToAdd = paymentTerm === 'cash' ? 1 : (parseInt(paymentTerm, 10) || 0)
  d.setDate(d.getDate() + daysToAdd)

  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function NewEntry({ onDone }) {
  const [parties, setParties] = useState([])
  const [form, setForm] = useState({
    party_id: '',
    entry_type: 'sale',
    payment_mode: 'cash',
    account_detail: '',
    item_name: '',
    rate: '',
    qty: '',
    amount: '',
    entry_date: todayStr(),
    delivery_date: todayStr(),
    payment_term: '30',
    due_date: calcDueDate(todayStr(), '30'),
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getParties().then(setParties)
  }, [])

  const isPayment = form.entry_type === 'payment_in' || form.entry_type === 'payment_out'

  // Seedha Rate ya Qty change hone par foran calculate karega: Rate × 55 × Qty
  const handleRateChange = (val) => {
    const r = parseFloat(val)
    const q = parseFloat(form.qty)
    const autoAmt = (!Number.isNaN(r) && !Number.isNaN(q) && val !== '' && form.qty !== '')
      ? String(Math.round((r * BAG_WEIGHT * q) * 100) / 100)
      : ''
    setForm(f => ({ ...f, rate: val, amount: autoAmt }))
  }

  const handleQtyChange = (val) => {
    const r = parseFloat(form.rate)
    const q = parseFloat(val)
    const autoAmt = (!Number.isNaN(r) && !Number.isNaN(q) && form.rate !== '' && val !== '')
      ? String(Math.round((r * BAG_WEIGHT * q) * 100) / 100)
      : ''
    setForm(f => ({ ...f, qty: val, amount: autoAmt }))
  }

  // Auto due date from Delivery Date + Payment Condition
  useEffect(() => {
    if (!isPayment) {
      const baseDate = form.delivery_date || form.entry_date
      const computedDue = calcDueDate(baseDate, form.payment_term)
      setForm(f => (f.due_date === computedDue ? f : { ...f, due_date: computedDue }))
    }
  }, [form.delivery_date, form.entry_date, form.payment_term, form.entry_type, isPayment])

  const resetForm = () => {
    const now = todayStr()
    setForm({
      party_id: '',
      entry_type: 'sale',
      payment_mode: 'cash',
      account_detail: '',
      item_name: '',
      rate: '',
      qty: '',
      amount: '',
      entry_date: now,
      delivery_date: now,
      payment_term: '30',
      due_date: calcDueDate(now, '30'),
      notes: ''
    })
  }

  const getPaymentModeTitle = () => {
    if (form.payment_mode === 'account') return 'Account Payment'
    if (form.payment_mode === 'cheque') return 'Cheque Payment'
    return 'Cash Payment'
  }

  const buildCombinedNotes = () => {
    const parts = []
    if (isPayment) {
      const modeTitle = getPaymentModeTitle()
      const detail = form.account_detail.trim()
      parts.push(detail ? `${modeTitle}: ${detail}` : modeTitle)
    } else if (form.payment_term === 'cash') {
      parts.push('Cash - Next Day Due')
    }
    if (form.notes && form.notes.trim()) {
      parts.push(form.notes.trim())
    }
    return parts.join(' | ')
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.party_id) return alert('Party select karein!')
    if (!form.amount) return alert('Amount likhein!')
    setSaving(true)
    await api.addEntry({
      party_id: parseInt(form.party_id),
      entry_type: form.entry_type,
      item_name: isPayment ? getPaymentModeTitle() : form.item_name,
      qty: !isPayment && form.qty !== '' ? parseFloat(form.qty) : null,
      rate: !isPayment && form.rate !== '' ? parseFloat(form.rate) : null,
      amount: parseFloat(form.amount),
      entry_date: form.entry_date,
      delivery_date: !isPayment ? (form.delivery_date || null) : null,
      due_date: !isPayment ? (form.due_date || null) : null,
      notes: buildCombinedNotes()
    })
    setSaving(false)
    alert('Entry save ho gayi! ✅')
    resetForm()
    if (onDone) onDone()
  }

  const typeColors = {
    sale: '#22c55e', purchase: '#f59e0b',
    payment_in: '#38bdf8', payment_out: '#f87171'
  }

  const numRate = parseFloat(form.rate)
  const numQty = parseFloat(form.qty)
  const hasCalc = !Number.isNaN(numRate) && !Number.isNaN(numQty) && form.rate !== '' && form.qty !== ''
  const liveTotal = hasCalc ? Math.round((numRate * BAG_WEIGHT * numQty) * 100) / 100 : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">New Entry</div>
          <div className="page-sub">Sale, Purchase, Payment record karein</div>
        </div>
      </div>

      <div className="card" style={{maxWidth: 740}}>
        <form onSubmit={save}>

          {/* Entry Type */}
          <div className="form-group" style={{marginBottom: 24}}>
            <label className="form-label">Entry Type</label>
            <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
              {[
                {v:'sale',        l:'💰 Sale (Bechna)'},
                {v:'purchase',    l:'🛒 Purchase (Khareedna)'},
                {v:'payment_in',  l:'📥 Payment In (Paisa Mila)'},
                {v:'payment_out', l:'📤 Payment Out (Paisa Diya)'},
              ].map(t => (
                <button key={t.v} type="button"
                  onClick={() => setForm({...form, entry_type: t.v, rate:'', qty:'', amount:'', account_detail:''})}
                  style={{
                    padding: '10px 16px', borderRadius: 8, border: '2px solid',
                    borderColor: form.entry_type===t.v ? typeColors[t.v] : '#334155',
                    background: form.entry_type===t.v ? typeColors[t.v]+'22' : '#1e293b',
                    color: form.entry_type===t.v ? typeColors[t.v] : '#94a3b8',
                    cursor: 'pointer', fontWeight: 600, fontSize: 14
                  }}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>

          {/* Party */}
          <div className="form-group">
            <label className="form-label">Party *</label>
            <select className="form-select" value={form.party_id}
              onChange={e => setForm({...form, party_id: e.target.value})}>
              <option value="">-- Party Select Karein --</option>
              {parties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type === 'customer' ? 'Customer' : 'Supplier'})
                </option>
              ))}
            </select>
          </div>

          {/* Payment Mode */}
          {isPayment && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Payment Mode (Cash / Account / Cheque)</label>
                <select
                  className="form-select"
                  value={form.payment_mode}
                  onChange={e => setForm({...form, payment_mode: e.target.value})}
                >
                  <option value="cash">💵 Cash</option>
                  <option value="account">🏦 Account (Bank / Online)</option>
                  <option value="cheque">🧾 Cheque</option>
                </select>
              </div>

              {(form.payment_mode === 'account' || form.payment_mode === 'cheque') && (
                <div className="form-group">
                  <label className="form-label">
                    {form.payment_mode === 'account'
                      ? 'Account / Bank Detail Likhein *'
                      : 'Cheque No & Bank Likhein *'}
                  </label>
                  <input
                    className="form-input"
                    placeholder={
                      form.payment_mode === 'account'
                        ? 'e.g. Meezan Bank - Account Title / Ref'
                        : 'e.g. Meezan Bank - Cheque # 448192'
                    }
                    value={form.account_detail}
                    onChange={e => setForm({...form, account_detail: e.target.value})}
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}

          {/* Item fields — Rate × 55 × Qty */}
          {!isPayment && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Item Name</label>
                  <input className="form-input" placeholder="e.g. HD Bags, LLD Bags, PP Tape"
                    value={form.item_name}
                    onChange={e => setForm({...form, item_name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Rate (Rs)</label>
                  <input className="form-input" type="number" step="any" placeholder="0" min="0"
                    value={form.rate}
                    onChange={e => handleRateChange(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Qty (Bags)</label>
                  <input className="form-input" type="number" step="any" placeholder="0" min="0"
                    value={form.qty}
                    onChange={e => handleQtyChange(e.target.value)} />
                </div>
              </div>

              {hasCalc && (
                <div style={{
                  background: '#0f172a', border: '1px solid #334155',
                  borderRadius: 8, padding: '12px 16px', marginBottom: 16,
                  color: '#94a3b8', fontSize: 15
                }}>
                  📊 Calculation: <strong style={{color:'#fff'}}>
                    Rs. {numRate} × {BAG_WEIGHT} × {numQty} Bags
                  </strong> = <strong style={{color: typeColors[form.entry_type], fontSize: 17}}>
                    Rs. {liveTotal.toLocaleString()}
                  </strong>
                </div>
              )}
            </>
          )}

          {/* Amount */}
          <div className="form-group">
            <label className="form-label">
              Amount (Rs) {isPayment ? '*' : '— Auto (Rate × 55 × Qty)'}
            </label>
            <input className="form-input" type="number" step="any" placeholder="0" min="0"
              value={form.amount}
              onChange={e => setForm({...form, amount: e.target.value})}
              style={{fontSize: 22, fontWeight: 700, color: typeColors[form.entry_type]}}
            />
          </div>

          {/* Dates & Payment Condition */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Entry Date *</label>
              <input className="form-input" type="date"
                value={form.entry_date}
                onChange={e => setForm({...form, entry_date: e.target.value})} />
            </div>

            {!isPayment && (
              <>
                <div className="form-group">
                  <label className="form-label">Delivery Date *</label>
                  <input className="form-input" type="date"
                    value={form.delivery_date}
                    onChange={e => setForm({...form, delivery_date: e.target.value})} />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Condition</label>
                  <select className="form-select" value={form.payment_term}
                    onChange={e => setForm({...form, payment_term: e.target.value})}>
                    <option value="cash">Cash (Next Day Due)</option>
                    <option value="15">15 Din</option>
                    <option value="30">30 Din</option>
                    <option value="35">35 Din</option>
                    <option value="40">40 Din</option>
                    <option value="45">45 Din</option>
                    <option value="60">60 Din</option>
                    <option value="90">90 Din</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Due Date (Auto)</label>
                  <input className="form-input" type="date"
                    value={form.due_date}
                    onChange={e => setForm({...form, due_date: e.target.value})} />
                </div>
              </>
            )}
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <input className="form-input" placeholder="Koi note..."
              value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})} />
          </div>

          <button type="submit" className="btn btn-success" disabled={saving}
            style={{width:'100%', padding:'14px', fontSize:16, marginTop:8}}>
            {saving ? 'Saving...' : '✅ Entry Save Karo'}
          </button>
        </form>
      </div>
    </div>
  )
}