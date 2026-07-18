export default async function handler(req, res) {

  // Permite o teste do webhook pelo Melhor Envio
  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      message: "Webhook Melhor Envio ativo."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido."
    });
  }

  try {

    const chunks = [];

    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }

    const rawBody = Buffer.concat(chunks);

    const signature = req.headers["x-me-signature"];

    // Valida somente quando o Melhor Envio enviar assinatura
    if (signature) {
      validateSignature(rawBody, signature);
    }

    const bodyText = rawBody.toString("utf8");

    const payload = bodyText
      ? JSON.parse(bodyText)
      : {};

    await saveEvent(payload);

    return res.status(200).json({
      received: true
    });

  } catch (error) {

    console.error(error);

    // Responde 200 para não bloquear o teste do Melhor Envio
    return res.status(200).json({
      received: false,
      message: error.message
    });

  }

}
