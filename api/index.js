import axios from "axios";

export default async function handler(req, res) {
  let chatId;

  try {
    if (req.method !== "POST") {
      return res.status(200).send("Bot running");
    }

    const update = req.body;
    if (!update?.message) return res.status(200).end();

    const message = update.message;
    chatId = message.chat.id;

    // ======================
    // TEXT MESSAGE → ECHO
    // ======================
    if (message.text) {
      await sendMessage(chatId, message.text);
    }

    // ======================
    // IMAGE MESSAGE → RETURN DOWNLOAD LINK
    // ======================
    if (message.photo) {

      const fileId = message.photo[message.photo.length - 1].file_id;

      // Get file path from Telegram
      const fileRes = await axios.get(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${fileId}`
      );

      const filePath = fileRes.data.result.file_path;

      const downloadLink = 
        `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;

      await sendMessage(
        chatId,
        `📥 Image Download Link:\n${downloadLink}`
      );
    }

    return res.status(200).end();

  } catch (error) {
    console.error("ERROR:", error.message);

    if (chatId) {
      await sendMessage(chatId, "❌ Error occurred.");
    }

    return res.status(200).end();
  }
}

// ======================
// Send Message Function
// ======================
async function sendMessage(chatId, text) {
  await axios.post(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      chat_id: chatId,
      text: text
    }
  );
}