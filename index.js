const express = require("express");
const axios = require("axios");
const app = express();

app.use(express.json());

// 🔐 CONFIG CINETPAY (NOUVELLE VERSION)
const API_KEY = process.env.API_KEY;
const API_PASSWORD = process.env.API_PASSWORD;

// 🧠 FAUSSE BASE DE DONNÉES (temporaire)
let users = [];
let paiements = [];

// 👤 CRÉER / RÉCUPÉRER UTILISATEUR
function getUser(telephone) {
  let user = users.find(u => u.telephone === telephone);

  if (!user) {
    user = { telephone, solde: 0 };
    users.push(user);
  }

  return user;
}

// 💰 DEPOT
app.post("/depot", async (req, res) => {
  try {
    let { telephone, montant } = req.body;

    if (!telephone || !montant) {
      return res.status(400).json({ error: "Données manquantes" });
    }

    // ➕ AJOUT AUTOMATIQUE +100F
    montant = parseInt(montant) + 100;

    const transaction_id = "TRANS_" + Date.now();

    paiements.push({
      transaction_id,
      telephone,
      montant,
      status: "EN_ATTENTE"
    });

    // 🔗 DEMANDE DE PAIEMENT
    const payment = await axios.post(
      "https://api-checkout.cinetpay.com/v2/payment",
      {
        apikey: API_KEY,
        password: API_PASSWORD,
        transaction_id,
        amount: montant,
        currency: "XOF",
        description: "Depot GLOBAL(Net) Service",
        notify_url: "https://ton-serveur.com/notify",
        return_url: "https://ton-app.com/success"
      }
    );

    res.json({
      payment_url: payment.data.data.payment_url,
      transaction_id
    });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Erreur lors du dépôt" });
  }
});

// 🔒 NOTIFICATION CINETPAY (VALIDATION)
app.post("/notify", async (req, res) => {
  try {
    const { transaction_id } = req.body;

    if (!transaction_id) return res.send("NO ID");

    // 🔍 VERIFICATION DU PAIEMENT
    const verify = await axios.post(
      "https://api-checkout.cinetpay.com/v2/payment/check",
      {
        apikey: API_KEY,
        password: API_PASSWORD,
        transaction_id
      }
    );

    const data = verify.data.data;

    if (data.status === "ACCEPTED") {
      const paiement = paiements.find(p => p.transaction_id === transaction_id);

      if (!paiement || paiement.status === "VALIDÉ") {
        return res.send("OK");
      }

      paiement.status = "VALIDÉ";

      const user = getUser(paiement.telephone);
      user.solde += paiement.montant;

      console.log("💰 Dépôt validé :", paiement.telephone);

      // 📩 MESSAGE PREUVE
      paiement.message = `Paiement réussi ✅
Montant: ${paiement.montant}F
ID: ${transaction_id}

Envoyez ce message par SMS à l'admin GLOBAL(Net) Service.`;
    }

    res.send("OK");

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.send("ERREUR");
  }
});

// 💰 CONSULTER SOLDE
app.get("/solde/:telephone", (req, res) => {
  const user = getUser(req.params.telephone);
  res.json({ solde: user.solde });
});

// 📩 OBTENIR PREUVE
app.get("/preuve/:transaction_id", (req, res) => {
  const paiement = paiements.find(p => p.transaction_id === req.params.transaction_id);

  if (!paiement) {
    return res.status(404).json({ error: "Transaction introuvable" });
  }

  res.json({
    message: paiement.message || "Paiement non encore validé"
  });
});

// 🚀 LANCEMENT SERVEUR
app.listen(3000, () => {
  console.log("✅ GLOBAL(Net) Service lancé sur le port 3000");
});
