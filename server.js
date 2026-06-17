import express from "express";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || "0.0.0.0";
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
    })
  : null;

app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, database: Boolean(pool) });
});

app.get("/api/state", async (_request, response) => {
  try {
    if (!pool) return response.json({});
    await ensureSchema();
    const result = await pool.query("SELECT value FROM app_state WHERE key = $1", ["main"]);
    response.json(result.rows[0]?.value || {});
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Nao foi possivel carregar os dados." });
  }
});

app.put("/api/state", async (request, response) => {
  try {
    if (!pool) return response.json({ ok: true, mode: "local" });
    await ensureSchema();
    await pool.query(
      `INSERT INTO app_state (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      ["main", request.body]
    );
    response.json({ ok: true });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Nao foi possivel salvar os dados." });
  }
});

app.use(
  express.static(__dirname, {
    extensions: ["html"],
    setHeaders(response, filePath) {
      if (/\.(html|js|css|json)$/.test(filePath) || filePath.endsWith("sw.js")) {
        response.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

app.get("*", (_request, response) => {
  response.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, host, () => {
  console.log(`AWKNAPP rodando em ${host}:${port}`);
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
