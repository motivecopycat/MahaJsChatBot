import axios from "axios";
import { google } from "googleapis";
import stream from "stream";

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).send("Bot running");
    }

    console.log("Webhook hit");

    const message = req.body.message;
    if (!message) return res.status(200).end();

    const chatId = message.chat.id;

    // Only process images
    if (!message.photo && !message.document) {
      await sendMessage(chatId, "📸 Please send a screenshot image.");
      return res.status(200).end();
    }

    let fileId = null;

    // If sent as photo
    if (message.photo) {
      fileId = message.photo[message.photo.length - 1].file_id;
    }

    // If sent as document image
    if (
      message.document &&
      message.document.mime_type &&
      message.document.mime_type.startsWith("image/")
    ) {
      fileId = message.document.file_id;
    }

    if (!fileId) {
      await sendMessage(chatId, "⚠ Please send image file.");
      return res.status(200).end();
    }

    console.log("File ID:", fileId);

    // Get file path
    const fileInfo = await axios.get(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${fileId}`
    );

    const filePath = fileInfo.data.result.file_path;

    const fileUrl =
      `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;

    console.log("Downloading:", fileUrl);

    // Download image
    const fileData = await axios.get(fileUrl, {
      responseType: "arraybuffer",
    });

    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileData.data);

    console.log("Uploading to Drive...");

    // Upload to Drive
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

    const driveLink =
      `https://drive.google.com/file/d/${driveFile.data.id}/view`;

    console.log("Uploaded:", driveLink);

    await sendMessage(
      chatId,
      `✅ Screenshot uploaded successfully!\n\n${driveLink}`
    );

    return res.status(200).end();

  } catch (error) {
    console.error("ERROR:", error.response?.data || error.message);
    return res.status(500).end();
  }
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