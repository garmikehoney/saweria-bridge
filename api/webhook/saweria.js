// api/webhook/saweria.js
//
// Endpoint ini didaftarkan ke Saweria sebagai Webhook URL.
// PENTING: Saweria mengirim data dalam FORMAT DISCORD EMBED, contoh:
//   {
//     "embeds": [{
//       "title": "... DONASI MASUK 69.420 DARI Someguy ...",
//       "description": "Pesan donasi disini",
//       "color": 16428587
//     }]
//   }
//
// URL yang didaftarkan ke Saweria nanti formatnya:
//   https://nama-project-kamu.vercel.app/api/webhook/saweria?secret=KODE_RAHASIA_KAMU

import { redis } from "../../lib/redis.js";

function parseSaweriaPayload(body) {
  // ── FORMAT 1: Discord Embed (format asli Saweria) ──────
  if (body.embeds && Array.isArray(body.embeds) && body.embeds[0]) {
    const embed = body.embeds[0];
    const title = String(embed.title || "");
    const description = String(embed.description || "");

    // Ambil angka setelah kata "MASUK" (format: "69.420" pakai titik)
    const amountMatch = title.match(/MASUK\s+([\d.,]+)/i);
    let amount = 0;
    if (amountMatch) {
      // hapus titik/koma pemisah ribuan, lalu jadikan angka
      amount = Number(amountMatch[1].replace(/[.,]/g, ""));
    }

    // Ambil nama donatur: HANYA kata pertama setelah "DARI"
    // (nama Saweria umumnya 1 kata tanpa spasi)
    const afterDari = title.split(/DARI\s+/i)[1] || "";
    const nameMatch = afterDari.match(/^([^\s]+)/);
    const donorName = nameMatch ? nameMatch[1] : "Anonymous";

    return {
      donorName,
      amount,
      message: description,
    };
  }

  // ── FORMAT 2: JSON polos (jaga-jaga kalau ada format lain) ──
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

  try {
    const body = req.body || {};
    console.log("[webhook/saweria] RAW BODY:", JSON.stringify(body));

    const parsed = parseSaweriaPayload(body);
    console.log("[webhook/saweria] PARSED:", JSON.stringify(parsed));

    if (!parsed.amount || parsed.amount <= 0) {
      console.log("[webhook/saweria] REJECTED - invalid amount after parsing.");
      res.status(400).json({ ok: false, reason: "invalid_amount", parsed });
      return;
    }

    const id = await redis.incr("saweria:donation_counter");

    const donation = {
      id: String(id),
      source: "saweria",
      donorName: parsed.donorName,
      amount: parsed.amount,
      currency: "IDR",
      message: parsed.message,
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
