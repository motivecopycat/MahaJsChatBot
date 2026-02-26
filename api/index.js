import axios from "axios";

export default async function handler(req, res) {
  try {
    console.log("Request received");

    if (req.method !== "POST") {
      return res.status(200).send("OK");
    }

    const body = req.body;

    if (!body || !body.message) {
      return res.status(200).send("No message");
    }

    const chatId = body.message.chat.id;

    await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: "Bot working ✅",
      }
    );

    return res.status(200).send("Sent");
  } catch (error) {
    console.error("ERROR:", error.message);
    return res.status(500).send("Error");
  }
}