// api/tail.js
//
// Dipanggil sekali saat server Roblox start, untuk tahu
// "donasi terakhir sampai sini" supaya donasi LAMA tidak ter-replay.

import { redis } from "../lib/redis.js";

async function validateSession(req) {
  const token = req.headers["x-session"];
  if (!token) return false;
  const universeId = await redis.get(`saweria:session:${token}`);
  return !!universeId;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, reason: "method_not_allowed" });
    return;
  }

  const valid = await validateSession(req);
  if (!valid) {
    res.status(401).json({ ok: false, reason: "invalid_session" });
    return;
  }

  try {
    // Ambil ID donasi paling besar (paling baru) yang sudah pernah masuk
    const latest = await redis.zrange("saweria:donations", -1, -1);
    if (!latest || latest.length === 0) {
      res.status(200).json({ ok: true, id: "0" });
      return;
    }

    const parsed = JSON.parse(latest[0]);
    res.status(200).json({ ok: true, id: parsed.id });
  } catch (err) {
    console.error("[tail] error:", err);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
}
