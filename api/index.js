import express from "express";
import axios from "axios";
import { google } from "googleapis";
import stream from "stream";

const app = express();
app.use(express.json());

// =============================
// 🔥 GOOGLE DRIVE AUTH
// =============================
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

// =============================
// 🚀 TELEGRAM WEBHOOK
// =============================
app.post("/", async (req, res) => {
  try {
    const message = req.body.message;
    if (!message) return res.sendStatus(200);

    const chatId = message.chat.id;

    // Only process photo
    if (!message.photo) {
      await sendMessage(chatId, "Please send an image.");
      return res.sendStatus(200);
    }

    // Get largest photo
    const fileId = message.photo[message.photo.length - 1].file_id;

    // Get file path from Telegram
    const fileInfo = await axios.get(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${fileId}`
    );

    const filePath = fileInfo.data.result.file_path;

    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;

    // Download image
    const fileData = await axios.get(fileUrl, {
      responseType: "arraybuffer",
    });

    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileData.data);

    // Upload to Google Drive
    const driveFile = await drive.files.create({
      requestBody: {
        name: `telegram_${Date.now()}.jpg`,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: "image/jpeg",
        body: bufferStream,
      },
    });

    const driveLink = `https://drive.google.com/file/d/${driveFile.data.id}/view`;

    await sendMessage(chatId, `✅ Uploaded Successfully!\n\n${driveLink}`);

    return res.sendStatus(200);

  } catch (error) {
    console.error("ERROR:", error);
    return res.sendStatus(500);
  }
});

// =============================
// 📩 SEND MESSAGE FUNCTION
// =============================
async function sendMessage(chatId, text) {
  await axios.post(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      chat_id: chatId,
      text,
    }
  );
}

export default app;