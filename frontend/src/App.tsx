import { useEffect, useState, type FormEvent } from 'react'
import { api, type Todo } from './api'

export default function App() {
  const [username, setUsername] = useState(localStorage.getItem('username'))

  function handleLogin(token: string, name: string) {
    localStorage.setItem('token', token)
    localStorage.setItem('username', name)
    setUsername(name)
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    setUsername(null)
  }

  return (
    <main>
      <h1>📝 Todo List</h1>
      {username ? <TodoPage username={username} onLogout={handleLogout} /> : <AuthPage onLogin={handleLogin} />}
      <LoadBalancerTest />
    </main>
  )
}

// ---------------- LOGIN & SIGNUP ----------------
function AuthPage({ onLogin }: { onLogin: (token: string, name: string) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    const body = JSON.stringify({ username, password })

    try {
      if (mode === 'signup') {
        await api('/auth/signup', { method: 'POST', body })
        setMessage('Akun berhasil dibuat, silakan login.')
        setMode('login')
        setPassword('')
      } else {
        const { data } = await api<{ token: string; username: string }>('/auth/login', { method: 'POST', body })
        onLogin(data.token, data.username)
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="card">
      <h2>{mode === 'login' ? 'Login' : 'Daftar Akun'}</h2>
      <form onSubmit={handleSubmit}>
        <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">{mode === 'login' ? 'Login' : 'Daftar'}</button>
      </form>
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
      <p className="switch">
        {mode === 'login' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
        <button className="link" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
          {mode === 'login' ? 'Daftar' : 'Login'}
        </button>
      </p>
    </section>
  )
}

// ---------------- TODO LIST ----------------
function TodoPage({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [instance, setInstance] = useState('')
  const [error, setError] = useState('')

  // Jalankan request, catat instance yang melayani, logout otomatis kalau token tidak valid
  async function run<T>(path: string, options?: RequestInit) {
    try {
      setError('')
      const result = await api<T>(path, options)
      setInstance(result.instance)
      return result.data
    } catch (err) {
      const msg = (err as Error).message
      if (msg === 'Silakan login dulu') onLogout()
      setError(msg)
      return null
    }
  }

  useEffect(() => {
    run<Todo[]>('/todos').then((data) => data && setTodos(data))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addTodo(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const todo = await run<Todo>('/todos', { method: 'POST', body: JSON.stringify({ title }) })
    if (todo) {
      setTodos([...todos, todo])
      setTitle('')
    }
  }

  async function toggleTodo(todo: Todo) {
    const updated = await run<Todo>(`/todos/${todo.id}`, { method: 'PATCH', body: JSON.stringify({ done: !todo.done }) })
    if (updated) setTodos(todos.map((t) => (t.id === todo.id ? updated : t)))
  }

  async function deleteTodo(id: number) {
    const ok = await run(`/todos/${id}`, { method: 'DELETE' })
    if (ok) setTodos(todos.filter((t) => t.id !== id))
  }

  return (
    <section className="card">
      <div className="header">
        <span>Halo, <b>{username}</b> 👋</span>
        <button className="link" onClick={onLogout}>Logout</button>
      </div>

      <form onSubmit={addTodo} className="row">
        <input placeholder="Mau mengerjakan apa?" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="submit">Tambah</button>
      </form>

      {error && <p className="error">{error}</p>}

      <ul className="todos">
        {todos.map((todo) => (
          <li key={todo.id} className={todo.done ? 'done' : ''}>
            <label>
              <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo)} />
              {todo.title}
            </label>
            <button className="delete" onClick={() => deleteTodo(todo.id)} aria-label="Hapus">✕</button>
          </li>
        ))}
        {todos.length === 0 && <li className="empty">Belum ada todo.</li>}
      </ul>

      {instance && <p className="instance">Request terakhir dilayani oleh <code>{instance}</code></p>}
    </section>
  )
}

// ---------------- TES LOAD BALANCER ----------------
// Kirim 6 request ke /api/health, lalu lihat instance mana saja yang menjawab.
function LoadBalancerTest() {
  const [results, setResults] = useState<string[]>([])

  async function test() {
    const list: string[] = []
    for (let i = 0; i < 6; i++) {
      try {
        const { instance } = await api('/health')
        list.push(instance)
      } catch {
        list.push('gagal')
      }
    }
    setResults(list)
  }

  return (
    <section className="card lb">
      <h3>⚖️ Tes Load Balancer</h3>
      <p>Kirim 6 request ke <code>/api/health</code> dan lihat siapa yang menjawab.</p>
      <button onClick={test}>Kirim 6 request</button>
      {results.length > 0 && (
        <ol>
          {results.map((r, i) => (
            <li key={i}><code>{r}</code></li>
          ))}
        </ol>
      )}
    </section>
  )
}
