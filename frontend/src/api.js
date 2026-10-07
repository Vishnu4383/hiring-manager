let access = null
let inflight = null
let onExpire = () => {}

export const setOnExpire = (fn) => { onExpire = fn }

function renew() {
  inflight ??= fetch('/api/auth/refresh/', { method: 'POST' })
    .then(async (r) => {
      if (!r.ok) return false
      access = (await r.json()).access
      return true
    })
    .catch(() => false)
    .finally(() => { inflight = null })
  return inflight
}

function explain(data) {
  if (!data) return 'Something went wrong.'
  if (data.detail) return data.detail
  const first = Object.values(data)[0]
  return Array.isArray(first) ? first[0] : String(first)
}

export async function api(path, { method = 'GET', body } = {}) {
  const auth = !path.startsWith('/auth/')
  const go = () => fetch('/api' + path, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(auth && access && { Authorization: `Bearer ${access}` }),
    },
    body: body && JSON.stringify(body),
  })

  let res = await go()
  if (res.status === 401 && auth) {
    if (!(await renew())) {
      onExpire()
      throw new Error('Session expired.')
    }
    res = await go()
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(explain(data))
  return data
}

export async function resume() {
  return (await renew()) ? api('/me/') : null
}

export async function enter(mode, email, password) {
  const data = await api(`/auth/${mode}/`, { method: 'POST', body: { email, password } })
  access = data.access
  return { email: data.email }
}

export async function leave() {
  await api('/auth/logout/', { method: 'POST' })
  access = null
}
