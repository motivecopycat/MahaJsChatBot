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
    // TEXT → ECHO
    // ======================
    if (message.text) {
      await sendMessage(chatId, message.text);
    }

    // ======================
    // IMAGE → HTML DOWNLOAD LINK
    // ======================
    if (message.photo) {

      const fileId = message.photo[message.photo.length - 1].file_id;

      const fileRes = await axios.get(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${fileId}`
      );

      const filePath = fileRes.data.result.file_path;

      const downloadLink =
        `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;

      const htmlMessage = `
<b>✅ Image Ready</b>

📥 <a href="${downloadLink}">Click here to download your image</a>
`;

      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: htmlMessage,
          parse_mode: "HTML",
          disable_web_page_preview: true
        }
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

// Simple text sender
async function sendMessage(chatId, text) {
  await axios.post(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      chat_id: chatId,
      text: text
    }
  );
}