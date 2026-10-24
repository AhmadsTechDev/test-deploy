FROM oven/bun:1-alpine
WORKDIR /app

# Install dependency dulu (biar layer ini di-cache kalau package.json tidak berubah)
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

# Baru copy kode aplikasi ke /app
COPY . .

EXPOSE 3000
CMD ["bun", "src/index.ts"]
