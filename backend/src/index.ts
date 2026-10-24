import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { sql } from "bun"; // Bun.sql otomatis memakai env DATABASE_URL

// Nama instance ini. Di docker-compose ada 2 backend: backend-1 dan backend-2.
// Dengan nama ini kamu bisa melihat instance mana yang dipilih nginx (load balancer).
const INSTANCE = process.env.INSTANCE_NAME ?? "backend-lokal";
const PORT = Number(process.env.PORT ?? 3000);

const authBody = t.Object({
  username: t.String({ minLength: 3 }),
  password: t.String({ minLength: 6 }),
});

const app = new Elysia({ prefix: "/api" })
  .use(jwt({ name: "jwt", secret: process.env.JWT_SECRET ?? "rahasia-dev", exp: "7d" }))

  // Setiap response diberi header "x-instance" berisi nama instance yang melayani
  .headers({ "x-instance": INSTANCE })

  .get("/health", () => ({ status: "ok", instance: INSTANCE }))

  // ---------- AUTH ----------
  .post(
    "/auth/signup",
    async ({ body, set }) => {
      const existing = await sql`SELECT id FROM users WHERE username = ${body.username}`;
      if (existing.length > 0) {
        set.status = 409;
        return { error: "Username sudah dipakai" };
      }

      const hash = await Bun.password.hash(body.password); // bcrypt/argon2 bawaan Bun
      const [user] = await sql`
        INSERT INTO users (username, password_hash)
        VALUES (${body.username}, ${hash})
        RETURNING id, username`;

      set.status = 201;
      return user;
    },
    { body: authBody },
  )

  .post(
    "/auth/login",
    async ({ body, jwt, set }) => {
      const [user] = await sql`
        SELECT id, username, password_hash FROM users WHERE username = ${body.username}`;

      if (!user || !(await Bun.password.verify(body.password, user.password_hash))) {
        set.status = 401;
        return { error: "Username atau password salah" };
      }

      // Token JWT berisi id user. Token ini "stateless": instance backend mana pun
      // bisa memverifikasinya, jadi aman dipakai di belakang load balancer.
      const token = await jwt.sign({ sub: String(user.id), username: user.username });
      return { token, username: user.username };
    },
    { body: authBody },
  )

  // ---------- SEMUA ROUTE DI BAWAH INI WAJIB LOGIN ----------
  .derive(async ({ headers, jwt }) => {
    const token = headers.authorization?.replace("Bearer ", "");
    const payload = token ? await jwt.verify(token) : false;
    return { userId: payload && payload.sub ? Number(payload.sub) : null };
  })
  .onBeforeHandle(({ userId, set }) => {
    if (!userId) {
      set.status = 401;
      return { error: "Silakan login dulu" };
    }
  })

  // ---------- TODOS ----------
  .get("/todos", async ({ userId }) => {
    const todos = await sql`
      SELECT id, title, done FROM todos
      WHERE user_id = ${userId}
      ORDER BY id`;
    return [...todos]; // ubah hasil query jadi array biasa
  })

  .post(
    "/todos",
    async ({ body, userId, set }) => {
      const [todo] = await sql`
        INSERT INTO todos (user_id, title)
        VALUES (${userId}, ${body.title})
        RETURNING id, title, done`;
      set.status = 201;
      return todo;
    },
    { body: t.Object({ title: t.String({ minLength: 1 }) }) },
  )

  .patch(
    "/todos/:id",
    async ({ params, body, userId, set }) => {
      const [todo] = await sql`
        UPDATE todos SET done = ${body.done}
        WHERE id = ${params.id} AND user_id = ${userId}
        RETURNING id, title, done`;
      if (!todo) {
        set.status = 404;
        return { error: "Todo tidak ditemukan" };
      }
      return todo;
    },
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Object({ done: t.Boolean() }),
    },
  )

  .delete(
    "/todos/:id",
    async ({ params, userId, set }) => {
      const deleted = await sql`
        DELETE FROM todos WHERE id = ${params.id} AND user_id = ${userId}
        RETURNING id`;
      if (deleted.length === 0) {
        set.status = 404;
        return { error: "Todo tidak ditemukan" };
      }
      return { ok: true };
    },
    { params: t.Object({ id: t.Numeric() }) },
  )

  .listen(PORT);

console.log(`🦊 ${INSTANCE} jalan di http://localhost:${app.server?.port}`);
