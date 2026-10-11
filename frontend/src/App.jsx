import { useEffect, useState } from 'react'
import { api, leave, resume, setOnExpire } from './api'
import { NAME } from './ui'
import Login from './Login'
import Board from './Board'
import Calendar from './Calendar'
import Stats from './Stats'
import Debrief from './Debrief'
import Vault from './Vault'
import Profile from './Profile'

const TABS = [
  ['board', 'Board'],
  ['calendar', 'Calendar'],
  ['stats', 'Insights'],
  ['debrief', 'Debrief'],
  ['vault', 'Vault'],
  ['profile', 'Profile'],
]

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function App() {
  const [user, setUser] = useState(undefined)
  const [tab, setTab] = useState('board')
  const [deadlines, setDeadlines] = useState([])

  useEffect(() => {
    setOnExpire(() => setUser(null))
    resume().then((u) => setUser(u), () => setUser(null))
  }, [])

  useEffect(() => {
    if (user) api('/deadlines/').then(setDeadlines).catch(() => {})
  }, [user])

  if (user === undefined) return null
  if (!user) return <Login onDone={setUser} />

  const open = deadlines.filter((d) => !d.done)
  const overdue = open.filter((d) => new Date(d.due_at) < Date.now()).length
  const soon = open.filter((d) => {
    const left = new Date(d.due_at) - Date.now()
    return left >= 0 && left < 7 * 864e5
  }).length

  async function signOut() {
    await leave().catch(() => {})
    setUser(null)
  }

  return (
    <div className="min-h-screen md:flex">
      <nav className="flex items-center gap-1 overflow-x-auto border-b border-line bg-card p-3 md:min-h-screen md:w-56 md:flex-col md:items-stretch md:border-b-0 md:border-r md:p-5">
        <div className="mr-3 text-xl font-extrabold text-brand md:mb-6 md:mr-0">{NAME}</div>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-xl px-3 py-2 text-left text-sm font-semibold ${
              tab === id ? 'bg-brand-soft text-brand-deep' : 'text-mute hover:bg-paper'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto text-xs text-mute md:ml-0 md:mt-auto md:pt-6">
          <div className="hidden truncate md:block">{user.email}</div>
          <button className="font-semibold text-brand hover:underline" onClick={signOut}>
            Sign out
          </button>
        </div>
      </nav>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold">{greeting()}.</h1>
          <p className="mt-1 text-sm text-mute">
            {soon ? `${soon} deadline${soon > 1 ? 's' : ''} in the next 7 days.` : 'Nothing due this week. Breathe.'}
            {overdue > 0 && (
              <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-xs font-semibold text-sand-ink">
                {overdue} overdue
              </span>
            )}
          </p>
        </header>
        {tab === 'board' && <Board />}
        {tab === 'calendar' && <Calendar deadlines={deadlines} setDeadlines={setDeadlines} />}
        {tab === 'stats' && <Stats />}
        {tab === 'debrief' && <Debrief />}
        {tab === 'vault' && <Vault />}
        {tab === 'profile' && <Profile />}
      </main>
    </div>
  )
}
