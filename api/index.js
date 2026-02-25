import express from "express";
import dotenv from "dotenv";
import db from "../services/firebase.js";
import { sendMessage } from "../services/telegram.js";

dotenv.config();

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.message;

    if (!message) return res.sendStatus(200);

    const chatId = message.chat.id;
    const text = message.text;

    // Save user in Firestore
    await db.collection("users").doc(chatId.toString()).set({
      chatId,
      lastMessage: text,
      timestamp: new Date()
    }, { merge: true });

    // Simple response logic
    if (text === "/start") {
      await sendMessage(chatId, "Welcome to your SaaS Telegram Bot 🚀");
    } else {
      await sendMessage(chatId, `You said: ${text}`);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

export default app;