import axios from "axios";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).send("OK");
    }

    const body = req.body;

    if (!body || !body.message) {
      return res.status(200).send("No message");
    }

    const chatId = body.message.chat.id;
    const userText = body.message.text;

    // If no text (like sticker/photo)
    if (!userText) {
      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: "Send me a text message 😊",
        }
      );

      return res.status(200).send("No text");
    }

    // 🔥 Echo reply
    await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: `You said: ${userText}`,
      }
    );

    return res.status(200).send("Message sent");
  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).send("Error");
  }
}