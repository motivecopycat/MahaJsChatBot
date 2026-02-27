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
    const firstName = body.message.from.first_name || "Customer";
    const text = body.message.text || "";

    const userRef = db.collection("telegramUser").doc(chatId);
    const userDoc = await userRef.get();

    // 🔥 Ensure telegramUser exists
    if (!userDoc.exists) {
      await userRef.set({
        chatId,
        username,
        name: firstName,
        joinDate: new Date(),
        status: "0",
        step: ""
      });
    }

    const userData = (await userRef.get()).data();

    // ======================================
    // 🔥 HANDLE /New COMMAND
    // ======================================
    if (text === "/New") {

      const customerQuery = await db
        .collection("customer")
        .where("chatId", "==", chatId)
        .get();

      if (!customerQuery.empty) {
        // Already Registered
        await sendMessage(chatId,
`👋 Welcome back ${firstName}!

You are already registered with Maha JS Mobile Shop 📱

Choose:
/Scheme
/Offers`);
        return res.status(200).send("Already Registered");
      }

      // Not Registered → Ask Full Name
      await userRef.update({ step: "fullName" });

      await sendMessage(chatId, "📝 Please enter your Full Name:");
      return res.status(200).send("Asked Full Name");
    }

    // ======================================
    // 🔥 STEP: FULL NAME
    // ======================================
    if (userData.step === "fullName") {

      await userRef.update({
        tempFullName: text,
        step: "address"
      });

      await sendMessage(chatId, "🏠 Please enter your Address:");
      return res.status(200).send("Saved Full Name");
    }

    // ======================================
    // 🔥 STEP: ADDRESS
    // ======================================
    if (userData.step === "address") {

      await userRef.update({
        tempAddress: text,
        step: "scheme"
      });

      await sendMessage(chatId,
`📦 Choose your Scheme:

1️⃣ 6 Months
2️⃣ 12 Months
3️⃣ 18 Months

Type scheme name.`);
      return res.status(200).send("Saved Address");
    }

    // ======================================
    // 🔥 STEP: SCHEME
    // ======================================
    if (userData.step === "scheme") {

      // 🔥 Save in customer collection
      await db.collection("customer").add({
        chatId: chatId,
        username: username,
        fullName: userData.tempFullName,
        address: userData.tempAddress,
        scheme: text,
        joinDate: new Date(),
        status: "active"
      });

      // 🔥 Update telegramUser
      await userRef.update({
        status: "1",
        step: "",
        tempFullName: admin.firestore.FieldValue.delete(),
        tempAddress: admin.firestore.FieldValue.delete()
      });

      await sendMessage(chatId,
`🎉 Registration Successful!

Welcome to Maha JS Mobile Shop 📱✨

Now you can explore:

/Scheme
/Offers`);

      return res.status(200).send("Registration Completed");
    }

    return res.status(200).send("Done");

  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).send("Error");
  }
}

// 🔥 Telegram Send Function
async function sendMessage(chatId, text) {
  await axios.post(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      chat_id: chatId,
      text: text
    }
  );
}