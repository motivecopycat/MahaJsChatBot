import axios from "axios";
import admin from "firebase-admin";
import { google } from "googleapis";
import stream from "stream";

// =============================
// 🔥 FIREBASE INIT
// =============================
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

const db = admin.firestore();

// =============================
// 🔥 GOOGLE DRIVE INIT
// =============================
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth });

// =============================
// 🚀 MAIN HANDLER
// =============================
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(200).send("OK");

    const message = req.body.message;
    if (!message) return res.status(200).send("No message");

    const chatId = message.chat.id.toString();
    const username = message.from.username || "";
    const firstName = message.from.first_name || "Customer";
    const text = message.text;

    if (!text && !message.photo && !message.document) {
      return res.status(200).send("Ignored");
    }

    const userRef = db.collection("telegramUser").doc(chatId);
    const userDoc = await userRef.get();

    // =============================
    // NEW USER
    // =============================
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

      return res.status(200).send("User created");
    }

    // Always refresh latest user data
    const latestDoc = await userRef.get();
    const userData = latestDoc.data();

    await userRef.update({ lastChat: new Date() });

    // =============================
    // BASIC COMMANDS
    // =============================

    if (text === "/start") {
      await sendWelcome(chatId, firstName);
      return res.status(200).send("Start");
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
https://your-scheme-link.com`
      );
      return res.status(200).send("Scheme");
    }

    if (text === "/Offers") {
      await sendMessage(chatId,
`🔥 Current Offers:

• Cashback bonus
• Festival discount
• Loyalty rewards

More details:
https://your-offer-link.com`
      );
      return res.status(200).send("Offers");
    }

    // =============================
    // START REGISTRATION
    // =============================
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
/savings`
        );
        return res.status(200).send("Already registered");
      }

      await userRef.update({ step: "name" });
      await sendMessage(chatId, "📝 Enter your Full Name:");
      return res.status(200).send("Ask name");
    }

    // =============================
    // STEP FLOW
    // =============================

    if (userData.step === "name") {
      await userRef.update({ tempName: text, step: "address" });
      await sendMessage(chatId, "🏠 Enter Full Address with PIN Code:");
      return res.status(200).send("Address");
    }

    if (userData.step === "address") {
      await userRef.update({ tempAddress: text, step: "mobile" });
      await sendMessage(chatId, "📱 Enter Mobile Number:");
      return res.status(200).send("Mobile");
    }

    if (userData.step === "mobile") {
      await userRef.update({ tempMobile: text, step: "scheme" });
      await sendMessage(chatId,
`📦 Choose Scheme:

/Monthly scheme
/Smart scheme`
      );
      return res.status(200).send("Choose scheme");
    }

    if (userData.step === "scheme") {
      if (text !== "/Monthly scheme" && text !== "/Smart scheme") {
        await sendMessage(chatId, "Please choose valid scheme.");
        return res.status(200).send("Invalid scheme");
      }

      await userRef.update({ tempScheme: text, step: "payment" });

      await sendMessage(chatId,
`💳 Registration Advance Amount: ₹200

Pay using UPI:

upi://pay?pa=thamizharasanmassboy-1@okaxis&pn=Thamizh&am=200&cu=INR&tn=Register%20for%20Maha%20JS%20Mobile%20Shop

Send payment screenshot after payment.`
      );

      return res.status(200).send("Payment step");
    }

    // =============================
    // PAYMENT SCREENSHOT
    // =============================
    if (userData.step === "payment" && (message.photo || message.document)) {

      let fileId;

      if (message.photo) {
        fileId = message.photo[message.photo.length - 1].file_id;
      }

      if (message.document) {
        fileId = message.document.file_id;
      }

      const fileInfo = await axios.get(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${fileId}`
      );

      const filePath = fileInfo.data.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;

      const fileData = await axios.get(fileUrl, {
        responseType: "arraybuffer",
      });

      const bufferStream = new stream.PassThrough();
      bufferStream.end(fileData.data);

      const driveFile = await drive.files.create({
        requestBody: {
          name: `${chatId}_payment.jpg`,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
        },
        media: {
          mimeType: "image/jpeg",
          body: bufferStream,
        },
      });

      const screenshotURL = `https://drive.google.com/file/d/${driveFile.data.id}/view`;

      const customerRef = await db.collection("Customer").add({
        chatId,
        username,
        name: userData.tempName,
        address: userData.tempAddress,
        mobile: userData.tempMobile,
        scheme: userData.tempScheme,
        profileImage: "",
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

      return res.status(200).send("Registered");
    }

    return res.status(200).send("No action");

  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).send("Error");
  }
}

// =============================
// MESSAGE FUNCTIONS
// =============================

async function sendWelcome(chatId, name) {
  await sendMessage(chatId,
`👋 Welcome ${name}!

I am Maha JS Mobile Shop 🤖  
Your virtual assistant.

Choose:
/New
/Scheme
/Offers`
  );
}

async function sendMessage(chatId, text) {
  await axios.post(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      chat_id: chatId,
      text,
    }
  );
}