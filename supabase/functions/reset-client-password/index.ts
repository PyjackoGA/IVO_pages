// Edge Function Supabase (Deno). Réinitialise le mot de passe d'un compte
// client existant (utile si le client l'a oublié). Même principe que
// create-client-account / delete-client-account : la clé service_role reste
// côté serveur, jamais exposée au navigateur.
//
// Déploiement :
//   supabase functions deploy reset-client-password
//
// ⚠ LIÉ À lib/conseiller-app.js (fonction resetClientPassword()) qui appelle
// cette fonction avec { userId, password }.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const callerToken = authHeader.replace(/^Bearer /i, "");
  if (!callerToken) return json({ error: "non authentifié" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: callerData, error: callerErr } = await admin.auth.getUser(callerToken);
  if (callerErr || !callerData?.user) return json({ error: "session invalide" }, 401);

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .maybeSingle();
  if (!profile || profile.role !== "advisor") {
    return json({ error: "réservé aux conseillers" }, 403);
  }

  let userId: string | undefined;
  let password: string | undefined;
  try {
    ({ userId, password } = await req.json());
  } catch {
    return json({ error: "corps de requête invalide, {userId, password} attendu" }, 400);
  }
  if (!userId || !password) return json({ error: "userId et password requis" }, 400);
  if (password.length < 8) return json({ error: "le mot de passe doit faire au moins 8 caractères" }, 400);

  const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password });
  if (updErr) return json({ error: updErr.message }, 400);

  return json({ ok: true });
});
