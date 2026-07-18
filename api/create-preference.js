import {
  normalizePostalCode,
  getOwnProducts,
  calculateShipping,
  supabaseHeaders
} from "./shipping-utils.js";

const MP_API = "https://api.mercadopago.com";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;
    const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "";
    const siteUrl = (
      process.env.SITE_URL ||
      vercelUrl ||
      "https://oferta-certa.vercel.app"
    ).replace(/\/$/, "");

    if (!accessToken || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Credenciais do pagamento não configuradas." });
    }

    const requestedItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const postalCode = normalizePostalCode(req.body?.shipping?.postal_code);
    const serviceId = Number(req.body?.shipping?.service_id);

    if (!requestedItems.length || requestedItems.length > 30) {
      return res.status(400).json({ error: "Carrinho inválido." });
    }
    if (postalCode.length !== 8 || !Number.isFinite(serviceId)) {
      return res.status(400).json({ error: "Calcule e escolha o frete novamente." });
    }

    const products = await getOwnProducts(requestedItems);
    const shippingOptions = await calculateShipping({
      postalCode,
      requestedItems,
      products
    });

    const selectedShipping = shippingOptions.find(
      option => Number(option.service_id) === serviceId
    );

    if (!selectedShipping) {
      return res.status(400).json({ error: "A opção de frete expirou. Calcule novamente." });
    }

    const items = requestedItems.map(requested => {
      const product = products.find(p => String(p.id) === String(requested.id));
      const quantity = Math.max(1, Math.min(99, Number(requested.quantity || 1)));

      return {
        id: String(product.id),
        title: String(product.title).slice(0, 120),
        description: String(product.description || "").slice(0, 256),
        picture_url: product.image_url || undefined,
        currency_id: "BRL",
        quantity,
        unit_price: Number(product.price)
      };
    });

    const productsTotal = items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0
    );
    const shippingTotal = Number(selectedShipping.price);
    const total = productsTotal + shippingTotal;

    const orderResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders`, {
      method: "POST",
      headers: { ...supabaseHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({
        status: "pending",
        total,
        shipping_total: shippingTotal,
        shipping_service_id: selectedShipping.service_id,
        shipping_service_name: `${selectedShipping.company} — ${selectedShipping.name}`,
        shipping_postal_code: postalCode,
        shipping_delivery_time: selectedShipping.delivery_time,
        items: requestedItems,
        customer_email: null
      })
    });

    if (!orderResponse.ok) {
      throw new Error("Não foi possível criar o pedido.");
    }

    const [order] = await orderResponse.json();

    const preferenceResponse = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": String(order.id)
      },
      body: JSON.stringify({
        items,
        shipments: {
          cost: shippingTotal,
          mode: "not_specified"
        },
        external_reference: String(order.id),
        back_urls: {
          success: `${siteUrl}/pagamento-sucesso.html`,
          pending: `${siteUrl}/pagamento-pendente.html`,
          failure: `${siteUrl}/pagamento-falhou.html`
        },
        auto_return: "approved",
        notification_url: `${siteUrl}/api/mercadopago-webhook`,
        statement_descriptor: "OFERTA CERTA",
        metadata: {
          order_id: String(order.id),
          shipping_service_id: selectedShipping.service_id
        }
      })
    });

    const preference = await preferenceResponse.json();

    if (!preferenceResponse.ok) {
      throw new Error(preference.message || "Mercado Pago recusou o checkout.");
    }

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`, {
      method: "PATCH",
      headers: supabaseHeaders(),
      body: JSON.stringify({ preference_id: preference.id })
    });

    return res.status(200).json({
      order_id: order.id,
      preference_id: preference.id,
      init_point: preference.init_point
    });
  } catch (error) {
    console.error(error);
    return res.status(400).json({
      error: error.message || "Erro ao criar pagamento."
    });
  }
}
