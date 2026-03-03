import axios from "axios";
import admin from "firebase-admin";

// 🔥 Initialize Firebase
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
    const username = message.from.username || message.from.first_name || "User";
    const text = (message.text || "").toLowerCase().trim();
    const now = new Date().toISOString();

    // ✅ Store or Update user in telegramUser collection
    await db.collection("telegramUser").doc(String(userId)).set({
      unique_id: userId,
      chat_id: chatId,
      username: username,
      status: "active",
      last_message_date_time: now
    }, { merge: true });

    // 🔥 Get all commands from telegramChat
    const chatSnapshot = await db.collection("telegramChat").get();

    let replyMessage = null;

    for (const doc of chatSnapshot.docs) {

      const data = doc.data();
      const keywords = data.userChat || [];

      if (Array.isArray(keywords)) {

        const lowerKeywords = keywords.map(k =>
          k.toLowerCase().trim()
        );

        if (lowerKeywords.includes(text)) {

          // ✅ Replace ${username}
          replyMessage = data.botChat.replace(
            /\$\{username\}/g,
            username
          );

          break; // stop after first match
        }
      }
    }

    // ❌ If no match
    if (!replyMessage) {
      replyMessage = "❌ Invalid option. Please try again.";
    }

    // ✅ Send Telegram Reply
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: replyMessage
    });

    return res.status(200).send("OK");

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send("Error occurred");
  }
}