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
  const secret = req.query.secret;
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    res.status(401).json({ ok: false, reason: "invalid_secret" });
    return;
  }

  try {
    const body = req.body || {};

    // DEBUG: selalu print body mentah yang diterima dari Saweria
    // Lihat ini di Vercel Logs untuk tahu format field aslinya
    console.log("[webhook/saweria] RAW BODY:", JSON.stringify(body));

    // ── FORMAT PAYLOAD — coba semua kemungkinan nama field ─
    const donorName =
      body.donator_name ||
      body.donatorName ||
      body.donator ||
      body.name ||
      "Anonymous";

    const amountRaw =
      body.amount_raw ??
      body.amount ??
      body.amountRaw ??
      body.nominal ??
      body.total ??
      0;

    const amount = Number(amountRaw);

    const message =
      body.message ||
      body.note ||
      body.pesan ||
      "";

    if (!amount || amount <= 0) {
      console.log("[webhook/saweria] REJECTED - invalid amount. Body was:", JSON.stringify(body));
      res.status(400).json({ ok: false, reason: "invalid_amount", receivedBody: body });
      return;
    }

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

    await redis.zadd("saweria:donations", {
      score: id,
      member: JSON.stringify(donation),
    });

    await redis.zremrangebyrank("saweria:donations", 0, -501);

    console.log("[webhook/saweria] SAVED:", JSON.stringify(donation));

    res.status(200).json({ ok: true, id: donation.id });
  } catch (err) {
    console.error("[webhook/saweria] error:", err);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
}
