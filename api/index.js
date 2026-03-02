import axios from "axios";

export default async function handler(req, res) {
  try {

    console.log("Method:", req.method);
    console.log("Body:", req.body);
    console.log("Token exists:", !!process.env.BOT_TOKEN);

    if (req.method !== "POST") {
      return res.status(200).send("Bot running");
    }

    const message = req.body?.message;

    if (!message) {
      console.log("No message found");
      return res.status(200).end();
    }

    const chatId = message.chat.id;

    if (message.text) {
      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: `Echo: ${message.text}`
        }
      );
    }

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
    console.error("FULL ERROR:", error);
    return res.status(200).end();
  }
}