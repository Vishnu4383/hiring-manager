import { useEffect } from 'react'

export const NAME = 'Tranquil'

export const STAGES = [
  ['wishlist', 'Wishlist'],
  ['applied', 'Applied'],
  ['oa', 'Online test'],
  ['interview', 'Interview'],
  ['offer', 'Offer'],
  ['rejected', 'Rejected'],
]

export const input =
  'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft'
export const btn =
  'rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50'
export const ghost = 'rounded-xl px-3 py-2 text-sm font-medium text-brand hover:bg-brand-soft'
export const card = 'rounded-2xl border border-line bg-card'

export function ago(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 864e5)
  if (days < 1) return 'today'
  return days === 1 ? 'yesterday' : `${days}d ago`
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-ink/30 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`${card} max-h-[90vh] w-full max-w-md overflow-y-auto p-6 shadow-xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="text-mute hover:text-ink" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Label({ text, children }) {
  return (
    <label className="block text-xs font-semibold text-mute">
      {text}
      <div className="mt-1 font-normal text-ink">{children}</div>
    </label>
  )
}
