# Todo List: Belajar nginx (Web Server, Reverse Proxy, Load Balancer)

Proyek todo list sederhana dengan login dan signup, dibuat untuk memahami cara kerja nginx.

- **Frontend**: Vite + React + TypeScript
- **Backend**: Elysia.js (Bun) + JWT
- **Database**: PostgreSQL
- **nginx**: web server + reverse proxy + load balancer
- Semuanya dijalankan dengan **Docker Compose**

## Arsitektur

```
                         ┌──────────────────── Docker ─────────────────────┐
                         │                                                 │
 Browser ──:80────▶  ┌───────┐   /          → file React (dist)            │
                     │ nginx │                                             │
                     └───┬───┘   /api/...   → diteruskan ke backend        │
                         │                                                 │
              ┌──────────┴──────────┐   (bergantian / round robin)         │
              ▼                     ▼                                      │
        ┌──────────┐          ┌──────────┐                                 │
        │ backend1 │          │ backend2 │   ← tidak bisa diakses langsung │
        └────┬─────┘          └────┬─────┘                                 │
             └──────────┬──────────┘                                       │
                        ▼                                                  │
                  ┌──────────┐                                             │
                  │ postgres │   ← satu database dipakai bersama           │
                  └──────────┘                                             │
                         └─────────────────────────────────────────────────┘
```

| Peran nginx | Di mana di `nginx/nginx.conf` | Artinya |
|---|---|---|
| Web server | `root` + `location /` | nginx sendiri yang mengirim file HTML/CSS/JS |
| Reverse proxy | `location /api/` + `proxy_pass` | nginx meneruskan request ke aplikasi lain |
| Load balancer | `upstream backend { ... }` | tujuan proxy-nya lebih dari satu, jadi request dibagi |

## Struktur folder

```
todo-nginx/
├── docker-compose.yml      ← menyusun semua service
├── nginx/nginx.conf        ← ⭐ file utama yang dipelajari
├── db/init.sql             ← tabel users & todos (otomatis dibuat)
├── backend/                ← Elysia.js
│   ├── Dockerfile
│   └── src/index.ts
└── frontend/               ← Vite + React
    ├── Dockerfile          ← build React, lalu masukkan ke image nginx
    └── src/
        ├── App.tsx
        └── api.ts
```

## Cara menjalankan

Syarat: Docker Desktop (Windows) atau Docker Engine (Ubuntu) sudah terinstall.

```bash
cd todo-nginx
cp .env.example .env   # lalu isi POSTGRES_PASSWORD dan JWT_SECRET
docker compose up -d --build
```

Buka **http://localhost**, daftar akun, login, lalu tambah todo.

Kalau dijalankan di VM Ubuntu Server, buka `http://IP-VM` dari browser Windows (cek IP dengan `ip a`).

Perintah lain yang berguna:

```bash
docker compose ps                 # lihat status semua container
docker compose logs -f nginx      # lihat log nginx secara live
docker compose logs -f backend1   # lihat log backend1
docker compose down               # matikan semua (data tetap aman)
docker compose down -v            # matikan + hapus database
```

## Eksperimen untuk memahami nginx

### 1. Lihat load balancer bekerja
Klik tombol **"Kirim 6 request"** di halaman. Hasilnya akan bergantian:
`backend-1, backend-2, backend-1, ...`. Inilah *round robin*.

Bisa juga lewat terminal:
```bash
curl http://localhost/api/health
curl http://localhost/api/health
```

Atau buka DevTools (F12) → tab **Network** → klik request `/api/...` → lihat header
`x-instance` (nama backend) dan `X-Upstream` (alamat IP yang dipilih nginx).

### 2. Matikan satu backend
```bash
docker compose stop backend2
```
Aplikasi tetap jalan, karena nginx otomatis mengirim semua request ke `backend1`.
Inilah alasan load balancer dipakai: kalau satu server mati, aplikasi tidak ikut mati.

Nyalakan lagi:
```bash
docker compose start backend2
```

### 3. Ubah cara pembagian request
Edit `nginx/nginx.conf` di bagian `upstream`, misalnya:

```nginx
upstream backend {
    server backend1:3000 weight=3;   # backend1 dapat 3x lebih banyak
    server backend2:3000;
}
```

Config nginx ikut dimasukkan ke dalam image, jadi build ulang nginx untuk menerapkannya:
```bash
docker compose up -d --build nginx          # build ulang + ganti container nginx
docker compose exec nginx nginx -t          # cek apakah config valid
docker compose exec nginx nginx -T          # lihat config yang sedang dipakai
```

Pilihan lain yang bisa dicoba: `least_conn;` (pilih server yang paling sepi) atau
`ip_hash;` (pengunjung yang sama selalu ke server yang sama).

### 4. Buktikan backend tidak bisa diakses langsung
Backend tidak punya `ports` di `docker-compose.yml`, jadi `http://localhost:3000` tidak bisa dibuka.
Satu-satunya pintu masuk adalah nginx. Begitulah reverse proxy melindungi aplikasi.

### 5. Kenapa login tetap jalan walaupun pindah-pindah backend?
Login memakai **JWT**. Token disimpan di browser dan bisa diverifikasi oleh backend mana pun,
asal `JWT_SECRET`-nya sama. Data todo juga disimpan di **satu database yang sama**.

Kalau login disimpan di memori masing-masing backend (session), user akan "ter-logout"
setiap kali nginx mengarahkan request ke backend lain. Ini masalah umum di load balancing.

## Development tanpa Docker (opsional)

Kalau mau ngoding dengan hot reload:

```bash
# 1. Nyalakan database saja
docker compose up -d db

# 2. Backend (terminal 1). Butuh Bun: https://bun.sh
cd backend
bun install
DATABASE_URL=postgres://todo:todo@localhost:5432/todo bun run dev
#  Windows PowerShell:
#  $env:DATABASE_URL="postgres://todo:todo@localhost:5432/todo"; bun run dev

# 3. Frontend (terminal 2)
cd frontend
npm install
npm run dev
```

Buka http://localhost:5173. Saat dev, tugas reverse proxy `/api` diambil alih oleh Vite
(lihat `server.proxy` di `frontend/vite.config.ts`).

## API backend

| Method | Endpoint | Login? | Keterangan |
|---|---|---|---|
| GET | `/api/health` | – | cek instance yang melayani |
| POST | `/api/auth/signup` | – | `{ username, password }` |
| POST | `/api/auth/login` | – | `{ username, password }` → `{ token }` |
| GET | `/api/todos` | ✅ | daftar todo milik user |
| POST | `/api/todos` | ✅ | `{ title }` |
| PATCH | `/api/todos/:id` | ✅ | `{ done }` |
| DELETE | `/api/todos/:id` | ✅ | hapus todo |

## Catatan

- Password dan `JWT_SECRET` di `docker-compose.yml` hanya untuk belajar. Ganti kalau dipakai sungguhan.
- nginx mencari alamat `backend1` dan `backend2` saat start. Kalau nginx di-restart
  saat salah satu backend mati, nginx gagal start. Nyalakan backend dulu.
- Port default 80. Kalau bentrok (misal dengan Laragon di Windows), isi `APP_PORT=8080`
  di `.env` lalu buka `http://localhost:8080`.
