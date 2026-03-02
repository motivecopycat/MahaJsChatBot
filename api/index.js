import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  let chatId;

  try {
    if (req.method !== "POST") {
      return res.status(200).send("Bot running");
    }

    const update = req.body;
    if (!update?.message) {
      return res.status(200).end();
    }

    const message = update.message;
    chatId = message.chat.id;

    // =====================
    // TEXT ECHO
    // =====================
    if (message.text) {
      await sendMessage(chatId, message.text);
    }

    // =====================
    // DETECT FILE
    // =====================
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

    if (!fileId) {
      return res.status(200).end();
    }

    // =====================
    // DOWNLOAD FILE FROM TELEGRAM
    // =====================
    const fileRes = await axios.get(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${fileId}`
    );

    const filePath = fileRes.data.result.file_path;

    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;

    const fileResponse = await axios.get(fileUrl, {
      responseType: "arraybuffer"
    });

    const fileBuffer = new Uint8Array(fileResponse.data);

    // =====================
    // CREATE USER FOLDER PATH
    // =====================
    const username =
      message.from.username ||
      message.from.first_name ||
      `user_${chatId}`;

    const path = `${username}/${fileName}`;

    // =====================
    // UPLOAD TO SUPABASE
    // =====================
    const { error } = await supabase.storage
      .from("telegram-files")
      .upload(path, fileBuffer, {
        contentType: "application/octet-stream",
        upsert: true
      });

    if (error) {
      console.error("Upload Error:", error);
      throw error;
    }

    await sendMessage(chatId, "✅ File uploaded to Supabase!");

    return res.status(200).end();

  } catch (error) {
    console.error("FULL ERROR:", error);

    if (chatId) {
      await sendMessage(chatId, "❌ Upload failed.");
    }

    return res.status(200).end();
  }
}

// =====================
// SEND MESSAGE
// =====================
async function sendMessage(chatId, text) {
  await axios.post(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      chat_id: chatId,
      text: text
    }
  );
}