import { getValidAccessToken } from "./melhor-envio-oauth-utils.js";

export function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !key) {
    throw new Error("Supabase não configurado no servidor.");
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
}

export function normalizePostalCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
}

export async function getOwnProducts(items) {
  const ids = [...new Set(items.map(item => String(item.id || "")).filter(Boolean))];
  if (!ids.length) throw new Error("Carrinho inválido.");

  const query = encodeURIComponent(`(${ids.join(",")})`);
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/products?select=id,title,description,price,image_url,stock,product_type,active,package_weight,package_length,package_width,package_height&id=in.${query}`,
    { headers: supabaseHeaders() }
  );

  if (!response.ok) throw new Error("Não foi possível validar os produtos.");
  const products = await response.json();
  validateCartItems(items, products);
  return products;
}

export function validateCartItems(requestedItems, products) {
  for (const requested of requestedItems) {
    const product = products.find(p => String(p.id) === String(requested.id));
    const quantity = Math.max(1, Math.min(99, Number(requested.quantity || 1)));

    if (!product || !product.active || product.product_type !== "own") {
      throw new Error("Um produto do carrinho não está disponível.");
    }

    const price = Number(product.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Preço inválido para ${product.title}.`);
    }

    if (quantity > Number(product.stock || 0)) {
      throw new Error(`Estoque insuficiente para ${product.title}.`);
    }
  }
}

export function buildShippingProducts(requestedItems, products) {
  validateCartItems(requestedItems, products);

  return requestedItems.map(requested => {
    const product = products.find(p => String(p.id) === String(requested.id));
    const quantity = Math.max(1, Math.min(99, Number(requested.quantity || 1)));
    const width = Number(product.package_width);
    const height = Number(product.package_height);
    const length = Number(product.package_length);
    const weight = Number(product.package_weight);

    if (![width, height, length, weight].every(value => Number.isFinite(value) && value > 0)) {
      throw new Error(`Complete peso e dimensões do produto ${product.title}.`);
    }

    return {
      id: String(product.id), width, height, length, weight,
      insurance_value: Number(product.price), quantity
    };
  });
}

export async function calculateShipping({ postalCode, requestedItems, products }) {
  const destination = normalizePostalCode(postalCode);
  if (destination.length !== 8) throw new Error("CEP de destino inválido.");

  validateCartItems(requestedItems, products);
  const mode = String(process.env.SHIPPING_MODE || "free").toLowerCase();

  if (mode === "free") {
    return [{
      service_id: 1, name: "Frete grátis", company: "Oferta Certa", price: 0,
      delivery_time: Number(process.env.DEFAULT_DELIVERY_DAYS || 7), postal_code: destination
    }];
  }

  if (mode === "fixed") {
    const price = Number(process.env.DEFAULT_SHIPPING_PRICE || 0);
    if (!Number.isFinite(price) || price < 0) throw new Error("Valor do frete fixo inválido.");
    return [{
      service_id: 2, name: "Entrega padrão", company: "Oferta Certa", price,
      delivery_time: Number(process.env.DEFAULT_DELIVERY_DAYS || 7), postal_code: destination
    }];
  }

  if (mode !== "melhor_envio") throw new Error("SHIPPING_MODE inválido.");

  const origin = normalizePostalCode(process.env.SHIPPING_ORIGIN_ZIP);
  if (origin.length !== 8) throw new Error("CEP de origem não configurado na Vercel.");
  const token = await getValidAccessToken();

  const baseUrl = (process.env.MELHOR_ENVIO_API_URL || "https://www.melhorenvio.com.br").replace(/\/$/, "");
  const userAgent = process.env.MELHOR_ENVIO_USER_AGENT || "Oferta Certa (contato@ofertacerta.com.br)";
  const response = await fetch(`${baseUrl}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json", "User-Agent": userAgent },
    body: JSON.stringify({
      from: { postal_code: origin }, to: { postal_code: destination },
      products: buildShippingProducts(requestedItems, products),
      options: { receipt: false, own_hand: false }
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "O Melhor Envio não conseguiu calcular o frete.");

  return (Array.isArray(data) ? data : [])
    .filter(item => !item.error && (item.custom_price || item.price))
    .map(item => ({
      service_id: Number(item.id), name: item.name || "Entrega",
      company: item.company?.name || "Transportadora",
      price: Number(item.custom_price || item.price),
      delivery_time: Number(item.custom_delivery_time || item.delivery_time || 0),
      postal_code: destination
    }))
    .sort((a, b) => a.price - b.price);
}
