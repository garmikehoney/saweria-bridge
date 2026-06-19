// api/donations.js
//
// Endpoint UTAMA yang di-polling Roblox tiap 4-7 detik.
// Mengembalikan semua donasi baru yang ID-nya lebih besar dari "after".

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
    const afterStr = req.query.after || "0";
    const afterNum = Number(afterStr);

    const raw = await redis.zrange("saweria:donations", `(${afterNum}`, "+inf", {
      byScore: true,
    });

    const items = (raw || []).map(safeParse).filter(Boolean);

    res.status(200).json({ ok: true, items });
  } catch (err) {
    console.error("[donations] error:", err);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
}
