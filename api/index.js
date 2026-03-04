import axios from "axios";
import admin from "firebase-admin";

// Firebase init
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
    const username = message.from.username || "";
    const text = (message.text || "").toLowerCase().trim();
    const now = new Date().toISOString();

    const userRef = db.collection("telegramUser").doc(String(userId));
    const userSnap = await userRef.get();

    // ------------------------------------------------
    // /start command
    // ------------------------------------------------
    if (text === "/start") {

      await userRef.set({
        unique_id: userId,
        chat_id: chatId,
        username: username,
        status: "active",
        step: "start",
        last_message_date_time: now
      }, { merge: true });

      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "👋 Welcome!\n\nUse /new to create customer."
      });

      return res.status(200).send("OK");
    }

    // ------------------------------------------------
    // /new command
    // ------------------------------------------------
    if (text === "/new") {

      if (!userSnap.exists) return res.status(200).send("User not found");

      const userData = userSnap.data();

      if (userData.status === "active" && userData.step === "start") {

        await userRef.update({
          step: "waiting_fullname"
        });

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "📝 Please enter your Full Name"
        });
      }

      return res.status(200).send("OK");
    }

    // ------------------------------------------------
    // Receive Full Name
    // ------------------------------------------------
    if (userSnap.exists) {

      const userData = userSnap.data();

      if (userData.step === "waiting_fullname") {

        const fullName = message.text;

        // Save customer
        await db.collection("customer").doc(String(userId)).set({
          unique_id: userId,
          chat_id: chatId,
          username: username,
          full_name: fullName,
          status: "active",
          join_date_time: now
        });

        // Reset step
        await userRef.update({
          step: "start"
        });

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: `✅ Customer created successfully\n\nName: ${fullName}`
        });
      }
    }

    return res.status(200).send("OK");

  } catch (error) {
    console.log(error);
    return res.status(500).send("Error");
  }
}