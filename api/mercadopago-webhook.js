import { WebhookSignatureValidator, InvalidWebhookSignatureError } from "mercadopago";
import { supabaseHeaders } from "./shipping-utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).end();

  try {
    const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) throw new Error("Access Token do Mercado Pago não configurado.");

    const dataId = req.query["data.id"] || req.body?.data?.id || req.query.data_id;
    if (!dataId) return res.status(200).end();

    const webhookSecret = process.env.MP_WEBHOOK_SECRET;
    if (webhookSecret) {
      WebhookSignatureValidator.validate({
        xSignature: req.headers["x-signature"],
        xRequestId: req.headers["x-request-id"],
        dataId: String(dataId),
        secret: webhookSecret
      });
    }

    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!paymentResponse.ok) throw new Error("Não foi possível consultar o pagamento.");
    const payment = await paymentResponse.json();

    const orderId = payment.external_reference || payment.metadata?.order_id;
    if (orderId) {
      const rpcResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/finalize_order_payment`, {
        method: "POST",
        headers: supabaseHeaders(),
        body: JSON.stringify({
          p_order_id: String(orderId),
          p_status: String(payment.status || "pending"),
          p_payment_id: String(payment.id),
          p_payer_email: payment.payer?.email || null
        })
      });
      if (!rpcResponse.ok) {
        const detail = await rpcResponse.text();
        throw new Error(`Falha ao atualizar pedido: ${detail}`);
      }
    }

    return res.status(200).end();
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) return res.status(401).end();
    console.error(error);
    return res.status(500).end();
  }
}
