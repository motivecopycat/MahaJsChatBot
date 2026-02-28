import axios from "axios";
import admin from "firebase-admin";
import { google } from "googleapis";
import stream from "stream";

// 🔥 Firebase Init
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// 🔥 Google Drive Auth
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(200).send("OK");

    const body = req.body;
    if (!body.message) return res.status(200).send("No message");

    const chatId = body.message.chat.id.toString();
    const username = body.message.from.username || "";
    const name = body.message.from.first_name || "Customer";
    const text = body.message.text || "";

    const userRef = db.collection("telegramUser").doc(chatId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await userRef.set({
        chatId,
        username,
        name,
        joinDate: new Date(),
        status: "guest",
        step: ""
      });

      await sendMessage(chatId,
`👋 Welcome ${name}!

I am Maha JS Mobile Shop 🤖  
Your virtual assistant.

Please choose:

/New
/Scheme
/Offers`);

      return res.status(200).send("New user");
    }

    const userData = (await userRef.get()).data();

    // =========================
    // START REGISTRATION
    // =========================
    if (text === "/New") {
      await userRef.update({ step: "fullName" });
      await sendMessage(chatId, "📝 Enter your Full Name:");
      return res.status(200).send("Ask name");
    }

    // FULL NAME
    if (userData.step === "fullName") {
      await userRef.update({
        tempFullName: text,
        step: "address"
      });

      await sendMessage(chatId,
`🏠 Enter Full Address:

House No:
Street:
Area:
City:
Pincode:`);

      return res.status(200).send("Ask address");
    }

    // ADDRESS
    if (userData.step === "address") {
      await userRef.update({
        tempAddress: text,
        step: "scheme"
      });

      await sendMessage(chatId,
`📦 Choose Scheme:

/Monthly scheme
/Smart scheme`);

      return res.status(200).send("Ask scheme");
    }

    // SCHEME
    if (userData.step === "scheme") {
      await userRef.update({
        tempScheme: text,
        step: "payment"
      });

      await sendMessage(chatId,
`💳 Pay ₹200 Advance

Send payment screenshot after payment.`);
      return res.status(200).send("Ask payment");
    }

    // =========================
    // PAYMENT SCREENSHOT HANDLING
    // =========================
    if (userData.step === "payment" && body.message.photo) {

      const photo = body.message.photo.pop();
      const fileId = photo.file_id;

      // Get file path
      const fileResponse = await axios.get(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${fileId}`
      );

      const filePath = fileResponse.data.result.file_path;

      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;

      const imageResponse = await axios.get(fileUrl, {
        responseType: "arraybuffer",
      });

      // Upload to Drive
      const bufferStream = new stream.PassThrough();
      bufferStream.end(imageResponse.data);

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

      const driveLink = `https://drive.google.com/file/d/${driveFile.data.id}/view`;

      // Get Telegram Profile Photo
      const profilePhotos = await axios.get(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getUserProfilePhotos?user_id=${chatId}`
      );

      let profileImage = "";

      if (profilePhotos.data.result.total_count > 0) {
        const profileFileId =
          profilePhotos.data.result.photos[0][0].file_id;

        const profileFile = await axios.get(
          `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${profileFileId}`
        );

        profileImage =
          `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${profileFile.data.result.file_path}`;
      }

      // Save in customer collection
      await db.collection("customer").add({
        chatId,
        username,
        fullName: userData.tempFullName,
        address: userData.tempAddress,
        scheme: userData.tempScheme,
        paymentScreenshot: driveLink,
        profileImage,
        joinDate: new Date(),
        status: "active"
      });

      await userRef.update({
        status: "active",
        step: "",
        tempFullName: admin.firestore.FieldValue.delete(),
        tempAddress: admin.firestore.FieldValue.delete(),
        tempScheme: admin.firestore.FieldValue.delete()
      });

      await sendMessage(chatId,
`🎉 Registration Successful!

Payment received.

Welcome to Maha JS Mobile Shop 📱✨`);

      return res.status(200).send("Registration complete");
    }

    return res.status(200).send("Done");

  } catch (error) {
    console.error(error);
    return res.status(500).send("Error");
  }
}

async function sendMessage(chatId, text) {
  await axios.post(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      chat_id: chatId,
      text
    }
  );
}