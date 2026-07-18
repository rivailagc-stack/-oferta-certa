import {
  exchangeAuthorizationCode,
  saveToken
} from "./melhor-envio-oauth-utils.js";

function readCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");

  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }

  return "";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Método não permitido.");
  }

  try {
    const code = String(req.query?.code || "");
    const state = String(req.query?.state || "");
    const expectedState = readCookie(req, "melhor_envio_oauth_state");

    if (!code) {
      return res.status(400).send("Código de autorização não recebido.");
    }

    if (!state || !expectedState || state !== expectedState) {
      return res.status(400).send("Estado OAuth inválido. Tente novamente.");
    }

    const tokenData = await exchangeAuthorizationCode(code);
    await saveToken(tokenData);

    res.setHeader(
      "Set-Cookie",
      "melhor_envio_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    );

    return res.status(200).send(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Melhor Envio conectado</title>
<style>
body{font-family:Arial,sans-serif;background:#f5f7fb;margin:0;padding:24px;color:#172033}
main{max-width:560px;margin:40px auto;background:#fff;padding:30px;border-radius:18px;text-align:center;box-shadow:0 10px 35px rgba(0,0,0,.08)}
h1{color:#168144}a{display:inline-block;margin-top:16px;padding:14px 20px;background:#ffe600;color:#111;text-decoration:none;border-radius:10px;font-weight:700}
</style>
</head>
<body>
<main>
<h1>Melhor Envio conectado ✅</h1>
<p>O token foi salvo com segurança e o cálculo de frete real já pode ser testado.</p>
<a href="/">Voltar para a loja</a>
</main>
</body>
</html>`);
  } catch (error) {
    console.error(error);
    return res.status(500).send(
      `Erro ao conectar Melhor Envio: ${String(error.message || error)}`
    );
  }
}
