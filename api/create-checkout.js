import {
  normalizePostalCode,
  getOwnProducts,
  calculateShipping,
  supabaseHeaders
} from "./shipping-utils.js";

const PICKUP_SERVICE_ID = 999999;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    requireEnvironment();

    const requestedItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const serviceId = Number(req.body?.shipping?.service_id);
    const pickup = serviceId === PICKUP_SERVICE_ID;
    const postalCode = pickup
      ? ""
      : normalizePostalCode(req.body?.shipping?.postal_code);
    const customer = normalizeCustomer(req.body?.customer, pickup, postalCode);

    if (!requestedItems.length || requestedItems.length > 30) {
      return res.status(400).json({ error: "Carrinho inválido." });
    }

    if (!Number.isFinite(serviceId)) {
      return res.status(400).json({ error: "Escolha entrega ou retirada." });
    }

    if (!pickup && postalCode.length !== 8) {
      return res.status(400).json({ error: "CEP de entrega inválido." });
    }

    const products = await getOwnProducts(requestedItems);
    const orderItems = validateAndSnapshotItems(requestedItems, products);

    let selectedShipping;

    if (pickup) {
      selectedShipping = {
        service_id: PICKUP_SERVICE_ID,
        name: "Retirada no local",
        company: "Oferta Certa",
        price: 0,
        delivery_time: 0
      };
    } else {
      const shippingOptions = await calculateShipping({
        postalCode,
        requestedItems,
        products
      });

      selectedShipping = shippingOptions.find(
        option => Number(option.service_id) === serviceId
      );

      if (!selectedShipping) {
        return res.status(400).json({
          error: "A opção de frete expirou. Calcule novamente."
        });
      }
    }

    const productsTotal = roundMoney(orderItems.reduce(
      (total, item) => total + item.unit_price * item.quantity,
      0
    ));
    const shippingTotal = roundMoney(Number(selectedShipping.price || 0));
    const total = roundMoney(productsTotal + shippingTotal);

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
          shipping_service_id: selectedShipping.service_id,
          shipping_service_name: `${selectedShipping.company} — ${selectedShipping.name}`,
          shipping_postal_code: pickup ? null : postalCode,
          shipping_delivery_time: selectedShipping.delivery_time,
          items: orderItems,
          customer,
          customer_email: customer.email,
          payer_email: customer.email
        })
      }
    );

    const orderText = await orderResponse.text();
    const orderRows = safeJson(orderText, []);

    if (!orderResponse.ok || !orderRows?.[0]?.id) {
      console.error("Erro Supabase create-checkout:", orderText);
      throw new Error("Não foi possível criar o pedido.");
    }

    return res.status(200).json({
      order_id: orderRows[0].id,
      total,
      products_total: productsTotal,
      shipping_total: shippingTotal,
      public_key: process.env.MP_PUBLIC_KEY,
      pickup,
      shipping_service_name: `${selectedShipping.company} — ${selectedShipping.name}`
    });
  } catch (error) {
    console.error("create-checkout:", error);
    return res.status(400).json({
      error: error.message || "Erro ao preparar pagamento."
    });
  }
}

function requireEnvironment() {
  if (!process.env.MP_PUBLIC_KEY) {
    throw new Error("MP_PUBLIC_KEY não configurada na Vercel.");
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Credenciais seguras do Supabase não configuradas.");
  }
}

function validateAndSnapshotItems(requestedItems, products) {
  return requestedItems.map(requested => {
    const product = products.find(
      item => String(item.id) === String(requested.id)
    );
    const quantity = Math.max(1, Math.min(99, Number(requested.quantity || 1)));

    if (!product || !product.active || product.product_type !== "own") {
      throw new Error("Um produto do carrinho não está disponível.");
    }

    if (quantity > Number(product.stock || 0)) {
      throw new Error(`Estoque insuficiente para ${product.title}.`);
    }

    const unitPrice = Number(product.price);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new Error(`Preço inválido para ${product.title}.`);
    }

    return {
      id: String(product.id),
      title: String(product.title || "Produto").slice(0, 160),
      description: String(product.description || "").slice(0, 500),
      image_url: product.image_url || null,
      unit_price: roundMoney(unitPrice),
      quantity,
      color: cleanText(requested.color, 80) || null,
      size: cleanText(requested.size, 80) || null
    };
  });
}

function normalizeCustomer(input, pickup, quotedPostalCode) {
  const customer = {
    name: cleanText(input?.name, 120),
    email: cleanText(input?.email, 160).toLowerCase(),
    phone: digits(input?.phone).slice(0, 11),
    cpf: digits(input?.cpf).slice(0, 11),
    address: null
  };

  if (customer.name.length < 3) throw new Error("Informe o nome completo.");
  if (!/^\S+@\S+\.\S+$/.test(customer.email)) throw new Error("Informe um e-mail válido.");
  if (![10, 11].includes(customer.phone.length)) throw new Error("Informe um celular com DDD.");
  if (!isValidCpf(customer.cpf)) throw new Error("Informe um CPF válido.");

  if (!pickup) {
    const address = {
      postal_code: normalizePostalCode(input?.address?.postal_code),
      street: cleanText(input?.address?.street, 180),
      number: cleanText(input?.address?.number, 20),
      complement: cleanText(input?.address?.complement, 80) || null,
      neighborhood: cleanText(input?.address?.neighborhood, 100),
      city: cleanText(input?.address?.city, 100),
      state: cleanText(input?.address?.state, 2).toUpperCase()
    };

    if (address.postal_code !== quotedPostalCode) {
      throw new Error("O CEP do endereço precisa ser o mesmo usado no frete.");
    }

    if (!address.street || !address.number || !address.neighborhood || !address.city) {
      throw new Error("Preencha o endereço completo para entrega.");
    }

    if (!/^[A-Z]{2}$/.test(address.state)) {
      throw new Error("Informe o estado com duas letras, por exemplo SP.");
    }

    customer.address = address;
  }

  return customer;
}

function isValidCpf(value) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
}

function cleanText(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}
function digits(value) { return String(value || "").replace(/\D/g, ""); }
function roundMoney(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
function safeJson(text, fallback) { try { return text ? JSON.parse(text) : fallback; } catch { return fallback; } }

