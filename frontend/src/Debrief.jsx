import { useEffect, useState } from 'react'
import { api } from './api'
import { Chip, Label, Modal, RESULTS, ROUNDS, btn, card, ghost, input } from './ui'

const roundName = Object.fromEntries(ROUNDS)
const OUTCOMES = [
  ['waiting', 'Waiting'],
  ['cleared', 'Cleared'],
  ['failed', 'Not cleared'],
]
const OUTCOME_STYLE = {
  waiting: 'bg-paper text-mute',
  cleared: 'bg-mint text-mint-ink',
  failed: 'bg-rose text-rose-ink',
}
const ROW_STYLE = { unknown: 'bg-rose/60', partial: 'bg-sand/70', solved: 'bg-mint/60' }

const today = () => new Date().toLocaleDateString('en-CA')
const blank = (company = '', round_no = 1) => ({
  application: '',
  company,
  round_type: 'oa',
  round_no,
  date: today(),
  outcome: 'waiting',
  went_well: '',
  to_improve: '',
  questions: [],
})

export default function Debrief() {
  const [view, setView] = useState('gaps')
  const [rounds, setRounds] = useState([])
  const [topics, setTopics] = useState([])
  const [apps, setApps] = useState([])
  const [editing, setEditing] = useState(null)

  const load = () =>
    Promise.all([api('/debriefs/'), api('/topics/')])
      .then(([r, t]) => { setRounds(r); setTopics(t) })
      .catch(() => {})

  useEffect(() => {
    load()
    api('/applications/').then(setApps).catch(() => {})
  }, [])

  const companies = [...new Set([...apps.map((a) => a.company), ...rounds.map((r) => r.company)])]

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[['gaps', 'Gaps'], ['rounds', 'Rounds']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              view === id ? 'bg-brand text-white' : 'bg-white text-mute hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
        <button className={`${btn} ml-auto`} onClick={() => setEditing(blank())}>+ Add round</button>
      </div>

      {view === 'gaps' ? <Gaps topics={topics} /> : <Rounds rounds={rounds} onEdit={setEditing} />}

      {editing && (
        <Editor
          round={editing}
          apps={apps}
          topics={topics}
          companies={companies}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </>
  )
}

function Gaps({ topics }) {
  const [open, setOpen] = useState(null)
  if (topics.length === 0) {
    return <p className="text-sm text-mute">Log a round with some questions and your weak spots show up here.</p>
  }

  return (
    <ul className="max-w-3xl space-y-2">
      {topics.map((t) => {
        const [label, chip] = RESULTS[t.latest]
        const { unknown, partial, solved } = t.counts
        return (
          <li key={t.topic} className={`${card} overflow-hidden`}>
            <button
              onClick={() => setOpen(open === t.topic ? null : t.topic)}
              className={`flex w-full items-center gap-3 p-4 text-left ${ROW_STYLE[t.latest]}`}
            >
              <span className="flex-1 font-bold">{t.topic}</span>
              <span className="hidden text-xs text-mute sm:block">
                {unknown} unknown · {partial} partly · {solved} solved
              </span>
              <Chip style={chip}>{label}</Chip>
            </button>
            {open === t.topic && (
              <ul className="divide-y divide-line bg-card">
                {[...t.questions].reverse().map((q, i) => (
                  <li key={i} className="flex items-start gap-3 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div>{q.text}</div>
                      <div className="text-xs text-mute">
                        {q.company} · {roundName[q.round_type]} · {new Date(q.date).toLocaleDateString()}
                      </div>
                    </div>
                    <Chip style={RESULTS[q.result][1]}>{RESULTS[q.result][0]}</Chip>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Rounds({ rounds, onEdit }) {
  if (rounds.length === 0) return <p className="text-sm text-mute">No rounds logged yet.</p>

  const groups = {}
  for (const r of rounds) (groups[r.company.toLowerCase()] ??= { company: r.company, rounds: [] }).rounds.push(r)
  const list = Object.values(groups)
  list.forEach((g) => g.rounds.sort((a, b) => a.round_no - b.round_no || a.date.localeCompare(b.date)))
  list.sort((a, b) => b.rounds.at(-1).date.localeCompare(a.rounds.at(-1).date))

  return (
    <div className="grid max-w-3xl gap-4">
      {list.map((g) => (
        <section key={g.company} className={`${card} p-4`}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold">{g.company}</h3>
            <button className={ghost} onClick={() => onEdit(blank(g.company, g.rounds.length + 1))}>
              + Round
            </button>
          </div>
          <ul className="divide-y divide-line">
            {g.rounds.map((r) => (
              <li
                key={r.id}
                onClick={() => onEdit({ ...r, application: r.application ?? '' })}
                className="flex cursor-pointer items-center gap-3 py-2 text-sm hover:bg-paper"
              >
                <span className="w-6 text-xs font-bold text-mute">#{r.round_no}</span>
                <span className="flex-1 font-semibold">{roundName[r.round_type]}</span>
                <span className="hidden text-xs text-mute sm:block">
                  {r.questions.length} question{r.questions.length === 1 ? '' : 's'} · {new Date(r.date).toLocaleDateString()}
                </span>
                <Chip style={OUTCOME_STYLE[r.outcome]}>{OUTCOMES.find(([id]) => id === r.outcome)[1]}</Chip>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Editor({ round, apps, topics, companies, onClose, onSaved }) {
  const [form, setForm] = useState(round)
  const [error, setError] = useState('')
  const isNew = !round.id
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  function pickApp(e) {
    const app = apps.find((a) => String(a.id) === e.target.value)
    setForm({ ...form, application: e.target.value, company: form.company || app?.company || '' })
  }

  const setQuestion = (i, k, v) =>
    setForm({ ...form, questions: form.questions.map((q, j) => (j === i ? { ...q, [k]: v } : q)) })

  async function save(e) {
    e.preventDefault()
    const body = {
      application: form.application || null,
      company: form.company,
      round_type: form.round_type,
      round_no: Number(form.round_no) || 1,
      date: form.date,
      outcome: form.outcome,
      went_well: form.went_well,
      to_improve: form.to_improve,
      questions: form.questions.filter((q) => q.text.trim() && q.topic.trim()),
    }
    try {
      await api(isNew ? '/debriefs/' : `/debriefs/${round.id}/`, { method: isNew ? 'POST' : 'PATCH', body })
      onSaved()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove() {
    if (!confirm('Delete this round?')) return
    await api(`/debriefs/${round.id}/`, { method: 'DELETE' })
    onSaved()
  }

  return (
    <Modal wide title={isNew ? 'Add a round' : `${round.company}, round ${round.round_no}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Label text="Application (optional)">
            <select className={input} value={form.application} onChange={pickApp}>
              <option value="">None, past experience</option>
              {apps.map((a) => <option key={a.id} value={a.id}>{a.company} · {a.role}</option>)}
            </select>
          </Label>
          <Label text="Company">
            <input className={input} list="companies" value={form.company} onChange={set('company')} />
          </Label>
          <Label text="Round type">
            <select className={input} value={form.round_type} onChange={set('round_type')}>
              {ROUNDS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <Label text="Round no.">
              <input className={input} type="number" min="1" value={form.round_no} onChange={set('round_no')} />
            </Label>
            <Label text="Date">
              <input className={input} type="date" required value={form.date} onChange={set('date')} />
            </Label>
          </div>
          <Label text="Outcome">
            <select className={input} value={form.outcome} onChange={set('outcome')}>
              {OUTCOMES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label text="What went well">
            <textarea className={input} rows={2} value={form.went_well} onChange={set('went_well')} />
          </Label>
          <Label text="What to improve">
            <textarea className={input} rows={2} value={form.to_improve} onChange={set('to_improve')} />
          </Label>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold text-mute">Questions asked</div>
          <div className="space-y-2">
            {form.questions.map((q, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_9rem_8rem_auto]">
                <input className={input} placeholder="Question" value={q.text} onChange={(e) => setQuestion(i, 'text', e.target.value)} />
                <input className={input} list="topics" placeholder="Topic" value={q.topic} onChange={(e) => setQuestion(i, 'topic', e.target.value)} />
                <select className={input} value={q.result} onChange={(e) => setQuestion(i, 'result', e.target.value)}>
                  <option value="solved">Solved</option>
                  <option value="partial">Partly</option>
                  <option value="unknown">Completely unknown</option>
                </select>
                <button
                  type="button"
                  className="text-mute hover:text-ink"
                  aria-label="Remove question"
                  onClick={() => setForm({ ...form, questions: form.questions.filter((_, j) => j !== i) })}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={`${ghost} mt-2`}
            onClick={() => setForm({ ...form, questions: [...form.questions, { text: '', topic: '', result: 'unknown' }] })}
          >
            + Add question
          </button>
        </div>

        <datalist id="topics">{topics.map((t) => <option key={t.topic} value={t.topic} />)}</datalist>
        <datalist id="companies">{companies.map((c) => <option key={c} value={c} />)}</datalist>

        {error && <p className="rounded-lg bg-sand px-3 py-2 text-sm text-sand-ink">{error}</p>}
        <div className="flex items-center justify-between pt-2">
          {isNew ? <span /> : <button type="button" className={ghost} onClick={remove}>Delete</button>}
          <button className={btn}>Save</button>
        </div>
      </form>
    </Modal>
  )
}
