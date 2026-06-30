// /api/price.js
// GET /api/price?id=215718515
// Butuh env variable ROBLOX_COOKIE di Vercel buat dapat Best Price reseller

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=120");

  const { id } = req.query;
  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ error: "id tidak valid" });
  }

  const assetId = Number(id);
  const cookie = process.env.ROBLOX_COOKIE;

  try {
    // 1. Resellers endpoint (butuh cookie buat dapat data aktif)
    if (cookie) {
      const resellerRes = await fetch(
        `https://economy.roblox.com/v1/assets/${assetId}/resellers?limit=1&sortOrder=Asc`,
        {
          headers: {
            "Accept": "application/json",
            "Cookie": `.ROBLOSECURITY=${cookie}`,
          },
        }
      );

      if (resellerRes.ok) {
        const data = await resellerRes.json();
        if (data?.data?.length > 0 && data.data[0].price) {
          return res.status(200).json({
            assetId,
            price: data.data[0].price,
            source: "reseller-best-price",
          });
        }
      }
    }

    // 2. Resale data — recentAveragePrice (gak butuh auth, tapi ini rata-rata bukan best price)
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
      if (data?.originalPrice) {
        return res.status(200).json({
          assetId,
          price: data.originalPrice,
          source: "original",
        });
      }
    }

    // 3. Last resort
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
