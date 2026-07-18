import crypto from "node:crypto";
import { supabaseHeaders } from "./shipping-utils.js";

const TOKEN_NAME = "melhor_envio";

function getBaseUrl() {
  return String(
    process.env.MELHOR_ENVIO_API_URL ||
    "https://www.melhorenvio.com.br"
  ).replace(/\/$/, "");
}

function getRedirectUri() {
  return (
    process.env.MELHOR_ENVIO_REDIRECT_URI ||
    "https://oferta-certa.vercel.app/api/melhor-envio-callback"
  );
}

export function createState() {
  return crypto.randomBytes(24).toString("hex");
}

export function buildAuthorizeUrl(state) {
  const clientId = process.env.MELHOR_ENVIO_CLIENT_ID;

  if (!clientId) {
    throw new Error("MELHOR_ENVIO_CLIENT_ID não configurado.");
  }

  const scopes = [
    "shipping-calculate",
    "shipping-companies",
    "shipping-tracking",
    "orders-read"
  ].join(" ");

  const url = new URL(`${getBaseUrl()}/oauth/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", scopes);

  return url.toString();
}

export async function exchangeAuthorizationCode(code) {
  return requestToken({
    grant_type: "authorization_code",
    client_id: process.env.MELHOR_ENVIO_CLIENT_ID,
    client_secret: process.env.MELHOR_ENVIO_CLIENT_SECRET,
    redirect_uri: getRedirectUri(),
    code
  });
}

async function refreshAccessToken(refreshToken) {
  return requestToken({
    grant_type: "refresh_token",
    client_id: process.env.MELHOR_ENVIO_CLIENT_ID,
    client_secret: process.env.MELHOR_ENVIO_CLIENT_SECRET,
    refresh_token: refreshToken
  });
}

async function requestToken(payload) {
  if (!payload.client_id || !payload.client_secret) {
    throw new Error("Client ID ou Client Secret não configurado.");
  }

  const response = await fetch(`${getBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
      data.error_description ||
      data.error ||
      "Não foi possível gerar o token do Melhor Envio."
    );
  }

  return data;
}

export async function saveToken(tokenData) {
  const expiresIn = Number(tokenData.expires_in || 2592000);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/integration_tokens?on_conflict=provider`,
    {
      method: "POST",
      headers: {
        ...supabaseHeaders(),
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({
        provider: TOKEN_NAME,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_type: tokenData.token_type || "Bearer",
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Não foi possível salvar o token: ${detail}`);
  }
}

async function getSavedToken() {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/integration_tokens?provider=eq.${TOKEN_NAME}&select=*&limit=1`,
    { headers: supabaseHeaders() }
  );

  if (!response.ok) {
    throw new Error("Não foi possível consultar o token do Melhor Envio.");
  }

  const rows = await response.json();
  return rows[0] || null;
}

export async function getValidAccessToken() {
  const envToken = process.env.MELHOR_ENVIO_TOKEN;
  if (envToken) return envToken;

  const saved = await getSavedToken();

  if (!saved?.access_token) {
    throw new Error(
      "Melhor Envio ainda não conectado. Abra /api/melhor-envio-autorizar."
    );
  }

  const expiresAt = new Date(saved.expires_at || 0).getTime();
  const renewBefore = Date.now() + 24 * 60 * 60 * 1000;

  if (expiresAt > renewBefore) {
    return saved.access_token;
  }

  if (!saved.refresh_token) {
    throw new Error("Token vencido e sem refresh token. Autorize novamente.");
  }

  const renewed = await refreshAccessToken(saved.refresh_token);
  await saveToken(renewed);
  return renewed.access_token;
}
