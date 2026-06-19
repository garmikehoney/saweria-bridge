// api/webhook/saweria.js
//
// Endpoint ini didaftarkan ke Saweria sebagai Webhook URL.
// Saweria akan kirim POST request kesini setiap ada donasi masuk.
//
// URL yang didaftarkan ke Saweria nanti formatnya:
//   https://nama-project-kamu.vercel.app/api/webhook/saweria?secret=KODE_RAHASIA_KAMU

import { redis } from "../../lib/redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, reason: "method_not_allowed" });
    return;
  }

  // ── VALIDASI SECRET ─────────────────────────────────
  // Mencegah orang lain kirim donasi palsu ke endpoint kamu
  const secret = req.query.secret;
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    res.status(401).json({ ok: false, reason: "invalid_secret" });
    return;
  }

  try {
    const body = req.body || {};

    // ── FORMAT PAYLOAD DARI SAWERIA ───────────────────
    // Saweria mengirim field-field berikut (sesuai dokumentasi resmi):
    //   donator_name   -> nama pendonasi
    //   amount_raw     -> jumlah donasi (angka)
    //   message        -> pesan donasi
    //   created_at     -> waktu donasi
    const donorName = body.donator_name || body.donatorName || "Anonymous";
    const amount    = Number(body.amount_raw || body.amount || 0);
    const message   = body.message || "";

    if (!amount || amount <= 0) {
      res.status(400).json({ ok: false, reason: "invalid_amount" });
      return;
    }

    // ── GENERATE ID UNIK & INCREMENTAL ────────────────
    // Roblox butuh ID yang selalu naik supaya bisa tahu mana donasi baru
    const id = await redis.incr("saweria:donation_counter");

    const donation = {
      id: String(id),
      source: "saweria",
      donorName: String(donorName),
      amount: amount,
      currency: "IDR",
      message: String(message),
      timestamp: Date.now(),
    };

    // ── SIMPAN KE REDIS (sorted set, score = id) ──────
    await redis.zadd("saweria:donations", {
      score: id,
      member: JSON.stringify(donation),
    });

    // Hapus data lebih dari 500 entry terakhir biar Redis tidak penuh
    await redis.zremrangebyrank("saweria:donations", 0, -501);

    res.status(200).json({ ok: true, id: donation.id });
  } catch (err) {
    console.error("[webhook/saweria] error:", err);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
}
