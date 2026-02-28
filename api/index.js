import express from "express";
import axios from "axios";
import admin from "firebase-admin";
import { google } from "googleapis";
import stream from "stream";

const app = express();
app.use(express.json());

// ==============================
// 🔥 FIREBASE INIT
// ==============================
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

const db = admin.firestore();

// ==============================
// 🔥 GOOGLE DRIVE INIT
// ==============================
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

// ==============================
// 🚀 TELEGRAM WEBHOOK ROUTE
// ==============================
app.post("/", async (req, res) => {
  try {
    const message = req.body.message;
    if (!message) return res.sendStatus(200);

    const chatId = message.chat.id.toString();
    const username = message.from.username || "";
    const firstName = message.from.first_name || "Customer";
    const text = message.text;

    const userRef = db.collection("telegramUser").doc(chatId);
    const userDoc = await userRef.get();

    // ==========================
    // NEW USER
    // ==========================
    if (!userDoc.exists) {
      await userRef.set({
        name: firstName,
        username,
        chatId,
        status: "guest",
        step: "",
        lastChat: new Date(),
      });

      if (text === "/start") {
        await sendWelcome(chatId, firstName);
      }

      return res.sendStatus(200);
    }

    const userData = (await userRef.get()).data();
    await userRef.update({ lastChat: new Date() });

    // ==========================
    // BASIC COMMANDS
    // ==========================

    if (text === "/start") {
      await sendWelcome(chatId, firstName);
      return res.sendStatus(200);
    }

    if (text === "/Scheme") {
      await sendMessage(chatId,
`📦 Our Schemes:

1️⃣ Monthly Scheme  
Monthly pay ₹200 fixed.  
You can also pay extra amount anytime.

2️⃣ Smart Scheme  
Pay any amount anytime.  
Minimum ₹200 required.

More details:
https://your-scheme-link.com`);
      return res.sendStatus(200);
    }

    if (text === "/Offers") {
      await sendMessage(chatId,
`🔥 Current Offers:

• Cashback bonus
• Festival discount
• Loyalty rewards

More details:
https://your-offer-link.com`);
      return res.sendStatus(200);
    }

    // ==========================
    // START REGISTRATION
    // ==========================
    if (text === "/New") {

      const existingCustomer = await db
        .collection("Customer")
        .where("chatId", "==", chatId)
        .get();

      if (!existingCustomer.empty) {
        await sendMessage(chatId,
`👋 You are already registered!

Choose:
/pay
/savings`);
        return res.sendStatus(200);
      }

      await userRef.update({ step: "name" });
      await sendMessage(chatId, "📝 Enter your Full Name:");
      return res.sendStatus(200);
    }

    // ==========================
    // STEP FLOW
    // ==========================

    if (userData.step === "name") {
      await userRef.update({ tempName: text, step: "address" });
      await sendMessage(chatId, "🏠 Enter Full Address with PIN Code:");
      return res.sendStatus(200);
    }

    if (userData.step === "address") {
      await userRef.update({ tempAddress: text, step: "mobile" });
      await sendMessage(chatId, "📱 Enter Mobile Number:");
      return res.sendStatus(200);
    }

    if (userData.step === "mobile") {
      await userRef.update({ tempMobile: text, step: "scheme" });

      await sendMessage(chatId,
`📦 Choose Scheme:

/Monthly scheme
/Smart scheme`);
      return res.sendStatus(200);
    }

    if (userData.step === "scheme") {
      if (text !== "/Monthly scheme" && text !== "/Smart scheme") {
        await sendMessage(chatId, "Please choose valid scheme.");
        return res.sendStatus(200);
      }

      await userRef.update({ tempScheme: text, step: "payment" });

      await sendMessage(chatId,
`💳 Registration Advance Amount: ₹200

Pay using UPI:

upi://pay?pa=thamizharasanmassboy-1@okaxis&pn=Thamizh&am=200&cu=INR&tn=Register%20for%20Maha%20JS%20Mobile%20Shop

Send payment screenshot after payment.`);
      return res.sendStatus(200);
    }

    // ==========================
    // PAYMENT SCREENSHOT
    // ==========================
    if (userData.step === "payment" && (message.photo || message.document)) {

      let fileId = null;

      if (message.photo) {
        fileId = message.photo[message.photo.length - 1].file_id;
      }

      if (message.document && message.document.mime_type?.startsWith("image/")) {
        fileId = message.document.file_id;
      }

      if (!fileId) {
        await sendMessage(chatId, "Please send payment screenshot as image.");
        return res.sendStatus(200);
      }

      const fileInfo = await axios.get(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${fileId}`
      );

      const filePath = fileInfo.data.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;

      const fileData = await axios.get(fileUrl, { responseType: "arraybuffer" });

      const bufferStream = new stream.PassThrough();
      bufferStream.end(fileData.data);

      const driveFile = await drive.files.create({
        requestBody: {
          name: `${chatId}_payment_${Date.now()}.jpg`,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
        },
        media: {
          mimeType: "image/jpeg",
          body: bufferStream,
        },
      });

      const screenshotURL =
        `https://drive.google.com/file/d/${driveFile.data.id}/view`;

      const customerRef = await db.collection("Customer").add({
        chatId,
        username,
        name: userData.tempName,
        address: userData.tempAddress,
        mobile: userData.tempMobile,
        scheme: userData.tempScheme,
        status: "active",
        joiningDate: new Date(),
      });

      await db.collection("Payment").add({
        chatId,
        username,
        name: userData.tempName,
        customerId: customerRef.id,
        screenshotURL,
        status: "pending",
        paymentDate: new Date(),
      });

      await userRef.update({
        status: "active",
        step: "",
      });

      await sendMessage(chatId, "🎉 Registration Successful! Screenshot received.");

      return res.sendStatus(200);
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error("ERROR:", error);
    return res.sendStatus(500);
  }
});

// ==============================
// MESSAGE FUNCTIONS
// ==============================
async function sendWelcome(chatId, name) {
  await sendMessage(chatId,
`👋 Welcome ${name}!

I am Maha JS Mobile Shop 🤖  
Your virtual assistant.

Choose:
/New
/Scheme
/Offers`);
}

async function sendMessage(chatId, text) {
  await axios.post(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    { chat_id: chatId, text }
  );
}

export default app;