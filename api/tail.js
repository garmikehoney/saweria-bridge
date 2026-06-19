// api/tail.js
//
// Dipanggil sekali saat server Roblox start, untuk tahu
// "donasi terakhir sampai sini" supaya donasi LAMA tidak ter-replay.
// Sekarang per-channel sesuai session.

import { redis } from "../lib/redis.js";

function safeParse(entry) {
  if (entry == null) return null;
  if (typeof entry === "object") return entry;
  try {
    return JSON.parse(entry);
  } catch {
    return null;
  }
}

async function getSessionData(req) {
  const token = req.headers["x-session"];
  if (!token) return null;
  const raw = await redis.get(`saweria:session:${token}`);
  if (!raw) return null;
  return safeParse(raw);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, reason: "method_not_allowed" });
    return;
  }

  const session = await getSessionData(req);
  if (!session || !session.channel) {
    res.status(401).json({ ok: false, reason: "invalid_session" });
    return;
  }

  try {
    const latest = await redis.zrange(`saweria:donations:${session.channel}`, -1, -1);
    if (!latest || latest.length === 0) {
      res.status(200).json({ ok: true, id: "0" });
      return;
    }

    const parsed = safeParse(latest[0]);
    if (!parsed) {
      res.status(200).json({ ok: true, id: "0" });
      return;
    }

    res.status(200).json({ ok: true, id: parsed.id });
  } catch (err) {
    console.error("[tail] error:", err);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
}
