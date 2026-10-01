(function(){
"use strict";

/* ==========================================================================
   DONNÉES DE RÉFÉRENCE / LISTES FIXES / CRITÈRES AML / PROFILS DE RISQUE
   (les libellés du formulaire "partie conseiller" — Parties 3, 8, 9, 10 du PDF)

   ⚠ TOUS les tableaux de cette section (AML_ROWS, PROFILES,
   PRECONISATIONS_META, RECON_META) ont un JUMEAU dans lib/pdf-fill.js
   (AML_ROWS, PROFIL_CHECK, PRECONISATIONS_ROWS, RECON_ROWS) qui porte les
   coordonnées x/y sur le PDF. Les clés "key" doivent être STRICTEMENT
   identiques des deux côtés — c'est ce qui relie une case cochée à l'écran à
   la bonne case cochée sur le PDF généré. Ajout/suppression/renommage d'un
   critère = à faire dans les DEUX fichiers.
   ========================================================================== */

/* --- CRITÈRES DE VIGILANCE RENFORCÉE / LISTE AML / LCB-FT (Partie 3 du PDF)
   ⚠ LIÉ À lib/pdf-fill.js "AML_ROWS" (mêmes clés "key", voir note ci-dessus) --- */
var AML_ROWS = [
  {key:"ppeBeneficiaires", label:"Des Personnes Politiquement Exposées ont été identifiées parmi les bénéficiaires effectifs"},
  {key:"listesSanctions", label:"Des personnes présentes sur liste des terroristes ou de gel des avoirs ont été identifiées"},
  {key:"refusPieces", label:"Refus ou impossibilité de produire des pièces justificatives sur la provenance des fonds"},
  {key:"diligencesImpossibles", label:"Les diligences usuelles ne permettent pas d'identifier le bénéficiaire effectif"},
  {key:"rapatriementEtranger", label:"Rapatriement de fonds d'un pays imposant des obligations LCB/FT non équivalentes"},
  {key:"relationDistance", label:"Le client veut entrer en relation à distance"},
  {key:"paysRisque", label:"Le ou les bénéficiaires effectifs résident dans un pays à risque"},
  {key:"changementsStatutaires", label:"Changements statutaires fréquents non justifiés par la situation économique"},
  {key:"interpositionPersonnes", label:"Interposition de personnes physiques n'intervenant qu'en apparence"},
  {key:"transactionSousEvaluee", label:"Transaction immobilière à un prix manifestement sous-évalué"},
  {key:"comportementAtypique", label:"Comportement atypique du client (urgence à investir, etc.)"},
  {key:"societesEcran1", label:"Utilisation de sociétés écran (siège dans un État non coopératif)"},
  {key:"operationsIncoherentes", label:"Opérations financières incohérentes / secteurs sensibles à la fraude TVA"},
  {key:"societesEcran2", label:"Utilisation de sociétés écran (domiciliataire / adresse privée)"},
];

/* --- PROFILS DE RISQUE IVO : prudent / équilibré / dynamique / discrétionnaire (Partie 8)
   ⚠ LIÉ À lib/pdf-fill.js "PROFIL_CHECK" (mêmes clés "key") ET à la fonction
   suggestProfile() plus bas, dupliquée à l'identique dans les deux fichiers. --- */
var PROFILES = [
  {key:"prudent", name:"Prudent", txt:"Rendements modérés et réguliers (en moyenne 3%). Peu de risque de perte en capital (en moyenne -6%). Horizon minimum 5 ans."},
  {key:"equilibre", name:"Équilibré", txt:"Valorisation du capital, rendements moyens (en moyenne 5%). Risque modéré de perte en capital (en moyenne -10%). Horizon minimum 5 ans."},
  {key:"dynamique", name:"Dynamique", txt:"Valorisation active, rendements élevés (en moyenne 15%). Risque important de perte en capital (en moyenne -30%). Horizon minimum 7 ans."},
  {key:"discretionnaire", name:"Discrétionnaire", txt:"Fluctuations élevées et risques forts de moins-value, allocation laissée à la discrétion d'IVO. Horizon minimum 8 ans."},
];

/* --- PRÉCONISATIONS IVO / RECOMMANDATIONS DE SERVICE (Partie 9)
   ⚠ LIÉ À lib/pdf-fill.js "PRECONISATIONS_ROWS" (mêmes clés "key") --- */
var PRECONISATIONS_META = [
  {key:"conseilInvestissement", label:"Conseil en investissement et test d'adéquation"},
  {key:"gestionMandat", label:"Gestion sous mandat et test d'adéquation"},
  {key:"rto", label:"Mandat de réception-transmission d'ordres conseillé et test du caractère approprié ou mise en garde"},
  {key:"assuranceVie", label:"Contrat d'assurance vie et devoir de conseil ou mise en garde"},
];

/* --- RECONNAISSANCE DE RÉCEPTION DE DOCUMENTS PAR LE CLIENT (Partie 10)
   ⚠ LIÉ À lib/pdf-fill.js "RECON_ROWS" (mêmes clés "key") --- */
var RECON_META = [
  {key:"conseils", label:"Tous les conseils et explications sur les services et produits proposés"},
  {key:"documentInfo", label:"Un document d'information présentant la société IVO Capital Partners"},
  {key:"infosPrecontractuelles", label:"Les informations précontractuelles"},
  {key:"courrierCategorisation", label:"Un courrier de catégorisation"},
];

/* --- TYPES DE DOCUMENTS PERSONNELS / PIÈCES JUSTIFICATIVES CLIENT
   ⚠ TRIPLE LIEN — ces clés doivent être identiques à :
     1. la contrainte SQL "doc_type in (...)" de la table client_documents
        (supabase/schema-v2-portail-client.sql, section 8) ;
     2. le même tableau DOC_TYPES dupliqué dans espace-client/index.html.
   Ajouter un type ici SANS mettre à jour ces deux autres endroits fait
   échouer l'insertion en base (contrainte SQL violée) ou affiche une clé
   technique brute au lieu d'un joli libellé côté client.

   "defaultFor" ne sert qu'à PRÉ-COCHER la liste "Documents demandés" selon le
   type de client (physique/morale) à la création du compte — le conseiller
   peut toujours cocher/décocher n'importe quel document pour n'importe quel
   client ensuite, quel que soit son type. Voir defaultDocsForType() plus bas,
   et submissions.requested_docs qui stocke le résultat final retenu. --- */
var DOC_TYPES = [
  {key:"cni", label:"Carte d'identité", defaultFor:["physique"]},
  {key:"justificatif_domicile", label:"Justificatif de domicile", defaultFor:["physique"]},
  {key:"rib", label:"RIB", defaultFor:[]},
  {key:"preuve_origine_fonds", label:"Preuve d'origine des fonds", defaultFor:["physique"]},
  {key:"kyc", label:"KYC", defaultFor:["physique"]},
  {key:"numero_fiscal", label:"Numéro fiscal", defaultFor:["physique"]},
  {key:"diligence_lcbft", label:"Diligence LCB-FT", defaultFor:["physique"]},
  {key:"esg_anciens_clients", label:"Questionnaire ESG (anciens clients)", defaultFor:["physique"]},
  {key:"statuts", label:"Statuts", defaultFor:["morale"]},
  {key:"kbis_rcs", label:"K-Bis / RCS", defaultFor:["morale"]},
  {key:"rbe", label:"RBE (registre des bénéficiaires effectifs)", defaultFor:["morale"]},
  {key:"id_jdd_beneficiaires", label:"ID + justificatif de domicile des bénéficiaires effectifs", defaultFor:["morale"]},
  {key:"bilan", label:"Bilan", defaultFor:["morale"]},
  {key:"diligence_lcbft_beneficiaire", label:"Diligence LCB-FT (bénéficiaire effectif)", defaultFor:["morale"]},
  {key:"justificatif_revenus", label:"Justificatif de revenus", defaultFor:[]},
  {key:"autre", label:"Autre document", defaultFor:[]},
];

/* Liste des clés DOC_TYPES pré-cochées pour un type de client donné — voir
   commentaire "defaultFor" ci-dessus. */
function defaultDocsForType(personType){
  return DOC_TYPES.filter(function(t){
    return t.defaultFor && t.defaultFor.indexOf(personType) > -1;
  }).map(function(t){ return t.key; });
}

/* ==========================================================================
   FONCTIONS UTILITAIRES / HELPERS / FORMATAGE TEXTE-DATE-NOMBRE
   ========================================================================== */
function esc(s){ return (s||"").toString().replace(/[&<>"']/g, function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
function n(v){ var f = parseFloat(v); return isNaN(f) ? 0 : f; }
function fmt(v){ if(v===""||v===null||v===undefined) return "—"; return n(v).toLocaleString('fr-FR'); }
function yn(v){ return v===true?"Oui":v===false?"Non":"—"; }
function fmtDateTime(iso){ try{ return new Date(iso).toLocaleString('fr-FR'); }catch(e){ return iso; } }

function defaultAdvisorAnswers(){
  var aml = {};
  AML_ROWS.forEach(function(r){ aml[r.key] = null; });
  var preconisations = {};
  PRECONISATIONS_META.forEach(function(p){ preconisations[p.key] = {checked:false, note:""}; });
  var reconnaissance = {};
  RECON_META.forEach(function(r){ reconnaissance[r.key] = false; });
  return { aml: aml, profil: null, preconisations: preconisations, reconnaissance: reconnaissance, lieu:"", date:"" };
}

/* --- CALCUL DU PROFIL DE RISQUE SUGGÉRÉ (à partir des 3 réponses client) --- */
function suggestProfile(risque){
  if(!risque || !risque.perte || !risque.reaction || !risque.rendement) return null;
  var s1 = {p1:1,p2:2,p3:3,p4:4}[risque.perte] || 0;
  var s2 = {vendre:1,conserver:2.5,investir:4}[risque.reaction] || 0;
  var s3 = {r1:1,r2:2.5,r3:4}[risque.rendement] || 0;
  var avg = (s1+s2+s3)/3;
  if(avg<=1.6) return "prudent";
  if(avg<=2.6) return "equilibre";
  if(avg<=3.5) return "dynamique";
  return "discretionnaire";
}

/* ==========================================================================
   CONNEXION SUPABASE / CLIENT API / IDENTIFIANTS
   ⚠ LIÉ À conseiller/index.html qui charge <script src="../client/config.js">
   (le fichier config.js n'existe qu'à UN seul endroit pour cette interface,
   partagé avec le questionnaire). ⚠ L'espace client, lui, a SA PROPRE copie
   à espace-client/config.js — si vous changez la clé Supabase (SUPABASE_URL
   / SUPABASE_ANON_KEY), il faut la changer aux DEUX endroits (client/config.js
   ET espace-client/config.js), sinon un des deux espaces cesse de fonctionner.
   ========================================================================== */
var supa = null;
function getClient(){
  if(supa) return supa;
  var cfg = window.IVO_CONFIG;
  if(!cfg || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.indexOf("your-project-ref")>-1){
    throw new Error("config.js (dans /client) n'est pas encore renseigné avec vos identifiants Supabase.");
  }
  supa = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  return supa;
}

/* ==========================================================================
   ÉTAT GLOBAL DE L'APPLICATION / APPSTATE
   ========================================================================== */
/* ⚠ ARCHITECTURE (2026-09-30) : "Dossier KYC" (submissions) et "Comptes
   clients" (profiles) sont volontairement SANS AUCUN LIEN — voir section 9 de
   supabase/schema-v2-portail-client.sql. appState.current = le dossier KYC
   ouvert (onglet Documents) ; appState.currentAccount = le compte client
   ouvert (onglet Comptes clients). Ce sont deux objets différents, jamais le
   même, et appState.documents/reports changent de sens selon lequel des deux
   est actif (ils n'appartiennent qu'AUX COMPTES maintenant — un dossier KYC
   n'a plus ni documents ni bilans). */
var appState = {
  view: "loading", // loading | login | dashboard | detail | accountDetail
  section: "documents", // documents | justificatifs | comptes (onglets du tableau de bord)
  session: null,
  submissions: [],
  current: null, // dossier KYC ouvert (vue "detail") — voir openSubmission()
  advisorAnswers: null,
  allDocuments: [], // tous les documents + PDF de tous les clients, voir loadAllDocuments()
  allDocsError: "",
  loading: false,
  loginError: "",
  listError: "",
  docError: "",
  reportError: "",
  documents: [], // documents du COMPTE CLIENT ouvert (voir openAccount()), jamais d'un dossier
  reports: [], // bilans du COMPTE CLIENT ouvert
  newClientError: "", // formulaire "Créer un client à partir de rien" (onglet Comptes clients)
  newClientCredentials: null, // {email, password} affiché une fois juste après création
  newClientDocs: null, // liste de clés DOC_TYPES cochées dans ce même formulaire
  editRequestedDocs: false, // bascule l'encart "Documents demandés" (fiche compte) en mode édition
  requestedDocsDraft: [], // brouillon de clés cochées pendant l'édition — voir saveRequestedDocs()
  requestedDocsError: "",
  editIdentity: false, // encart "Identité" du DOSSIER KYC (corrige answers/client_name du questionnaire)
  identityError: "",
  // --- Comptes clients (profiles, role='client') ---
  clientAccounts: [],
  clientAccountsError: "",
  accountSearch: "", // filtre texte de la liste "Comptes existants"
  currentAccount: null, // compte client ouvert (vue "accountDetail") — voir openAccount()
  accountTab: "compte", // compte | documents | bilans (onglets de la fiche compte)
  editAccountIdentity: false,
  accountIdentityError: "",
  showResetPassword: false,
  resetPasswordError: "",
  resetPasswordValue: "", // affiché une fois juste après réinitialisation
  deleteAccountError: "",
};

function showToast(msg){
  var t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(function(){ t.classList.remove("show"); }, 2400);
}

/* ==========================================================================
   JOURNAL D'AUDIT / AUDIT_LOG — écrit une ligne à chaque action sensible.
   ⚠ LIÉ À supabase/schema-v2-portail-client.sql (table audit_log, section 7).
   Volontairement "best effort" : si l'écriture du journal échoue (ex: table
   pas encore créée chez vous), on log juste dans la console et on NE BLOQUE
   PAS l'action elle-même — un audit qui empêche de travailler serait pire
   que pas d'audit du tout.
   ========================================================================== */
async function logAudit(action, targetType, targetId, detail){
  try{
    var client = getClient();
    if(!appState.session) return;
    await client.from("audit_log").insert({
      actor_id: appState.session.user.id,
      actor_email: appState.session.user.email,
      action: action,
      target_type: targetType,
      target_id: targetId ? String(targetId) : null,
      detail: detail || null,
    });
  }catch(err){
    console.error("logAudit a échoué (action non bloquée) :", err);
  }
}

/* ==========================================================================
   MOTEUR D'AFFICHAGE / RENDER PRINCIPAL / AIGUILLAGE DES ÉCRANS
   ========================================================================== */
function render(){
  document.getElementById("topbar").innerHTML = renderTopbar();
  var app = document.getElementById("app");
  if(appState.view==="loading") app.innerHTML = '<div class="card"><p class="step-intro" style="margin:0">Chargement…</p></div>';
  else if(appState.view==="login") app.innerHTML = renderLogin();
  else if(appState.view==="dashboard") app.innerHTML = renderDashboard();
  else if(appState.view==="detail") app.innerHTML = renderDetail();
  else if(appState.view==="accountDetail") app.innerHTML = renderAccountDetail();
  bindEvents();
}

/* ==========================================================================
   BANNIÈRE / EN-TÊTE / TOPBAR / LOGO IVO (partie conseiller)
   ⚠ LIÉ À lib/ivo-theme.css (classes #topbar/.topbar-inner/.brand-badge — la
   TAILLE du logo se règle là-bas, pas ici) ET au fichier
   assets/logo-ivo-white.png lui-même (chemin répété dans 3 AUTRES fichiers :
   index.html racine, client/index.html, espace-client/index.html — renommer
   le PNG casse les 4 en même temps).
   ========================================================================== */
function renderTopbar(){
  var userBit = appState.session ? (
    '<div class="topbar-user"><span>'+esc(appState.session.user.email)+'</span><button data-action="logout">Déconnexion</button></div>'
  ) : "";
  return '<div class="topbar-inner">' +
    '<div class="brand-badge"><img src="../assets/logo-ivo-white.png" alt="IVO Capital Partners"></div>' +
    '<div class="brand-context"><div class="brand-sub">Interface conseiller</div></div>' +
    userBit +
  '</div>';
}

/* ==========================================================================
   ÉCRAN DE CONNEXION / LOGIN / MOT DE PASSE CONSEILLER
   ========================================================================== */
function renderLogin(){
  return '<div class="card">' +
    '<div class="eyebrow">Accès réservé</div>' +
    '<h1 class="step-title">Interface conseiller</h1>' +
    '<p class="step-intro">Connectez-vous avec votre compte IVO Capital Partners.</p>' +
    '<div class="login-field"><label class="flabel">Email</label><input type="email" id="loginEmail" autocomplete="username"></div>' +
    '<div class="login-field"><label class="flabel">Mot de passe</label><input type="password" id="loginPassword" autocomplete="current-password"></div>' +
    '<button class="btn btn-primary" style="width:100%" data-action="login">Se connecter</button>' +
    (appState.loginError ? '<div class="err-box">'+esc(appState.loginError)+'</div>' : '') +
  '</div>';
}

/* --- PASTILLES DE STATUT / BADGES DE COULEUR (dossier + document) --- */
function statusBadge(status){
  if(status==="complete") return '<span class="badge badge-complete">Complété</span>';
  if(status==="recu") return '<span class="badge badge-recu">Reçu</span>';
  return '<span class="badge badge-encours">En cours</span>';
}

function docStatusBadge(status){
  if(status==="valide") return '<span class="badge badge-complete">Validé</span>';
  if(status==="refuse") return '<span class="badge badge-danger">Refusé</span>';
  return '<span class="badge badge-recu">À valider</span>';
}

/* ==========================================================================
   TABLEAU DE BORD / DASHBOARD CONSEILLER / 3 ONGLETS
   (Documents reçus / Justificatifs (pièces clients) / Comptes clients)

   ⚠ NOMS À NE PAS CONFONDRE (clarifié suite à retour utilisateur) :
   - "Documents" (onglet 1, appState.section==="documents") = les
     QUESTIONNAIRES reçus des clients (une ligne = un dossier/une soumission
     du formulaire). C'est l'ancien onglet "Dossiers".
   - "Justificatifs" (onglet 2, appState.section==="justificatifs") = les
     PIÈCES JOINTES personnelles (CNI, RIB...) + les PDF déjà générés, tous
     clients confondus. C'est l'ancien onglet "Documents".
   - "Comptes clients" (onglet 3) = les accès espace-client créés.

   ⚠ LIÉ À appState.section — voir bindEvents() action "section", et
   loadAllDocuments() plus bas qui alimente l'onglet Justificatifs + les
   compteurs affichés dans les onglets et les cartes-statistiques.
   ========================================================================== */
function renderDashboard(){
  var section = appState.section || "documents";
  var linkedCount = appState.clientAccounts.length;
  var toValidateCount = appState.allDocuments.filter(function(d){ return d.kind==="doc" && d.status==="a_valider"; }).length;

  var html = '<h1 class="step-title" style="margin-bottom:2px">Espace conseiller</h1>' +
    '<p class="step-intro" style="margin:0 0 18px">Vue d\'ensemble de vos clients IVO Capital Partners.</p>';

  /* --- CARTES STATISTIQUES / RÉSUMÉ EN UN COUP D'ŒIL --- */
  html += '<div class="statgrid3">' +
    '<div class="statcard"><div class="sc-label">Questionnaires reçus</div><div class="sc-value">'+appState.submissions.length+'</div></div>' +
    '<div class="statcard'+(toValidateCount?' warn':'')+'"><div class="sc-label">Justificatifs à valider</div><div class="sc-value">'+toValidateCount+'</div></div>' +
    '<div class="statcard"><div class="sc-label">Comptes clients actifs</div><div class="sc-value">'+linkedCount+'</div></div>' +
  '</div>';

  /* --- NAVIGATION DES 3 ONGLETS DU TABLEAU DE BORD --- */
  html += '<div class="tabrow" style="align-items:center">' +
    '<button class="tabbtn '+(section==="documents"?"on":"")+'" data-action="section" data-section="documents">Documents</button>' +
    '<button class="tabbtn '+(section==="justificatifs"?"on":"")+'" data-action="section" data-section="justificatifs">Justificatifs'+(toValidateCount?' ('+toValidateCount+')':'')+'</button>' +
    '<button class="tabbtn '+(section==="comptes"?"on":"")+'" data-action="section" data-section="comptes">Comptes clients ('+linkedCount+')</button>' +
    '<button class="btn btn-ghost" style="margin-left:auto" data-action="refresh">↻ Actualiser</button>' +
  '</div>';

  if(section==="justificatifs") html += renderJustificatifsSection();
  else if(section==="comptes") html += renderComptesClientsSection();
  else html += renderDocumentsRecusSection();

  return html;
}

/* --- ONGLET "DOCUMENTS" : les questionnaires reçus (un client = une ligne)
   + l'import manuel d'un PDF. Anciennement appelé "Dossiers". --- */
function renderDocumentsRecusSection(){
  var html = '';

  /* --- ZONE DE DÉPÔT / DROPZONE / IMPORT MANUEL D'UN PDF --- */
  html += '<div class="card wide dropzone" id="importDropzone">' +
    '<div class="import-row">' +
      '<div><div class="import-title">📎 Importer un PDF reçu manuellement</div>' +
      '<div class="import-sub">Envoi automatique en échec, ou dossier traité autrement : glissez ici le PDF généré par cet outil (le vôtre ou celui d\'un client), ou cliquez pour le choisir.</div></div>' +
      '<label class="btn btn-ghost" style="cursor:pointer;flex-shrink:0">Choisir un fichier' +
        '<input type="file" accept="application/pdf" id="importPdfInput" data-action="importPdf" style="display:none">' +
      '</label>' +
    '</div>' +
    '<div id="importError"></div>' +
  '</div>';

  if(appState.listError){
    html += '<div class="err-box">'+esc(appState.listError)+'</div>';
  }

  /* --- LISTE DES QUESTIONNAIRES REÇUS --- */
  if(!appState.submissions.length && !appState.listError){
    html += '<div class="card"><div class="empty-state">Aucun questionnaire reçu pour le moment.<br>Ceux complétés par vos clients apparaîtront ici automatiquement.</div></div>';
  } else if(appState.submissions.length) {
    html += '<div class="card wide"><div class="sublist">';
    appState.submissions.forEach(function(s){
      html += '<div class="subitem" data-action="open" data-id="'+esc(s.id)+'">' +
        '<div><div class="subitem-name">'+esc(s.client_name||"(sans nom)")+'</div>' +
        '<div class="subitem-meta">'+esc(s.client_email||"")+' · '+fmtDateTime(s.created_at)+' · conseiller : '+esc(s.advisor_email)+'</div></div>' +
        statusBadge(s.status) +
      '</div>';
    });
    html += '</div></div>';
  }
  return html;
}

/* --- ONGLET "JUSTIFICATIFS" : TOUTES les pièces jointes de TOUS les clients
   (CNI, justificatif de domicile, RIB, revenus) + les PDF déjà générés
   (questionnaire initial, dossier complet). Anciennement appelé "Documents".
   ⚠ LIÉ À loadAllDocuments() plus bas, qui construit appState.allDocuments en
   combinant la table client_documents ET les colonnes pdf_client_path /
   pdf_final_path de submissions. */
function renderJustificatifsSection(){
  var html = '';
  if(appState.allDocsError) html += '<div class="err-box">'+esc(appState.allDocsError)+'</div>';
  if(!appState.allDocuments.length){
    html += '<div class="card"><div class="empty-state">Aucun justificatif pour le moment.</div></div>';
    return html;
  }
  html += '<div class="card wide"><div class="sublist">';
  appState.allDocuments.forEach(function(d){
    var isDoc = d.kind==="doc";
    html += '<div class="subitem" style="cursor:default">' +
      '<div><div class="subitem-name">'+esc(d.label)+'</div>' +
      '<div class="subitem-meta">'+esc(d.clientName||"(sans nom)")+(d.fileName?' · '+esc(d.fileName):'')+' · '+fmtDateTime(d.date)+'</div></div>' +
      (isDoc ? docStatusBadge(d.status) : '<span class="badge badge-recu">PDF</span>') +
      '<div class="docrow-actions">' +
        '<button class="btn btn-ghost" data-action="'+(isDoc?"docViewG":"pdfViewG")+'" data-id="'+esc(d.id)+'">Voir</button>' +
        (isDoc && d.status!=="valide" ? '<button class="btn btn-primary" data-action="docValidateG" data-id="'+esc(d.id)+'">Valider</button>' : '') +
        (isDoc && d.status!=="refuse" ? '<button class="btn" style="background:var(--danger-soft);color:var(--danger)" data-action="docRefuseG" data-id="'+esc(d.id)+'">Refuser</button>' : '') +
        (isDoc ? '<button class="btn" style="background:var(--danger-soft);color:var(--danger)" data-action="docDeleteG" data-id="'+esc(d.id)+'">Supprimer</button>' : '') +
      '</div>' +
    '</div>';
  });
  html += '</div></div>';
  return html;
}

/* --- ONGLET "COMPTES CLIENTS" : indépendant des dossiers KYC, dérivé de
   appState.clientAccounts (table profiles, role='client') — voir
   loadClientAccounts(). Pour CRÉER un nouveau compte : formulaire "Ajouter un
   client" en bas de cet onglet. Pour GÉRER un compte existant (identité,
   documents demandés, justificatifs, bilans, mot de passe, suppression) :
   cliquez sur sa ligne, ça ouvre sa fiche dédiée (renderAccountDetail()). --- */
function renderComptesClientsSection(){
  var html = '<div class="section-title" style="margin-top:0">Comptes existants</div>';
  html += '<div class="card wide" style="margin-bottom:14px">' +
    '<input type="text" placeholder="Rechercher un client (nom, email, conseiller...)" data-action="accountSearchInput" value="'+esc(appState.accountSearch)+'">' +
  '</div>';
  if(appState.clientAccountsError) html += '<div class="err-box">'+esc(appState.clientAccountsError)+'</div>';

  var q = (appState.accountSearch||"").trim().toLowerCase();
  var filtered = !q ? appState.clientAccounts : appState.clientAccounts.filter(function(p){
    var hay = [accountDisplayName(p), p.email, p.advisor_email].join(" ").toLowerCase();
    return hay.indexOf(q) > -1;
  });

  if(!filtered.length){
    html += '<div class="card"><div class="empty-state">'+(appState.clientAccounts.length ? "Aucun compte ne correspond à cette recherche." : "Aucun compte client pour le moment.")+'</div></div>';
  } else {
    html += '<div class="card wide"><div class="sublist">';
    filtered.forEach(function(p){
      html += '<div class="subitem" data-action="openAccount" data-id="'+esc(p.id)+'">' +
        '<div><div class="subitem-name">'+esc(accountDisplayName(p)||"(sans nom)")+'</div>' +
        '<div class="subitem-meta">'+esc(p.email||"")+(p.advisor_email?' · conseiller : '+esc(p.advisor_email):'')+'</div></div>' +
        '<span class="badge badge-recu">'+(p.person_type==="morale"?"Morale":"Physique")+'</span>' +
      '</div>';
    });
    html += '</div></div>';
  }

  html += '<div class="section-title">Ajouter un client</div>';
  html += renderNewClientForm();
  return html;
}

/* Nom d'affichage d'un compte client (profiles) selon son type. */
function accountDisplayName(p){
  if(!p) return "";
  return p.person_type==="morale" ? (p.denomination||"") : ((p.prenom||"")+" "+(p.nom||"")).trim();
}

/* ==========================================================================
   CRÉER UN CLIENT À PARTIR DE RIEN (onglet "Comptes clients")
   C'est la SEULE façon de créer un compte client — indépendamment de tout
   dossier KYC (voir note d'architecture sur appState plus haut). Le
   conseiller renseigne l'identité + email + mot de passe + documents
   demandés, ça crée le compte espace-client (ligne "profiles") tout seul.
   ⚠ LIÉ À createNewClientFromScratch() plus bas ET à
   supabase/functions/create-client-account/index.ts.
   ========================================================================== */
function renderNewClientForm(){
  var advisors = (window.IVO_CONFIG && window.IVO_CONFIG.ADVISORS) || [];
  var currentEmail = appState.session ? appState.session.user.email : "";
  // ⚠ lazy-init : n'écrase jamais une sélection déjà en cours (voir aussi
  // ncPersonTypeChange et createNewClientFromScratch() qui la remet à null
  // après création, pour repartir propre au prochain formulaire).
  if(!appState.newClientDocs) appState.newClientDocs = defaultDocsForType("physique");
  var html = '<div class="card wide">';
  html += '<div class="eyebrow">Indépendant de tout dossier KYC</div>';
  html += '<h2 style="font-size:16px;margin:0 0 4px">Créer un client à partir de rien</h2>';
  html += '<p class="section-sub">Renseignez l\'identité et les identifiants — l\'accès espace client est créé directement, sans créer de dossier KYC. Le client pourra remplir un questionnaire en ligne séparément si besoin.</p>';

  html += '<div class="field-row">' +
    '<div class="field"><label class="flabel">Prénom <span class="opt">(optionnel pour une société)</span></label><input type="text" id="ncPrenom"></div>' +
    '<div class="field"><label class="flabel">Nom / Dénomination</label><input type="text" id="ncNom"></div>' +
  '</div>';
  html += '<div class="field-row">' +
    '<div class="field"><label class="flabel">Email du client</label><input type="email" id="ncEmail"></div>' +
    '<div class="field"><label class="flabel">Téléphone <span class="opt">(optionnel)</span></label><input type="tel" id="ncTelephone"></div>' +
  '</div>';
  html += '<div class="field-row">' +
    '<div class="field"><label class="flabel">Type de client</label><select id="ncPersonType" data-action="ncPersonTypeChange">' +
      '<option value="physique">Personne physique</option>' +
      '<option value="morale">Personne morale</option>' +
    '</select></div>' +
    '<div class="field"><label class="flabel">Conseiller</label><select id="ncAdvisor">' +
      (advisors.length ? advisors.map(function(a){
        return '<option value="'+esc(a.email)+'"'+(a.email===currentEmail?" selected":"")+'>'+esc(a.name)+'</option>';
      }).join("") : '<option value="'+esc(currentEmail)+'">'+esc(currentEmail)+'</option>') +
    '</select></div>' +
  '</div>';

  /* --- DOCUMENTS À DEMANDER (pré-cochés selon le type, modifiables) ---
     ⚠ LIÉ À DOC_TYPES plus haut et à submissions.requested_docs (SQL, section
     8) : la sélection ici devient la liste affichée au client dans son
     onglet "Mes documents" — voir createNewClientFromScratch(). */
  html += '<div class="field"><label class="flabel">Documents à demander à ce client</label></div>';
  html += '<div class="doccheck-grid" id="newClientDocsList">' +
    DOC_TYPES.map(function(t){
      var checked = appState.newClientDocs.indexOf(t.key) > -1;
      return '<label class="doc-check"><input type="checkbox" data-action="toggleNewClientDoc" data-key="'+t.key+'" '+(checked?"checked":"")+'> '+esc(t.label)+'</label>';
    }).join('') +
  '</div>';

  html += '<div class="field"><label class="flabel">Mot de passe de l\'espace client</label><input type="text" id="ncPassword" placeholder="Au moins 8 caractères"></div>';

  html += '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<button type="button" class="btn btn-ghost" data-action="genPasswordNew">Générer un mot de passe</button>' +
    '<button type="button" class="btn btn-primary" data-action="createNewClient">Créer le client</button>' +
  '</div>';

  if(appState.newClientError) html += '<div class="err-box">'+esc(appState.newClientError)+'</div>';
  if(appState.newClientCredentials){
    html += '<div class="info" style="margin-top:10px"><span class="ic">✅</span><div>Client créé — transmettez ces identifiants (par téléphone ou tout autre canal sécurisé, pas par email en clair) :<br><b>'+esc(appState.newClientCredentials.email)+'</b> / <b>'+esc(appState.newClientCredentials.password)+'</b></div></div>';
  }

  html += '</div>';
  return html;
}

/* ==========================================================================
   FICHE DOSSIER CLIENT / DÉTAIL DOSSIER / ONGLETS KYC-DOCUMENTS-BILANS
   ========================================================================== */
function renderDetail(){
  var sub = appState.current;
  var a = sub.answers;
  var aa = appState.advisorAnswers;
  var isMorale = a.personType==="morale";

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">' +
    '<button class="backlink" data-action="backToDashboard" style="margin-bottom:0">← Retour aux dossiers</button>' +
    (!sub.isLocal ? '<button class="btn" style="background:var(--danger-soft);color:var(--danger)" data-action="deleteSubmission">🗑 Supprimer ce dossier</button>' : '') +
  '</div>';
  html += '<div class="card wide" style="margin-top:16px">';
  html += '<div class="eyebrow">Dossier KYC</div>';
  html += '<h1 class="step-title" style="margin-bottom:4px">'+esc(sub.client_name||"(sans nom)")+'</h1>';
  html += '<p class="step-intro">'+esc(sub.client_email||"")+' · reçu le '+fmtDateTime(sub.created_at)+' · '+statusBadge(sub.status)+'</p>';
  if(sub.isLocal){
    html += '<div class="info"><span class="ic">📎</span><div>Dossier importé localement depuis <b>'+esc(sub._sourceFile)+'</b> — il n\'est pas (encore) enregistré dans Supabase. "Générer le PDF final" le téléchargera directement sans le synchroniser au tableau de bord.</div></div>';
  }

  /* ⚠ Un dossier KYC n'a plus d'onglets Documents/Bilans — ces deux
     fonctionnalités appartiennent au COMPTE client (onglet "Comptes
     clients"), indépendamment de tout dossier. Voir note d'architecture sur
     appState plus haut. */
  html += renderKycTab(sub, a, aa, isMorale);

  html += '</div>';
  return html;
}

/* ==========================================================================
   ONGLET DOSSIER KYC / RÉCAPITULATIF / VIGILANCE AML / PROFIL / SIGNATURE
   ========================================================================== */
function renderKycTab(sub, a, aa, isMorale){
  var html = '';

  /* --- ENCART IDENTITÉ (CORRIGIBLE) — corrige une boulette de saisie du
     CLIENT dans son questionnaire (nom, email, téléphone, type). Concerne
     UNIQUEMENT ce dossier KYC — pour corriger l'identité d'un COMPTE client
     (espace-client), voir renderAccountCompteTab() à la place : les deux
     n'ont aucun lien (voir note d'architecture sur appState plus haut).
     ⚠ LIÉ À saveIdentity() plus bas : met à jour à la fois answers.* (utilisé
     par le PDF) et les colonnes client_name/client_email/person_type de
     submissions (utilisées par les listes du tableau de bord). */
  html += '<div class="link-account-box">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center">' +
    '<div style="font-weight:700;font-size:13px">Identité</div>' +
    '<button type="button" class="advisor-toggle" data-action="toggleEditIdentity">'+(appState.editIdentity?'Annuler':'✏️ Corriger')+'</button>' +
  '</div>';
  if(appState.editIdentity){
    html += '<div class="field-row" style="margin-top:10px">' +
      '<div class="field" style="margin-bottom:10px"><label class="flabel">Prénom <span class="opt">(optionnel pour une société)</span></label><input type="text" id="idPrenom" value="'+esc(a.prenom||"")+'"></div>' +
      '<div class="field" style="margin-bottom:10px"><label class="flabel">Nom / Dénomination</label><input type="text" id="idNom" value="'+esc(isMorale ? ((a.morale&&a.morale.denomination)||"") : (a.nom||""))+'"></div>' +
    '</div>';
    html += '<div class="field-row">' +
      '<div class="field" style="margin-bottom:10px"><label class="flabel">Email</label><input type="email" id="idEmail" value="'+esc((a.contact&&a.contact.email)||"")+'"></div>' +
      '<div class="field" style="margin-bottom:10px"><label class="flabel">Téléphone</label><input type="tel" id="idTelephone" value="'+esc((a.contact&&a.contact.telephone)||"")+'"></div>' +
    '</div>';
    html += '<div class="field" style="margin-bottom:10px"><label class="flabel">Type de client</label><select id="idPersonType">' +
      '<option value="physique"'+(!isMorale?" selected":"")+'>Personne physique</option>' +
      '<option value="morale"'+(isMorale?" selected":"")+'>Personne morale</option>' +
    '</select></div>';
    html += '<button type="button" class="btn btn-primary" data-action="saveIdentity">Enregistrer la correction</button>';
    if(appState.identityError) html += '<div class="err-box">'+esc(appState.identityError)+'</div>';
  } else {
    html += '<div class="readonly-grid" style="margin-top:8px">' +
      '<div class="k">Nom complet</div><div class="v">'+esc((isMorale ? (a.morale&&a.morale.denomination) : ((a.prenom||"")+" "+(a.nom||""))) || "—")+'</div>' +
      '<div class="k">Email</div><div class="v">'+esc((a.contact&&a.contact.email)||"—")+'</div>' +
      '<div class="k">Téléphone</div><div class="v">'+esc((a.contact&&a.contact.telephone)||"—")+'</div>' +
    '</div>';
  }
  html += '</div>';

  /* --- RÉCAPITULATIF DES RÉPONSES DU CLIENT (lecture seule) --- */
  html += '<div class="section-title">Récapitulatif des réponses du client</div>';
  html += readonlyGrid(clientSummaryRows(a, isMorale));

  /* --- CRITÈRES DE VIGILANCE RENFORCÉE / AML / LCB-FT --- */
  html += '<div class="section-title">Critères de vigilance renforcée (LCB-FT)</div>';
  html += '<p class="section-sub">À votre appréciation, sur la base de l\'entretien avec le client.</p>';
  AML_ROWS.forEach(function(row){
    var v = aa.aml[row.key];
    html += '<div class="aml-row"><div class="aml-label">'+esc(row.label)+'</div>' +
      '<div class="aml-yn">' +
        '<button class="'+(v===true?"on-oui":"")+'" data-action="amlSet" data-key="'+row.key+'" data-value="true">Oui</button>' +
        '<button class="'+(v===false?"on-non":"")+'" data-action="amlSet" data-key="'+row.key+'" data-value="false">Non</button>' +
      '</div></div>';
  });

  /* --- PROFIL DE RISQUE RETENU PAR IVO --- */
  html += '<div class="section-title">Profil de risque retenu par IVO</div>';
  var suggestion = suggestProfile(a.risque);
  if(suggestion && !aa.profil){
    html += '<p class="section-sub">Profil indicatif calculé à partir des réponses client : <b>'+PROFILES.filter(function(p){return p.key===suggestion;})[0].name+'</b>. À confirmer ci-dessous.</p>';
  }
  PROFILES.forEach(function(p){
    html += '<div class="optcard'+(aa.profil===p.key?" on":"")+'" data-action="set" data-path="profil" data-value="'+p.key+'">' +
      '<div class="ot">'+p.name+'</div><div class="od">'+p.txt+'</div></div>';
  });

  /* --- NOS PRÉCONISATIONS --- */
  html += '<div class="section-title">Nos préconisations</div>';
  PRECONISATIONS_META.forEach(function(p){
    var item = aa.preconisations[p.key];
    html += '<div class="preco-item'+(item.checked?" on":"")+'">' +
      '<label class="preco-head"><input type="checkbox" data-action="precoCheck" data-key="'+p.key+'" '+(item.checked?"checked":"")+'><span>'+esc(p.label)+'</span></label>' +
      (item.checked ? '<textarea placeholder="Précisions / justification (optionnel)" data-action="precoNote" data-key="'+p.key+'">'+esc(item.note)+'</textarea>' : '') +
    '</div>';
  });

  /* --- RECONNAISSANCE DE RÉCEPTION DE DOCUMENTS --- */
  html += '<div class="section-title">Le client reconnaît avoir reçu</div>';
  RECON_META.forEach(function(r){
    html += '<div class="checkline"><input type="checkbox" id="recon-'+r.key+'" data-action="reconCheck" data-key="'+r.key+'" '+(aa.reconnaissance[r.key]?"checked":"")+'>' +
      '<label for="recon-'+r.key+'">'+esc(r.label)+'</label></div>';
  });

  /* --- LIEU / DATE DE SIGNATURE --- */
  html += '<div class="field-row" style="margin-top:20px">' +
    '<div class="field"><label class="flabel">Lieu de signature</label><input type="text" data-action="setText" data-key="lieu" value="'+esc(aa.lieu)+'"></div>' +
    '<div class="field"><label class="flabel">Date de signature</label><input type="date" data-action="setText" data-key="date" value="'+esc(aa.date)+'"></div>' +
  '</div>';

  /* --- BLOC FINAL / GÉNÉRATION DU PDF COMPLET --- */
  html += '<div class="finalbox">' +
    '<div class="finalbox-title">'+(sub.status==="complete"?"Dossier complété":"Finaliser le dossier")+'</div>' +
    '<p class="finalbox-text">Génère le PDF officiel complet (partie client + partie IVO) et le dépose dans le dossier.</p>' +
    '<button class="btn btn-primary btn-large" data-action="generateFinal">📄 '+(sub.status==="complete"?"Régénérer le PDF final":"Générer le PDF final")+'</button>' +
    '<div id="detailError"></div>' +
  '</div>';

  return html;
}

/* ==========================================================================
   FICHE COMPTE CLIENT / DÉTAIL COMPTE / ONGLETS COMPTE-JUSTIFICATIFS-BILANS
   ⚠ Indépendante de la fiche dossier KYC (renderDetail() plus haut) — voir
   note d'architecture sur appState tout en haut du fichier. Ouverte via
   openAccount(), depuis l'onglet "Comptes clients".
   ========================================================================== */
function renderAccountDetail(){
  var acc = appState.currentAccount;

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">' +
    '<button class="backlink" data-action="backToAccounts" style="margin-bottom:0">← Retour aux comptes clients</button>' +
    '<button class="btn" style="background:var(--danger-soft);color:var(--danger)" data-action="deleteClientAccount">🗑 Supprimer ce compte</button>' +
  '</div>';
  html += '<div class="card wide" style="margin-top:16px">';
  html += '<div class="eyebrow">Compte client</div>';
  html += '<h1 class="step-title" style="margin-bottom:4px">'+esc(accountDisplayName(acc)||"(sans nom)")+'</h1>';
  html += '<p class="step-intro">'+esc(acc.email||"")+'</p>';

  html += '<div class="tabrow">' +
    '<button class="tabbtn '+(appState.accountTab==="compte"?"on":"")+'" data-action="accountTab" data-tab="compte">Compte</button>' +
    '<button class="tabbtn '+(appState.accountTab==="documents"?"on":"")+'" data-action="accountTab" data-tab="documents">Justificatifs'+(appState.documents.length?' ('+appState.documents.length+')':'')+'</button>' +
    '<button class="tabbtn '+(appState.accountTab==="bilans"?"on":"")+'" data-action="accountTab" data-tab="bilans">Bilans'+(appState.reports.length?' ('+appState.reports.length+')':'')+'</button>' +
  '</div>';

  if(appState.accountTab==="documents") html += renderDocumentsTab(acc);
  else if(appState.accountTab==="bilans") html += renderBilansTab(acc);
  else html += renderAccountCompteTab(acc);

  html += '</div>';
  return html;
}

function renderAccountCompteTab(acc){
  var isMorale = acc.person_type==="morale";
  var html = '';

  /* --- IDENTITÉ DU COMPTE (distincte de l'identité d'un dossier KYC) --- */
  html += '<div class="link-account-box">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center">' +
    '<div style="font-weight:700;font-size:13px">Identité</div>' +
    '<button type="button" class="advisor-toggle" data-action="toggleEditAccountIdentity">'+(appState.editAccountIdentity?'Annuler':'✏️ Corriger')+'</button>' +
  '</div>';
  if(appState.editAccountIdentity){
    html += '<div class="field-row" style="margin-top:10px">' +
      '<div class="field" style="margin-bottom:10px"><label class="flabel">Prénom <span class="opt">(optionnel pour une société)</span></label><input type="text" id="accPrenom" value="'+esc(acc.prenom||"")+'"></div>' +
      '<div class="field" style="margin-bottom:10px"><label class="flabel">Nom / Dénomination</label><input type="text" id="accNom" value="'+esc(isMorale ? (acc.denomination||"") : (acc.nom||""))+'"></div>' +
    '</div>';
    html += '<div class="field-row">' +
      '<div class="field" style="margin-bottom:10px"><label class="flabel">Téléphone</label><input type="tel" id="accTelephone" value="'+esc(acc.telephone||"")+'"></div>' +
      '<div class="field" style="margin-bottom:10px"><label class="flabel">Type de client</label><select id="accPersonType">' +
        '<option value="physique"'+(!isMorale?" selected":"")+'>Personne physique</option>' +
        '<option value="morale"'+(isMorale?" selected":"")+'>Personne morale</option>' +
      '</select></div>' +
    '</div>';
    html += '<div class="advisor-note">L\'email de connexion ('+esc(acc.email||"")+') ne se change pas ici.</div>';
    html += '<button type="button" class="btn btn-primary" data-action="saveAccountIdentity">Enregistrer la correction</button>';
    if(appState.accountIdentityError) html += '<div class="err-box">'+esc(appState.accountIdentityError)+'</div>';
  } else {
    html += '<div class="readonly-grid" style="margin-top:8px">' +
      '<div class="k">Nom complet</div><div class="v">'+esc(accountDisplayName(acc) || "—")+'</div>' +
      '<div class="k">Email</div><div class="v">'+esc(acc.email||"—")+'</div>' +
      '<div class="k">Téléphone</div><div class="v">'+esc(acc.telephone||"—")+'</div>' +
      '<div class="k">Type</div><div class="v">'+(isMorale?"Personne morale":"Personne physique")+'</div>' +
      '<div class="k">Conseiller</div><div class="v">'+esc(acc.advisor_email||"—")+'</div>' +
    '</div>';
  }
  html += '</div>';

  /* --- DOCUMENTS DEMANDÉS À CE COMPTE ---
     ⚠ LIÉ À espace-client/index.html (fonction requestedDocTypes(), onglet
     "Mes documents") : seuls les types listés dans profiles.requested_docs
     sont affichés au client comme "à fournir". ⚠ LIÉ À DOC_TYPES plus haut et
     à saveRequestedDocs() plus bas. */
  html += '<div class="link-account-box">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center">' +
    '<div style="font-weight:700;font-size:13px">Documents demandés à ce client</div>' +
    '<button type="button" class="advisor-toggle" data-action="toggleEditRequestedDocs">'+(appState.editRequestedDocs?'Annuler':'✏️ Modifier')+'</button>' +
  '</div>';
  if(appState.editRequestedDocs){
    html += '<div class="doccheck-grid" style="margin-top:10px">' +
      DOC_TYPES.map(function(t){
        var checked = appState.requestedDocsDraft.indexOf(t.key) > -1;
        return '<label class="doc-check"><input type="checkbox" data-action="toggleRequestedDoc" data-key="'+t.key+'" '+(checked?"checked":"")+'> '+esc(t.label)+'</label>';
      }).join('') +
    '</div>';
    html += '<button type="button" class="btn btn-primary" style="margin-top:10px" data-action="saveRequestedDocs">Enregistrer la liste</button>';
    if(appState.requestedDocsError) html += '<div class="err-box">'+esc(appState.requestedDocsError)+'</div>';
  } else {
    var currentDocs = (acc.requested_docs && acc.requested_docs.length) ? acc.requested_docs : [];
    html += '<div class="section-sub" style="margin:8px 0 0">' +
      (currentDocs.length ? esc(currentDocs.map(function(k){
        var found = DOC_TYPES.filter(function(t){ return t.key===k; })[0];
        return found ? found.label : k;
      }).join(", ")) : 'Aucun document configuré — le client ne verra rien dans son onglet "Mes documents".') +
    '</div>';
  }
  html += '</div>';

  /* --- ACCÈS / SÉCURITÉ --- */
  html += '<div class="link-account-box">';
  html += '<div style="font-weight:700;font-size:13px;margin-bottom:8px">Accès espace client</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<button type="button" class="btn btn-ghost" data-action="toggleResetPassword">🔑 Réinitialiser le mot de passe</button>' +
  '</div>';
  if(appState.showResetPassword){
    html += '<div class="advisor-panel">';
    html += '<div class="field"><label class="flabel">Nouveau mot de passe</label><input type="text" id="resetPasswordInput" placeholder="Au moins 8 caractères"></div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="btn btn-ghost" data-action="genPasswordReset">Générer</button>' +
      '<button type="button" class="btn btn-primary" data-action="resetClientPassword">Enregistrer le nouveau mot de passe</button>' +
    '</div>';
    if(appState.resetPasswordError) html += '<div class="err-box">'+esc(appState.resetPasswordError)+'</div>';
    if(appState.resetPasswordValue) html += '<div class="info" style="margin-top:8px"><span class="ic">✅</span><div>Nouveau mot de passe à transmettre au client : <b>'+esc(appState.resetPasswordValue)+'</b></div></div>';
    html += '</div>';
  }
  if(appState.deleteAccountError) html += '<div class="err-box">'+esc(appState.deleteAccountError)+'</div>';
  html += '</div>';

  return html;
}

/* ==========================================================================
   ONGLET JUSTIFICATIFS D'UN COMPTE / VALIDATION-REFUS
   ========================================================================== */
function renderDocumentsTab(acc){
  /* --- DÉPÔT D'UN DOCUMENT AU NOM DU CLIENT (upload conseiller) --- */
  var html = '<div class="doc-uploadbox" style="margin-top:16px">' +
    '<div style="flex-grow:1"><div class="import-title">Déposer un document au nom du client</div>' +
    '<div class="import-sub">Utile si le client vous a transmis un justificatif autrement (email, papier).</div>' +
    '<select id="advisorDocType" style="margin-top:8px;max-width:260px">' +
      DOC_TYPES.map(function(t){ return '<option value="'+t.key+'">'+esc(t.label)+'</option>'; }).join('') +
    '</select></div>' +
    '<label class="btn btn-primary" style="cursor:pointer;flex-shrink:0">Choisir un fichier' +
      '<input type="file" id="advisorDocInput" data-action="advisorUploadDoc" style="display:none">' +
    '</label>' +
  '</div>';
  if(appState.docError) html += '<div class="err-box">'+esc(appState.docError)+'</div>';
  if(!appState.documents.length){
    html += '<div class="empty-state">Aucun document transmis pour le moment.</div>';
    return html;
  }
  /* --- LISTE DES DOCUMENTS DÉJÀ TRANSMIS + BOUTONS VALIDER-REFUSER-SUPPRIMER --- */
  html += '<div class="sublist">';
  appState.documents.forEach(function(d){
    var typeLabel = (DOC_TYPES.filter(function(t){return t.key===d.doc_type;})[0]||{}).label || d.doc_type;
    html += '<div class="subitem" style="cursor:default">' +
      '<div><div class="subitem-name">'+esc(typeLabel)+'</div>' +
      '<div class="subitem-meta">'+esc(d.file_name||"")+' · reçu le '+fmtDateTime(d.uploaded_at)+'</div></div>' +
      docStatusBadge(d.status) +
      '<div class="docrow-actions">' +
        '<button class="btn btn-ghost" data-action="docView" data-id="'+esc(d.id)+'">Voir</button>' +
        (d.status!=="valide" ? '<button class="btn btn-primary" data-action="docValidate" data-id="'+esc(d.id)+'">Valider</button>' : '') +
        (d.status!=="refuse" ? '<button class="btn" style="background:var(--danger-soft);color:var(--danger)" data-action="docRefuse" data-id="'+esc(d.id)+'">Refuser</button>' : '') +
        '<button class="btn" style="background:var(--danger-soft);color:var(--danger)" data-action="docDelete" data-id="'+esc(d.id)+'">Supprimer</button>' +
      '</div>' +
    '</div>';
  });
  html += '</div>';
  return html;
}

/* ==========================================================================
   ONGLET BILANS D'UN COMPTE / COMPTES RENDUS / ENVOI DE RAPPORT AU CLIENT
   ========================================================================== */
function renderBilansTab(acc){
  /* --- AJOUT D'UN NOUVEAU BILAN (upload conseiller) --- */
  var html = '<div class="doc-uploadbox" style="margin-top:16px">' +
    '<div style="flex-grow:1"><div class="import-title">Ajouter un bilan / compte rendu</div>' +
    '<div class="import-sub">Le fichier sera immédiatement visible par le client dans son espace personnel.</div></div>' +
    '<label class="btn btn-primary" style="cursor:pointer;flex-shrink:0">Choisir un fichier' +
      '<input type="file" id="reportFileInput" data-action="reportUpload" style="display:none">' +
    '</label>' +
  '</div>';
  if(appState.reportError) html += '<div class="err-box">'+esc(appState.reportError)+'</div>';
  if(!appState.reports.length){
    html += '<div class="empty-state">Aucun bilan envoyé pour le moment.</div>';
    return html;
  }
  /* --- LISTE DES BILANS DÉJÀ ENVOYÉS + BOUTON SUPPRIMER --- */
  html += '<div class="sublist">';
  appState.reports.forEach(function(r){
    html += '<div class="subitem" style="cursor:default">' +
      '<div><div class="subitem-name">'+esc(r.title)+'</div>' +
      '<div class="subitem-meta">Envoyé le '+fmtDateTime(r.sent_at)+'</div></div>' +
      '<div class="docrow-actions">' +
        '<button class="btn btn-ghost" data-action="reportView" data-id="'+esc(r.id)+'">Voir</button>' +
        '<button class="btn" style="background:var(--danger-soft);color:var(--danger)" data-action="reportDelete" data-id="'+esc(r.id)+'">Supprimer</button>' +
      '</div>' +
    '</div>';
  });
  html += '</div>';
  return html;
}

/* ==========================================================================
   TABLEAU RÉCAP LECTURE SEULE / GRILLE CLÉ-VALEUR
   ========================================================================== */
function readonlyGrid(rows){
  var html = '<div class="readonly-grid">';
  rows.forEach(function(r){
    html += '<div class="k">'+esc(r[0])+'</div><div class="v">'+(r[1]||"—")+'</div>';
  });
  html += '</div>';
  return html;
}

/* --- LISTE DES LIGNES DU RÉCAPITULATIF CLIENT (identité, patrimoine, ESG, etc.) --- */
function clientSummaryRows(a, isMorale){
  var rows = [];
  if(!isMorale){
    rows.push(["Nom complet", esc((a.prenom||"")+" "+(a.nom||""))]);
    rows.push(["Date de naissance", esc(a.dateNaissance)]);
    rows.push(["Situation de famille", esc(a.situationFamille)]);
    rows.push(["Profession", esc(a.profession)]);
  } else {
    rows.push(["Société", esc(a.morale && a.morale.denomination)]);
    rows.push(["Forme juridique", esc(a.morale && a.morale.formeJuridique)]);
  }
  rows.push(["Email", esc(a.contact && a.contact.email)]);
  rows.push(["Téléphone", esc(a.contact && a.contact.telephone)]);
  rows.push(["PPE (vous)", yn(a.ppe && a.ppe.vous)]);
  rows.push(["PPE (entourage)", yn(a.ppe && a.ppe.famille)]);
  rows.push(["Montant envisagé", a.fonds && a.fonds.montant ? fmt(a.fonds.montant)+" €" : "—"]);
  var pTotal = 0;
  var src = isMorale ? a.pm : a.pp;
  if(src){ for(var k in src){ pTotal += n(src[k]); } }
  rows.push(["Patrimoine total estimé", pTotal ? fmt(pTotal)+" K€" : "—"]);
  rows.push(["Gère seul son portefeuille", yn(a.gereSeul)]);
  rows.push(["Expérience professionnelle finance", yn(a.experiencePro)]);
  var hMap = {court:"Court terme",moyen:"Moyen terme",long:"Long terme",tlong:"Très long terme"};
  rows.push(["Horizon d'investissement", a.horizon ? hMap[a.horizon] : "—"]);
  var perteMap={p1:"Jusqu'à 10 000€",p2:"Jusqu'à 20 000€",p3:"Jusqu'à 30 000€",p4:"Plus de 30 000€"};
  rows.push(["Perte acceptée sur 100 000€", a.risque && a.risque.perte ? perteMap[a.risque.perte] : "—"]);
  var incMap={oui:"Oui",non:"Non",nonExprime:"Ne s'est pas exprimé"};
  rows.push(["Préférences ESG", a.esg && a.esg.inclure ? incMap[a.esg.inclure] : "—"]);
  return rows;
}

/* ==========================================================================
   VÉRIFICATION DU RÔLE / GARDE-FOU CONSEILLER
   ⚠ SÉCURITÉ CRITIQUE : client.auth.signInWithPassword() réussit pour
   N'IMPORTE QUEL compte Supabase valide, y compris un compte client créé pour
   l'espace-client. Les policies RLS limitent ce qu'un tel compte pourrait lire
   une fois "dedans", mais l'interface conseiller elle-même ne doit JAMAIS
   s'afficher pour un compte qui n'est pas role='advisor' dans "profiles".
   Cette fonction est LE garde-fou — appelée à la fois par init() (session déjà
   ouverte, ex: retour sur la page) et par doLogin() (connexion à l'instant) ;
   ne jamais passer appState.view="dashboard" sans être passé par elle avant.
   ========================================================================== */
async function verifyAdvisorRole(client, userId){
  var { data, error } = await client.from("profiles").select("role").eq("id", userId).maybeSingle();
  if(error) throw new Error("Impossible de vérifier le rôle du compte : " + error.message);
  return !!data && data.role === "advisor";
}

/* ==========================================================================
   INITIALISATION / DÉMARRAGE APPLICATION / SESSION SUPABASE
   ========================================================================== */
async function init(){
  try{
    var client = getClient();
    var { data } = await client.auth.getSession();
    if(data.session){
      var isAdvisor = await verifyAdvisorRole(client, data.session.user.id);
      if(!isAdvisor){
        await client.auth.signOut();
        appState.session = null;
        appState.view = "login";
        appState.loginError = "Ce compte n'est pas un compte conseiller — accès refusé.";
        render();
        return;
      }
    }
    appState.session = data.session;
    appState.view = data.session ? "dashboard" : "login";
    render();
    if(data.session){ loadSubmissions(); loadClientAccounts(); }
    client.auth.onAuthStateChange(function(event, session){
      appState.session = session;
      if(!session){ appState.view = "login"; render(); }
    });
  }catch(err){
    appState.view = "login";
    appState.loginError = err.message;
    render();
  }
}

/* ==========================================================================
   CHARGEMENT DES DONNÉES / REQUÊTES SUPABASE / DOSSIERS-DOCUMENTS-BILANS
   ========================================================================== */
async function loadSubmissions(){
  appState.listError = "";
  try{
    var client = getClient();
    var { data, error } = await client.from("submissions").select("*").order("created_at",{ascending:false});
    if(error) throw new Error(error.message);
    appState.submissions = data || [];
    // ⚠ doit s'exécuter APRÈS avoir rempli appState.submissions : loadAllDocuments()
    // s'appuie dessus pour fabriquer les lignes "PDF" (pdf_client_path/pdf_final_path).
    await loadAllDocuments();
  }catch(err){
    appState.listError = "Impossible de charger les dossiers : " + err.message;
  }
  render();
}

/* --- Alimente l'onglet "Justificatifs" du tableau de bord : combine TOUS les
   documents (client_documents, tous COMPTES confondus, avec le nom du client
   récupéré via la relation profiles()) ET les PDF "de mise en relation" déjà
   présents dans submissions (pdf_client_path = questionnaire initial,
   pdf_final_path = dossier complet) — ces deux PDF restent liés au dossier
   KYC (ce sont des captures du questionnaire, pas des documents du compte).
   ⚠ LIÉ À DOC_TYPES (pour le libellé) et à renderJustificatifsSection() plus haut. --- */
async function loadAllDocuments(){
  appState.allDocsError = "";
  try{
    var client = getClient();
    var { data: docs, error } = await client
      .from("client_documents")
      .select("*, profiles(nom, prenom, denomination, email, person_type)")
      .order("uploaded_at",{ascending:false});
    if(error) throw new Error(error.message);

    var combined = (docs||[]).map(function(d){
      var typeLabel = (DOC_TYPES.filter(function(t){return t.key===d.doc_type;})[0]||{}).label || d.doc_type;
      var p = d.profiles;
      return {
        id: d.id, kind:"doc", label: typeLabel, fileName: d.file_name, storage_path: d.storage_path,
        status: d.status, date: d.uploaded_at, clientId: d.client_id,
        clientName: p ? accountDisplayName(p) : "",
        clientEmail: p ? p.email : "",
      };
    });

    appState.submissions.forEach(function(s){
      if(s.pdf_client_path){
        combined.push({
          id: s.id+"-client", kind:"pdf_client", label:"Questionnaire initial (PDF)",
          fileName:null, storage_path:s.pdf_client_path, status:null,
          date:s.created_at, submissionId:s.id, clientName:s.client_name, clientEmail:s.client_email,
        });
      }
      if(s.pdf_final_path){
        combined.push({
          id: s.id+"-final", kind:"pdf_final", label:"Dossier complet (PDF)",
          fileName:null, storage_path:s.pdf_final_path, status:null,
          date:s.updated_at||s.created_at, submissionId:s.id, clientName:s.client_name, clientEmail:s.client_email,
        });
      }
    });

    combined.sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
    appState.allDocuments = combined;
  }catch(err){
    appState.allDocsError = "Impossible de charger les documents : " + err.message;
  }
}

/* ⚠ "documents"/"reports" du COMPTE client (client_id = profiles.id), jamais
   d'un dossier KYC — voir note d'architecture sur appState tout en haut. */
async function loadDocuments(clientId){
  try{
    var client = getClient();
    var { data, error } = await client.from("client_documents").select("*").eq("client_id", clientId).order("uploaded_at",{ascending:false});
    if(error) throw new Error(error.message);
    appState.documents = data || [];
  }catch(err){
    appState.docError = "Impossible de charger les documents : " + err.message;
  }
}

async function loadReports(clientId){
  try{
    var client = getClient();
    var { data, error } = await client.from("client_reports").select("*").eq("client_id", clientId).order("sent_at",{ascending:false});
    if(error) throw new Error(error.message);
    appState.reports = data || [];
  }catch(err){
    appState.reportError = "Impossible de charger les bilans : " + err.message;
  }
}

/* --- Alimente l'onglet "Comptes clients" — indépendant des dossiers KYC. --- */
async function loadClientAccounts(){
  appState.clientAccountsError = "";
  try{
    var client = getClient();
    var { data, error } = await client.from("profiles").select("*").eq("role","client").order("created_at",{ascending:false});
    if(error) throw new Error(error.message);
    appState.clientAccounts = data || [];
  }catch(err){
    appState.clientAccountsError = "Impossible de charger les comptes clients : " + err.message;
  }
  render();
}

async function openSubmission(id){
  var sub = appState.submissions.filter(function(s){ return s.id===id; })[0];
  if(!sub) return;
  appState.current = sub;
  appState.advisorAnswers = sub.advisor_answers ? JSON.parse(JSON.stringify(sub.advisor_answers)) : defaultAdvisorAnswers();
  var suggestion = suggestProfile(sub.answers.risque);
  if(suggestion && !appState.advisorAnswers.profil) appState.advisorAnswers.profil = suggestion;
  appState.editIdentity = false;
  appState.identityError = "";
  appState.view = "detail";
  render();
}

async function openAccount(id){
  var acc = appState.clientAccounts.filter(function(p){ return p.id===id; })[0];
  if(!acc) return;
  appState.currentAccount = acc;
  appState.accountTab = "compte";
  appState.documents = [];
  appState.reports = [];
  appState.docError = "";
  appState.reportError = "";
  appState.editAccountIdentity = false;
  appState.accountIdentityError = "";
  appState.editRequestedDocs = false;
  appState.requestedDocsError = "";
  appState.showResetPassword = false;
  appState.resetPasswordError = "";
  appState.resetPasswordValue = "";
  appState.deleteAccountError = "";
  appState.view = "accountDetail";
  render();
  await Promise.all([loadDocuments(acc.id), loadReports(acc.id)]);
  render();
}

/* ==========================================================================
   ÉCOUTEURS D'ÉVÉNEMENTS / CLICS / BIND EVENTS / AIGUILLAGE DES ACTIONS
   (tous les boutons/champs "data-action" de l'interface passent par ici)
   ========================================================================== */
function bindEvents(){
  var app = document.getElementById("app");
  var topbar = document.getElementById("topbar");

  [app, topbar].forEach(function(root){
    root.querySelectorAll("[data-action]").forEach(function(el){
      // ⚠ les <select> utilisent "change" (pas "click") pour réagir à un
      // changement de valeur — nécessaire pour ncPersonTypeChange plus bas.
      // Aucun autre <select> du fichier n'a de data-action à ce jour, donc ce
      // choix n'affecte que ce cas précis.
      var evt = (el.tagName==="TEXTAREA" || (el.tagName==="INPUT" && el.type!=="checkbox" && el.type!=="file")) ? "input"
        : (el.tagName==="SELECT") ? "change"
        : "click";
      el.addEventListener(evt, function(e){
        var action = el.getAttribute("data-action");

        /* --- CONNEXION / DÉCONNEXION --- */
        if(action==="login"){
          e.preventDefault();
          doLogin();
          return;
        }
        if(action==="logout"){
          getClient().auth.signOut();
          appState.view="login"; appState.submissions=[]; render();
          return;
        }

        /* --- NAVIGATION TABLEAU DE BORD / OUVERTURE-FERMETURE DOSSIER --- */
        if(action==="refresh"){ loadSubmissions(); loadClientAccounts(); return; }
        if(action==="open"){ openSubmission(el.getAttribute("data-id")); return; }
        if(action==="backToDashboard"){ appState.view="dashboard"; appState.current=null; render(); return; }
        if(action==="deleteSubmission"){ deleteSubmission(); return; }

        /* --- NAVIGATION DES ONGLETS DU TABLEAU DE BORD (Documents/Justificatifs/Comptes) --- */
        if(action==="section"){ appState.section = el.getAttribute("data-section"); render(); return; }

        /* --- IDENTITÉ DU DOSSIER KYC (answers/client_name — pas le compte) --- */
        if(action==="toggleEditIdentity"){ appState.editIdentity = !appState.editIdentity; appState.identityError = ""; render(); return; }
        if(action==="saveIdentity"){ saveIdentity(); return; }

        /* --- COMPTES CLIENTS : ouverture / retour / recherche / création --- */
        if(action==="openAccount"){ openAccount(el.getAttribute("data-id")); return; }
        if(action==="backToAccounts"){ appState.view="dashboard"; appState.section="comptes"; appState.currentAccount=null; render(); return; }
        if(action==="accountTab"){ appState.accountTab = el.getAttribute("data-tab"); render(); return; }
        if(action==="accountSearchInput"){ appState.accountSearch = el.value; render(); return; }
        if(action==="genPasswordNew"){ document.getElementById("ncPassword").value = generateStrongPassword(); return; }
        if(action==="createNewClient"){ createNewClientFromScratch(); return; }

        /* --- FICHE COMPTE : identité, documents demandés, accès --- */
        if(action==="toggleEditAccountIdentity"){ appState.editAccountIdentity = !appState.editAccountIdentity; appState.accountIdentityError = ""; render(); return; }
        if(action==="saveAccountIdentity"){ saveAccountIdentity(); return; }
        if(action==="toggleResetPassword"){ appState.showResetPassword = !appState.showResetPassword; appState.resetPasswordError = ""; appState.resetPasswordValue = ""; render(); return; }
        if(action==="genPasswordReset"){ document.getElementById("resetPasswordInput").value = generateStrongPassword(); return; }
        if(action==="resetClientPassword"){ resetClientPassword(); return; }
        if(action==="deleteClientAccount"){ deleteClientAccount(); return; }
        if(action==="ncPersonTypeChange"){
          // ⚠ met à jour SEULEMENT l'état + les cases déjà présentes dans le
          // DOM (pas de render() complet) pour ne pas effacer ce que le
          // conseiller a déjà tapé dans les autres champs du formulaire, qui
          // ne sont pas "contrôlés" (pas de value="" lié à appState).
          var newDefaults = defaultDocsForType(el.value);
          appState.newClientDocs = newDefaults;
          var ncBox = document.getElementById("newClientDocsList");
          if(ncBox){
            ncBox.querySelectorAll("input[type=checkbox]").forEach(function(cb){
              cb.checked = newDefaults.indexOf(cb.getAttribute("data-key")) > -1;
            });
          }
          return;
        }
        if(action==="toggleNewClientDoc"){
          var ncKey = el.getAttribute("data-key");
          var ncIdx = appState.newClientDocs.indexOf(ncKey);
          if(el.checked && ncIdx===-1) appState.newClientDocs.push(ncKey);
          else if(!el.checked && ncIdx>-1) appState.newClientDocs.splice(ncIdx,1);
          return; // pas de render() — la case reflète déjà son propre état
        }
        if(action==="toggleEditRequestedDocs"){
          if(!appState.editRequestedDocs){
            var accForDocs = appState.currentAccount;
            appState.requestedDocsDraft = (accForDocs.requested_docs && accForDocs.requested_docs.length)
              ? accForDocs.requested_docs.slice()
              : defaultDocsForType(accForDocs.person_type || "physique");
            appState.requestedDocsError = "";
          }
          appState.editRequestedDocs = !appState.editRequestedDocs;
          render();
          return;
        }
        if(action==="toggleRequestedDoc"){
          var rdKey = el.getAttribute("data-key");
          var rdIdx = appState.requestedDocsDraft.indexOf(rdKey);
          if(el.checked && rdIdx===-1) appState.requestedDocsDraft.push(rdKey);
          else if(!el.checked && rdIdx>-1) appState.requestedDocsDraft.splice(rdIdx,1);
          return;
        }
        if(action==="saveRequestedDocs"){ saveRequestedDocs(); return; }

        /* --- DOCUMENTS (dans la fiche d'un compte précis) : VALIDER / REFUSER / VOIR / SUPPRIMER / DÉPOSER --- */
        if(action==="docValidate"){ setDocStatus(el.getAttribute("data-id"), "valide"); return; }
        if(action==="docRefuse"){ setDocStatus(el.getAttribute("data-id"), "refuse"); return; }
        if(action==="docDelete"){ deleteDocument(el.getAttribute("data-id")); return; }
        if(action==="docView"){ viewFile("client-documents", el.getAttribute("data-id"), appState.documents); return; }

        /* --- DOCUMENTS (onglet global "Documents", tous les clients) --- */
        if(action==="docValidateG"){ setDocStatusGlobal(el.getAttribute("data-id"), "valide"); return; }
        if(action==="docRefuseG"){ setDocStatusGlobal(el.getAttribute("data-id"), "refuse"); return; }
        if(action==="docDeleteG"){ deleteDocumentGlobal(el.getAttribute("data-id")); return; }
        if(action==="docViewG"){ viewFile("client-documents", el.getAttribute("data-id"), appState.allDocuments); return; }
        if(action==="pdfViewG"){ viewFile("submissions", el.getAttribute("data-id"), appState.allDocuments); return; }
        if(action==="advisorUploadDoc"){
          if(el.files && el.files[0]){
            var typeSel = document.getElementById("advisorDocType");
            advisorUploadDocument(typeSel ? typeSel.value : "autre", el.files[0]);
          }
          return;
        }

        /* --- BILANS : VOIR / ENVOYER / SUPPRIMER --- */
        if(action==="reportView"){ viewFile("client-reports", el.getAttribute("data-id"), appState.reports); return; }
        if(action==="reportDelete"){ deleteReport(el.getAttribute("data-id")); return; }
        if(action==="reportUpload"){
          if(el.files && el.files[0]) uploadReport(el.files[0]);
          return;
        }

        /* --- FORMULAIRE PARTIE CONSEILLER : AML / PROFIL / PRÉCONISATIONS / RECONNAISSANCE --- */
        if(action==="amlSet"){
          var key = el.getAttribute("data-key");
          appState.advisorAnswers.aml[key] = el.getAttribute("data-value")==="true";
          render();
          return;
        }
        if(action==="set"){
          appState.advisorAnswers[el.getAttribute("data-path")] = el.getAttribute("data-value");
          render();
          return;
        }
        if(action==="precoCheck"){
          var k = el.getAttribute("data-key");
          appState.advisorAnswers.preconisations[k].checked = el.checked;
          render();
          return;
        }
        if(action==="precoNote"){
          var k2 = el.getAttribute("data-key");
          appState.advisorAnswers.preconisations[k2].note = el.value;
          return; // no re-render needed, avoid losing focus while typing
        }
        if(action==="reconCheck"){
          appState.advisorAnswers.reconnaissance[el.getAttribute("data-key")] = el.checked;
          return;
        }
        if(action==="setText"){
          appState.advisorAnswers[el.getAttribute("data-key")] = el.value;
          return;
        }

        /* --- GÉNÉRATION PDF FINAL / IMPORT MANUEL D'UN PDF --- */
        if(action==="generateFinal"){
          generateFinalPdf(el);
          return;
        }
        if(action==="importPdf"){
          if(el.files && el.files[0]) handleImportFile(el.files[0]);
          return;
        }
      });
    });
  });

  /* --- GLISSER-DÉPOSER / DRAG AND DROP DU PDF IMPORTÉ MANUELLEMENT --- */
  var dz = document.getElementById("importDropzone");
  if(dz){
    ["dragenter","dragover"].forEach(function(evt){
      dz.addEventListener(evt, function(e){ e.preventDefault(); dz.classList.add("drag-over"); });
    });
    ["dragleave","drop"].forEach(function(evt){
      dz.addEventListener(evt, function(e){ e.preventDefault(); dz.classList.remove("drag-over"); });
    });
    dz.addEventListener("drop", function(e){
      var file = e.dataTransfer.files && e.dataTransfer.files[0];
      if(file) handleImportFile(file);
    });
  }
}

/* ==========================================================================
   CORRIGER UNE BOULETTE DE SAISIE (nom, email, téléphone, type de client)
   ⚠ LIÉ AU RENDU dans renderKycTab() (encart "Identité") plus haut. Met à
   jour à la fois answers.* (lu par lib/pdf-fill.js pour le PDF officiel) et
   les colonnes client_name/client_email/person_type de submissions (lues par
   les listes du tableau de bord et l'onglet Comptes clients) — les deux
   doivent rester synchronisés, d'où la mise à jour groupée ci-dessous.
   ========================================================================== */
async function saveIdentity(){
  appState.identityError = "";
  var prenom = document.getElementById("idPrenom").value.trim();
  var nom = document.getElementById("idNom").value.trim();
  var email = document.getElementById("idEmail").value.trim();
  var telephone = document.getElementById("idTelephone").value.trim();
  var personType = document.getElementById("idPersonType").value;

  if(!nom || !email){
    appState.identityError = "Nom/Dénomination et email sont obligatoires.";
    render();
    return;
  }

  try{
    var client = getClient();
    var sub = appState.current;
    var a = sub.answers;
    var before = { client_name: sub.client_name, client_email: sub.client_email, person_type: sub.person_type };
    a.personType = personType;
    a.nom = nom;
    a.prenom = prenom;
    a.morale = a.morale || {};
    if(personType==="morale") a.morale.denomination = nom;
    a.contact = a.contact || {};
    a.contact.email = email;
    a.contact.telephone = telephone;

    var clientName = personType==="morale" ? nom : (prenom+" "+nom).trim();
    var update = await client.from("submissions").update({
      answers: a,
      client_name: clientName,
      client_email: email,
      person_type: personType,
    }).eq("id", sub.id);
    if(update.error) throw new Error(update.error.message);

    sub.client_name = clientName;
    sub.client_email = email;
    sub.person_type = personType;
    appState.editIdentity = false;
    logAudit("edit_identity", "submission", sub.id, { before: before, after: { client_name: clientName, client_email: email, person_type: personType } });
    showToast("Identité corrigée ✓");
    render();
  }catch(err){
    appState.identityError = err.message;
    render();
  }
}

/* ==========================================================================
   ENREGISTRER LA LISTE "DOCUMENTS DEMANDÉS" D'UN DOSSIER
   ⚠ LIÉ À espace-client/index.html (requestedDocTypes()) : c'est cette
   colonne que lit le client pour savoir quels documents lui sont demandés.
   ========================================================================== */
async function saveRequestedDocs(){
  appState.requestedDocsError = "";
  try{
    var client = getClient();
    var acc = appState.currentAccount;
    var before = (acc.requested_docs || []).slice();
    var after = appState.requestedDocsDraft.slice();
    var update = await client.from("profiles").update({ requested_docs: after }).eq("id", acc.id);
    if(update.error) throw new Error(update.error.message);
    acc.requested_docs = after;
    appState.editRequestedDocs = false;
    logAudit("edit_requested_docs", "auth_user", acc.id, { before: before, after: after });
    showToast("Documents demandés mis à jour ✓");
    render();
  }catch(err){
    appState.requestedDocsError = err.message;
    render();
  }
}

/* ==========================================================================
   CORRIGER L'IDENTITÉ D'UN COMPTE CLIENT (nom, prénom/dénomination,
   téléphone, type) — distinct de saveIdentity() qui corrige l'identité d'un
   DOSSIER KYC. L'email de connexion n'est volontairement pas modifiable ici
   (il faudrait une fonction Edge dédiée pour changer l'email Auth, non
   construite pour l'instant).
   ========================================================================== */
async function saveAccountIdentity(){
  appState.accountIdentityError = "";
  var prenom = document.getElementById("accPrenom").value.trim();
  var nom = document.getElementById("accNom").value.trim();
  var telephone = document.getElementById("accTelephone").value.trim();
  var personType = document.getElementById("accPersonType").value;
  if(!nom){
    appState.accountIdentityError = "Nom/Dénomination obligatoire.";
    render();
    return;
  }
  try{
    var client = getClient();
    var acc = appState.currentAccount;
    var before = { nom: acc.nom, prenom: acc.prenom, denomination: acc.denomination, telephone: acc.telephone, person_type: acc.person_type };
    var payload = { person_type: personType, telephone: telephone };
    if(personType==="morale"){ payload.denomination = nom; payload.nom = null; payload.prenom = null; }
    else { payload.nom = nom; payload.prenom = prenom; payload.denomination = null; }
    var update = await client.from("profiles").update(payload).eq("id", acc.id);
    if(update.error) throw new Error(update.error.message);
    Object.assign(acc, payload);
    appState.editAccountIdentity = false;
    logAudit("edit_account_identity", "auth_user", acc.id, { before: before, after: payload });
    showToast("Identité du compte corrigée ✓");
    render();
  }catch(err){
    appState.accountIdentityError = err.message;
    render();
  }
}

/* --- Génère un mot de passe temporaire lisible (sans caractères ambigus
   0/O, 1/l/I) à transmettre au client. Purement côté client, aucun appel
   réseau. --- */
function generateStrongPassword(){
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  var out = "";
  for(var i=0;i<12;i++){ out += chars.charAt(Math.floor(Math.random()*chars.length)); }
  return out;
}

/* ==========================================================================
   RÉINITIALISER LE MOT DE PASSE D'UN COMPTE CLIENT EXISTANT
   ⚠ LIÉ À supabase/functions/reset-client-password/index.ts.
   ========================================================================== */
async function resetClientPassword(){
  appState.resetPasswordError = "";
  var password = document.getElementById("resetPasswordInput").value;
  if(!password || password.length < 8){
    appState.resetPasswordError = "Le mot de passe doit faire au moins 8 caractères.";
    render();
    return;
  }
  try{
    var client = getClient();
    var acc = appState.currentAccount;
    var fn = await client.functions.invoke("reset-client-password", { body: { userId: acc.id, password: password } });
    if(fn.error){
      var detail = "";
      try{
        if(fn.error.context && typeof fn.error.context.json === "function"){
          var body = await fn.error.context.json();
          detail = body && body.error ? body.error : "";
        }
      }catch(parseErr){}
      throw new Error(detail || fn.error.message || "Réinitialisation impossible.");
    }
    if(fn.data && fn.data.error) throw new Error(fn.data.error);
    appState.resetPasswordValue = password;
    // ⚠ on ne journalise JAMAIS le mot de passe lui-même, juste le fait qu'une réinitialisation a eu lieu.
    logAudit("reset_client_password", "auth_user", acc.id, {});
    showToast("Mot de passe réinitialisé ✓");
    render();
  }catch(err){
    appState.resetPasswordError = err.message;
    render();
  }
}

/* ==========================================================================
   SUPPRIMER DÉFINITIVEMENT UN COMPTE CLIENT
   ⚠ LIÉ À supabase/functions/delete-client-account/index.ts : supprime le
   compte Auth côté serveur, ce qui cascade automatiquement sur la ligne
   "profiles" ET sur ses client_documents/client_reports (on delete cascade,
   voir section 9 du schéma SQL) — on supprime donc d'abord les FICHIERS de
   stockage ici (le storage n'est jamais nettoyé par un "on delete cascade"
   SQL), puis on appelle la fonction Edge qui fait tout le reste.
   ========================================================================== */
async function deleteClientAccount(){
  appState.deleteAccountError = "";
  var acc = appState.currentAccount;
  if(!window.confirm("Supprimer définitivement le compte de "+(accountDisplayName(acc)||"ce client")+" ? Le client ne pourra plus se connecter, et ses documents/bilans seront perdus. Cette action est irréversible.")) return;
  try{
    var client = getClient();

    var docPaths = appState.documents.map(function(d){ return d.storage_path; });
    var reportPaths = appState.reports.map(function(r){ return r.storage_path; });
    if(docPaths.length) await client.storage.from("client-documents").remove(docPaths);
    if(reportPaths.length) await client.storage.from("client-reports").remove(reportPaths);

    var fn = await client.functions.invoke("delete-client-account", { body: { userId: acc.id } });
    if(fn.error){
      var detail = "";
      try{
        if(fn.error.context && typeof fn.error.context.json === "function"){
          var body = await fn.error.context.json();
          detail = body && body.error ? body.error : "";
        }
      }catch(parseErr){}
      throw new Error(detail || fn.error.message || "Suppression du compte échouée.");
    }
    if(fn.data && fn.data.error) throw new Error(fn.data.error);

    logAudit("delete_client_account", "auth_user", acc.id, { email: acc.email, name: accountDisplayName(acc) });
    showToast("Compte client supprimé");
    appState.view = "dashboard";
    appState.section = "comptes";
    appState.currentAccount = null;
    await loadClientAccounts();
  }catch(err){
    appState.deleteAccountError = err.message;
    render();
  }
}

/* ==========================================================================
   CRÉER UN COMPTE CLIENT (seule façon d'en créer un — jamais de dossier KYC)
   ⚠ LIÉ À renderNewClientForm() plus haut ET à
   supabase/functions/create-client-account/index.ts — cette fonction Edge
   fait le travail sensible (créer un utilisateur Supabase Auth) côté serveur,
   avec la clé service_role, jamais exposée au navigateur. Ici on ne fait
   qu'appeler cette fonction puis créer la ligne "profiles" (le compte).
   ========================================================================== */
async function createNewClientFromScratch(){
  appState.newClientError = "";
  var prenom = document.getElementById("ncPrenom").value.trim();
  var nom = document.getElementById("ncNom").value.trim();
  var email = document.getElementById("ncEmail").value.trim();
  var telephone = document.getElementById("ncTelephone").value.trim();
  var personType = document.getElementById("ncPersonType").value;
  var advisorEmail = document.getElementById("ncAdvisor").value;
  var password = document.getElementById("ncPassword").value;

  if(!nom || !email || !password){
    appState.newClientError = "Nom/Dénomination, email et mot de passe sont obligatoires.";
    render();
    return;
  }
  if(password.length < 8){
    appState.newClientError = "Le mot de passe doit faire au moins 8 caractères.";
    render();
    return;
  }

  try{
    var client = getClient();
    var fn = await client.functions.invoke("create-client-account", { body: { email: email, password: password } });
    if(fn.error){
      var detail = "";
      try{
        if(fn.error.context && typeof fn.error.context.json === "function"){
          var body = await fn.error.context.json();
          detail = body && body.error ? body.error : "";
        }
      }catch(parseErr){ /* pas grave, on retombe sur le message générique */ }
      throw new Error(detail || fn.error.message || "création impossible.");
    }
    if(fn.data && fn.data.error) throw new Error(fn.data.error);
    var uuid = fn.data && fn.data.userId;
    if(!uuid) throw new Error("Réponse inattendue du serveur (aucun identifiant retourné).");

    var requestedDocs = appState.newClientDocs || defaultDocsForType(personType);
    var upsertProfile = await client.from("profiles").upsert({
      id: uuid,
      role: "client",
      email: email,
      nom: personType==="morale" ? null : nom,
      prenom: personType==="morale" ? null : prenom,
      denomination: personType==="morale" ? nom : null,
      telephone: telephone,
      person_type: personType,
      advisor_email: advisorEmail,
      requested_docs: requestedDocs,
    });
    if(upsertProfile.error) throw new Error(upsertProfile.error.message);

    appState.newClientCredentials = { email: email, password: password };
    appState.newClientDocs = null; // repart sur les defaults au prochain formulaire, voir renderNewClientForm()
    logAudit("create_client_from_scratch", "auth_user", uuid, { email: email, person_type: personType, requested_docs: requestedDocs });
    showToast("Client créé ✓");
    await loadClientAccounts();
  }catch(err){
    appState.newClientError = err.message;
    render();
  }
}

/* ==========================================================================
   ACTIONS SUR LES DOCUMENTS / VALIDER-REFUSER-SUPPRIMER-DÉPOSER
   ========================================================================== */
async function setDocStatus(docId, status){
  try{
    var client = getClient();
    var update = await client.from("client_documents").update({
      status: status,
      validated_by: appState.session.user.id,
      validated_at: new Date().toISOString(),
    }).eq("id", docId);
    if(update.error) throw new Error(update.error.message);
    await loadDocuments(appState.currentAccount.id);
    logAudit(status==="valide" ? "validate_document" : "refuse_document", "client_documents", docId, { client_id: appState.currentAccount.id });
    showToast(status==="valide" ? "Document validé ✓" : "Document refusé");
    render();
  }catch(err){
    appState.docError = err.message;
    render();
  }
}

async function deleteDocument(docId){
  if(!window.confirm("Supprimer définitivement ce document ? Cette action est irréversible.")) return;
  try{
    var client = getClient();
    var doc = appState.documents.filter(function(d){ return d.id===docId; })[0];
    if(doc){
      await client.storage.from("client-documents").remove([doc.storage_path]);
    }
    var del = await client.from("client_documents").delete().eq("id", docId);
    if(del.error) throw new Error(del.error.message);
    await loadDocuments(appState.currentAccount.id);
    logAudit("delete_document", "client_documents", docId, { client_id: appState.currentAccount.id, doc_type: doc && doc.doc_type });
    showToast("Document supprimé");
    render();
  }catch(err){
    appState.docError = err.message;
    render();
  }
}

/* --- Mêmes actions que ci-dessus, mais depuis l'onglet global "Documents"
   (tous les clients) — recharge appState.allDocuments au lieu de
   appState.documents (voir loadAllDocuments()). --- */
async function setDocStatusGlobal(docId, status){
  try{
    var client = getClient();
    var update = await client.from("client_documents").update({
      status: status,
      validated_by: appState.session.user.id,
      validated_at: new Date().toISOString(),
    }).eq("id", docId);
    if(update.error) throw new Error(update.error.message);
    await loadAllDocuments();
    logAudit(status==="valide" ? "validate_document" : "refuse_document", "client_documents", docId, null);
    showToast(status==="valide" ? "Document validé ✓" : "Document refusé");
    render();
  }catch(err){
    appState.allDocsError = err.message;
    render();
  }
}

async function deleteDocumentGlobal(docId){
  if(!window.confirm("Supprimer définitivement ce document ? Cette action est irréversible.")) return;
  try{
    var client = getClient();
    var doc = appState.allDocuments.filter(function(d){ return d.id===docId && d.kind==="doc"; })[0];
    if(doc){
      await client.storage.from("client-documents").remove([doc.storage_path]);
    }
    var del = await client.from("client_documents").delete().eq("id", docId);
    if(del.error) throw new Error(del.error.message);
    await loadAllDocuments();
    logAudit("delete_document", "client_documents", docId, { doc_type: doc && doc.docType, client_name: doc && doc.clientName });
    showToast("Document supprimé");
    render();
  }catch(err){
    appState.allDocsError = err.message;
    render();
  }
}

async function advisorUploadDocument(docType, file){
  appState.docError = "";
  try{
    var client = getClient();
    var acc = appState.currentAccount;
    // ⚠ CONVENTION DE CHEMIN LIÉE AUX POLICIES SQL : le chemin DOIT commencer
    // par "<id du COMPTE>/" (acc.id + "/...") — supabase/schema-v2-portail-client.sql
    // (section 9) vérifie ça avec (storage.foldername(name))[1] pour savoir
    // qui a le droit de lire/écrire ce fichier. Si vous changez cette
    // convention ici, il faut aussi changer les policies SQL "client-documents
    // lecture/depot", sinon plus personne (ou tout le monde) n'a accès aux
    // fichiers. Même règle pour le bucket "client-reports" (fonction
    // uploadReport plus bas) — le bucket "submissions" (PDF du questionnaire,
    // fonction generateFinalPdf tout en bas) garde sa propre convention par
    // dossier, sans rapport avec celle-ci.
    var path = acc.id + "/" + docType + "-" + Date.now() + "-" + file.name;
    var upload = await client.storage.from("client-documents").upload(path, file, { upsert:false });
    if(upload.error) throw new Error(upload.error.message);
    var insert = await client.from("client_documents").insert({
      client_id: acc.id,
      doc_type: docType,
      file_name: file.name,
      storage_path: path,
      status: "a_valider",
    });
    if(insert.error) throw new Error(insert.error.message);
    await loadDocuments(acc.id);
    showToast("Document déposé ✓");
    render();
  }catch(err){
    appState.docError = err.message;
    render();
  }
}

/* --- OUVRIR / VOIR UN FICHIER (URL signée, buckets privés) --- */
async function viewFile(bucket, id, list){
  var item = list.filter(function(x){ return x.id===id; })[0];
  if(!item) return;
  try{
    var client = getClient();
    var { data, error } = await client.storage.from(bucket).createSignedUrl(item.storage_path, 120);
    if(error) throw new Error(error.message);
    window.open(data.signedUrl, "_blank");
  }catch(err){
    showToast("Impossible d'ouvrir le fichier : " + err.message);
  }
}

/* ==========================================================================
   ACTIONS SUR LES BILANS / ENVOYER-SUPPRIMER UN COMPTE RENDU
   ========================================================================== */
async function uploadReport(file){
  appState.reportError = "";
  try{
    var client = getClient();
    var acc = appState.currentAccount;
    // ⚠ même convention de chemin "<id du COMPTE>/..." que advisorUploadDocument()
    // plus haut — voir sa note "CONVENTION DE CHEMIN LIÉE AUX POLICIES SQL".
    var path = acc.id + "/" + Date.now() + "-" + file.name;
    var upload = await client.storage.from("client-reports").upload(path, file, { upsert:false });
    if(upload.error) throw new Error(upload.error.message);
    var insert = await client.from("client_reports").insert({
      client_id: acc.id,
      title: file.name,
      storage_path: path,
      sent_by: appState.session.user.id,
    });
    if(insert.error) throw new Error(insert.error.message);
    await loadReports(acc.id);
    logAudit("send_report", "client_reports", acc.id, { title: file.name });
    showToast("Bilan envoyé ✓");
    render();
  }catch(err){
    appState.reportError = err.message;
    render();
  }
}

async function deleteReport(reportId){
  if(!window.confirm("Supprimer définitivement ce bilan ? Cette action est irréversible.")) return;
  try{
    var client = getClient();
    var report = appState.reports.filter(function(r){ return r.id===reportId; })[0];
    if(report){
      await client.storage.from("client-reports").remove([report.storage_path]);
    }
    var del = await client.from("client_reports").delete().eq("id", reportId);
    if(del.error) throw new Error(del.error.message);
    await loadReports(appState.currentAccount.id);
    logAudit("delete_report", "client_reports", reportId, { client_id: appState.currentAccount.id, title: report && report.title });
    showToast("Bilan supprimé");
    render();
  }catch(err){
    appState.reportError = err.message;
    render();
  }
}

/* ==========================================================================
   SUPPRESSION COMPLÈTE D'UN DOSSIER CLIENT (irréversible)
   Supprime le(s) PDF du questionnaire puis la ligne en base. ⚠ Un dossier
   KYC n'a plus ni documents ni bilans (voir note d'architecture sur appState
   tout en haut) — supprimer un dossier ne touche donc JAMAIS à un compte
   client, même si la même personne en a un.
   ========================================================================== */
async function deleteSubmission(){
  var sub = appState.current;
  var confirmText = "Supprimer DÉFINITIVEMENT le dossier de " + (sub.client_name||"ce client") +
    " ? Ses réponses seront perdues. Cette action est irréversible.";
  if(!window.confirm(confirmText)) return;
  try{
    var client = getClient();

    var submissionsPaths = [sub.pdf_client_path, sub.pdf_final_path].filter(Boolean);
    if(submissionsPaths.length) await client.storage.from("submissions").remove(submissionsPaths);

    var del = await client.from("submissions").delete().eq("id", sub.id);
    if(del.error) throw new Error(del.error.message);

    logAudit("delete_submission", "submission", sub.id, { client_name: sub.client_name, client_email: sub.client_email });
    showToast("Dossier supprimé");
    appState.view = "dashboard";
    appState.current = null;
    await loadSubmissions();
  }catch(err){
    showToast("Erreur lors de la suppression : " + err.message);
  }
}

/* ==========================================================================
   IMPORT MANUEL D'UN PDF / LECTURE DES DONNÉES EMBARQUÉES / DOSSIER LOCAL
   ========================================================================== */
async function handleImportFile(file){
  var errBox = document.getElementById("importError");
  if(errBox) errBox.innerHTML = "";
  if(file.type && file.type!=="application/pdf" && !file.name.toLowerCase().endsWith(".pdf")){
    if(errBox) errBox.innerHTML = '<div class="err-box">Ce fichier n\'est pas un PDF.</div>';
    return;
  }
  try{
    var buf = await file.arrayBuffer();
    var parsed = await IvoPdfFill.extractEmbeddedData(new Uint8Array(buf));
    if(!parsed){
      if(errBox) errBox.innerHTML = '<div class="err-box">Ce PDF ne contient pas de données IVO KYC exploitables — vérifiez qu\'il vient bien de cet outil (bouton "Télécharger mon PDF" côté client, ou "Générer le PDF final" côté conseiller).</div>';
      return;
    }
    openLocalSubmission(parsed, file.name);
  }catch(err){
    console.error(err);
    if(errBox) errBox.innerHTML = '<div class="err-box">Impossible de lire ce fichier : '+esc(err.message)+'</div>';
  }
}

function openLocalSubmission(parsed, fileName){
  var a = parsed.clientAnswers;
  var isMorale = a.personType==="morale";
  var clientName = isMorale ? (a.morale && a.morale.denomination) : ((a.prenom||"")+" "+(a.nom||"")).trim();
  appState.current = {
    id: "local-"+Date.now(),
    isLocal: true,
    client_name: clientName,
    client_email: a.contact && a.contact.email,
    advisor_email: (window.IVO_CONFIG && window.IVO_CONFIG.ADVISORS && window.IVO_CONFIG.ADVISORS[0] && window.IVO_CONFIG.ADVISORS[0].email) || "",
    status: parsed.advisorAnswers ? "complete" : "recu",
    created_at: new Date().toISOString(),
    answers: a,
    advisor_answers: parsed.advisorAnswers || null,
    _sourceFile: fileName,
  };
  appState.advisorAnswers = parsed.advisorAnswers ? JSON.parse(JSON.stringify(parsed.advisorAnswers)) : defaultAdvisorAnswers();
  var suggestion = suggestProfile(a.risque);
  if(suggestion && !appState.advisorAnswers.profil) appState.advisorAnswers.profil = suggestion;
  appState.view = "detail";
  render();
  showToast("Dossier importé depuis "+fileName);
}

/* ==========================================================================
   CONNEXION CONSEILLER / DOLOGIN
   ========================================================================== */
async function doLogin(){
  appState.loginError = "";
  var email = document.getElementById("loginEmail").value.trim();
  var password = document.getElementById("loginPassword").value;
  if(!email || !password){ appState.loginError = "Email et mot de passe requis."; render(); return; }
  try{
    var client = getClient();
    var { data, error } = await client.auth.signInWithPassword({ email: email, password: password });
    if(error) throw new Error(error.message);
    // ⚠ voir verifyAdvisorRole() ci-dessus : sans ce contrôle, un compte
    // client (espace-client) pourrait se connecter ici avec ses propres
    // identifiants et voir s'afficher le tableau de bord conseiller.
    var isAdvisor = await verifyAdvisorRole(client, data.session.user.id);
    if(!isAdvisor){
      await client.auth.signOut();
      appState.session = null;
      appState.loginError = "Ce compte n'est pas un compte conseiller — accès refusé.";
      render();
      return;
    }
    appState.session = data.session;
    appState.view = "dashboard";
    render();
    loadSubmissions();
    loadClientAccounts();
  }catch(err){
    appState.loginError = err.message;
    render();
  }
}

/* ==========================================================================
   GÉNÉRATION DU PDF FINAL / FUSION PARTIE CLIENT + PARTIE CONSEILLER
   ========================================================================== */
async function generateFinalPdf(btn){
  var errBox = document.getElementById("detailError");
  if(errBox) errBox.innerHTML = "";
  var original = btn.textContent;
  btn.disabled = true; btn.textContent = "Génération en cours…";
  try{
    var sub = appState.current;
    var bytes = await IvoPdfFill.fillAnnexe4(sub.answers, appState.advisorAnswers);

    if(!sub.isLocal){
      var client = getClient();
      var path = sub.id + "-final.pdf";
      var upload = await client.storage.from("submissions").upload(path, new Blob([bytes],{type:"application/pdf"}), {contentType:"application/pdf", upsert:true});
      if(upload.error) throw new Error(upload.error.message);
      var update = await client.from("submissions").update({
        advisor_answers: appState.advisorAnswers,
        pdf_final_path: path,
        status: "complete",
        updated_at: new Date().toISOString(),
      }).eq("id", sub.id);
      if(update.error) throw new Error(update.error.message);
    }

    var blobUrl = URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
    var a = document.createElement("a");
    a.href = blobUrl; a.download = "IVO-dossier-complet-"+(sub.client_name||"client").replace(/[^a-zA-Z0-9-]+/g,"_")+".pdf";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(blobUrl); }, 4000);

    sub.status = "complete";
    showToast("Dossier finalisé et PDF téléchargé ✓");
    render();
  }catch(err){
    console.error(err);
    if(errBox) errBox.innerHTML = '<div class="err-box">'+esc(err.message)+'</div>';
  }finally{
    btn.disabled = false; btn.textContent = original;
  }
}

init();
})();
