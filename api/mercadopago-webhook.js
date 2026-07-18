import {
  WebhookSignatureValidator,
  InvalidWebhookSignatureError
} from "mercadopago";

const supabaseHeaders = () => ({
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json"
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).end();

  try {
    const dataId =
      req.query["data.id"] ||
      req.body?.data?.id ||
      req.query.data_id;

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

    const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;
    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!paymentResponse.ok) throw new Error("Não foi possível consultar o pagamento.");
    const payment = await paymentResponse.json();

    const orderId = payment.external_reference || payment.metadata?.order_id;
    if (!orderId) return res.status(200).end();

    if (payment.status === "approved") {
      const rpcResponse = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/rpc/confirm_paid_order`,
        {
          method: "POST",
          headers: supabaseHeaders(),
          body: JSON.stringify({
            p_order_id: orderId,
            p_payment_id: String(payment.id),
            p_payer_email: payment.payer?.email || null,
            p_payment_method: payment.payment_method_id || null,
            p_status_detail: payment.status_detail || null
          })
        }
      );

      if (!rpcResponse.ok) {
        throw new Error(`Falha ao confirmar pedido: ${await rpcResponse.text()}`);
      }
    } else {
      const updateResponse = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
        {
          method: "PATCH",
          headers: { ...supabaseHeaders(), Prefer: "return=minimal" },
          body: JSON.stringify({
            status: payment.status,
            payment_id: String(payment.id),
            payer_email: payment.payer?.email || null,
            payment_method: payment.payment_method_id || null,
            payment_status_detail: payment.status_detail || null,
            updated_at: new Date().toISOString()
          })
        }
      );

      if (!updateResponse.ok) {
        throw new Error(`Falha ao atualizar pedido: ${await updateResponse.text()}`);
      }
    }

    return res.status(200).end();
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      return res.status(401).end();
    }
    console.error("mercadopago-webhook:", error);
    return res.status(500).end();
  }
}
