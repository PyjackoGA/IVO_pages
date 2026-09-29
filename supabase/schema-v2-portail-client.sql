-- ==========================================================================
-- IVO — Extension "Portail Client" (documents + bilans + comptes clients).
-- À COLLER dans Supabase → SQL Editor → New query → Run, EN PLUS de
-- l'ancien schema.sql (déjà appliqué, ne pas le rejouer).
--
-- Ce script :
--  1) crée une table "profiles" pour savoir qui est conseiller / qui est client
--  2) ajoute un lien entre un dossier (submissions) et le compte client
--     autorisé à le consulter
--  3) resserre les règles de "submissions" : un client connecté ne voit/ne
--     modifie plus QUE son propre dossier (avant, "to authenticated" voulait
--     dire "n'importe quel compte connecté", ce qui n'était pas un problème
--     tant que seuls les conseillers avaient un compte — ce n'est plus vrai
--     dès qu'un client peut se connecter aussi)
--  4) crée les tables client_documents et client_reports (bilans)
--  5) crée deux nouveaux buckets de stockage privés + leurs règles d'accès
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1) Rôles
-- --------------------------------------------------------------------------
-- ⚠ LIÉ AU CODE JS : les valeurs 'advisor'/'client' ci-dessous sont écrites en
-- dur dans lib/conseiller-app.js (fonction linkAccount(), littéral role:"client")
-- et lues implicitement par TOUTES les policies "... and p.role = 'advisor'"
-- de ce fichier. Ne renommez jamais ces deux mots sans faire une recherche
-- globale des deux côtés (SQL et JS).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('advisor','client')),
  email text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ⚠ SÉCURITÉ : chacun ne lit QUE sa propre ligne (id = auth.uid()), jamais
-- toute la table. C'est suffisant pour que les vérifications "exists (select
-- 1 from profiles where id=auth.uid() and role='advisor')" utilisées PARTOUT
-- ailleurs (submissions, client_documents, client_reports, storage) continuent
-- de fonctionner — ces vérifications ne portent jamais que sur sa propre
-- ligne. Une version antérieure de ce script utilisait "using (true)" (tout
-- le monde peut tout lire) : si vous l'avez déjà exécutée, relancez bien le
-- "drop policy" + "create policy" ci-dessous pour la resserrer.
drop policy if exists "chacun peut lire les profils" on public.profiles;
create policy "chacun lit seulement sa propre ligne"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "un conseiller peut gerer les profils" on public.profiles;
create policy "un conseiller peut gerer les profils"
  on public.profiles for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'));

-- ⚠️ ÉTAPE MANUELLE, à faire UNE SEULE FOIS avant que la policy ci-dessus ne
-- fonctionne pour vos comptes existants (elle vérifie "est-ce déjà un
-- conseiller ?", donc il faut insérer les premières lignes "à la main") :
--
--   1. Supabase → Authentication → Users → copiez l'UUID de chaque conseiller
--   2. Puis lancez, en remplaçant les UUID/emails :
--
-- insert into public.profiles (id, role, email) values
--   ('<uuid-tristan>', 'advisor', 'tristan.dantin@ivocapital.com'),
--   ('<uuid-gabriel>', 'advisor', 'gabriel.atimi@ivocapital.com')
-- on conflict (id) do update set role = 'advisor';


-- --------------------------------------------------------------------------
-- 2) Lien dossier <-> compte client
-- ⚠ LIÉ AU CODE JS : cette colonne est écrite par linkAccount() dans
-- lib/conseiller-app.js (interface conseiller) et LUE par loadEverything()
-- dans espace-client/index.html (filtre "eq('client_user_id', uid)") — c'est
-- LE lien technique entre les deux interfaces pour un même client.
--
-- ⚠ "on delete set null" est IMPORTANT : sans ça, supprimer le compte Auth
-- d'un client (fonction delete-client-account) échouerait tant qu'un dossier
-- le référence encore. Si vous avez déjà exécuté une version antérieure de ce
-- script (sans ce "on delete set null"), relancez au moins les 2 lignes
-- ci-dessous pour corriger la contrainte existante.
-- --------------------------------------------------------------------------
alter table public.submissions add column if not exists client_user_id uuid references auth.users(id);
alter table public.submissions drop constraint if exists submissions_client_user_id_fkey;
alter table public.submissions add constraint submissions_client_user_id_fkey
  foreign key (client_user_id) references auth.users(id) on delete set null;

-- --------------------------------------------------------------------------
-- 3) Policies "submissions" resserrées (remplace les anciennes, trop larges)
-- --------------------------------------------------------------------------
drop policy if exists "les conseillers connectes peuvent tout lire" on public.submissions;
drop policy if exists "les conseillers connectes peuvent mettre a jour" on public.submissions;

create policy "lecture selon le role"
  on public.submissions for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor')
    or client_user_id = auth.uid()
  );

create policy "ecriture reservee aux conseillers"
  on public.submissions for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'));

-- Le conseiller a un droit de suppression complet et définitif d'un dossier
-- (réponses + documents + bilans associés, via "on delete cascade" plus bas).
-- Pensez à supprimer aussi les fichiers du bucket "submissions" et les
-- fichiers client_documents/client_reports AVANT ce delete (l'app le fait,
-- mais si vous supprimez à la main dans Supabase, faites-le aussi).
create policy "suppression reservee aux conseillers"
  on public.submissions for delete
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'));


-- --------------------------------------------------------------------------
-- 4) Documents personnels du client (CNI, justificatif de domicile, RIB, ...)
-- ⚠ LIÉ AU CODE JS : la liste doc_type ci-dessous doit être identique au
-- tableau DOC_TYPES dupliqué dans lib/conseiller-app.js ET espace-client/index.html
-- (triple lien, voir la note "TRIPLE LIEN" à côté de DOC_TYPES dans ces deux
-- fichiers). storage_path doit toujours commencer par "<submission_id>/..."
-- (convention imposée par les policies de stockage plus bas, section 6).
-- --------------------------------------------------------------------------
create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  doc_type text not null check (doc_type in ('cni','justificatif_domicile','rib','justificatif_revenus','autre')),
  file_name text,
  storage_path text not null,
  status text not null default 'a_valider' check (status in ('a_valider','valide','refuse')),
  uploaded_at timestamptz not null default now(),
  validated_by uuid references auth.users(id),
  validated_at timestamptz
);
alter table public.client_documents enable row level security;

create policy "voir ses documents (client ou conseiller)"
  on public.client_documents for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor')
    or exists (select 1 from public.submissions s where s.id = submission_id and s.client_user_id = auth.uid())
  );

create policy "le client depose ses propres documents"
  on public.client_documents for insert
  to authenticated
  with check (exists (select 1 from public.submissions s where s.id = submission_id and s.client_user_id = auth.uid()));

-- Le conseiller a tous les droits sur les documents : déposer au nom d'un
-- client, valider/refuser, corriger, ou supprimer un document.
create policy "le conseiller gere tous les documents"
  on public.client_documents for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'));


-- --------------------------------------------------------------------------
-- 5) Bilans / comptes rendus envoyés par le conseiller
-- --------------------------------------------------------------------------
create table if not exists public.client_reports (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  title text not null,
  storage_path text not null,
  sent_by uuid references auth.users(id),
  sent_at timestamptz not null default now()
);
alter table public.client_reports enable row level security;

create policy "le client voit ses propres bilans"
  on public.client_reports for select
  to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id and s.client_user_id = auth.uid()));

-- Le conseiller a tous les droits sur les bilans : voir, ajouter, renommer,
-- remplacer ou supprimer un bilan déjà envoyé.
create policy "le conseiller gere tous les bilans"
  on public.client_reports for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'));


-- --------------------------------------------------------------------------
-- 6) Stockage : deux nouveaux buckets privés.
--    Convention de chemin obligatoire : "<submission_id>/<nom-de-fichier>"
--    (le premier dossier du chemin = l'id du dossier concerné), c'est ce que
--    les policies ci-dessous vérifient avec (storage.foldername(name))[1].
--
--    ⚠ LIÉ AU CODE JS (double sens) :
--    - les noms de buckets 'client-documents'/'client-reports' ci-dessous
--      sont répétés tels quels dans lib/conseiller-app.js ET
--      espace-client/index.html (appels ".storage.from('client-documents')"
--      etc.) — renommer un bucket ici casse les deux fichiers JS ;
--    - la convention de chemin "<submission_id>/..." est CONSTRUITE côté JS
--      (variable "path" dans advisorUploadDocument()/uploadReport() de
--      lib/conseiller-app.js, et uploadDocument() de espace-client/index.html)
--      et VÉRIFIÉE ici côté SQL — les deux doivent rester cohérents.
-- --------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('client-reports', 'client-reports', false)
on conflict (id) do nothing;

create policy "client-documents lecture"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-documents' and (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor')
      or exists (
        select 1 from public.submissions s
        where s.client_user_id = auth.uid()
          and s.id::text = (storage.foldername(name))[1]
      )
    )
  );

create policy "client-documents depot par le client"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'client-documents' and
    exists (
      select 1 from public.submissions s
      where s.client_user_id = auth.uid()
        and s.id::text = (storage.foldername(name))[1]
    )
  );

-- Le conseiller a tous les droits sur les fichiers (déposer au nom d'un
-- client, remplacer, supprimer), quel que soit le dossier concerné.
create policy "client-documents tous droits conseiller"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'client-documents' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'))
  with check (bucket_id = 'client-documents' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'));

create policy "client-reports lecture"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-reports' and (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor')
      or exists (
        select 1 from public.submissions s
        where s.client_user_id = auth.uid()
          and s.id::text = (storage.foldername(name))[1]
      )
    )
  );

-- Le conseiller a tous les droits sur les fichiers de bilans (déposer,
-- remplacer, supprimer).
create policy "client-reports tous droits conseiller"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'client-reports' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'))
  with check (bucket_id = 'client-reports' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'));

-- Le conseiller peut aussi gérer les PDF du bucket "submissions" (déposer,
-- remplacer, supprimer) — avant, seule l'insertion était permise.
create policy "submissions bucket tous droits conseiller"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'submissions' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'))
  with check (bucket_id = 'submissions' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'));

-- --------------------------------------------------------------------------
-- 7) Journal d'audit / audit_log — qui a fait quoi, sur quel dossier/compte,
--    et quand. Table volontairement IMMUABLE : aucune policy update/delete,
--    même pas pour les conseillers — seul un accès direct via service_role
--    (donc jamais depuis le navigateur) pourrait modifier une ligne existante.
--    ⚠ LIÉ AU CODE JS : chaque action sensible de lib/conseiller-app.js
--    (suppression de dossier/compte, réinitialisation de mot de passe,
--    correction d'identité, validation/refus de document, création de
--    client...) écrit une ligne ici via la fonction logAudit().
-- --------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  actor_email text,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;

create policy "un conseiller peut lire le journal"
  on public.audit_log for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor'));

create policy "un conseiller peut ecrire dans le journal (ses propres actions)"
  on public.audit_log for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'advisor')
  );

-- ==========================================================================
-- Si les policies "to authenticated" ci-dessus ne fonctionnent pas pour vos
-- clients (même symptôme que le souci déjà rencontré avec la clé
-- "sb_publishable_..." sur les policies "to anon" du schema.sql d'origine),
-- remplacez chaque "to authenticated" par "to public" dans ce script — c'est
-- le correctif qui avait fonctionné la première fois.
-- ==========================================================================
