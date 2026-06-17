import express from "express";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import webpush from "web-push";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || "0.0.0.0";
const databaseUrl = process.env.DATABASE_URL;
const vapidPublicKey =
  process.env.VAPID_PUBLIC_KEY ||
  "BHfO81KI2PQ_nOjqz6KqnVOpmdXk-6cgdz3PSzBixsLUmUnZAfop--5P2SP_IM3L8DyCKLG-dcjFt8NV7wflRQI";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "cFlSanRxyKhjULaNPjSopMpY2H3wUudEaGteo8ZDsI0";
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
    })
  : null;

webpush.setVapidDetails("mailto:awkn@app.local", vapidPublicKey, vapidPrivateKey);

app.use(express.json({ limit: "2mb" }));

app.use("/api", (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, database: Boolean(pool), push: Boolean(vapidPublicKey && vapidPrivateKey) });
});

app.get("/api/push/public-key", (_request, response) => {
  response.json({ publicKey: vapidPublicKey });
});

app.post("/api/push/subscribe", async (request, response) => {
  try {
    if (!pool) return response.status(503).json({ error: "Banco de dados indisponivel." });
    const { musicianId, subscription } = request.body || {};
    if (!musicianId || !subscription?.endpoint) {
      return response.status(400).json({ error: "Assinatura de notificacao invalida." });
    }
    await ensureSchema();
    await pool.query(
      `INSERT INTO push_subscriptions (musician_id, endpoint, subscription, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (endpoint)
       DO UPDATE SET musician_id = EXCLUDED.musician_id, subscription = EXCLUDED.subscription, updated_at = NOW()`,
      [musicianId, subscription.endpoint, subscription]
    );
    response.json({ ok: true });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Nao foi possivel ativar notificacoes." });
  }
});

app.post("/api/push/unsubscribe", async (request, response) => {
  try {
    if (!pool) return response.json({ ok: true });
    const { endpoint } = request.body || {};
    if (endpoint) {
      await ensureSchema();
      await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
    }
    response.json({ ok: true });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Nao foi possivel remover notificacao." });
  }
});

app.post("/api/push/test", async (request, response) => {
  try {
    if (!pool) return response.status(503).json({ error: "Banco de dados indisponivel." });
    const { musicianId } = request.body || {};
    if (!musicianId) return response.status(400).json({ error: "Musico invalido." });
    await ensureSchema();
    const sent = await sendPushToMusician(musicianId, {
      title: "Notificações ativadas",
      body: "Este aparelho já pode receber avisos de escala.",
      url: "/",
    });
    response.json({ ok: true, sent });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Nao foi possivel testar notificacao." });
  }
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
    const previous = await pool.query("SELECT value FROM app_state WHERE key = $1", ["main"]);
    const previousState = previous.rows[0]?.value || {};
    const nextState = mergeAppState(previousState, request.body || {});
    await pool.query(
      `INSERT INTO app_state (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      ["main", nextState]
    );
    response.json({ ok: true, state: nextState });
    notifyNewAssignments(previousState, nextState).catch((error) => console.error(error));
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      musician_id TEXT NOT NULL,
      endpoint TEXT UNIQUE NOT NULL,
      subscription JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function mergeAppState(previousState = {}, incomingState = {}) {
  const deletedMissionIds = [...new Set([...(previousState.deletedMissionIds || []), ...(incomingState.deletedMissionIds || [])])];
  const missions = mergeMissions(previousState.missions, incomingState.missions).filter((mission) => !deletedMissionIds.includes(mission.id));
  const activeMissionId = incomingState.activeMissionId || previousState.activeMissionId || null;
  return {
    musicians: mergeById(previousState.musicians, incomingState.musicians, "mainRole"),
    missions,
    songLibrary: mergeSongs(previousState.songLibrary, incomingState.songLibrary),
    deletedMissionIds,
    activeMissionId: missions.some((mission) => mission.id === activeMissionId) ? activeMissionId : missions[0]?.id || null,
    visibleDate: incomingState.visibleDate || previousState.visibleDate,
    updatedAt: new Date().toISOString(),
  };
}

function mergeById(previous = [], incoming = [], tieField) {
  const map = new Map();
  [...(previous || []), ...(incoming || [])].forEach((item) => {
    if (!item?.id) return;
    const current = map.get(item.id) || {};
    map.set(item.id, { ...current, ...item, [tieField]: item[tieField] || current[tieField] });
  });
  return [...map.values()];
}

function mergeMissions(previous = [], incoming = []) {
  const map = new Map();
  (previous || []).forEach((mission) => {
    if (mission?.id) map.set(mission.id, { ...mission });
  });
  (incoming || []).forEach((mission) => {
    if (!mission?.id) return;
    const current = map.get(mission.id) || {};
    const currentTime = Date.parse(current.updatedAt || 0) || 0;
    const incomingTime = Date.parse(mission.updatedAt || 0) || 0;
    if (!current.id || incomingTime >= currentTime) {
      map.set(mission.id, {
        ...current,
        ...mission,
        members: Array.isArray(mission.members) ? mission.members : current.members || [],
        songs: Array.isArray(mission.songs) ? mission.songs : current.songs || [],
        updatedAt: mission.updatedAt || new Date().toISOString(),
      });
    }
  });
  return [...map.values()].sort((a, b) => `${a.date || ""} ${a.time || ""}`.localeCompare(`${b.date || ""} ${b.time || ""}`));
}

function mergeMembers(previous = [], incoming = []) {
  const map = new Map();
  [...(previous || []), ...(incoming || [])].forEach((member) => {
    if (!member?.id) return;
    const current = map.get(member.id) || {};
    map.set(member.id, { ...current, ...member });
  });
  return [...map.values()];
}

function mergeSongs(previous = [], incoming = []) {
  const map = new Map();
  [...(previous || []), ...(incoming || [])].forEach((song) => {
    const key = song?.id || `${song?.type || "Missa"}:${song?.moment || ""}:${String(song?.name || "").toLowerCase()}`;
    if (!key) return;
    const current = map.get(key) || {};
    map.set(key, { ...current, ...song, id: song?.id || current.id || key });
  });
  return [...map.values()];
}

async function notifyNewAssignments(previousState, nextState) {
  if (!pool) return;
  const previousKeys = assignmentKeys(previousState);
  const musiciansById = new Map((nextState.musicians || []).map((musician) => [musician.id, musician]));
  for (const mission of nextState.missions || []) {
    for (const member of mission.members || []) {
      const key = assignmentKey(mission, member);
      if (previousKeys.has(key)) continue;
      const musician = musiciansById.get(member.musicianId);
      await sendPushToMusician(member.musicianId, {
        title: "Você foi escalado(a)",
        body: `${mission.title} - ${formatPushDate(mission.date)} às ${mission.time}`,
        url: "/",
        missionId: mission.id,
        musicianName: musician?.name || "",
      });
    }
  }
}

function assignmentKeys(state) {
  const keys = new Set();
  for (const mission of state.missions || []) {
    for (const member of mission.members || []) {
      keys.add(assignmentKey(mission, member));
    }
  }
  return keys;
}

function assignmentKey(mission, member) {
  return `${mission.id}:${member.musicianId}:${member.id}:${member.assignedAt || mission.date || ""}`;
}

async function sendPushToMusician(musicianId, payload) {
  const result = await pool.query("SELECT id, subscription FROM push_subscriptions WHERE musician_id = $1", [musicianId]);
  let sent = 0;
  await Promise.all(
    result.rows.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify(payload));
        sent += 1;
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await pool.query("DELETE FROM push_subscriptions WHERE id = $1", [row.id]);
          return;
        }
        console.error(error);
      }
    })
  );
  return sent;
}

function formatPushDate(value) {
  if (!value) return "data definida";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(year, month - 1, day));
}
