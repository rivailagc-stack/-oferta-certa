import crypto from "node:crypto";
import { supabaseHeaders } from "./shipping-utils.js";

const TOKEN_NAME = "melhor_envio";

function getAuthorizeUrl() {
  return "https://www.melhorenvio.com.br/oauth/authorize";
}

function getTokenUrl() {
  return "https://api.melhorenvio.com/oauth/token";
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

  const url = new URL(getAuthorizeUrl());

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", state);

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

  const response = await fetch(getTokenUrl(), {
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
      data.error_description ||
      data.message ||
      data.error ||
      "Erro ao gerar token do Melhor Envio."
    );
  }

  return data;
}

export async function saveToken(tokenData) {

  const expiresIn = Number(tokenData.expires_in || 2592000);

  const expiresAt = new Date(
    Date.now() + expiresIn * 1000
  ).toISOString();

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
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type || "Bearer",
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function getSavedToken() {

  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/integration_tokens?provider=eq.${TOKEN_NAME}&select=*&limit=1`,
    {
      headers: supabaseHeaders()
    }
  );

  if (!response.ok) {
    throw new Error("Não foi possível consultar token.");
  }

  const rows = await response.json();

  return rows[0] || null;
}

export async function getValidAccessToken() {

  if (process.env.MELHOR_ENVIO_TOKEN) {
    return process.env.MELHOR_ENVIO_TOKEN;
  }

  const saved = await getSavedToken();

  if (!saved) {
    throw new Error("Melhor Envio não autorizado.");
  }

  const expires =
    new Date(saved.expires_at).getTime();

  if (expires > Date.now() + 86400000) {
    return saved.access_token;
  }

  const renewed = await refreshAccessToken(
    saved.refresh_token
  );

  await saveToken(renewed);

  return renewed.access_token;
}
