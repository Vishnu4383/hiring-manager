import { useEffect, useState } from 'react'
import { api } from './api'
import { Chip, Label, Modal, btn, card, ghost, input } from './ui'

const LINKS = [
  ['github', 'GitHub'],
  ['linkedin', 'LinkedIn'],
  ['leetcode', 'LeetCode'],
]
const blankProject = { title: '', description: '', tech: '', repo_url: '', live_url: '' }

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [projects, setProjects] = useState([])
  const [editing, setEditing] = useState(false)
  const [project, setProject] = useState(null)

  const loadProjects = () => api('/projects/').then(setProjects).catch(() => {})
  useEffect(() => {
    api('/profile/').then(setProfile).catch(() => {})
    loadProjects()
  }, [])

  if (!profile) return null
  const bare = !profile.full_name && !profile.university && projects.length === 0

  return (
    <div className="max-w-3xl space-y-6">
      <section className={`${card} p-6`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-3xl font-extrabold">{profile.full_name || 'Your name'}</h2>
            {(profile.university || profile.degree) && (
              <p className="mt-1 text-sm text-mute">
                {[profile.degree, profile.university].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button className={ghost} onClick={() => setEditing(true)}>Edit</button>
        </div>

        {profile.gpa != null && (
          <div className="mt-3">
            <Chip style="bg-brand-soft text-brand-deep">GPA {Number(profile.gpa).toFixed(2)} / 10</Chip>
          </div>
        )}
        {profile.intro && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{profile.intro}</p>}

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
          {LINKS.filter(([k]) => profile[k]).map(([k, label]) => (
            <a key={k} className="text-brand hover:underline" href={profile[k]} target="_blank" rel="noreferrer">{label}</a>
          ))}
          {profile.email && <a className="text-brand hover:underline" href={`mailto:${profile.email}`}>{profile.email}</a>}
        </div>

        {profile.skills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.skills.map((s) => (
              <span key={s} className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-deep">{s}</span>
            ))}
          </div>
        )}
        {bare && <p className="mt-4 text-sm text-mute">Press Edit to fill this in. It is only visible to you.</p>}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Projects</h2>
          <button className={ghost} onClick={() => setProject(blankProject)}>+ Add project</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <article key={p.id} className={`${card} flex flex-col p-4`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold">{p.title}</h3>
                <button className="text-xs font-semibold text-mute hover:text-brand" onClick={() => setProject(p)}>Edit</button>
              </div>
              {p.description && <p className="mt-1 text-sm text-mute">{p.description}</p>}
              {p.tech && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.tech.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                    <span key={t} className="rounded-md bg-paper px-2 py-0.5 text-xs text-mute">{t}</span>
                  ))}
                </div>
              )}
              <div className="mt-auto flex gap-4 pt-3 text-sm font-semibold">
                {p.repo_url && <a className="text-brand hover:underline" href={p.repo_url} target="_blank" rel="noreferrer">Code</a>}
                {p.live_url && <a className="text-brand hover:underline" href={p.live_url} target="_blank" rel="noreferrer">Live</a>}
              </div>
            </article>
          ))}
        </div>
      </section>

      {editing && (
        <ProfileForm
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(p) => { setProfile(p); setEditing(false) }}
        />
      )}
      {project && (
        <ProjectForm
          project={project}
          onClose={() => setProject(null)}
          onSaved={() => { setProject(null); loadProjects() }}
        />
      )}
    </div>
  )
}

function ProfileForm({ profile, onClose, onSaved }) {
  const [form, setForm] = useState({ ...profile, skills: profile.skills.join(', '), gpa: profile.gpa ?? '' })
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function save(e) {
    e.preventDefault()
    const body = {
      ...form,
      gpa: form.gpa === '' ? null : form.gpa,
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
    }
    try {
      onSaved(await api('/profile/', { method: 'PATCH', body }))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Label text="Name"><input className={input} value={form.full_name} onChange={set('full_name')} /></Label>
        <Label text="University"><input className={input} value={form.university} onChange={set('university')} /></Label>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Label text="Degree"><input className={input} value={form.degree} onChange={set('degree')} /></Label>
          <Label text="GPA / 10">
            <input className={input} type="number" step="0.01" min="0" max="10" value={form.gpa} onChange={set('gpa')} />
          </Label>
        </div>
        <Label text="Intro"><textarea className={input} rows={3} value={form.intro} onChange={set('intro')} /></Label>
        <Label text="Skills (comma separated)">
          <input className={input} value={form.skills} onChange={set('skills')} placeholder="Python, Django, PyTorch" />
        </Label>
        {LINKS.map(([k, label]) => (
          <Label key={k} text={label}>
            <input className={input} type="url" value={form[k]} onChange={set(k)} placeholder="https://" />
          </Label>
        ))}
        <Label text="Email"><input className={input} type="email" value={form.email} onChange={set('email')} /></Label>
        {error && <p className="rounded-lg bg-sand px-3 py-2 text-sm text-sand-ink">{error}</p>}
        <div className="flex justify-end pt-2"><button className={btn}>Save</button></div>
      </form>
    </Modal>
  )
}

function ProjectForm({ project, onClose, onSaved }) {
  const [form, setForm] = useState(project)
  const [error, setError] = useState('')
  const isNew = !project.id
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function save(e) {
    e.preventDefault()
    try {
      await api(isNew ? '/projects/' : `/projects/${project.id}/`, { method: isNew ? 'POST' : 'PATCH', body: form })
      onSaved()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove() {
    if (!confirm(`Delete ${project.title}?`)) return
    await api(`/projects/${project.id}/`, { method: 'DELETE' })
    onSaved()
  }

  return (
    <Modal title={isNew ? 'Add project' : 'Edit project'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Label text="Title"><input className={input} required value={form.title} onChange={set('title')} /></Label>
        <Label text="Description"><textarea className={input} rows={3} value={form.description} onChange={set('description')} /></Label>
        <Label text="Tech (comma separated)">
          <input className={input} value={form.tech} onChange={set('tech')} placeholder="Django, React, Postgres" />
        </Label>
        <Label text="Code link"><input className={input} type="url" value={form.repo_url} onChange={set('repo_url')} placeholder="https://" /></Label>
        <Label text="Live link"><input className={input} type="url" value={form.live_url} onChange={set('live_url')} placeholder="https://" /></Label>
        {error && <p className="rounded-lg bg-sand px-3 py-2 text-sm text-sand-ink">{error}</p>}
        <div className="flex items-center justify-between pt-2">
          {isNew ? <span /> : <button type="button" className={ghost} onClick={remove}>Delete</button>}
          <button className={btn}>Save</button>
        </div>
      </form>
    </Modal>
  )
}
