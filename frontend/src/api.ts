// Semua request ke backend lewat path relatif "/api/...".
// Browser tidak tahu backend ada di mana. Yang ia tahu cuma nginx (atau proxy Vite saat dev).

export type Todo = { id: number; title: string; done: boolean }

type Result<T> = { data: T; instance: string }

export async function api<T>(path: string, options: RequestInit = {}): Promise<Result<T>> {
  const token = localStorage.getItem('token')

  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  // Nama instance backend yang melayani request ini (dikirim lewat header x-instance)
  const instance = res.headers.get('x-instance') ?? '?'
  const data = await res.json().catch(() => null)

  if (!res.ok) {
    if (res.status === 422) throw new Error('Username minimal 3 karakter, password minimal 6 karakter')
    throw new Error(data?.error ?? `Error ${res.status}`)
  }

  return { data, instance }
}
