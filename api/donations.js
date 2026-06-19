// api/donations.js
//
// Endpoint UTAMA yang di-polling Roblox tiap 4-7 detik.
// Sekarang per-channel sesuai session, jadi data antar game/teman tidak campur.

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
    const afterStr = req.query.after || "0";
    const afterNum = Number(afterStr);

    const raw = await redis.zrange(`saweria:donations:${session.channel}`, `(${afterNum}`, "+inf", {
      byScore: true,
    });

    const items = (raw || []).map(safeParse).filter(Boolean);

    res.status(200).json({ ok: true, items });
  } catch (err) {
    console.error("[donations] error:", err);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
}
