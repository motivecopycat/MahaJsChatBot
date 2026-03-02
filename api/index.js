import axios from "axios";

export default async function handler(req, res) {
  try {
    // Health check
    if (req.method !== "POST") {
      return res.status(200).send("Bot running");
    }

    // IMPORTANT: Vercel sometimes needs manual body parsing
    const update = req.body;

    if (!update) {
      return res.status(200).end();
    }

    const message = update.message;
    if (!message) {
      return res.status(200).end();
    }

    const chatId = message.chat.id;

    // TEXT MESSAGE
    if (message.text) {
      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: `You said: ${message.text}`
        }
      );
    }

    // IMAGE MESSAGE
    if (message.photo) {
      const fileId = message.photo[message.photo.length - 1].file_id;

      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendPhoto`,
        {
          chat_id: chatId,
          photo: fileId,
          caption: "📸 Image received!"
        }
      );
    }

    return res.status(200).end();

  } catch (error) {
    console.error("ERROR:", error.message);
    return res.status(200).end(); // NEVER return 500 to Telegram
  }
}