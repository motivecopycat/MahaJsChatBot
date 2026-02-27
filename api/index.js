import axios from "axios";
import admin from "firebase-admin";

// 🔥 Firebase Init
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
    const username = body.message.from.username || "";
    const firstName = body.message.from.first_name || "";
    const message = body.message.text || "";

    const userRef = db.collection("users").doc(chatId);
    const userDoc = await userRef.get();

    // 🔥 NEW USER
    if (!userDoc.exists) {
      await userRef.set({
        chatId,
        username,
        firstName,
        joinedAt: new Date(),
        lastMessage: message,
      });

      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: `👋 Welcome ${firstName}!\n\nThanks for starting the bot 🚀`,
        }
      );
    }

    // 🔥 EXISTING USER
    else {
      await userRef.update({
        lastMessage: message,
        updatedAt: new Date(),
      });

      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: `🛠 Help Menu:\n\n1️⃣ Type /info\n2️⃣ Type /support\n3️⃣ Type /plan`,
        }
      );
    }

    return res.status(200).send("Done");
  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).send("Error");
  }
}