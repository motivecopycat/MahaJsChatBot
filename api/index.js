import axios from "axios";

export default async function handler(req, res) {
  try {

    if (req.method !== "POST") {
      return res.status(200).send("Bot running");
    }

    console.log("Webhook triggered");

    const body = req.body || {};
    const message = body.message;

    if (!message) {
      return res.status(200).end();
    }

    const chatId = message.chat.id;

    // Echo text
    if (message.text) {
      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: `You said: ${message.text}`
        }
      );
    }

    // Echo image
    if (message.photo) {
      const fileId = message.photo[message.photo.length - 1].file_id;

      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendPhoto`,
        {
          chat_id: chatId,
          photo: fileId
        }
      );
    }

    return res.status(200).end();

  } catch (error) {
    console.error("Error:", error.message);
    return res.status(200).end(); // IMPORTANT: never return 500 to Telegram
  }
}