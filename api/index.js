import axios from "axios";
import admin from "firebase-admin";

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FB_PROJECT_ID,
      clientEmail: process.env.FB_CLIENT_EMAIL,
      privateKey: process.env.FB_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(200).send("Bot Running 🚀");
  }

  try {

    const message = req.body.message;
    if (!message) return res.status(200).send("No message");

    const chatId = message.chat.id;
    const userId = message.from.id;
    const username =
      message.from.username || message.from.first_name || "User";

    const text = message.text || "";
    const now = new Date().toISOString();

    // ✅ If user sends /start
    if (text === "/start") {

      // 🔥 Store user in Firestore
      await db.collection("telegramUser").doc(String(userId)).set({
        unique_id: userId,
        chat_id: chatId,
        username: username,
        status: "active",
        step: "start",
        last_message_date_time: now
      }, { merge: true });

      // 🔥 Welcome message
      const welcomeMessage =
        `👋 Welcome ${username}!\n\nYour data is stored successfully 🔥`;

      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: welcomeMessage
      });
    }

    return res.status(200).send("OK");

  } catch (error) {
    console.error(error);
    return res.status(500).send("Error");
  }
}