
const ML_API = "https://api.mercadolibre.com";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const source = String(req.body?.source || "").trim();

    if (!source) {
      return res.status(400).json({
        error: "Informe o código MLB ou o link público do produto."
      });
    }

    const itemId = await resolveItemId(source);

    if (!itemId) {
      return res.status(400).json({
        error:
          "Não encontrei o código MLB nesse endereço. Abra o anúncio público normal e copie o link completo, ou informe o código MLB."
      });
    }

    const headers = {
      Accept: "application/json",
      "User-Agent": "Oferta-Certa/1.0"
    };

    if (process.env.ML_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.ML_ACCESS_TOKEN}`;
    }

    const item = await getJson(`${ML_API}/items/${itemId}`, headers);

    let description = "";
    try {
      const descriptionData = await getJson(
        `${ML_API}/items/${itemId}/description`,
        headers
      );
      description =
        descriptionData.plain_text ||
        descriptionData.text ||
        "";
    } catch {
      description = "";
    }

    let category = "Outros";
    if (item.category_id) {
      try {
        const categoryData = await getJson(
          `${ML_API}/categories/${item.category_id}`,
          headers
        );
        category = categoryData.name || "Outros";
      } catch {
        category = "Outros";
      }
    }

    const images = (item.pictures || [])
      .map(picture => picture.secure_url || picture.url)
      .filter(Boolean)
      .slice(0, 5);

    if (!images.length && item.thumbnail) {
      images.push(item.thumbnail.replace(/^http:/, "https:"));
    }

    return res.status(200).json({
      product: {
        item_id: item.id,
        title: item.title || "",
        description: description.slice(0, 500),
        price: Number.isFinite(Number(item.price))
          ? Number(item.price)
          : null,
        old_price: Number.isFinite(Number(item.original_price))
          ? Number(item.original_price)
          : null,
        category,
        images,
        permalink: item.permalink || null
      }
    });
  } catch (error) {
    console.error("Mercado Livre import error:", error);

    const status = error.status || 400;
    const publicMessage =
      status === 401 || status === 403
        ? "O Mercado Livre exigiu autorização para consultar esse anúncio. Será necessário configurar uma aplicação e um token oficial."
        : error.message || "Não foi possível importar o produto.";

    return res.status(status >= 500 ? 500 : 400).json({
      error: publicMessage
    });
  }
}

async function resolveItemId(source) {
  const direct = extractItemId(source);
  if (direct) return direct;

  if (!/^https?:\/\//i.test(source)) return null;

  const response = await fetch(source, {
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent":
        "Mozilla/5.0 (compatible; OfertaCertaImporter/1.0)"
    }
  });

  const finalUrlId = extractItemId(response.url);
  if (finalUrlId) return finalUrlId;

  const html = await response.text();
  return extractItemId(html);
}

function extractItemId(value) {
  const normalized = String(value || "")
    .toUpperCase()
    .replace(/MLB-(\d+)/g, "MLB$1");

  const match = normalized.match(/\bMLB\d{7,15}\b/);
  return match ? match[0] : null;
}

async function getJson(url, headers) {
  const response = await fetch(url, { headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message ||
      data.error ||
      `Consulta recusada pelo Mercado Livre (${response.status}).`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}
