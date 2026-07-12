
const ML_API = "https://api.mercadolibre.com";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const source = String(req.body?.source || "").trim();

    if (!source) {
      return res.status(400).json({
        error: "Informe o link público normal do produto ou o código MLB."
      });
    }

    // 1) Tenta importar diretamente da página pública.
    if (/^https?:\/\//i.test(source)) {
      try {
        const pageProduct = await importFromPublicPage(source);

        if (pageProduct?.title && pageProduct?.images?.length) {
          return res.status(200).json({
            product: pageProduct,
            method: "public-page"
          });
        }
      } catch (error) {
        console.warn("Falha na leitura pública:", error.message);
      }
    }

    // 2) Tenta localizar o código MLB e consultar a API oficial.
    const itemId = await resolveItemId(source);

    if (!itemId) {
      return res.status(400).json({
        error:
          "Não encontrei dados suficientes nesse link. Use o link público completo do anúncio, não o link curto meli.la."
      });
    }

    const product = await importFromOfficialApi(itemId);

    return res.status(200).json({
      product,
      method: "official-api"
    });
  } catch (error) {
    console.error("Erro ao importar produto:", error);

    return res.status(400).json({
      error:
        error.message ||
        "Não foi possível importar o produto. Tente outro link público."
    });
  }
}

async function importFromPublicPage(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
    }
  });

  if (!response.ok) {
    throw new Error(`Página recusou a consulta (${response.status}).`);
  }

  const finalUrl = response.url;
  const html = await response.text();

  if (!html || html.length < 500) {
    throw new Error("A página não retornou conteúdo suficiente.");
  }

  const jsonLd = readJsonLdProducts(html);

  const title =
    cleanText(jsonLd?.name) ||
    cleanText(readMeta(html, "property", "og:title")) ||
    cleanText(readMeta(html, "name", "twitter:title")) ||
    cleanText(readTitle(html));

  const description =
    cleanText(jsonLd?.description) ||
    cleanText(readMeta(html, "property", "og:description")) ||
    cleanText(readMeta(html, "name", "description"));

  const images = uniqueUrls([
    ...normalizeImages(jsonLd?.image),
    readMeta(html, "property", "og:image"),
    readMeta(html, "property", "og:image:secure_url"),
    readMeta(html, "name", "twitter:image"),
    ...readAllMeta(html, "property", "og:image")
  ]).slice(0, 5);

  const offers = Array.isArray(jsonLd?.offers)
    ? jsonLd.offers[0]
    : jsonLd?.offers;

  const price =
    parseMoney(offers?.price) ??
    parseMoney(readMeta(html, "property", "product:price:amount")) ??
    parseMoney(findPriceInHtml(html));

  const oldPrice =
    parseMoney(offers?.highPrice) ??
    parseMoney(readMeta(html, "property", "product:original_price:amount"));

  const itemId = extractItemId(finalUrl) || extractItemId(html);

  return {
    item_id: itemId || "LINK-PUBLICO",
    title: title || "",
    description: (description || "").slice(0, 500),
    price,
    old_price: oldPrice,
    category: guessCategory(title, description),
    images,
    permalink: finalUrl
  };
}

async function importFromOfficialApi(itemId) {
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

  return {
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
  };
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

function readJsonLdProducts(html) {
  const scripts = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  ];

  for (const match of scripts) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1].trim()));
      const candidates = Array.isArray(parsed)
        ? parsed
        : parsed?.["@graph"]
          ? parsed["@graph"]
          : [parsed];

      const product = candidates.find(candidate =>
        ["Product", "IndividualProduct"].includes(candidate?.["@type"])
      );

      if (product) return product;
    } catch {
      // Ignora JSON-LD inválido.
    }
  }

  return null;
}

function readMeta(html, attribute, value) {
  const safe = escapeRegExp(value);
  const patterns = [
    new RegExp(
      `<meta[^>]+${attribute}=["']${safe}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${safe}["'][^>]*>`,
      "i"
    )
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }

  return "";
}

function readAllMeta(html, attribute, value) {
  const results = [];
  const safe = escapeRegExp(value);

  const pattern = new RegExp(
    `<meta[^>]+${attribute}=["']${safe}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "gi"
  );

  for (const match of html.matchAll(pattern)) {
    if (match?.[1]) results.push(decodeHtml(match[1]));
  }

  return results;
}

function readTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] || "";
}

function findPriceInHtml(html) {
  const patterns = [
    /"price"\s*:\s*"?(?:R\$\s*)?([\d.,]+)"?/i,
    /"amount"\s*:\s*([\d.]+)/i,
    /R\$\s*([\d.]+,\d{2})/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

function normalizeImages(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeImages);
  if (typeof value === "string") return [value];
  if (typeof value === "object") {
    return [
      value.url,
      value.contentUrl,
      value.thumbnailUrl
    ].filter(Boolean);
  }
  return [];
}

function uniqueUrls(values) {
  return [...new Set(
    values
      .map(value => String(value || "").trim())
      .filter(value => /^https?:\/\//i.test(value))
      .map(value => value.replace(/^http:/i, "https:"))
  )];
}

function parseMoney(value) {
  if (value === null || value === undefined || value === "") return null;

  let text = String(value)
    .replace(/[R$\s]/g, "")
    .trim();

  if (text.includes(",") && text.includes(".")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function cleanText(value) {
  return decodeHtml(String(value || ""))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function guessCategory(title, description) {
  const text = `${title || ""} ${description || ""}`.toLowerCase();

  const rules = [
    ["Eletrônicos", ["celular", "smartphone", "fone", "televisão", "tv ", "câmera"]],
    ["Informática", ["notebook", "computador", "ssd", "teclado", "mouse", "monitor"]],
    ["Casa e Cozinha", ["cozinha", "panela", "taça", "copo", "pote", "talher"]],
    ["Ferramentas", ["furadeira", "parafusadeira", "soquete", "ferramenta", "chave"]],
    ["Beleza", ["serum", "sérum", "maquiagem", "shampoo", "perfume", "hidratante"]],
    ["Automotivo", ["automotivo", "carro", "moto", "pneu", "capacete"]],
    ["Esporte e Fitness", ["academia", "fitness", "halter", "bicicleta", "esporte"]],
    ["Artesanato", ["crochê", "barbante", "linha", "agulha", "artesanato"]],
    ["Pet Shop", ["pet", "cachorro", "gato", "ração"]],
    ["Brinquedos", ["brinquedo", "boneca", "carrinho infantil", "lego"]]
  ];

  for (const [category, words] of rules) {
    if (words.some(word => text.includes(word))) return category;
  }

  return "Outros";
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
