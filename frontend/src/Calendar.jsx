import { useEffect, useState } from 'react'
import { api } from './api'
import { Label, btn, card, ghost, input } from './ui'

const dayKey = (d) => new Date(d).toLocaleDateString('en-CA')
const blank = { title: '', due: '', application: '' }

export default function Calendar({ deadlines, setDeadlines }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [apps, setApps] = useState([])
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')

  useEffect(() => { api('/applications/').then(setApps).catch(() => {}) }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const shift = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))

  const lead = (month.getDay() + 6) % 7
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))]
  const today = dayKey(new Date())

  async function add(e) {
    e.preventDefault()
    setError('')
    try {
      const body = {
        title: form.title,
        due_at: new Date(form.due).toISOString(),
        application: form.application || null,
      }
      const made = await api('/deadlines/', { method: 'POST', body })
      setDeadlines([...deadlines, made].sort((a, b) => a.due_at.localeCompare(b.due_at)))
      setForm(blank)
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggle(d) {
    const next = await api(`/deadlines/${d.id}/`, { method: 'PATCH', body: { done: !d.done } })
    setDeadlines(deadlines.map((x) => (x.id === d.id ? next : x)))
  }

  async function remove(d) {
    await api(`/deadlines/${d.id}/`, { method: 'DELETE' })
    setDeadlines(deadlines.filter((x) => x.id !== d.id))
  }

  const late = (d) => !d.done && new Date(d.due_at) < Date.now()
  const upcoming = deadlines.filter((d) => !d.done || dayKey(d.due_at) >= today)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className={`${card} p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <div>
            <button className={ghost} onClick={() => shift(-1)}>←</button>
            <button className={ghost} onClick={() => shift(1)}>→</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-mute">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const key = dayKey(d)
            const here = deadlines.filter((x) => dayKey(x.due_at) === key)
            return (
              <div
                key={i}
                onClick={() => setForm({ ...form, due: `${key}T09:00` })}
                className={`min-h-20 cursor-pointer rounded-xl border p-1 text-xs ${
                  key === today ? 'border-brand bg-brand-soft/60' : 'border-line hover:bg-paper'
                }`}
              >
                <div className="px-1 font-semibold text-mute">{d.getDate()}</div>
                {here.map((x) => (
                  <div
                    key={x.id}
                    title={x.title}
                    className={`mt-0.5 truncate rounded-md px-1 py-0.5 ${
                      x.done ? 'bg-paper text-mute line-through' : late(x) ? 'bg-sand text-sand-ink' : 'bg-brand text-white'
                    }`}
                  >
                    {x.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </section>

      <aside className="space-y-4">
        <form onSubmit={add} className={`${card} space-y-3 p-4`}>
          <h2 className="font-bold">Add a deadline</h2>
          <Label text="What">
            <input className={input} required value={form.title} onChange={set('title')} placeholder="Short Title" />
          </Label>
          <Label text="When">
            <input className={input} type="datetime-local" required value={form.due} onChange={set('due')} />
          </Label>
          <Label text="Application (optional)">
            <select className={input} value={form.application} onChange={set('application')}>
              <option value="">None</option>
              {apps.map((a) => <option key={a.id} value={a.id}>{a.company} · {a.role}</option>)}
            </select>
          </Label>
          {error && <p className="rounded-lg bg-sand px-3 py-2 text-sm text-sand-ink">{error}</p>}
          <button className={btn}>Add</button>
        </form>

        <div className={`${card} p-4`}>
          <h2 className="mb-2 font-bold">Coming up</h2>
          {upcoming.length === 0 && <p className="text-sm text-mute">All clear.</p>}
          <ul className="space-y-2">
            {upcoming.map((d) => (
              <li key={d.id} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 accent-brand" checked={d.done} onChange={() => toggle(d)} />
                <div className="min-w-0 flex-1">
                  <div className={d.done ? 'text-mute line-through' : 'font-semibold'}>{d.title}</div>
                  <div className={`text-xs ${late(d) ? 'text-sand-ink' : 'text-mute'}`}>
                    {new Date(d.due_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>
                <button className="text-mute hover:text-ink" onClick={() => remove(d)} aria-label="Delete">✕</button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
