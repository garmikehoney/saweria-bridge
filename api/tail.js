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

// Upstash Redis client kadang otomatis decode JSON, kadang tidak.
// Helper ini menangani keduanya dengan aman.
function safeParse(entry) {
  if (entry == null) return null;
  if (typeof entry === "object") return entry; // sudah ter-decode otomatis
  try {
    return JSON.parse(entry);
  } catch {
    return null;
  }
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
    const latest = await redis.zrange("saweria:donations", -1, -1);
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
