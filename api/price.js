// /api/price.js — taruh di folder api/ di project Vercel saweria-bridge kamu
// GET /api/price?id=215718515
// Gak nyentuh Redis/Upstash atau data Saweria sama sekali

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=120"); // cache di Vercel edge 2 menit

  const { id } = req.query;
  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ error: "id tidak valid" });
  }

  const assetId = Number(id);

  try {
    // 1. Coba ambil harga reseller terendah (= "Best Price" di marketplace)
    const resellerRes = await fetch(
      `https://economy.roblox.com/v1/assets/${assetId}/resellers?limit=1&sortOrder=Asc`,
      { headers: { "Accept": "application/json" } }
    );

    if (resellerRes.ok) {
      const data = await resellerRes.json();
      if (data?.data?.length > 0 && data.data[0].price) {
        return res.status(200).json({
          assetId,
          price: data.data[0].price,
          source: "reseller",
        });
      }
    }

    // 2. Kalau gak ada reseller aktif, coba pakai recentAveragePrice dari resale-data
    const resaleRes = await fetch(
      `https://economy.roblox.com/v1/assets/${assetId}/resale-data`,
      { headers: { "Accept": "application/json" } }
    );

    if (resaleRes.ok) {
      const data = await resaleRes.json();
      if (data?.recentAveragePrice) {
        return res.status(200).json({
          assetId,
          price: data.recentAveragePrice,
          source: "resale-average",
        });
      }
      // item non-limited → punya originalPrice
      if (data?.originalPrice) {
        return res.status(200).json({
          assetId,
          price: data.originalPrice,
          source: "original",
        });
      }
    }

    // 3. Last resort: detail asset langsung
    const detailRes = await fetch(
      `https://economy.roblox.com/v2/assets/${assetId}/details`,
      { headers: { "Accept": "application/json" } }
    );

    if (detailRes.ok) {
      const data = await detailRes.json();
      if (data?.PriceInRobux != null) {
        return res.status(200).json({
          assetId,
          price: data.PriceInRobux,
          source: "product-info",
        });
      }
    }

    return res.status(502).json({ error: "semua endpoint Roblox gagal", assetId });

  } catch (err) {
    return res.status(500).json({ error: err.message, assetId });
  }
}
