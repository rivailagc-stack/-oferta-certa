import { supabaseHeaders } from "./shipping-utils.js";

const MP_API = "https://api.mercadopago.com";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) throw new Error("Access Token do Mercado Pago não configurado.");
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Credenciais seguras do Supabase não configuradas.");
    }

    const orderId = String(req.body?.order_id || "").trim();
    const idempotencyKey = normalizeIdempotencyKey(req.body?.idempotency_key);
    const formData = req.body?.payment;

    if (!isUuid(orderId)) throw new Error("Pedido inválido.");
    if (!idempotencyKey) throw new Error("Identificação segura do pagamento ausente.");
    if (!formData || typeof formData !== "object") throw new Error("Dados de pagamento inválidos.");

    const order = await getOrder(orderId);
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.status === "approved") {
      return res.status(200).json({
        payment_id: order.payment_id,
        status: "approved",
        status_detail: "accredited",
        status_message: "Pagamento já aprovado."
      });
    }

    const customer = order.customer || {};
    const paymentMethodId = cleanText(formData.payment_method_id, 80);
    if (!paymentMethodId) throw new Error("Escolha uma forma de pagamento.");

    const installments = finitePositiveInteger(formData.installments);
    const payload = removeUndefined({
      transaction_amount: roundMoney(order.total),
      token: cleanText(formData.token, 300) || undefined,
      description: `Pedido Oferta Certa ${shortOrderId(order.id)}`,
      installments: installments || undefined,
      payment_method_id: paymentMethodId,
      issuer_id: formData.issuer_id ? String(formData.issuer_id) : undefined,
      payer: {
        email: customer.email || order.customer_email || formData.payer?.email,
        identification: {
          type: "CPF",
          number: digits(customer.cpf || formData.payer?.identification?.number).slice(0, 11)
        }
      },
      external_reference: String(order.id),
      notification_url: `${getSiteUrl(req)}/api/mercadopago-webhook`,
      statement_descriptor: "OFERTA CERTA",
      metadata: {
        order_id: String(order.id),
        shipping_service_id: order.shipping_service_id,
        pickup: Number(order.shipping_service_id) === 999999
      }
    });

    if (paymentMethodId === "pix") {
      delete payload.token;
      delete payload.installments;
      delete payload.issuer_id;
    } else if (!payload.token) {
      throw new Error("Os dados seguros do cartão não foram gerados. Tente novamente.");
    }

    const paymentResponse = await fetch(`${MP_API}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    const paymentText = await paymentResponse.text();
    const payment = safeJson(paymentText, {});

    if (!paymentResponse.ok) {
      console.error("Mercado Pago /v1/payments:", paymentText);
      throw new Error(getMercadoPagoError(payment));
    }

    await updateOrder(order.id, payment, customer.email);

    const transactionData = payment.point_of_interaction?.transaction_data || {};

    return res.status(200).json({
      payment_id: String(payment.id),
      status: payment.status,
      status_detail: payment.status_detail,
      status_message: translateStatus(payment.status, payment.status_detail),
      payment_method_id: payment.payment_method_id,
      payment_type_id: payment.payment_type_id,
      pix: payment.payment_method_id === "pix" ? {
        qr_code: transactionData.qr_code || null,
        qr_code_base64: transactionData.qr_code_base64 || null,
        ticket_url: transactionData.ticket_url || null,
        expiration_date: payment.date_of_expiration || null
      } : null
    });
  } catch (error) {
    console.error("process-payment:", error);
    return res.status(400).json({
      error: error.message || "Erro ao processar pagamento."
    });
  }
}

async function getOrder(orderId) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/orders?select=*&id=eq.${encodeURIComponent(orderId)}&limit=1`,
    { headers: supabaseHeaders() }
  );
  if (!response.ok) throw new Error("Não foi possível consultar o pedido.");
  const rows = await response.json();
  return rows?.[0] || null;
}

async function updateOrder(orderId, payment, email) {
  if (payment.status === "approved") {
    const rpcResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/confirm_paid_order`,
      {
        method: "POST",
        headers: supabaseHeaders(),
        body: JSON.stringify({
          p_order_id: orderId,
          p_payment_id: payment.id ? String(payment.id) : null,
          p_payer_email: payment.payer?.email || email || null,
          p_payment_method: payment.payment_method_id || null,
          p_status_detail: payment.status_detail || null
        })
      }
    );

    if (!rpcResponse.ok) {
      console.error("Pagamento aprovado, mas estoque/pedido não atualizados:", await rpcResponse.text());
    }
    return;
  }

  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      headers: { ...supabaseHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        status: payment.status || "pending",
        payment_id: payment.id ? String(payment.id) : null,
        payer_email: payment.payer?.email || email || null,
        customer_email: email || null,
        payment_method: payment.payment_method_id || null,
        payment_status_detail: payment.status_detail || null,
        updated_at: new Date().toISOString()
      })
    }
  );

  if (!response.ok) {
    console.error("Pagamento criado, mas pedido não atualizado:", await response.text());
  }
}

function getSiteUrl(req) {
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const candidate = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || forwardedHost || req.headers.host || "oferta-certa.vercel.app";
  let value = String(candidate).trim().replace(/^['\"]|['\"]$/g, "");
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  return new URL(value).origin;
}

function getMercadoPagoError(data) {
  const causes = Array.isArray(data?.cause)
    ? data.cause.map(item => item?.description || item?.code).filter(Boolean).join(" | ")
    : "";
  return causes || data?.message || data?.error_description || data?.error || "Mercado Pago recusou o pagamento.";
}

function translateStatus(status, detail) {
  if (status === "approved") return "Pagamento aprovado.";
  if (status === "pending") return "Pagamento pendente.";
  if (status === "in_process") return "Pagamento em análise.";
  if (status === "authorized") return "Pagamento autorizado.";
  if (status === "rejected") {
    const messages = {
      cc_rejected_bad_filled_card_number: "Confira o número do cartão.",
      cc_rejected_bad_filled_date: "Confira a validade do cartão.",
      cc_rejected_bad_filled_security_code: "Confira o código de segurança.",
      cc_rejected_insufficient_amount: "Limite insuficiente.",
      cc_rejected_call_for_authorize: "Autorize o pagamento com o banco do cartão.",
      cc_rejected_card_disabled: "O cartão está desabilitado.",
      cc_rejected_high_risk: "O pagamento não foi aprovado por segurança.",
      cc_rejected_other_reason: "O cartão não aprovou o pagamento. Tente outro meio."
    };
    return messages[detail] || "Pagamento não aprovado. Tente outro meio.";
  }
  return "Pagamento recebido para processamento.";
}

function removeUndefined(value) {
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined && item !== null && item !== "")
        .map(([key, item]) => [key, removeUndefined(item)])
    );
  }
  return value;
}

function normalizeIdempotencyKey(value) {
  const key = String(value || "").trim();
  return /^[a-zA-Z0-9-]{16,100}$/.test(key) ? key : "";
}
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function cleanText(value, max) { return String(value || "").trim().slice(0, max); }
function digits(value) { return String(value || "").replace(/\D/g, ""); }
function roundMoney(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
function safeJson(text, fallback) { try { return text ? JSON.parse(text) : fallback; } catch { return fallback; } }
function shortOrderId(value) { return String(value || "").split("-")[0].toUpperCase(); }
function finitePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
