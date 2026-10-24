# ---------- Tahap 1: build React dengan Node ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
# hasilnya ada di /app/dist

# ---------- Tahap 2: sajikan hasil build dengan nginx ----------
# Image akhir cuma berisi nginx + file statis, tanpa Node dan node_modules.
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Konfigurasi nginx ikut dimasukkan ke image, jadi file React dan config-nya
# selalu satu paket. "nginxconf" adalah folder ./nginx (diatur di docker-compose.yml).
# Ditulis sebagai default.conf supaya menggantikan config bawaan image.
COPY --from=nginxconf nginx.conf /etc/nginx/conf.d/default.conf
