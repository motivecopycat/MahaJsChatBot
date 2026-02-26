import axios from "axios";

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;

export const sendMessage = async (chatId, text) => {
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: text,
  });
};