import axios from "axios";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(200).send("Bot is running");
  }

  console.log("Webhook Hit");

  const message = req.body.message;

  if (!message) {
    return res.status(200).end();
  }

  const chatId = message.chat.id;

  // If user sends photo
  if (message.photo) {
    await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: "📸 Image received!"
      }
    );
  }

  return res.status(200).end();
}