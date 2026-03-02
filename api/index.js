import axios from "axios";
import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).send("Bot running");
    }

    const update = req.body;
    if (!update?.message) {
      return res.status(200).end();
    }

    const message = update.message;
    const chatId = message.chat.id;

    // ==========================
    // TEXT MESSAGE (Echo Reply)
    // ==========================
    if (message.text) {
      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: message.text
        }
      );
    }

    // ==========================
    // IMAGE MESSAGE
    // ==========================
    if (message.photo) {

      const fileId = message.photo[message.photo.length - 1].file_id;

      // Get Telegram file path
      const fileRes = await axios.get(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${fileId}`
      );

      const filePath = fileRes.data.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;

      // Download image
      const imageRes = await axios.get(fileUrl, {
        responseType: "arraybuffer"
      });

      // Google Drive Auth
      const auth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        null,
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        ["https://www.googleapis.com/auth/drive"]
      );

      const drive = google.drive({ version: "v3", auth });

      // ==================================
      // CREATE FOLDER USING USERNAME
      // ==================================

      const username =
        message.from.username ||
        message.from.first_name ||
        `user_${chatId}`;

      // Check if folder already exists
      const folderSearch = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${username}' and '${process.env.PARENT_FOLDER_ID}' in parents and trashed=false`,
        fields: "files(id, name)"
      });

      let userFolderId;

      if (folderSearch.data.files.length > 0) {
        // Folder exists
        userFolderId = folderSearch.data.files[0].id;
      } else {
        // Create new folder
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

      // ==================================
      // Upload Image into User Folder
      // ==================================

      await drive.files.create({
        requestBody: {
          name: `image_${Date.now()}.jpg`,
          mimeType: "image/jpeg",
          parents: [userFolderId]
        },
        media: {
          mimeType: "image/jpeg",
          body: Buffer.from(imageRes.data)
        }
      });

      // Confirm to user
      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: "✅ Image uploaded inside your personal folder!"
        }
      );
    }

    return res.status(200).end();

  } catch (error) {
    console.error("ERROR:", error.message);
    return res.status(200).end();
  }
}