// /api/price.js
// GET /api/price?id=215718515
// Return recentAveragePrice dari Roblox economy API (berubah otomatis tiap ada transaksi)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=120");

  const { id } = req.query;
  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ error: "id tidak valid" });
  }

  const assetId = Number(id);

  try {
    // primary: recentAveragePrice (rata-rata harga transaksi terakhir, otomatis update)
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

    // fallback: harga original dari product info
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
