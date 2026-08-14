const TREASURY_BASE = "https://api.mcstatecraft.com/economy/api/v1";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors() });
    }

    if (url.pathname === "/") {
      return json({
        service: "Taco Watch",
        ok: true,
        endpoint: "/api/notes"
      });
    }

    if (url.pathname === "/api/notes") {
      try {
        validateEnv(env);

        const pageLimit = clamp(Number(env.TREASURY_PAGE_LIMIT || 500), 1, 1000);
        const pageCount = clamp(Number(env.TREASURY_PAGES || 3), 1, 20);

        const all = [];
        for (let page = 1; page <= pageCount; page++) {
          const response = await treasuryFetch(
            `/accounts/${encodeURIComponent(env.TREASURY_ACCOUNT_ID)}/transactions?page=${page}&limit=${pageLimit}`,
            env.TREASURY_API_KEY
          );

          const rows = extractRows(response);
          all.push(...rows);

          if (rows.length < pageLimit) break;
        }

        const marker = String(env.NOTE_MARKER || "note").toLowerCase();
        const faceValue = positiveNumber(env.NOTE_FACE_VALUE, 100);
        const shopPrice = positiveNumber(env.NOTE_SHOP_PRICE, faceValue);

        const matches = all
          .map(normalizeTransaction)
          .filter(Boolean)
          .filter(tx => `${tx.memo} ${tx.type} ${tx.description}`.toLowerCase().includes(marker));

        const holders = new Map();
        const activity = [];

        for (const tx of matches) {
          const player = tx.counterparty || tx.player || "Unknown";
          if (player === "Unknown") continue;

          // If the API exposes item quantity, use it. Otherwise infer quantity from
          // Treasury money moved divided by the configured ChestShop price per note.
          const quantity = tx.quantity > 0
            ? tx.quantity
            : Math.max(1, Math.round(Math.abs(tx.amount) / shopPrice));

          const noteValue = quantity * faceValue;

          // Perspective is the configured Treasury account:
          // money received by treasury => player bought notes => player acquired notes
          // money sent by treasury     => player sold/redeemed notes => player disposed notes
          const acquired = tx.direction === "IN";
          const h = holders.get(player) || {
            player,
            acquired: 0,
            disposed: 0,
            estimated: 0,
            transactions: 0,
            confidencePoints: 0
          };

          if (acquired) {
            h.acquired += noteValue;
            h.estimated += noteValue;
          } else {
            h.disposed += noteValue;
            h.estimated -= noteValue;
          }

          h.transactions += 1;
          h.confidencePoints += tx.quantity > 0 ? 3 : (tx.amount > 0 ? 2 : 1);
          holders.set(player, h);

          activity.push({
            id: tx.id,
            player,
            direction: acquired ? "ACQUIRED NOTES" : "DISPOSED NOTES",
            noteValue,
            memo: tx.memo || tx.description || tx.type || "(no memo)",
            timestamp: tx.timestamp
          });
        }

        const holderList = [...holders.values()]
          .map(h => ({
            player: h.player,
            acquired: round2(h.acquired),
            disposed: round2(h.disposed),
            estimated: round2(h.estimated),
            transactions: h.transactions,
            confidence: h.confidencePoints >= 12 ? "high" : h.confidencePoints >= 5 ? "medium" : "low"
          }))
          .sort((a,b) => b.estimated - a.estimated);

        activity.sort((a,b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));

        const trackedValue = holderList.reduce((s,h) => s + Math.max(0,h.estimated), 0);
        const globalConfidence =
          matches.length >= 30 ? "high" :
          matches.length >= 8 ? "medium" : "low";

        return json({
          generatedAt: new Date().toISOString(),
          configuration: {
            marker: env.NOTE_MARKER,
            faceValue,
            shopPrice,
            accountId: env.TREASURY_ACCOUNT_ID
          },
          summary: {
            trackedValue: round2(trackedValue),
            players: holderList.length,
            matchingTransactions: matches.length,
            confidence: globalConfidence
          },
          holders: holderList,
          activity: activity.slice(0, 50)
        });
      } catch (err) {
        return json({ error: String(err.message || err) }, 500);
      }
    }

    return new Response("Not Found", { status: 404, headers: cors() });
  }
};

function validateEnv(env) {
  const missing = [];
  for (const key of ["TREASURY_API_KEY","TREASURY_ACCOUNT_ID","NOTE_MARKER"]) {
    if (!env[key]) missing.push(key);
  }
  if (missing.length) {
    throw new Error(`Missing Cloudflare variable(s): ${missing.join(", ")}`);
  }
}

async function treasuryFetch(path, token) {
  const res = await fetch(`${TREASURY_BASE}${path}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json"
    }
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`StateCraft Treasury API ${res.status}: ${text.slice(0,300)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Treasury API returned non-JSON data.");
  }
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["transactions","items","data","content","results"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  // Some APIs nest page content one level down.
  for (const value of Object.values(payload || {})) {
    if (value && typeof value === "object") {
      for (const key of ["transactions","items","data","content","results"]) {
        if (Array.isArray(value[key])) return value[key];
      }
    }
  }
  return [];
}

function normalizeTransaction(raw) {
  if (!raw || typeof raw !== "object") return null;

  const amount = numberFrom(
    raw.amount, raw.value, raw.total, raw.money, raw.postingAmount,
    raw.transactionAmount
  );

  const memo = textFrom(raw.memo, raw.message, raw.note, raw.reason, raw.description, raw.details);
  const description = textFrom(raw.description, raw.details, raw.itemName, raw.item, raw.material);
  const type = textFrom(raw.type, raw.transactionType, raw.kind, raw.category);

  let direction = String(textFrom(raw.direction, raw.flow, raw.side)).toUpperCase();
  if (!["IN","OUT"].includes(direction)) {
    if (raw.incoming === true || raw.credit === true || amount > 0) direction = "IN";
    else direction = "OUT";
  }

  const counterparty = textFrom(
    raw.counterpartyName,
    raw.counterparty,
    raw.playerName,
    raw.initiatorName,
    raw.actorName,
    raw.senderName,
    raw.recipientName,
    raw.fromName,
    raw.toName,
    raw.username
  );

  const quantity = numberFrom(
    raw.quantity, raw.qty, raw.itemQuantity, raw.itemCount, raw.count
  );

  return {
    id: textFrom(raw.txnId, raw.transactionId, raw.id, raw.uuid) || "?",
    amount: Math.abs(amount),
    direction,
    counterparty,
    player: counterparty,
    quantity: Math.abs(quantity),
    memo,
    description,
    type,
    timestamp: textFrom(raw.timestamp, raw.createdAt, raw.settledAt, raw.date, raw.time)
  };
}

function textFrom(...vals) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
    if (v && typeof v === "object") {
      for (const key of ["name","username","displayName","label"]) {
        if (typeof v[key] === "string" && v[key].trim()) return v[key].trim();
      }
    }
  }
  return "";
}

function numberFrom(...vals) {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/[£,$\s]/g,""));
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function positiveNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function clamp(n,min,max) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max,Math.max(min,Math.floor(n)));
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function json(data, status=200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...cors(),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
