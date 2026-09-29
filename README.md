# IVO — Portail Client / Conseiller (v2)

Ce dossier est un **pack complet prêt à uploader** sur votre repo GitHub
(`projetivotest`). Il remplace l'intégralité du contenu actuel du repo.

Rien dans la partie "questionnaire client" n'a été modifié dans son
fonctionnement, sa mise en page ou son calibrage PDF — uniquement de nouvelles
parties ont été ajoutées (espace client existant) et l'accueil a été simplifié.

📋 Voir aussi **`SECURITY-CHECKLIST.md`** — ce qui est déjà sécurisé, ce qui
est partiel, et les réglages Supabase/GitHub à faire vous-même (MFA, HTTPS,
sauvegardes...).

## 0. Comment retrouver rapidement une section dans le code

Tous les fichiers (CSS, JS, SQL) sont découpés en gros blocs commentés avec
plusieurs mots-clés, par exemple :
```
/* ==========================================================================
   BANNIÈRE / EN-TÊTE / HEADER / TOPBAR / LOGO IVO / ENCOCHE BLEUE
   ========================================================================== */
```
Faites Ctrl+F avec n'importe lequel de ces mots pour sauter directement à la
bonne section, même si vous ne connaissez pas le terme technique exact.

De plus, partout où deux bouts de code (parfois dans des fichiers différents)
doivent rester cohérents entre eux, il y a un commentaire commençant par
**"⚠ LIÉ À"** qui explique quoi vérifier ailleurs avant de modifier. Exemple
concret : la taille du bandeau et celle du logo sont réglées à deux endroits
différents de lib/ivo-theme.css — les commentaires "⚠ LIÉ À" au-dessus de
chacun expliquent leur dépendance (c'est exactement le genre de problème
qu'on a résolu ensemble en direct sur ce projet). Cherchez "⚠ LIÉ À" pour
lister tous ces points de vigilance d'un coup.

## 1. Ce qui a changé

- **`index.html`** (accueil) : ne propose plus que "Remplir le questionnaire".
  L'accès conseiller et l'espace client existant ne sont plus affichés
  publiquement — chacun y accède par son propre lien direct (voir plus bas).
- **`client/`** : strictement inchangé (questionnaire, calibrage, PDF).
- **`conseiller/`** : le tableau de bord a été refait avec 3 onglets clairs :
  - **Documents** = les questionnaires reçus des clients (l'ancienne liste
    "Dossiers" — un client = une ligne, cliquable pour ouvrir son dossier) ;
  - **Justificatifs** = toutes les pièces jointes de tous les clients (CNI,
    justificatif de domicile, RIB, revenus) + les PDF déjà générés
    (questionnaire initial, dossier complet), avec valider/refuser/supprimer
    directement depuis cette vue globale ;
  - **Comptes clients** = la liste des accès espace-client déjà créés.
  En haut, 3 cartes-résumé (questionnaires reçus / justificatifs à valider /
  comptes actifs). Dans la fiche d'un dossier précis, un bouton **"Créer le
  compte client"** crée le compte en un clic, sans passer par Supabase (voir
  section 3). Son code JS est dans `lib/conseiller-app.js` (avant : inline
  dans la page) pour rester lisible malgré les ajouts.
- **`espace-client/`** (nouveau) : l'espace pour vos clients déjà passés par
  le questionnaire. Ils se connectent avec un email + mot de passe (créés par
  vous, voir section 3), et retrouvent : le statut de leur dossier, leurs
  documents à transmettre/déjà transmis, et leurs bilans à télécharger.
- **`supabase/schema-v2-portail-client.sql`** (nouveau) : à exécuter dans
  Supabase — voir section 2, **obligatoire** avant que l'espace client ou les
  nouveaux onglets ne fonctionnent.
- **`supabase/functions/create-client-account/`** (nouveau) : fonction Edge
  qui crée le compte Supabase Auth d'un client depuis le bouton "Créer le
  compte client" — voir section 2 pour le déploiement.
- **`supabase/functions/delete-client-account/`** et
  **`supabase/functions/reset-client-password/`** (nouveau) : suppression
  définitive d'un compte client et réinitialisation de son mot de passe,
  boutons disponibles dans l'encart "Accès espace client" d'un dossier déjà
  relié à un compte. Un encart **"Identité"** (juste en dessous) permet aussi
  de corriger une erreur de saisie (nom, email, téléphone, type) faite à la
  création — voir section 2 pour le déploiement des fonctions.
- **Journal d'audit** (table `audit_log`, incluse dans
  `supabase/schema-v2-portail-client.sql`) : trace automatiquement chaque
  action sensible (suppression de dossier/document/bilan/compte,
  réinitialisation de mot de passe, correction d'identité, validation de
  document...). Consultable dans Supabase → Table Editor → `audit_log`.

## 2. Mettre à jour Supabase (à faire une seule fois)

1. Allez sur [supabase.com](https://supabase.com) → votre projet → **SQL
   Editor** → **New query**.
2. Collez le contenu de `supabase/schema-v2-portail-client.sql`, cliquez
   **Run**.
3. Le script s'arrêtera probablement à l'étape "un conseiller peut gerer les
   profils" tant que vos comptes conseillers existants ne sont pas déclarés
   — c'est normal, suivez l'instruction en commentaire juste en dessous dans
   le fichier SQL (copier l'UUID de chaque conseiller depuis
   **Authentication → Users**, puis relancer le petit `insert into profiles
   ...` fourni).
4. Si vous voyez des erreurs de permission (mêmes symptômes qu'avec les
   anciennes policies `to anon`), remplacez `to authenticated` par `to
   public` dans le script — c'est le correctif qui avait déjà fonctionné une
   première fois sur ce projet.
5. **Déployez les 3 fonctions Edge de gestion des comptes clients**
   (nécessite le CLI Supabase installé une seule fois : `npm install -g
   supabase`) :
   ```
   supabase login
   supabase link --project-ref <votre-ref-de-projet>
   supabase functions deploy create-client-account
   supabase functions deploy delete-client-account
   supabase functions deploy reset-client-password
   ```
   Aucun secret à configurer pour celle-ci (elle réutilise les mêmes clés
   auto-fournies que send-advisor-email).

## 3. Donner accès à l'espace client à un client existant

**Méthode recommandée — tout dans l'appli, sans toucher à Supabase :**

1. Dans **l'espace conseiller**, onglet **Documents**, ouvrez le dossier du
   client concerné.
2. Onglet **Dossier KYC** → encart "Accès espace client" → renseignez son
   email (déjà pré-rempli s'il l'a donné dans le questionnaire) et un mot de
   passe (bouton "Générer un mot de passe" si besoin) → **Créer le compte
   client**.
3. Le mot de passe s'affiche une seule fois à l'écran — transmettez-le au
   client avec son email, par téléphone ou tout autre canal sécurisé, jamais
   par email en clair. Donnez-lui aussi le lien **`espace-client/index.html`**
   (section 4).

Le client peut alors se connecter et voit uniquement son propre dossier —
jamais celui des autres clients.

**Méthode manuelle (de secours)**, si vous préférez créer le compte
vous-même dans Supabase : **Authentication → Users → Add user** (cochez
*Auto Confirm User*), copiez son UUID, puis dans le même encart "Accès
espace client", dépliez *"Ce compte existe déjà ?"* et collez l'UUID.

## 4. Les 3 liens à connaître (rien n'est indexé/public au-delà de l'accueil)

- Accueil public : `https://pyjackoga.github.io/projetivotest/`
  → uniquement "Remplir le questionnaire", pour les nouveaux clients.
- Conseiller : `https://pyjackoga.github.io/projetivotest/conseiller/`
  → à garder pour vous (bookmark), jamais affiché publiquement.
- Espace client existant : `https://pyjackoga.github.io/projetivotest/espace-client/`
  → à transmettre uniquement aux clients à qui vous avez créé un accès
  (section 3).

## 5. Comment uploader ce pack sur GitHub

1. Ouvrez votre repo `projetivotest` sur github.com.
2. Pour chaque dossier ci-dessous, ouvrez-le sur GitHub, cliquez **Add file
   → Upload files**, puis glissez le contenu du dossier correspondant de ce
   pack (pas le dossier lui-même, son **contenu**) :
   - `client/` → dans `client/` du repo (remplace les fichiers existants)
   - `conseiller/` → dans `conseiller/` du repo
   - `espace-client/` → **nouveau dossier**, à créer en tapant
     `espace-client/nomdufichier` dans la zone d'upload de GitHub si elle ne
     propose pas de créer un dossier directement
   - `lib/` → dans `lib/` du repo
   - `assets/` → dans `assets/` du repo
   - `supabase/` → dans `supabase/` du repo (schéma SQL + les 2 fonctions
     Edge, `send-advisor-email` et le nouveau `create-client-account`)
   - `index.html` → à la racine du repo
3. Validez chaque commit ("Commit changes").
4. Attendez 1-2 minutes que GitHub Pages republie le site, puis testez en
   navigation privée (pour éviter le cache navigateur) :
   - l'accueil n'affiche plus que "Remplir le questionnaire" ;
   - `conseiller/` fonctionne comme avant, avec les nouveaux onglets
     Documents/Bilans sur un dossier ;
   - `espace-client/` affiche l'écran de connexion.

## 6. Ce qui n'a PAS pu être testé de mon côté

Le tableau de bord (3 onglets, cartes-statistiques) a été testé en direct sur
votre vraie session/vos vraies données et fonctionne bien. En revanche, je
n'ai pas d'accès à votre compte Supabase pour déployer/tester ce qui suit —
à vérifier une fois les fonctions Edge déployées (section 2, étape 5) :
- "Créer le compte client", "Créer un client à partir de rien" ;
- "Réinitialiser le mot de passe" et "Supprimer ce compte" (accès espace
  client) — testez d'abord sur un client factice ;
- l'encart "Identité" (corriger nom/email/téléphone après coup) — celui-ci
  ne dépend d'aucune fonction Edge, juste des nouvelles policies SQL ;
- l'upload réel d'un document ou d'un bilan côté client ;
- la connexion espace-client elle-même.

Si quelque chose coince après upload, dites-moi précisément le message
d'erreur affiché (F12 → Console, ou le message rouge dans la page) et je
corrige.
