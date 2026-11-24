const fmtDateShort = (iso) => {
  if (!iso) return ''
  const parts = String(iso).slice(0, 10).split('-')
  if (parts.length !== 3) return iso
  return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`
}

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })

const escapeHtml = (str = '') =>
  String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')

async function openPrintHtml(title, bodyHtml) {
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 10px;
      font-size: 12px;
    }
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-weight: 700;
      font-size: 13px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #e5e7eb;
      color: #000;
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      border-left: 1px solid #9ca3af;
      border-right: 1px solid #9ca3af;
      padding: 6px 7px;
      text-align: left;
      font-size: 12px;
    }
    td {
      border-left: 1px solid #d1d5db;
      border-right: 1px solid #d1d5db;
      border-bottom: 1px solid #e5e7eb;
      padding: 6px 7px;
      vertical-align: top;
      font-size: 12px;
    }
    .sub-desc {
      font-size: 11px;
      color: #1f2937;
      margin-top: 2px;
    }
    .num { text-align: right; white-space: nowrap; }
    .total-row td {
      border-top: 1.5px solid #000;
      border-bottom: 2px double #000;
      font-weight: 700;
      background: #f9fafb;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`

  const bridge = window.pmcDesktop || window.electronAPI
  if (bridge && typeof bridge.saveAndOpenPdf === 'function') {
    const res = await bridge.saveAndOpenPdf(fullHtml, `${title}.pdf`)
    if (!res?.ok) {
      alert('PDF Save Error: ' + (res?.error || 'Unknown error'))
    }
    return
  }

  alert('Desktop PDF bridge load nahi hua — please app ko restart karein.')
}

export function printSinglePartyLedger(party, entries = []) {
  let running = 0
  let totalDebit = 0
  let totalCredit = 0

  const rowsHtml = entries.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:18px;">Is party ki koi entry nahi hai.</td></tr>`
    : entries.map((e, idx) => {
        const isCharge = e.entry_type === 'sale' || e.entry_type === 'purchase'
        const debit = isCharge ? Number(e.amount || 0) : 0
        const credit = !isCharge ? Number(e.amount || 0) : 0
        totalDebit += debit
        totalCredit += credit
        running += debit - credit

        const mainTitle = isCharge
          ? `${party.name.toUpperCase()}${e.item_name ? ` ~ ${String(e.item_name).toUpperCase()}` : ''}`
          : `${party.name.toUpperCase()} ~ ${e.item_name ? String(e.item_name).toUpperCase() : (e.entry_type === 'payment_in' ? 'PAYMENT RECEIVED' : 'PAYMENT PAID')}`

        const subLine = isCharge && e.qty && e.rate
          ? `${Number(e.qty)} BAG  @${Number(e.rate)}${e.notes ? ` (${e.notes})` : ''}`
          : (e.notes || '')

        return `
          <tr>
            <td>${escapeHtml(fmtDateShort(e.entry_date))}</td>
            <td>${escapeHtml(`${party.id} - ${idx + 1}`)}</td>
            <td>
              <div><strong>${escapeHtml(mainTitle)}</strong></div>
              ${subLine ? `<div class="sub-desc">${escapeHtml(subLine)}</div>` : ''}
            </td>
            <td>${escapeHtml(fmtDateShort(e.due_date) || '—')}</td>
            <td class="num">${debit ? fmtMoney(debit) : ''}</td>
            <td class="num">${credit ? fmtMoney(credit) : ''}</td>
            <td class="num"><strong>${fmtMoney(Math.abs(running))} ${running >= 0 ? 'DR' : 'CR'}</strong></td>
          </tr>
        `
      }).join('')

  const bodyHtml = `
    <div class="top-bar">
      <div>Ledger Account : ${escapeHtml(String(party.id).padStart(5, '0'))} - ${escapeHtml(party.name.toUpperCase())} (${party.type === 'customer' ? 'SALE CREDIT' : 'PURCHASE'})</div>
      <div>Date: ${escapeHtml(fmtDateShort(new Date().toISOString().slice(0, 10)))}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:9%;">Date</th>
          <th style="width:8%;">Ref</th>
          <th style="width:36%;">Descriptions</th>
          <th style="width:10%;">Due on</th>
          <th class="num" style="width:12%;">Debit</th>
          <th class="num" style="width:12%;">Credit</th>
          <th class="num" style="width:13%;">Balance</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="4" class="num">Total :</td>
          <td class="num">${fmtMoney(totalDebit)}</td>
          <td class="num">${fmtMoney(totalCredit)}</td>
          <td class="num">${fmtMoney(Math.abs(running))} ${running >= 0 ? 'DR' : 'CR'}</td>
        </tr>
      </tfoot>
    </table>
  `

  openPrintHtml(`Ledger-${party.name}`, bodyHtml)
}

export function printAllPartiesSummary(parties = [], allEntries = []) {
  let grandDebit = 0
  let grandCredit = 0

  const rowsHtml = parties.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:18px;">Koi party record nahi hai.</td></tr>`
    : parties.map((p, idx) => {
        const pRows = allEntries.filter(e => e.party_id === p.id)
        let pDebit = 0
        let pCredit = 0
        let latestDue = ''
        const descSet = new Set()

        pRows.forEach(e => {
          const isCharge = e.entry_type === 'sale' || e.entry_type === 'purchase'
          if (isCharge) {
            pDebit += Number(e.amount || 0)
            if (e.item_name) descSet.add(e.qty ? `${e.item_name} (${e.qty} BAG)` : e.item_name)
            if (e.due_date && (!latestDue || e.due_date > latestDue)) latestDue = e.due_date
          } else {
            pCredit += Number(e.amount || 0)
            if (e.notes) descSet.add(e.notes)
          }
        })

        grandDebit += pDebit
        grandCredit += pCredit
        const net = pDebit - pCredit

        return `
          <tr>
            <td>${escapeHtml(fmtDateShort(new Date().toISOString().slice(0, 10)))}</td>
            <td>${escapeHtml(String(idx + 1))}</td>
            <td>
              <div><strong>${escapeHtml(p.name.toUpperCase())}</strong> (${p.type === 'customer' ? 'Customer' : 'Supplier'})</div>
              <div class="sub-desc">${escapeHtml(Array.from(descSet).join(' · ') || '—')}</div>
            </td>
            <td>${escapeHtml(fmtDateShort(latestDue) || '—')}</td>
            <td class="num">${fmtMoney(pDebit)}</td>
            <td class="num">${fmtMoney(pCredit)}</td>
            <td class="num"><strong>${fmtMoney(Math.abs(net))} ${net > 0 ? 'DUE' : net < 0 ? 'ADV' : 'CLR'}</strong></td>
          </tr>
        `
      }).join('')

  const grandNet = grandDebit - grandCredit

  const bodyHtml = `
    <div class="top-bar">
      <div>ALL PARTIES CONSOLIDATED LEDGER REPORT</div>
      <div>Date: ${escapeHtml(fmtDateShort(new Date().toISOString().slice(0, 10)))}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:9%;">Date</th>
          <th style="width:7%;">Ref</th>
          <th style="width:37%;">Party & Maal / Payment Details</th>
          <th style="width:10%;">Due on</th>
          <th class="num" style="width:12%;">Total Bill</th>
          <th class="num" style="width:12%;">Paid / Recv</th>
          <th class="num" style="width:13%;">Balance</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="4" class="num">Grand Total :</td>
          <td class="num">${fmtMoney(grandDebit)}</td>
          <td class="num">${fmtMoney(grandCredit)}</td>
          <td class="num">${fmtMoney(Math.abs(grandNet))} ${grandNet >= 0 ? 'DUE' : 'ADV'}</td>
        </tr>
      </tfoot>
    </table>
  `

  openPrintHtml('All-Parties-Ledger-Report', bodyHtml)
}