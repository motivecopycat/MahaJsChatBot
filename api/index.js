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

// Replace with your payment link
const PAYMENT_LINK = "https://google.com";

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
    const text = (message.text || "").trim().toLowerCase();
    const rawText = message.text || "";
    const now = new Date().toISOString();

    const userRef = db.collection("telegramUser").doc(String(userId));
    const userSnap = await userRef.get();

    // START COMMAND
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
        text: "👋 Welcome!\n\nUse /new to register."
      });

      return res.status(200).send("OK");
    }

    // NEW COMMAND
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

    if (userSnap.exists) {

      const userData = userSnap.data();

      // WAITING FULL NAME
      if (userData.step === "waiting_fullname") {

        const fullName = rawText;

        await db.collection("customer").doc(String(chatId)).set({
          unique_id: userId,
          chat_id: chatId,
          username: username,
          full_name: fullName,
          status: "active",
          join_date_time: now
        });

        await userRef.update({
          step: "waiting_address"
        });

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "🏠 Please enter your Full Address with PIN code"
        });

        return res.status(200).send("OK");
      }

      // WAITING ADDRESS
      if (userData.step === "waiting_address") {

        const address = rawText;

        await db.collection("customer").doc(String(chatId)).update({
          address: address
        });

        await userRef.update({
          step: "payment_pending"
        });

        // Send Payment Button
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: `💳 Please complete your payment:\n\n<a href="${PAYMENT_LINK}">Click here to Pay Now</a>`,
    parse_mode: "HTML"
        });

        return res.status(200).send("OK");
      }
    }

    return res.status(200).send("OK");

  } catch (error) {
    console.log(error);
    return res.status(500).send("Error");
  }
}