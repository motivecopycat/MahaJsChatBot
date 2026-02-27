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
    const name = body.message.from.first_name || "Customer";

    const userRef = db.collection("telegramUser").doc(chatId);
    const userDoc = await userRef.get();

    // 🔥 IF USER NOT REGISTERED
    if (!userDoc.exists) {
      await userRef.set({
        chatId: chatId,
        username: username,
        name: name,
        joinDate: new Date(),
        status: "active"
      });

      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text:
`👋 Welcome ${name}!

I am *Maha JS Mobile Shop* 🤖  
Your virtual assistant.

I am here to help with your queries,  
show you latest offers and schemes 📱✨

Please choose an option:

/New registration
/Scheme
/Offers`,
          parse_mode: "Markdown"
        }
      );
    }

    // 🔥 IF USER ALREADY REGISTERED
    else {
      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text:
`👋 Welcome back ${name}!

Please choose:

/New registration
/Scheme
/Offers`
        }
      );
    }

    return res.status(200).send("Done");
  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).send("Error");
  }
}