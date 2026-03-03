import axios from "axios";
import admin from "firebase-admin";

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
  const text = (message.text || "").toLowerCase();
  const now = new Date().toISOString();

  const userRef = db.collection("telegramUser").doc(String(userId));
  const userSnap = await userRef.get();

  let currentStep = "start";

  // 🔥 If user not exists → create
  if (!userSnap.exists) {

    await userRef.set({
      unique_id: userId,
      chat_id: chatId,
      username: username,
      status: "active",
      step: "start",
      last_message_date_time: now
    });

    currentStep = "start";

  } else {

    const userData = userSnap.data();
    currentStep = userData.step || "start";

    // Update last message time
    await userRef.update({
      last_message_date_time: now
    });
  }

  // 🔥 Check telegramChat collection based on step
  const chatRef = db.collection("telegramChat").doc(currentStep);
  const chatSnap = await chatRef.get();

  if (!chatSnap.exists) {
    return res.status(200).send("Step not found");
  }

  const chatData = chatSnap.data();
  const validInputs = chatData.userChat || [];

  // Check if user message matches allowed words
  if (validInputs.includes(text)) {

    // Send bot reply from database
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: chatData.botChat
    });

    // Update user step to nextStep
    if (chatData.nextStep) {
      await userRef.update({
        step: chatData.nextStep
      });
    }

  } else {

    // Optional fallback
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: "❌ Invalid option. Please try again."
    });
  }

  return res.status(200).send("OK");
}