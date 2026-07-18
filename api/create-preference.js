import {
  normalizePostalCode,
  getOwnProducts,
  calculateShipping,
  supabaseHeaders
} from "./shipping-utils.js";

const MP_API = "https://api.mercadopago.com";

function getSiteUrl(req) {
  const forwardedHost = String(
    req.headers["x-forwarded-host"] || ""
  )
    .split(",")[0]
    .trim();

  const candidate =
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    forwardedHost ||
    req.headers.host ||
    "oferta-certa.vercel.app";

  let normalized = String(candidate || "")
    .trim()
    .replace(/^["']|["']$/g, "");

  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  const parsedUrl = new URL(normalized);

  if (parsedUrl.protocol !== "https:") {
    throw new Error("A URL da loja precisa começar com https://");
  }

  return parsedUrl.origin;
}

function getMercadoPagoError(data) {
  const causes = Array.isArray(data?.cause)
    ? data.cause
        .map(item => item?.description || item?.code)
        .filter(Boolean)
        .join(" | ")
    : "";

  return (
    causes ||
    data?.message ||
    data?.error_description ||
    data?.error ||
    "Mercado Pago recusou o checkout."
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido."
    });
  }

  try {
    const accessToken =
      process.env.MP_ACCESS_TOKEN ||
      process.env.MERCADOPAGO_ACCESS_TOKEN;

    const siteUrl = getSiteUrl(req);

    if (
      !accessToken ||
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res.status(500).json({
        error: "Credenciais do pagamento não configuradas."
      });
    }

    const requestedItems = Array.isArray(req.body?.items)
      ? req.body.items
      : [];

    const postalCode = normalizePostalCode(
      req.body?.shipping?.postal_code
    );

    const serviceId = Number(
      req.body?.shipping?.service_id
    );

    if (
      !requestedItems.length ||
      requestedItems.length > 30
    ) {
      return res.status(400).json({
        error: "Carrinho inválido."
      });
    }

    if (
      postalCode.length !== 8 ||
      !Number.isFinite(serviceId)
    ) {
      return res.status(400).json({
        error: "Calcule e escolha o frete novamente."
      });
    }

    const products = await getOwnProducts(
      requestedItems
    );

    const shippingOptions = await calculateShipping({
      postalCode,
      requestedItems,
      products
    });

    const selectedShipping = shippingOptions.find(
      option =>
        Number(option.service_id) === serviceId
    );

    if (!selectedShipping) {
      return res.status(400).json({
        error:
          "A opção de frete expirou. Calcule novamente."
      });
    }

    const items = requestedItems.map(requested => {
      const product = products.find(
        item =>
          String(item.id) === String(requested.id)
      );

      const quantity = Math.max(
        1,
        Math.min(
          99,
          Number(requested.quantity || 1)
        )
      );

      return {
        id: String(product.id),
        title: String(product.title).slice(0, 120),
        description: String(
          product.description || product.title
        ).slice(0, 256),
        picture_url: product.image_url || undefined,
        currency_id: "BRL",
        quantity,
        unit_price: Number(product.price)
      };
    });

    const productsTotal = items.reduce(
      (sum, item) =>
        sum + item.unit_price * item.quantity,
      0
    );

    const shippingTotal = Number(
      selectedShipping.price
    );

    if (
      !Number.isFinite(shippingTotal) ||
      shippingTotal < 0
    ) {
      throw new Error("Valor do frete inválido.");
    }

    const total = productsTotal + shippingTotal;

    const orderResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/orders`,
      {
        method: "POST",
        headers: {
          ...supabaseHeaders(),
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          status: "pending",
          total,
          shipping_total: shippingTotal,
          shipping_service_id:
            selectedShipping.service_id,
          shipping_service_name:
            `${selectedShipping.company} — ${selectedShipping.name}`,
          shipping_postal_code: postalCode,
          shipping_delivery_time:
            selectedShipping.delivery_time,
          items: requestedItems,
          customer_email: null
        })
      }
    );

    if (!orderResponse.ok) {
      const detail = await orderResponse.text();

      console.error(
        "Erro ao criar pedido no Supabase:",
        detail
      );

      throw new Error(
        "Não foi possível criar o pedido."
      );
    }

    const orderRows = await orderResponse.json();
    const order = orderRows[0];

    if (!order?.id) {
      throw new Error(
        "O pedido foi criado sem identificação."
      );
    }

    /*
     * Usamos a página inicial com parâmetros.
     * Assim não dependemos da existência de arquivos
     * pagamento-sucesso.html, pagamento-pendente.html etc.
     */
    const backUrls = {
      success: `${siteUrl}/?payment=success`,
      pending: `${siteUrl}/?payment=pending`,
      failure: `${siteUrl}/?payment=failure`
    };

    const preferencePayload = {
      items,

      shipments: {
        cost: shippingTotal,
        mode: "not_specified"
      },

      external_reference: String(order.id),

      back_urls: backUrls,

      auto_return: "approved",

      notification_url:
        `${siteUrl}/api/mercadopago-webhook`,

      statement_descriptor: "OFERTA CERTA",

      metadata: {
        order_id: String(order.id),
        shipping_service_id:
          selectedShipping.service_id,
        shipping_postal_code: postalCode
      }
    };

    console.log(
      "SITE URL:",
      siteUrl
    );

    console.log(
      "BACK URLS:",
      JSON.stringify(backUrls, null, 2)
    );

    const preferenceResponse = await fetch(
      `${MP_API}/checkout/preferences`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Idempotency-Key": String(order.id)
        },
        body: JSON.stringify(preferencePayload)
      }
    );

    const preferenceText =
      await preferenceResponse.text();

    let preference;

    try {
      preference = preferenceText
        ? JSON.parse(preferenceText)
        : {};
    } catch {
      console.error(
        "Resposta inválida do Mercado Pago:",
        preferenceText
      );

      throw new Error(
        "O Mercado Pago devolveu uma resposta inválida."
      );
    }

    console.log(
      "RESPOSTA MERCADO PAGO:",
      JSON.stringify(preference, null, 2)
    );

    if (!preferenceResponse.ok) {
      throw new Error(
        getMercadoPagoError(preference)
      );
    }

    if (!preference.id || !preference.init_point) {
      throw new Error(
        "O Mercado Pago não devolveu o link de pagamento."
      );
    }

    const updateOrderResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`,
      {
        method: "PATCH",
        headers: {
          ...supabaseHeaders(),
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          preference_id: preference.id
        })
      }
    );

    if (!updateOrderResponse.ok) {
      console.error(
        "Pagamento criado, mas o pedido não foi atualizado:",
        await updateOrderResponse.text()
      );
    }

    return res.status(200).json({
      order_id: order.id,
      preference_id: preference.id,
      init_point: preference.init_point
    });
  } catch (error) {
    console.error(error);

    return res.status(400).json({
      error:
        error.message ||
        "Erro ao criar pagamento."
    });
  }
}
