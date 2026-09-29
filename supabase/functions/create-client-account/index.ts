// Edge Function Supabase (Deno). Crée un compte Supabase Auth pour un client
// (email + mot de passe choisis par le conseiller), sans jamais exposer la clé
// "service_role" au navigateur — c'est tout l'intérêt de passer par une
// fonction serveur plutôt que d'appeler l'API Admin directement depuis
// lib/conseiller-app.js.
//
// Déploiement :
//   supabase functions deploy create-client-account
// Aucun secret supplémentaire à configurer : SUPABASE_URL et
// SUPABASE_SERVICE_ROLE_KEY sont auto-fournies par Supabase (comme pour
// send-advisor-email).
//
// ⚠ LIÉ À lib/conseiller-app.js (fonction createClientAccount()) qui appelle
// cette fonction avec { email, password }, et attend en retour { userId }.
// ⚠ Sécurité : cette fonction VÉRIFIE que l'appelant est bien un conseiller
// (table "profiles", role='advisor') avant de créer quoi que ce soit — sans
// ça, n'importe qui connaissant l'URL de la fonction pourrait créer des
// comptes. Le jeton de l'appelant est lu depuis l'en-tête Authorization que
// supabase-js ajoute automatiquement à chaque invoke() d'un utilisateur connecté.

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

  // Qui appelle ? (le jeton du conseiller connecté, pas la clé anon)
  const { data: callerData, error: callerErr } = await admin.auth.getUser(callerToken);
  if (callerErr || !callerData?.user) return json({ error: "session invalide" }, 401);

  // Est-ce bien un conseiller ?
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .maybeSingle();
  if (!profile || profile.role !== "advisor") {
    return json({ error: "réservé aux conseillers" }, 403);
  }

  let email: string | undefined;
  let password: string | undefined;
  try {
    ({ email, password } = await req.json());
  } catch {
    return json({ error: "corps de requête invalide, {email, password} attendu" }, 400);
  }
  if (!email || !password) return json({ error: "email et mot de passe requis" }, 400);
  if (password.length < 8) return json({ error: "le mot de passe doit faire au moins 8 caractères" }, 400);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // pas d'email de confirmation à faire cliquer par le client
  });
  if (createErr) return json({ error: createErr.message }, 400);

  return json({ userId: created.user.id });
});
