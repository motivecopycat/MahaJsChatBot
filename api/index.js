import axios from "axios";
import admin from "firebase-admin";
import { google } from "googleapis";
import stream from "stream";

// 🔥 Firebase Init
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

const db = admin.firestore();

// 🔥 Google Drive Init
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth });

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(200).send("OK");

    const message = req.body.message;
    if (!message) return res.status(200).send("No message");

    const chatId = message.chat.id.toString();
    const username = message.from.username || "";
    const name = message.from.first_name || "Customer";
    const text = message.text || "";

    const userRef = db.collection("telegramUser").doc(chatId);
    const userDoc = await userRef.get();

    // ======================
    // NEW TELEGRAM USER
    // ======================
    if (!userDoc.exists) {
      await userRef.set({
        name,
        username,
        chatId,
        status: "guest",
        step: "",
        lastChat: new Date(),
      });

      await sendWelcome(chatId, name);
      return res.status(200).send("New User");
    }

    const userData = (await userRef.get()).data();

    await userRef.update({ lastChat: new Date() });

    // ======================
    // MENU COMMANDS
    // ======================
    if (text === "/Scheme") {
      await sendMessage(
        chatId,
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
      await sendMessage(
        chatId,
`🔥 Current Offers:

• Cashback offers
• Bonus savings
• Festival discounts

View full details:
https://your-offer-link.com`
      );
      return res.status(200).send("Offers");
    }

    // ======================
    // START REGISTRATION
    // ======================
    if (text === "/New") {
      const customerQuery = await db
        .collection("Customer")
        .where("chatId", "==", chatId)
        .get();

      if (!customerQuery.empty) {
        await sendMessage(
          chatId,
`👋 You are already registered!

Choose:
/pay
/savings`
        );
        return res.status(200).send("Already registered");
      }

      await userRef.update({ step: "fullName" });
      await sendMessage(chatId, "📝 Enter your Full Name:");
      return res.status(200).send("Ask name");
    }

    // ======================
    // STEP FLOW
    // ======================

    if (userData.step === "fullName") {
      await userRef.update({ tempName: text, step: "address" });
      await sendMessage(
        chatId,
"🏠 Enter Full Address with PIN Code:"
      );
      return res.status(200).send("Address");
    }

    if (userData.step === "address") {
      await userRef.update({ tempAddress: text, step: "mobile" });
      await sendMessage(chatId, "📱 Enter Mobile Number:");
      return res.status(200).send("Mobile");
    }

    if (userData.step === "mobile") {
      await userRef.update({ tempMobile: text, step: "chooseScheme" });

      await sendMessage(
        chatId,
`📦 Choose Scheme:

/Monthly scheme
/Smart scheme`
      );
      return res.status(200).send("Choose scheme");
    }

    if (userData.step === "chooseScheme") {
      if (text !== "/Monthly scheme" && text !== "/Smart scheme") {
        await sendMessage(chatId, "Select valid scheme.");
        return res.status(200).send("Invalid scheme");
      }

      await userRef.update({ tempScheme: text, step: "payment" });

      await sendMessage(
        chatId,
`💳 Registration Advance Amount: ₹200

Pay using UPI:

upi://pay?pa=thamizharasanmassboy-1@okaxis&pn=Thamizh&am=200&cu=INR&tn=Register%20for%20Maha%20JS%20Mobile%20Shop

Send payment screenshot after payment.`
      );

      return res.status(200).send("Payment step");
    }

    // ======================
    // PAYMENT SCREENSHOT
    // ======================
    if (userData.step === "payment" && message.photo) {
      const photo = message.photo.pop();
      const fileId = photo.file_id;

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

      // Get Telegram profile photo
      let profileImage = "";
      const profilePhotos = await axios.get(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getUserProfilePhotos?user_id=${chatId}`
      );

      if (profilePhotos.data.result.total_count > 0) {
        const profileFileId =
          profilePhotos.data.result.photos[0][0].file_id;

        const profileFile = await axios.get(
          `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${profileFileId}`
        );

        profileImage = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${profileFile.data.result.file_path}`;
      }

      // Save Customer
      const customerRef = await db.collection("Customer").add({
        chatId,
        username,
        name: userData.tempName,
        address: userData.tempAddress,
        mobile: userData.tempMobile,
        scheme: userData.tempScheme,
        profileImage,
        status: "active",
        joiningDate: new Date(),
      });

      // Save Payment
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

      await sendMessage(chatId, "🎉 Registration Successful!");
      return res.status(200).send("Registered");
    }

    // DEFAULT MENU
    await sendWelcome(chatId, name);
    return res.status(200).send("Menu");

  } catch (error) {
    console.error(error);
    return res.status(500).send("Error");
  }
}

async function sendWelcome(chatId, name) {
  await sendMessage(
    chatId,
`👋 Welcome ${name}!

I am Maha JS Mobile Shop 🤖  
Your virtual assistant.

Choose:
/New registration
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