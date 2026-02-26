import express from "express";
import db from "../services/firebase.js";
import { sendMessage } from "../services/telegram.js";

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  try {
    console.log("Incoming:", req.body);

    const message = req.body.message;
    if (!message) return res.status(200).send("No message");

    const chatId = message.chat.id;
    const text = message.text || "";

    // Save user in Firebase
    await db.collection("users").doc(chatId.toString()).set(
      {
        chatId,
        lastMessage: text,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    if (text === "/start") {
      await sendMessage(chatId, "🚀 Bot connected with Firebase successfully!");
    } else {
      await sendMessage(chatId, `You said: ${text}`);
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).send("Server Error");
  }
});

export default app;