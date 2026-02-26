import axios from "axios";
import admin from "firebase-admin";

// Initialize Firebase
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).send("OK");
    }

    const body = req.body;

    if (!body || !body.message) {
      return res.status(200).send("No message");
    }

    const chatId = body.message.chat.id.toString();
    const userText = body.message.text || "";
    const username = body.message.from.username || "";
    const firstName = body.message.from.first_name || "";

    // 🔥 Save chat in Firestore
    await db.collection("chats").add({
      chatId: chatId,
      username: username,
      firstName: firstName,
      message: userText,
      timestamp: new Date(),
    });

    // Reply
    await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: `Saved ✅ You said: ${userText}`,
      }
    );

    return res.status(200).send("Saved");
  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).send("Error");
  }
}