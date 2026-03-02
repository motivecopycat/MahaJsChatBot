import axios from "axios";
import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).send("Bot running");
    }

    const update = req.body;
    if (!update?.message) return res.status(200).end();

    const message = update.message;
    const chatId = message.chat.id;

    // =========================
    // TEXT ECHO
    // =========================
    if (message.text) {
      await sendMessage(chatId, message.text);
    }

    // =========================
    // HANDLE ANY FILE TYPE
    // =========================

    let fileId = null;
    let fileName = `file_${Date.now()}`;

    if (message.photo) {
      fileId = message.photo[message.photo.length - 1].file_id;
      fileName += ".jpg";
    }

    if (message.document) {
      fileId = message.document.file_id;
      fileName = message.document.file_name;
    }

    if (message.video) {
      fileId = message.video.file_id;
      fileName += ".mp4";
    }

    if (message.audio) {
      fileId = message.audio.file_id;
      fileName += ".mp3";
    }

    if (!fileId) return res.status(200).end();

    // =========================
    // GET FILE FROM TELEGRAM
    // =========================

    const fileRes = await axios.get(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${fileId}`
    );

    const filePath = fileRes.data.result.file_path;

    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;

    const fileData = await axios.get(fileUrl, {
      responseType: "arraybuffer"
    });

    // =========================
    // GOOGLE DRIVE AUTH
    // =========================

    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/drive"]
    );

    const drive = google.drive({ version: "v3", auth });

    // =========================
    // CREATE / GET USER FOLDER
    // =========================

    const username =
      message.from.username ||
      message.from.first_name ||
      `user_${chatId}`;

    const search = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${username}' and '${process.env.PARENT_FOLDER_ID}' in parents and trashed=false`,
      fields: "files(id, name)"
    });

    let userFolderId;

    if (search.data.files.length > 0) {
      userFolderId = search.data.files[0].id;
    } else {
      const folder = await drive.files.create({
        requestBody: {
          name: username,
          mimeType: "application/vnd.google-apps.folder",
          parents: [process.env.PARENT_FOLDER_ID]
        },
        fields: "id"
      });

      userFolderId = folder.data.id;
    }

    // =========================
    // UPLOAD FILE TO DRIVE
    // =========================

    await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [userFolderId]
      },
      media: {
        body: Buffer.from(fileData.data)
      }
    });

    await sendMessage(chatId, "✅ File uploaded to your Drive folder!");

    return res.status(200).end();

  } catch (error) {
    console.error("UPLOAD ERROR:", error.response?.data || error.message);
    return res.status(200).end();
  }
}

// Helper function
async function sendMessage(chatId, text) {
  await axios.post(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      chat_id: chatId,
      text: text
    }
  );
}