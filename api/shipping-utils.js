export function supabaseHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
}

export function normalizePostalCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
}

export async function getOwnProducts(items) {
  const ids = [...new Set(items.map(item => String(item.id)))];
  const query = encodeURIComponent(`(${ids.join(",")})`);

  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/products?select=id,title,description,price,image_url,stock,product_type,active,package_weight,package_length,package_width,package_height&id=in.${query}`,
    { headers: supabaseHeaders() }
  );

  if (!response.ok) throw new Error("Não foi possível validar os produtos.");
  return response.json();
}

export function buildShippingProducts(requestedItems, products) {
  return requestedItems.map(requested => {
    const product = products.find(p => String(p.id) === String(requested.id));
    const quantity = Math.max(1, Math.min(99, Number(requested.quantity || 1)));

    if (!product || !product.active || product.product_type !== "own") {
      throw new Error("Um produto do carrinho não está disponível.");
    }

    if (quantity > Number(product.stock || 0)) {
      throw new Error(`Estoque insuficiente para ${product.title}.`);
    }

    const width = Number(product.package_width);
    const height = Number(product.package_height);
    const length = Number(product.package_length);
    const weight = Number(product.package_weight);

    if (![width, height, length, weight].every(value => Number.isFinite(value) && value > 0)) {
      throw new Error(`Complete peso e dimensões do produto ${product.title}.`);
    }

    return {
      id: String(product.id),
      width,
      height,
      length,
      weight,
      insurance_value: Number(product.price),
      quantity
    };
  });
}

export async function calculateShipping({ postalCode, requestedItems, products }) {
  const origin = normalizePostalCode(process.env.SHIPPING_ORIGIN_ZIP);
  const destination = normalizePostalCode(postalCode);

  if (origin.length !== 8) throw new Error("CEP de origem não configurado na Vercel.");
  if (destination.length !== 8) throw new Error("CEP de destino inválido.");

  const token = process.env.MELHOR_ENVIO_TOKEN;
  if (!token) throw new Error("Token do Melhor Envio não configurado.");

  const baseUrl = (process.env.MELHOR_ENVIO_API_URL || "https://www.melhorenvio.com.br").replace(/\/$/, "");
  const userAgent = process.env.MELHOR_ENVIO_USER_AGENT || "Oferta Certa (contato@ofertacerta.com.br)";

  const response = await fetch(`${baseUrl}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": userAgent
    },
    body: JSON.stringify({
      from: { postal_code: origin },
      to: { postal_code: destination },
      products: buildShippingProducts(requestedItems, products),
      options: {
        receipt: false,
        own_hand: false
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "O Melhor Envio não conseguiu calcular o frete.");
  }

  return (Array.isArray(data) ? data : [])
    .filter(item => !item.error && (item.custom_price || item.price))
    .map(item => ({
      service_id: Number(item.id),
      name: item.name || "Entrega",
      company: item.company?.name || "Transportadora",
      price: Number(item.custom_price || item.price),
      delivery_time: Number(item.custom_delivery_time || item.delivery_time || 0),
      postal_code: destination
    }))
    .sort((a, b) => a.price - b.price);
}
