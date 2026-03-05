import axios from "axios";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FB_PROJECT_ID,
      clientEmail: process.env.FB_CLIENT_EMAIL,
      privateKey: process.env.FB_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });
}

const db = admin.firestore();

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

const PAYMENT_LINK = "https://your-payment-link.com";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(200).send("Bot Running");
  }

  try {

    const message = req.body.message;
    if (!message) return res.status(200).send("OK");

    const chatId = message.chat.id;
    const userId = message.from.id;
    const username = message.from.username || "";
    const text = (message.text || "").toLowerCase().trim();
    const rawText = message.text || "";
    const now = new Date().toISOString();

    const userRef = db.collection("telegramUser").doc(String(userId));
    const userSnap = await userRef.get();

    // ---------------- START ----------------

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
        text: "👋 Welcome!\n\nUse /new to start registration."
      });

      return res.status(200).send("OK");
    }

    // ---------------- NEW ----------------

    if (text === "/new") {

      if (!userSnap.exists) return res.status(200).send("OK");

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

    if (!userSnap.exists) return res.status(200).send("OK");

    const userData = userSnap.data();

    // ---------------- FULL NAME ----------------

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

    // ---------------- ADDRESS ----------------

    if (userData.step === "waiting_address") {

      const address = rawText;

      await db.collection("customer").doc(String(chatId)).update({
        address: address
      });

      await userRef.update({
        step: "payment_pending"
      });

      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `💳 Please complete payment\n\n<a href="${PAYMENT_LINK}">Click here to Pay Now</a>`,
        parse_mode: "HTML"
      });

      return res.status(200).send("OK");
    }

    // ---------------- PAYMENT SCREENSHOT ----------------

    if (userData.step === "payment_pending") {

      if (!message.photo) {

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "⚠ Please send payment screenshot for confirmation."
        });

        return res.status(200).send("OK");
      }

      const photo = message.photo[message.photo.length - 1];
      const fileId = photo.file_id;

      const fileRes = await axios.get(
        `${TELEGRAM_API}/getFile?file_id=${fileId}`
      );

      const filePath = fileRes.data.result.file_path;

      const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;

      await db.collection("telegramPayment").add({
        unique_id: userId,
        chat_id: chatId,
        username: username,
        payment_screenshot_url: fileUrl,
        amount: 500,
        date_time: now
      });

      await userRef.update({
        step: "payment_submitted"
      });

      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "✅ Payment screenshot received. Verification pending."
      });

      return res.status(200).send("OK");
    }

    return res.status(200).send("OK");

  } catch (error) {

    console.log(error);
    return res.status(500).send("Error");

  }
}