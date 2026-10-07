import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from './api'
import { card } from './ui'

const FUNNEL = [
  ['applied', 'Applied'],
  ['oa', 'Online test'],
  ['interview', 'Interview'],
  ['offer', 'Offer'],
]
const BRAND = '#6c4bc4'
const AXIS = { fontSize: 12, fill: '#766d90' }

function Tile({ label, value }) {
  return (
    <div className={`${card} p-4`}>
      <div className="text-xs font-semibold text-mute">{label}</div>
      <div className="mt-1 text-3xl font-extrabold">{value}</div>
    </div>
  )
}

export default function Stats() {
  const [data, setData] = useState(null)
  useEffect(() => { api('/stats/').then(setData).catch(() => {}) }, [])
  if (!data) return null

  const funnel = FUNNEL.map(([id, name]) => ({ name, n: data.reached[id] }))
  const weeks = data.per_week.map((w) => ({
    name: new Date(w.week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    n: w.n,
  }))
  const wait = data.avg_days_to_response

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Applications" value={data.total} />
        <Tile label="Interviews" value={data.reached.interview} />
        <Tile label="Offers" value={data.reached.offer} />
        <Tile label="Avg. days to first reply" value={wait == null ? '–' : wait.toFixed(1)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${card} p-4`}>
          <h2 className="mb-3 font-bold">Where applications get to</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnel} layout="vertical" margin={{ right: 28 }} barSize={18}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={84} />
              <Tooltip cursor={{ fill: '#ebe5f9' }} formatter={(v) => [v, 'Applications']} />
              <Bar dataKey="n" fill={BRAND} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="n" position="right" style={{ fontSize: 12, fill: '#2d2543' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className={`${card} p-4`}>
          <h2 className="mb-3 font-bold">Applications sent per week</h2>
          {weeks.length === 0 ? (
            <p className="text-sm text-mute">Move a card to Applied and this fills in.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeks} barSize={22}>
                <CartesianGrid vertical={false} stroke="#e4ddf2" />
                <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={24} />
                <Tooltip cursor={{ fill: '#ebe5f9' }} formatter={(v) => [v, 'Applications']} />
                <Bar dataKey="n" fill={BRAND} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>
    </div>
  )
}
