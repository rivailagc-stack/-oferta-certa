import crypto from "node:crypto";
import { supabaseHeaders } from "./shipping-utils.js";

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));

  return left.length === right.length &&
    crypto.timingSafeEqual(left, right);
}

function validateSignature(rawBody, receivedSignature) {
  const secret = process.env.MELHOR_ENVIO_CLIENT_SECRET;

  if (!secret) {
    throw new Error("MELHOR_ENVIO_CLIENT_SECRET não configurado.");
  }

  const hex = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const base64 = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  if (
    !safeEqual(receivedSignature, hex) &&
    !safeEqual(receivedSignature, base64)
  ) {
    throw new Error("Assinatura do webhook inválida.");
  }
}

async function saveEvent(payload) {
  const data = payload?.data || {};
  const event = String(payload?.event || "");

  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/shipping_events`,
    {
      method: "POST",
      headers: {
        ...supabaseHeaders(),
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        provider: "melhor_envio",
        event,
        external_id: data.id || null,
        protocol: data.protocol || null,
        status: data.status || null,
        tracking: data.tracking || null,
        tracking_url: data.tracking_url || null,
        payload
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Não foi possível salvar o evento: ${await response.text()}`);
  }

  if (data.id || data.protocol) {
    const filters = [];

    if (data.id) {
      filters.push(`melhor_envio_order_id=eq.${encodeURIComponent(data.id)}`);
    }

    if (data.protocol) {
      filters.push(`shipping_protocol=eq.${encodeURIComponent(data.protocol)}`);
    }

    const query = filters.length > 1
      ? `or=(${filters.join(",")})`
      : filters[0];

    const updateResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/orders?${query}`,
      {
        method: "PATCH",
        headers: {
          ...supabaseHeaders(),
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          shipping_status: data.status || event.replace("order.", ""),
          tracking_code: data.tracking || null,
          tracking_url: data.tracking_url || null,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!updateResponse.ok) {
      console.error(
        "Evento salvo, mas pedido não foi atualizado:",
        await updateResponse.text()
      );
    }
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }

    const rawBody = Buffer.concat(chunks);
    const signature = req.headers["x-me-signature"];

    validateSignature(rawBody, signature);

    const payload = JSON.parse(rawBody.toString("utf-8"));
    await saveEvent(payload);

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(error);
    return res.status(401).json({
      error: error.message || "Webhook inválido."
    });
  }
}
