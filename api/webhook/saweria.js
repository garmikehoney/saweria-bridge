// api/webhook/saweria.js
//
// Endpoint ini didaftarkan ke Saweria sebagai Webhook URL.
// Sekarang support MULTI-CHANNEL — beberapa game/teman bisa pakai
// 1 bridge yang sama, datanya tetap terpisah.
//
// URL untuk tiap game/teman (WAJIB beda "channel"):
//   https://nama-project.vercel.app/api/webhook/saweria?secret=KODE_RAHASIA&channel=npnh
//   https://nama-project.vercel.app/api/webhook/saweria?secret=KODE_RAHASIA&channel=temanA

import { redis } from "../../lib/redis.js";

function parseSaweriaPayload(body) {
  if (body.embeds && Array.isArray(body.embeds) && body.embeds[0]) {
    const embed = body.embeds[0];
    const title = String(embed.title || "");
    const description = String(embed.description || "");

    const amountMatch = title.match(/MASUK\s+([\d.,]+)/i);
    let amount = 0;
    if (amountMatch) {
      amount = Number(amountMatch[1].replace(/[.,]/g, ""));
    }

    const afterDari = title.split(/DARI\s+/i)[1] || "";
    const nameMatch = afterDari.match(/^([^\s]+)/);
    const donorName = nameMatch ? nameMatch[1] : "Anonymous";

    return { donorName, amount, message: description };
  }

  const donorName =
    body.donator_name || body.donatorName || body.donator || body.name || "Anonymous";
  const amountRaw =
    body.amount_raw ?? body.amount ?? body.amountRaw ?? body.nominal ?? body.total ?? 0;
  const message = body.message || body.note || body.pesan || "";

  return {
    donorName: String(donorName),
    amount: Number(amountRaw),
    message: String(message),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, reason: "method_not_allowed" });
    return;
  }

  const secret = req.query.secret;
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    res.status(401).json({ ok: false, reason: "invalid_secret" });
    return;
  }

  // ── CHANNEL — wajib diisi, identitas unik tiap game/teman ──
  const channel = String(req.query.channel || "").trim();
  if (!channel) {
    res.status(400).json({ ok: false, reason: "missing_channel" });
    return;
  }

  try {
    const body = req.body || {};
    console.log(`[webhook/saweria] [channel=${channel}] RAW BODY:`, JSON.stringify(body));

    const parsed = parseSaweriaPayload(body);
    console.log(`[webhook/saweria] [channel=${channel}] PARSED:`, JSON.stringify(parsed));

    if (!parsed.amount || parsed.amount <= 0) {
      res.status(400).json({ ok: false, reason: "invalid_amount", parsed });
      return;
    }

    // Counter & list donasi sekarang per-channel
    const id = await redis.incr(`saweria:donation_counter:${channel}`);

    const donation = {
      id: String(id),
      source: "saweria",
      donorName: parsed.donorName,
      amount: parsed.amount,
      currency: "IDR",
      message: parsed.message,
      timestamp: Date.now(),
    };

    await redis.zadd(`saweria:donations:${channel}`, {
      score: id,
      member: JSON.stringify(donation),
    });

    await redis.zremrangebyrank(`saweria:donations:${channel}`, 0, -501);

    console.log(`[webhook/saweria] [channel=${channel}] SAVED:`, JSON.stringify(donation));

    res.status(200).json({ ok: true, id: donation.id });
  } catch (err) {
    console.error("[webhook/saweria] error:", err);
    res.status(500).json({ ok: false, reason: "internal_error" });
  }
}
