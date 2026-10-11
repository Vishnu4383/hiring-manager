import { useEffect, useState } from 'react'
import { api } from './api'
import { Label, btn, card, ghost, input } from './ui'

const LIMIT = 5 * 1024 * 1024
const KINDS = ['resume', 'transcript', 'other']

const size = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

export default function Vault() {
  const [docs, setDocs] = useState([])
  const [kind, setKind] = useState('resume')
  const [file, setFile] = useState(null)
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api('/documents/').then(setDocs).catch(() => {})
  useEffect(() => { load() }, [])

  function choose(e) {
    const picked = e.target.files[0] ?? null
    setFile(picked)
    if (picked) setName(picked.name)
  }

  async function upload(e) {
    e.preventDefault()
    if (!file) return setError('Choose a file first.')
    if (file.size > LIMIT) return setError('Files can be up to 5 MB.')
    setBusy(true)
    setError('')
    try {
      const { url, key } = await api('/documents/upload-url/', {
        method: 'POST',
        body: { content_type: file.type },
      })
      const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!put.ok) throw new Error('Upload to storage failed.')
      await api('/documents/', { method: 'POST', body: { name: name.trim() || file.name, kind, key } })
      setFile(null)
      setName('')
      await load()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  async function rename(e) {
    e.preventDefault()
    const value = renaming.value.trim()
    if (value) await api(`/documents/${renaming.id}/`, { method: 'PATCH', body: { name: value } })
    setRenaming(null)
    load()
  }

  async function open(d) {
    const { url } = await api(`/documents/${d.id}/download/`)
    window.open(url, '_blank', 'noopener')
  }

  async function remove(d) {
    if (!confirm(`Delete ${d.name}?`)) return
    await api(`/documents/${d.id}/`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={upload} className={`${card} space-y-3 p-4`}>
        <h2 className="font-bold">Add a document</h2>
        <Label text="File (PDF, DOCX, PNG, JPEG)">
          <div className={`${input} relative flex cursor-pointer items-center gap-2`}>
            <span className="truncate">{file ? file.name : 'Choose file'}</span>
            <input
              type="file"
              accept=".pdf,.docx,.png,.jpg,.jpeg"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={choose}
            />
          </div>
        </Label>
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <Label text="Name">
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Backend CV" />
          </Label>
          <Label text="Type">
            <select className={input} value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </Label>
        </div>
        {error && <p className="rounded-lg bg-sand px-3 py-2 text-sm text-sand-ink">{error}</p>}
        <button className={btn} disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
      </form>

      <section className={`${card} divide-y divide-line`}>
        {docs.length === 0 && <p className="p-4 text-sm text-mute">Nothing here yet.</p>}
        {docs.map((d) => (
          <div key={d.id} className="flex items-center gap-3 p-4">
            {renaming?.id === d.id ? (
              <form onSubmit={rename} className="flex min-w-0 flex-1 gap-2">
                <input
                  autoFocus
                  className={input}
                  value={renaming.value}
                  onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                  onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)}
                />
                <button className={btn}>Save</button>
              </form>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{d.name}</div>
                  <div className="text-xs text-mute">
                    {d.kind} · {size(d.size)} · {new Date(d.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button className={ghost} onClick={() => open(d)}>Open</button>
                <button className={ghost} onClick={() => setRenaming({ id: d.id, value: d.name })}>Rename</button>
                <button className={ghost} onClick={() => remove(d)}>Delete</button>
              </>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
