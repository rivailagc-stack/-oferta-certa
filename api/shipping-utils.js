export async function calculateShipping({ postalCode, requestedItems, products }) {

  const destination = normalizePostalCode(postalCode);

  if (destination.length !== 8) {
    throw new Error("CEP de destino inválido.");
  }

  validateCartItems(requestedItems, products);

  const mode = String(process.env.SHIPPING_MODE || "free").toLowerCase();

  if (mode === "free") {
    return [{
      service_id: 1,
      name: "Frete grátis",
      company: "Oferta Certa",
      price: 0,
      delivery_time: Number(process.env.DEFAULT_DELIVERY_DAYS || 7),
      postal_code: destination
    }];
  }

  if (mode === "fixed") {
    return [{
      service_id: 2,
      name: "Entrega padrão",
      company: "Oferta Certa",
      price: Number(process.env.DEFAULT_SHIPPING_PRICE || 0),
      delivery_time: Number(process.env.DEFAULT_DELIVERY_DAYS || 7),
      postal_code: destination
    }];
  }

  if (mode !== "melhor_envio") {
    throw new Error("SHIPPING_MODE inválido.");
  }

  const origin = normalizePostalCode(process.env.SHIPPING_ORIGIN_ZIP);

  if (origin.length !== 8) {
    throw new Error("CEP de origem não configurado.");
  }

  const token = await getValidAccessToken();

  const response = await fetch(
    "https://api.melhorenvio.com/api/v2/me/shipment/calculate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent":
          process.env.MELHOR_ENVIO_USER_AGENT ||
          "Oferta Certa (contato@ofertacerta.com.br)"
      },
      body: JSON.stringify({
        from: {
          postal_code: origin
        },
        to: {
          postal_code: destination
        },
        products: buildShippingProducts(requestedItems, products),
        options: {
          receipt: false,
          own_hand: false
        }
      })
    }
  );

  const data = await response.json();

  console.log("=== MELHOR ENVIO ===");
  console.log(JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(
      data.message ||
      data.error ||
      "Erro ao calcular frete."
    );
  }

  return (Array.isArray(data) ? data : [])
    .filter(item => !item.error)
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
