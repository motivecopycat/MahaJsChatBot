import axios from "axios";
import admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

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
    const text = body.message.text || "";

    const userRef = db.collection("telegramUser").doc(chatId);
    const userDoc = await userRef.get();

    // =========================
    // 🔥 CREATE telegramUser IF NOT EXISTS
    // =========================
    if (!userDoc.exists) {
      await userRef.set({
        chatId,
        username,
        name,
        joinDate: new Date(),
        status: "active",
        step: ""
      });

      await sendMessage(chatId,
`👋 Welcome ${name}!

I am *Maha JS Mobile Shop* 🤖  
Your virtual assistant.

I am here to help with your queries,  
show you latest offers and schemes 📱✨

Please choose an option:

/New registration
/Scheme
/Offers`);

      return res.status(200).send("New user welcome");
    }

    const userData = (await userRef.get()).data();

    // =========================
    // 🔥 RETURNING USER
    // =========================
    if (text === "/start") {
      await sendMessage(chatId,
`👋 Welcome back ${name}!

Please choose:

/New registration
/Scheme
/Offers`);
      return res.status(200).send("Welcome back");
    }

    // =========================
    // 🔥 /New REGISTRATION START
    // =========================
    if (text === "/New") {

      const customerQuery = await db
        .collection("customer")
        .where("chatId", "==", chatId)
        .get();

      if (!customerQuery.empty) {
        await sendMessage(chatId,
`👋 Welcome back ${name}!

You are already registered 🎉

Please choose:

/Scheme
/Offers`);

        return res.status(200).send("Already registered");
      }

      await userRef.update({ step: "fullName" });

      await sendMessage(chatId, "📝 Please enter your Full Name:");
      return res.status(200).send("Ask Full Name");
    }

    // =========================
    // STEP 1 - FULL NAME
    // =========================
    if (userData.step === "fullName") {
      await userRef.update({
        tempFullName: text,
        step: "address"
      });

      await sendMessage(chatId,
`🏠 Please enter your Full Address in this format:

House No:
Street:
Area:
City:
Pincode:`);

      return res.status(200).send("Ask Address");
    }

    // =========================
    // STEP 2 - ADDRESS
    // =========================
    if (userData.step === "address") {
      await userRef.update({
        tempAddress: text,
        step: "scheme"
      });

      await sendMessage(chatId,
`📦 Choose Your Scheme:

1️⃣ Monthly Scheme  
Monthly pay ₹200 fixed.  
You can also pay extra amount anytime.

2️⃣ Smart Scheme  
Pay any amount anytime.  
Minimum ₹200 required.

Select:

/Monthly scheme  
/Smart scheme`);

      return res.status(200).send("Ask Scheme");
    }

    // =========================
    // STEP 3 - SCHEME
    // =========================
    if (userData.step === "scheme") {

      if (text !== "/Monthly scheme" && text !== "/Smart scheme") {
        await sendMessage(chatId, "❌ Please select valid option:\n/Monthly scheme\n/Smart scheme");
        return res.status(200).send("Invalid scheme");
      }

      await userRef.update({
        tempScheme: text,
        step: "payment"
      });

      await sendMessage(chatId,
`💳 Registration Advance Amount: ₹200

Please complete payment using UPI:

upi://pay?pa=thamizharasanmassboy-1@okaxis&pn=Thamizh&am=200&cu=INR&tn=Register for Maha JS Mobile Shop

After payment, type: PAID`);

      return res.status(200).send("Ask Payment");
    }

    // =========================
    // STEP 4 - PAYMENT CONFIRM
    // =========================
    if (userData.step === "payment" && text.toUpperCase() === "PAID") {

      await db.collection("customer").add({
        chatId,
        username,
        fullName: userData.tempFullName,
        address: userData.tempAddress,
        scheme: userData.tempScheme,
        joinDate: new Date(),
        status: "active"
      });

      await userRef.update({
        status: "New",
        step: "",
        tempFullName: admin.firestore.FieldValue.delete(),
        tempAddress: admin.firestore.FieldValue.delete(),
        tempScheme: admin.firestore.FieldValue.delete()
      });

      await sendMessage(chatId,
`🎉 Registration Successful!

Welcome to Maha JS Mobile Shop 📱✨

Now you can explore:

/Scheme
/Offers`);

      return res.status(200).send("Registration Complete");
    }

    return res.status(200).send("Done");

  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).send("Error");
  }
}

// Telegram Send Function
async function sendMessage(chatId, text) {
  await axios.post(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      chat_id: chatId,
      text: text
    }
  );
}