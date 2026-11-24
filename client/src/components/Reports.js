import React, { useState, useEffect, useMemo } from 'react'
import { api } from '../api'
import { printAllPartiesSummary, printSinglePartyLedger } from '../printLedger'

const fmtDateShort = (iso) => {
  if (!iso) return ''
  const parts = String(iso).slice(0, 10).split('-')
  if (parts.length !== 3) return String(iso)
  return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`
}

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const fmtBags = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export default function Reports() {
  const now = new Date()
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [monthly, setMonthly] = useState({ sales: 0, purchases: 0, collected: 0, profit: 0 })
  const [parties, setParties] = useState([])
  const [allEntries, setAllEntries] = useState([])
  const [loadErr, setLoadErr] = useState('')

  const [reportMode, setReportMode] = useState('single')
  const [selectedPartyId, setSelectedPartyId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    api.getMonthly(ym)
      .then(m => {
        if (m && typeof m === 'object') {
          setMonthly({
            sales: Number(m.sales || 0),
            purchases: Number(m.purchases || 0),
            collected: Number(m.collected || 0),
            profit: Number(m.profit || 0)
          })
        }
      })
      .catch(() => {})
  }, [ym])

  useEffect(() => {
    Promise.all([
      api.getParties().catch(() => []),
      api.getAllLedger ? api.getAllLedger().catch(() => []) : Promise.resolve([])
    ])
      .then(([pList, eList]) => {
        const list = Array.isArray(pList) ? pList : []
        const entriesList = Array.isArray(eList) ? eList : []
        setParties(list)
        setAllEntries(entriesList)
        if (list.length > 0 && !selectedPartyId) {
          setSelectedPartyId(String(list[0].id))
        }
      })
      .catch(err => setLoadErr(err?.message || 'Reports load error'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Selected month ki entries (aur agar fromDate/toDate di ho toh woh bhi)
  const monthFilteredEntries = useMemo(() => {
    return (allEntries || []).filter(e => {
      if (!e) return false
      const d = String(e.entry_date || '')
      if (ym && !d.startsWith(ym)) return false
      if (fromDate && d < fromDate) return false
      if (toDate && d > toDate) return false
      return true
    })
  }, [allEntries, ym, fromDate, toDate])

  // Month stats: Sale Bags, Purchase Bags, Profit, Payment In, Payment Out
  const monthStats = useMemo(() => {
    let saleBags = 0
    let purchaseBags = 0
    let paymentIn = 0
    let paymentOut = 0

    monthFilteredEntries.forEach(e => {
      const qty = Number(e.qty || 0)
      const amt = Number(e.amount || 0)
      if (e.entry_type === 'sale') saleBags += qty
      else if (e.entry_type === 'purchase') purchaseBags += qty
      else if (e.entry_type === 'payment_in') paymentIn += amt
      else if (e.entry_type === 'payment_out') paymentOut += amt
    })

    return {
      saleBags,
      purchaseBags,
      paymentIn,
      paymentOut
    }
  }, [monthFilteredEntries])

  const selectedParty = useMemo(
    () => parties.find(p => String(p.id) === String(selectedPartyId)) || null,
    [parties, selectedPartyId]
  )

  const singlePartyRows = useMemo(() => {
    if (!selectedParty) return []
    const rows = monthFilteredEntries.filter(e => String(e.party_id) === String(selectedParty.id))
    let running = 0
    return rows.map((e, idx) => {
      const isCharge = e.entry_type === 'sale' || e.entry_type === 'purchase'
      const debit = isCharge ? Number(e.amount || 0) : 0
      const credit = !isCharge ? Number(e.amount || 0) : 0
      running += debit - credit

      const descMain = isCharge
        ? `${String(selectedParty.name || '').toUpperCase()}${e.item_name ? ` ~ ${String(e.item_name).toUpperCase()}` : ''}`
        : `${String(selectedParty.name || '').toUpperCase()} ~ ${String(e.item_name || (e.entry_type === 'payment_in' ? 'PAYMENT RECEIVED' : 'PAYMENT PAID')).toUpperCase()}`

      const descSub = isCharge && e.qty && e.rate
        ? `${Number(e.qty)} BAG @ Rs.${Number(e.rate)}${e.notes ? ` (${e.notes})` : ''}`
        : (e.notes || '')

      return {
        id: e.id || idx,
        date: fmtDateShort(e.entry_date),
        ref: `${selectedParty.id} - ${idx + 1}`,
        descMain,
        descSub,
        dueOn: fmtDateShort(e.due_date),
        debit,
        credit,
        balance: running
      }
    })
  }, [selectedParty, monthFilteredEntries])

  const singleTotals = useMemo(() => {
    const totalDebit = singlePartyRows.reduce((s, r) => s + Number(r.debit || 0), 0)
    const totalCredit = singlePartyRows.reduce((s, r) => s + Number(r.credit || 0), 0)
    const closing = singlePartyRows.length ? Number(singlePartyRows[singlePartyRows.length - 1].balance || 0) : 0
    return { totalDebit, totalCredit, closing }
  }, [singlePartyRows])

  const allPartiesSummary = useMemo(() => {
    return (parties || []).map((p) => {
      const pRows = monthFilteredEntries.filter(e => String(e.party_id) === String(p.id))
      let totalDebit = 0
      let totalCredit = 0
      const itemsSet = new Set()
      let latestDue = ''

      pRows.forEach(e => {
        const isCharge = e.entry_type === 'sale' || e.entry_type === 'purchase'
        if (isCharge) {
          totalDebit += Number(e.amount || 0)
          if (e.item_name) {
            itemsSet.add(e.qty ? `${e.item_name} (${e.qty} BAG)` : e.item_name)
          }
          if (e.due_date && (!latestDue || String(e.due_date) > latestDue)) {
            latestDue = String(e.due_date)
          }
        } else {
          totalCredit += Number(e.amount || 0)
          if (e.notes) itemsSet.add(e.notes)
        }
      })

      const balance = totalDebit - totalCredit
      return {
        id: p.id,
        code: String(p.id).padStart(5, '0'),
        name: p.name || '',
        type: p.type,
        itemsSummary: Array.from(itemsSet).join(' · ') || '—',
        dueOn: fmtDateShort(latestDue),
        totalDebit,
        totalCredit,
        balance
      }
    })
  }, [parties, monthFilteredEntries])

  const allTotals = useMemo(() => {
    const totalDebit = allPartiesSummary.reduce((s, r) => s + Number(r.totalDebit || 0), 0)
    const totalCredit = allPartiesSummary.reduce((s, r) => s + Number(r.totalCredit || 0), 0)
    const closing = totalDebit - totalCredit
    return { totalDebit, totalCredit, closing }
  }, [allPartiesSummary])

  const triggerPrint = async () => {
    if (reportMode === 'all') {
      printAllPartiesSummary(parties, monthFilteredEntries)
    } else if (selectedParty) {
      const rows = await api.getEntries(selectedParty.id).catch(() => [])
      const filtered = (Array.isArray(rows) ? rows : []).filter(e => {
        const d = String(e.entry_date || '')
        if (ym && !d.startsWith(ym)) return false
        if (fromDate && d < fromDate) return false
        if (toDate && d > toDate) return false
        return true
      })
      printSinglePartyLedger(selectedParty, filtered)
    }
  }

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <div className="page-title">Reports & Monthly Ledger</div>
          <div className="page-sub">Monthly Bags, Profit, Payments & Ledger Print</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-success" onClick={() => printAllPartiesSummary(parties, monthFilteredEntries)}>
            🖨️ Print Sab Parties
          </button>
          <button className="btn btn-primary" onClick={triggerPrint}>
            🖨️ Print Selected Report
          </button>
        </div>
      </div>

      {loadErr && (
        <div className="card" style={{ borderColor: '#f87171', color: '#f87171' }}>
          {loadErr}
        </div>
      )}

      <div className="no-print" style={{ marginBottom: 24 }}>
        <div className="card" style={{ marginBottom: 14, maxWidth: 300 }}>
          <label className="form-label">Select Month</label>
          <input className="form-input" type="month" value={ym}
            onChange={e => setYm(e.target.value)} />
        </div>

        <div className="stat-cards">
          <div className="card-sm">
            <div className="stat-label">Sale Bags (Month)</div>
            <div className="stat-value green">{fmtBags(monthStats.saleBags)} Bags</div>
          </div>
          <div className="card-sm">
            <div className="stat-label">Purchase Bags (Month)</div>
            <div className="stat-value red">{fmtBags(monthStats.purchaseBags)} Bags</div>
          </div>
          <div className="card-sm">
            <div className="stat-label">Net Profit (Month)</div>
            <div className={`stat-value ${monthly.profit >= 0 ? 'green' : 'red'}`}>
              Rs. {fmtMoney(monthly.profit)}
            </div>
          </div>
          <div className="card-sm">
            <div className="stat-label">Payment Aayi (In)</div>
            <div className="stat-value blue">Rs. {fmtMoney(monthStats.paymentIn)}</div>
          </div>
          <div className="card-sm">
            <div className="stat-label">Payment Di (Out)</div>
            <div className="stat-value red">Rs. {fmtMoney(monthStats.paymentOut)}</div>
          </div>
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>
          📄 Ledger Print Settings
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Report Type</label>
            <select
              className="form-select"
              value={reportMode}
              onChange={e => setReportMode(e.target.value)}
            >
              <option value="single">Specific Party Ledger (Ek Party ka Khata)</option>
              <option value="all">All Parties Summary (Sab Parties ka Total)</option>
            </select>
          </div>

          {reportMode === 'single' && (
            <div className="form-group">
              <label className="form-label">Party Select Karein</label>
              <select
                className="form-select"
                value={selectedPartyId}
                onChange={e => setSelectedPartyId(e.target.value)}
              >
                {parties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type === 'customer' ? 'Customer' : 'Supplier'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">From Date</label>
            <input className="form-input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">To Date</label>
            <input className="form-input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="ledger-print-sheet">
        {reportMode === 'single' ? (
          <table className="ledger-excel-table">
            <thead>
              <tr>
                <th style={{ width: '9%' }}>Date</th>
                <th style={{ width: '8%' }}>Ref</th>
                <th style={{ width: '35%' }}>Descriptions</th>
                <th style={{ width: '10%' }}>Due on</th>
                <th style={{ width: '12%', textAlign: 'right' }}>Debit</th>
                <th style={{ width: '12%', textAlign: 'right' }}>Credit</th>
                <th style={{ width: '14%', textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {singlePartyRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>
                    Is month mein is party ki koi entry nahi mili.
                  </td>
                </tr>
              ) : (
                singlePartyRows.map(row => (
                  <tr key={row.id}>
                    <td>{row.date}</td>
                    <td>{row.ref}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.descMain}</div>
                      {row.descSub && <div style={{ fontSize: 12, marginTop: 2 }}>{row.descSub}</div>}
                    </td>
                    <td>{row.dueOn || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{row.debit ? fmtMoney(row.debit) : ''}</td>
                    <td style={{ textAlign: 'right' }}>{row.credit ? fmtMoney(row.credit) : ''}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {fmtMoney(Math.abs(row.balance))} {row.balance >= 0 ? 'DR' : 'CR'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="ledger-total-row">
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700 }}>Total :</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(singleTotals.totalDebit)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(singleTotals.totalCredit)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                  {fmtMoney(Math.abs(singleTotals.closing))} {singleTotals.closing >= 0 ? 'DR' : 'CR'}
                </td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="ledger-excel-table">
            <thead>
              <tr>
                <th style={{ width: '8%' }}>Code</th>
                <th style={{ width: '22%' }}>Party Name</th>
                <th style={{ width: '26%' }}>Maal / Items Summary</th>
                <th style={{ width: '10%' }}>Due on</th>
                <th style={{ width: '11%', textAlign: 'right' }}>Total Bill</th>
                <th style={{ width: '11%', textAlign: 'right' }}>Paid / Recv</th>
                <th style={{ width: '12%', textAlign: 'right' }}>Due Balance</th>
              </tr>
            </thead>
            <tbody>
              {allPartiesSummary.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>
                    Koi party record nahi mila.
                  </td>
                </tr>
              ) : (
                allPartiesSummary.map(row => (
                  <tr key={row.id}>
                    <td>{row.code}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.name.toUpperCase()}</div>
                      <div style={{ fontSize: 11 }}>{row.type === 'customer' ? 'Customer' : 'Supplier'}</div>
                    </td>
                    <td>{row.itemsSummary}</td>
                    <td>{row.dueOn || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(row.totalDebit)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(row.totalCredit)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {fmtMoney(Math.abs(row.balance))} {row.balance > 0 ? 'DUE' : row.balance < 0 ? 'ADV' : 'CLR'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="ledger-total-row">
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700 }}>Grand Total :</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(allTotals.totalDebit)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(allTotals.totalCredit)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                  {fmtMoney(Math.abs(allTotals.closing))} {allTotals.closing >= 0 ? 'DUE' : 'ADV'}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}