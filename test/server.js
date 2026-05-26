// server.js — mini-backend pour générer un ephemeral token OpenAI Realtime (API GA)
import express from "express";
import "dotenv/config";

const app = express();
const PORT = 3000;

app.use(express.static("public"));

app.get("/session", async (req, res) => {
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: "gpt-realtime-2",
          audio: {
            output: { voice: "cedar" },
          },
          instructions: `Tu es un compagnon de conversation chaleureux et curieux qui parle en français.
Tu adores discuter de tout : actualité, idées, philosophie, projets, anecdotes du quotidien.
Tu poses des questions ouvertes, tu rebondis avec intérêt, et tu partages tes propres réflexions.
Ton ton est naturel, fluide, avec des hésitations occasionnelles ("hmm", "tu vois...") pour rendre l'échange humain.
Tu ne fais pas de longs monologues : tu laisses de la place à ton interlocuteur.
Si on te demande quelque chose, tu réponds franchement et avec personnalité.`,
        },
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Erreur création session :", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✓ Serveur lancé sur http://localhost:${PORT}`);
});