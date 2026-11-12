/* Sends a completed questionnaire to Supabase (DB row + PDF in Storage) and
   triggers the send-advisor-email Edge Function, so the advisor receives the
   filled PDF automatically — no action needed from the client's own mailbox.

   ⚠ LIÉ À 3 ENDROITS :
   1. client/index.html : lit state.personType, state.morale.denomination,
      state.prenom, state.nom, state.contact.email, state.advisorEmail —
      voir la note "TRÈS LIÉ AU RESTE DU PROJET" sur defaultState() là-bas.
   2. supabase/schema.sql (l'original, déjà en place) : les colonnes de
      l'insert ci-dessous (client_name, client_email, person_type,
      advisor_email, status, answers, pdf_client_path) doivent exister sur
      la table "submissions" avec ces noms exacts.
   3. supabase/functions/send-advisor-email/index.ts : appelée juste après
      l'insert, avec le même "submissionId" — si l'insert change de forme,
      vérifiez que cette Edge Function sait toujours lire la ligne créée. */
(function () {
  "use strict";

  function getClient() {
    var cfg = window.IVO_CONFIG;
    if (!cfg || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.indexOf("your-project-ref") > -1) {
      throw new Error("config.js n'est pas encore renseigné avec vos identifiants Supabase.");
    }
    return window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  /* Identifiant unique. crypto.randomUUID() n'existe pas sur les navigateurs
     d'avant 2022 (iPhone non mis à jour, par exemple) : sans ce repli, l'envoi
     du questionnaire y échouait avec une erreur incompréhensible.
     ⚠ LIÉ À la colonne "id uuid" de la table submissions : le résultat doit
     rester un UUID valide (8-4-4-4-12 caractères hexadécimaux). */
  function newUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    var b = new Uint8Array(16);
    window.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  /* Empreinte des RÉPONSES (sans ce qui bouge tout seul : écran en cours, date
     d'envoi...). Deux tentatives avec la même empreinte = le même questionnaire. */
  function fingerprint(state) {
    var copy = {};
    for (var k in state) {
      if (k !== "step" && k !== "sub" && k !== "sentAt" && k !== "pdfDownloaded") copy[k] = state[k];
    }
    return JSON.stringify(copy);
  }

  /* ⚠ ANTI-DOUBLON : l'envoi se fait en 3 temps (PDF → fiche → email). Si le
     3e échoue et que le client clique sur "réessayer", il ne faut PAS recréer
     un PDF et une fiche : le conseiller verrait le même dossier deux fois.
     On retient donc où l'envoi en était (tant que la page reste ouverte et que
     les réponses n'ont pas changé) et on reprend à l'étape qui a échoué. */
  var progress = null; // { fp, id, uploaded, inserted }

  async function submitToAdvisor(state, pdfBytes) {
    var client = getClient();
    var isMorale = state.personType === "morale";
    var clientName = isMorale ? state.morale.denomination : (state.prenom + " " + state.nom).trim();
    var clientEmail = state.contact.email;

    var fp = fingerprint(state);
    if (!progress || progress.fp !== fp) {
      progress = { fp: fp, id: newUuid(), uploaded: false, inserted: false };
    }
    var submissionId = progress.id;
    var path = submissionId + ".pdf";

    if (!progress.uploaded) {
      var upload = await client.storage
        .from("submissions")
        .upload(
          path,
          new Blob([pdfBytes], { type: "application/pdf" }),
          {
            contentType: "application/pdf",
            upsert: false,
          }
        );

      if (upload.error) {
        throw new Error("Échec de l'envoi du PDF : " + upload.error.message);
      }
      progress.uploaded = true;
    }

    if (!progress.inserted) {
      var insert = await client
        .from("submissions")
        .insert({
          id: submissionId,
          client_name: clientName,
          client_email: clientEmail,
          person_type: state.personType,
          advisor_email: state.advisorEmail,
          status: "en_cours",
          answers: state,
          pdf_client_path: path,
        });

      if (insert.error) {
        throw new Error(
          "Échec de l'enregistrement de la fiche : " + insert.error.message
        );
      }
      progress.inserted = true;
    }

    var fn = await client.functions.invoke("send-advisor-email", {
      body: {
        submissionId: submissionId,
      },
    });

    if (fn.error) {
      throw new Error(
        "Le PDF est enregistré, mais l'envoi automatique a échoué : " +
          fn.error.message
      );
    }

    return submissionId;
  }

  window.IvoSubmit = { submitToAdvisor: submitToAdvisor };
})();
