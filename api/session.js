// api/session.js
//
// Dipanggil oleh Roblox (SaweriaBridge.lua) sekali saat server Roblox start.
// Sekarang juga butuh "channel" supaya tahu data donasi siapa yang harus dibaca.

import { redis } from "../lib/redis.js";
import { randomBytes } from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, reason: "method_not_allowed" });
    return;
  }

  try {
    const { universeId, channel } = req.body || {};
    if (!universeId) {
      res.status(400).json({ ok: false, reason: "missing_universe_id" });
      return;
    }
    if (!channel) {
      res.status(400).json({ ok: false, reason: "missing_channel" });
      return;
    }

    const token = randomBytes(16).toString("hex");

    // Simpan token -> { universeId, channel } selama 24 jam
    await redis.set(
      `saweria:session:${token}`,
      JSON.stringify({ universeId: String(universeId), channel: String(channel) }),
      { ex: 86400 }
    );

    res.status(200).json({ ok: true, token });
  } catch (err) {
    console.error("[session] error:", err);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
}
