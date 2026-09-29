# Checklist sécurité — IVO Portail Client/Conseiller

État au 2026-09-29. Revu à chaque changement important de l'application.

## ✅ Déjà en place (vérifié dans le code)

- **RLS activé sur toutes les tables exposées** : `submissions`,
  `client_documents`, `client_reports`, `profiles`.
- **Restrictions Storage via RLS** sur les 3 buckets : `submissions`,
  `client-documents`, `client-reports` — accès scindé par rôle (client ne
  voit que ses fichiers, conseiller voit tout).
- **Aucun secret dans le code/GitHub** : les fichiers `config.js` ne
  contiennent que la clé "anon" (publique par nature, protégée par les
  policies RLS). La clé `service_role` et la clé Resend ne sont jamais dans
  le repo, uniquement dans les secrets Supabase (Project Settings → Edge
  Functions → Secrets, auto-injectées pour `SUPABASE_URL`/`SERVICE_ROLE_KEY`).
- **`service_role` utilisée uniquement côté serveur** : seulement dans les 3
  fonctions Edge (`create-client-account`, `delete-client-account`,
  `reset-client-password`), jamais exposée au navigateur.
- **Table `profiles` resserrée** (corrigé le 2026-09-29) : chacun ne lit que
  sa propre ligne (`id = auth.uid()`), plus toute la table.
- **Journal d'audit** (ajouté le 2026-09-29) : table `audit_log`, immuable
  (aucune policy update/delete, même pour les conseillers), qui trace :
  création/suppression de compte client, réinitialisation de mot de passe
  (jamais le mot de passe lui-même), correction d'identité, suppression de
  dossier/document/bilan, validation/refus de document, liaison manuelle
  d'un compte. Consultable directement dans Supabase → Table Editor →
  `audit_log` (pas encore d'écran dédié dans l'appli — à demander si besoin).

## ⚠️ Partiellement couvert

- **Mot de passe robuste** : 8 caractères minimum imposés pour les comptes
  clients (créés via l'appli). Rien d'imposé pour les comptes conseillers
  (créés à la main dans Supabase — dépend de ce que vous tapez). Aucune règle
  de complexité (majuscule/chiffre/symbole) nulle part.

## ❌ À faire vous-même — réglages Supabase / GitHub (hors de portée du code)

| Action | Où | Pourquoi |
|---|---|---|
| Activer la MFA pour les comptes conseillers | Supabase → Authentication → Providers (ou Policies selon version) | Protège contre un mot de passe volé/deviné |
| Renforcer la politique de mot de passe (longueur/complexité) | Supabase → Authentication → Policies | Le contrôle actuel (8 caractères) n'est fait que côté appli, pas au niveau Supabase |
| Désactiver les inscriptions publiques | Supabase → Authentication → Providers → Email → décocher "Allow new users to sign up" | Personne d'autre que vous ne doit pouvoir créer un compte — vos clients sont créés uniquement par vous via l'appli |
| Forcer HTTPS sur GitHub Pages | Repo GitHub → Settings → Pages → cocher "Enforce HTTPS" | Empêche l'accès en clair au site |
| Forcer SSL sur les connexions PostgreSQL | Supabase → Project Settings → Database → "Enforce SSL" | Chiffre les connexions à la base |
| Vérifier/activer les sauvegardes | Supabase → Project Settings → Database → Backups | Le plan gratuit n'inclut pas (ou très peu) de sauvegardes automatiques — passez sur un plan payant si les données sont critiques |
| Vérifier les logs disponibles | Supabase → Logs (Auth logs, Postgres logs, Edge Function logs) | Utile en cas d'incident, même sans audit applicatif dédié |

