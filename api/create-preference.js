const MP_API = "https://api.mercadopago.com";
const SUPABASE_HEADERS = () => ({
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json"
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    const supabaseUrl = process.env.SUPABASE_URL;
    const siteUrl = (process.env.SITE_URL || "https://oferta-certa.vercel.app").replace(/\/$/, "");

    if (!accessToken || !supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Credenciais do pagamento ainda não configuradas." });
    }

    const requestedItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!requestedItems.length || requestedItems.length > 30) {
      return res.status(400).json({ error: "Carrinho inválido." });
    }

    const ids = [...new Set(requestedItems.map(item => String(item.id)))];
    const query = encodeURIComponent(`(${ids.join(",")})`);

    const productResponse = await fetch(
      `${supabaseUrl}/rest/v1/products?select=id,title,description,price,image_url,stock,shipping_price,product_type,active&id=in.${query}`,
      { headers: SUPABASE_HEADERS() }
    );

    if (!productResponse.ok) throw new Error("Não foi possível validar os produtos.");
    const products = await productResponse.json();

    const items = requestedItems.map(requested => {
      const product = products.find(p => String(p.id) === String(requested.id));
      const quantity = Math.max(1, Math.min(99, Number(requested.quantity || 1)));

      if (!product || !product.active || product.product_type !== "own") {
        throw new Error("Um produto do carrinho não está disponível.");
      }
      if (quantity > Number(product.stock || 0)) {
        throw new Error(`Estoque insuficiente para ${product.title}.`);
      }

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

    const shipping = requestedItems.reduce((sum, requested) => {
      const product = products.find(p => String(p.id) === String(requested.id));
      return sum + Number(product?.shipping_price || 0);
    }, 0);

    const total = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0) + shipping;

    const orderResponse = await fetch(`${supabaseUrl}/rest/v1/orders`, {
      method: "POST",
      headers: { ...SUPABASE_HEADERS(), Prefer: "return=representation" },
      body: JSON.stringify({
        status: "pending",
        total,
        shipping_total: shipping,
        items: requestedItems,
        customer_email: null
      })
    });

    if (!orderResponse.ok) throw new Error("Não foi possível criar o pedido.");
    const [order] = await orderResponse.json();

    const preferenceBody = {
      items,
      shipments: shipping > 0 ? { cost: shipping, mode: "not_specified" } : undefined,
      external_reference: String(order.id),
      back_urls: {
        success: `${siteUrl}/pagamento-sucesso.html`,
        pending: `${siteUrl}/pagamento-pendente.html`,
        failure: `${siteUrl}/pagamento-falhou.html`
      },
      auto_return: "approved",
      notification_url: `${siteUrl}/api/mercadopago-webhook`,
      statement_descriptor: "OFERTA CERTA",
      metadata: { order_id: String(order.id) }
    };

    const preferenceResponse = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": String(order.id)
      },
      body: JSON.stringify(preferenceBody)
    });

    const preference = await preferenceResponse.json();
    if (!preferenceResponse.ok) {
      throw new Error(preference.message || "Mercado Pago recusou a criação do checkout.");
    }

    await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${order.id}`, {
      method: "PATCH",
      headers: SUPABASE_HEADERS(),
      body: JSON.stringify({ preference_id: preference.id })
    });

    return res.status(200).json({
      order_id: order.id,
      preference_id: preference.id,
      init_point: preference.init_point
    });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: error.message || "Erro ao criar pagamento." });
  }
}
