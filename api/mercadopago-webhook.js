import {
  WebhookSignatureValidator,
  InvalidWebhookSignatureError
} from "mercadopago";

const headers = () => ({
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

    WebhookSignatureValidator.validate({
      xSignature: req.headers["x-signature"],
      xRequestId: req.headers["x-request-id"],
      dataId: String(dataId),
      secret: process.env.MP_WEBHOOK_SECRET
    });

    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`,
      { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
    );

    if (!paymentResponse.ok) throw new Error("Não foi possível consultar o pagamento.");
    const payment = await paymentResponse.json();

    const orderId =
      payment.external_reference ||
      payment.metadata?.order_id;

    if (orderId) {
      await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
        {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify({
            status: payment.status,
            payment_id: String(payment.id),
            payer_email: payment.payer?.email || null,
            updated_at: new Date().toISOString()
          })
        }
      );
    }

    return res.status(200).end();
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      return res.status(401).end();
    }
    console.error(error);
    return res.status(500).end();
  }
}
