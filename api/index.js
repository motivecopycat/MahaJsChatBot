import axios from "axios";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).send("Bot running");
    }

    const message = req.body.message;
    if (!message) return res.status(200).end();

    const chatId = message.chat.id;

    // If user sends photo
    if (message.photo) {
      const fileId = message.photo[message.photo.length - 1].file_id;

      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendPhoto`,
        {
          chat_id: chatId,
          photo: fileId,
          caption: "📸 You sent this image!"
        }
      );

      return res.status(200).end();
    }

    // If user sends image as document
    if (
      message.document &&
      message.document.mime_type &&
      message.document.mime_type.startsWith("image/")
    ) {
      const fileId = message.document.file_id;

      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendPhoto`,
        {
          chat_id: chatId,
          photo: fileId,
          caption: "📸 You sent this image!"
        }
      );

      return res.status(200).end();
    }

    return res.status(200).end();

  } catch (error) {
    console.error("ERROR:", error.response?.data || error.message);
    return res.status(500).end();
  }
}