// Edge Function Supabase (Deno). Supprime DÉFINITIVEMENT le compte Supabase
// Auth d'un client (utilise l'API Admin, clé service_role, jamais exposée au
// navigateur — même principe que create-client-account).
//
// Déploiement :
//   supabase functions deploy delete-client-account
//
// ⚠ LIÉ À lib/conseiller-app.js (fonction deleteClientAccount()) qui appelle
// cette fonction avec { userId }.
// ⚠ LIÉ À supabase/schema-v2-portail-client.sql : submissions.client_user_id
// doit être en "on delete set null" (voir section 7 du script) sinon la
// suppression échoue tant qu'un dossier référence encore ce compte — le code
// JS déroule aussi les choses dans le bon ordre (délier avant de supprimer).
// ⚠ Sécurité : même vérification "appelant = conseiller" que create-client-account.

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
  try {
    ({ userId } = await req.json());
  } catch {
    return json({ error: "corps de requête invalide, {userId} attendu" }, 400);
  }
  if (!userId) return json({ error: "userId requis" }, 400);

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) return json({ error: delErr.message }, 400);

  return json({ ok: true });
});
