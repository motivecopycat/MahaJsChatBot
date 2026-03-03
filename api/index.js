import axios from "axios";
import admin from "firebase-admin";

// Initialize Firebase only once
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

  const message = req.body.message;
  if (!message) return res.status(200).send("No message");

  const chatId = message.chat.id;
  const userId = message.from.id;
  const username = message.from.username || "NoUsername";
  const text = message.text || "";
  const now = new Date().toISOString();

  // 🔥 Save or Update User Data in Firestore
  await db.collection("telegramUser").doc(String(userId)).set({
    unique_id: userId,
    chat_id: chatId,
    username: username,
    status: "active",
    step: "start",
    last_message_date_time: now
  }, { merge: true });

  // /start response
  if (text === "/start") {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `👋 Welcome ${username}!\n\nYour data is stored successfully 🔥`
    });
  } else {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: "Message received ✅"
    });
  }

  return res.status(200).send("OK");
}