import { useState } from 'react'
import { enter } from './api'
import { NAME, btn, input, card } from './ui'

export default function Login({ onDone }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      onDone(await enter(mode, form.email, form.password))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className={`${card} w-full max-w-sm space-y-4 p-8 shadow-sm`}>
        <div>
          <h1 className="text-2xl font-extrabold text-brand">{NAME}</h1>
          <p className="mt-1 text-sm text-mute">One calm place for the whole job hunt.</p>
        </div>
        <input className={input} type="email" placeholder="Email" required value={form.email} onChange={set('email')} />
        <input
          className={input}
          type="password"
          placeholder="Password"
          required
          minLength={mode === 'register' ? 8 : undefined}
          value={form.password}
          onChange={set('password')}
        />
        {error && <p className="rounded-lg bg-sand px-3 py-2 text-sm text-sand-ink">{error}</p>}
        <button className={`${btn} w-full`} disabled={busy}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <button
          type="button"
          className="w-full text-sm text-mute hover:text-brand"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
        >
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
