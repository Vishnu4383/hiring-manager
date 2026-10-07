import { useEffect, useState } from 'react'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { api } from './api'
import { STAGES, Label, Modal, ago, btn, card, ghost, input } from './ui'

const blank = { company: '', role: '', link: '', notes: '', contact_name: '', contact_email: '', status: 'wishlist' }

export default function Board() {
  const [apps, setApps] = useState([])
  const [editing, setEditing] = useState(null)

  const load = () => api('/applications/').then(setApps).catch(() => {})
  useEffect(() => { load() }, [])

  async function onDragEnd({ draggableId, destination }) {
    if (!destination) return
    const id = Number(draggableId)
    const status = destination.droppableId
    if (apps.find((a) => a.id === id).status === status) return
    setApps(apps.map((a) => (a.id === id ? { ...a, status } : a)))
    await api(`/applications/${id}/`, { method: 'PATCH', body: { status } }).catch(() => {})
    load()
  }

  return (
    <>
      <button className={`${btn} mb-4`} onClick={() => setEditing(blank)}>
        + Add application
      </button>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map(([id, label]) => {
            const items = apps.filter((a) => a.status === id)
            return (
              <Droppable droppableId={id} key={id}>
                {(drop, snap) => (
                  <section
                    ref={drop.innerRef}
                    {...drop.droppableProps}
                    className={`w-60 shrink-0 rounded-2xl p-2 ${snap.isDraggingOver ? 'bg-brand-soft' : 'bg-white/60'}`}
                  >
                    <h3 className="mb-2 flex justify-between px-2 pt-1 text-xs font-bold uppercase tracking-wide text-mute">
                      {label}
                      <span>{items.length}</span>
                    </h3>
                    <div className="min-h-16">
                      {items.map((a, i) => (
                        <Draggable key={a.id} draggableId={String(a.id)} index={i}>
                          {(drag) => (
                            <article
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              {...drag.dragHandleProps}
                              onClick={() => setEditing(a)}
                              className={`${card} mb-2 cursor-pointer p-3 hover:border-brand`}
                            >
                              <div className="text-sm font-bold">{a.company}</div>
                              <div className="text-sm text-mute">{a.role}</div>
                              <div className="mt-2 text-xs text-mute/80">
                                {ago(a.events.at(-1)?.at ?? a.created_at)}
                              </div>
                            </article>
                          )}
                        </Draggable>
                      ))}
                      {drop.placeholder}
                    </div>
                  </section>
                )}
              </Droppable>
            )
          })}
        </div>
      </DragDropContext>

      {editing && (
        <Editor
          app={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </>
  )
}

function Editor({ app, onClose, onSaved }) {
  const [form, setForm] = useState(app)
  const [error, setError] = useState('')
  const isNew = !app.id
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function save(e) {
    e.preventDefault()
    try {
      const { events, id, created_at, ...body } = form
      await api(isNew ? '/applications/' : `/applications/${id}/`, {
        method: isNew ? 'POST' : 'PATCH',
        body,
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove() {
    if (!confirm(`Delete ${app.company}?`)) return
    await api(`/applications/${app.id}/`, { method: 'DELETE' })
    onSaved()
  }

  return (
    <Modal title={isNew ? 'New application' : app.company} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Label text="Company">
          <input className={input} required value={form.company} onChange={set('company')} />
        </Label>
        <Label text="Role">
          <input className={input} required value={form.role} onChange={set('role')} />
        </Label>
        <Label text="Stage">
          <select className={input} value={form.status} onChange={set('status')}>
            {STAGES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </Label>
        <Label text="Posting link">
          <input className={input} type="url" value={form.link} onChange={set('link')} />
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <Label text="Contact">
            <input className={input} value={form.contact_name} onChange={set('contact_name')} />
          </Label>
          <Label text="Contact email">
            <input className={input} type="email" value={form.contact_email} onChange={set('contact_email')} />
          </Label>
        </div>
        <Label text="Notes">
          <textarea className={input} rows={3} value={form.notes} onChange={set('notes')} />
        </Label>

        {!isNew && (
          <ol className="space-y-1 border-l-2 border-line pl-3 text-xs text-mute">
            {app.events.map((ev, i) => (
              <li key={i}>
                {new Date(ev.at).toLocaleDateString()} · {ev.old ? `${ev.old} → ${ev.new}` : `added as ${ev.new}`}
              </li>
            ))}
          </ol>
        )}

        {error && <p className="rounded-lg bg-sand px-3 py-2 text-sm text-sand-ink">{error}</p>}
        <div className="flex items-center justify-between pt-2">
          {isNew ? <span /> : <button type="button" className={ghost} onClick={remove}>Delete</button>}
          <button className={btn}>Save</button>
        </div>
      </form>
    </Modal>
  )
}
