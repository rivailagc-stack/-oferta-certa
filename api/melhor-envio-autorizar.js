import {
  buildAuthorizeUrl,
  createState
} from "./melhor-envio-oauth-utils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const state = createState();

    res.setHeader(
      "Set-Cookie",
      `melhor_envio_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    );

    return res.redirect(302, buildAuthorizeUrl(state));
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message || "Erro ao iniciar autorização."
    });
  }
}
