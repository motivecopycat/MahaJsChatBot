import axios from "axios";

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

export default async function handler(req, res) {

  // For browser test
  if (req.method !== "POST") {
    return res.status(200).send("Telegram Bot Running 🚀");
  }

  const message = req.body.message;

  if (!message) {
    return res.status(200).send("No message");
  }

  const chatId = message.chat.id;
  const text = message.text;

  // /start command
  if (text === "/start") {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: "👋 Welcome to my Telegram Bot!\n\nYour bot is live on Vercel 🚀"
    });
  } else {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: "You said: " + text
    });
  }

  return res.status(200).send("OK");
}