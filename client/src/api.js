const BASE = 'http://localhost:3001/api'

const safeJson = async (res) => {
  const data = await res.json().catch(() => null)
  if (!res.ok || data === null) {
    throw new Error((data && data.error) || `Request failed (${res.status})`)
  }
  return data
}

const r = (url, opt = {}) =>
  fetch(BASE + url, opt).then(safeJson)

const post = (url, data) =>
  r(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

const put = (url, data) =>
  r(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

const del = (url) => r(url, { method: 'DELETE' })

export const api = {
  getParties:    ()      => r('/parties'),
  addParty:      (d)     => post('/parties', d),
  updateParty:   (id, d) => put(`/parties/${id}`, d),
  delParty:      (id)    => del(`/parties/${id}`),

  getEntries:    (id)    => r(`/entries/${id}`),
  addEntry:      (d)     => post('/entries', d),
  updateEntry:   (id, d) => put(`/entries/${id}`, d),
  delEntry:      (id)    => del(`/entries/${id}`),

  getDash:       ()      => r('/dashboard'),

  getMonthly:    (ym)    => r(`/reports/monthly/${ym}`),
  getBalances:   ()      => r('/reports/balances'),
  getAllLedger:  ()      => r('/reports/all-ledger'),
}