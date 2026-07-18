export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const status = {
    mp_access_token: Boolean(process.env.MP_ACCESS_TOKEN),
    supabase_url: Boolean(process.env.SUPABASE_URL),
    supabase_service_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    site_url: Boolean(process.env.SITE_URL),
    webhook_secret: Boolean(process.env.MP_WEBHOOK_SECRET)
  };

  status.ready =
    status.mp_access_token &&
    status.supabase_url &&
    status.supabase_service_key &&
    status.site_url;

  return res.status(200).json(status);
}
