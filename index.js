require("dotenv").config();

const express = require("express");
const axios = require("axios");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Meta webhook doğrulaması
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("Webhook doğrulandı.");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// WhatsApp mesajlarını alma
app.post("/webhook", (req, res) => {
  res.sendStatus(200);

  handleIncomingMessage(req.body).catch((error) => {
    console.error(
      "Mesaj işleme hatası:",
      error.response?.data || error.message
    );
  });
});

async function handleIncomingMessage(body) {
  const message =
    body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message || message.type !== "text") {
    return;
  }

  const customerNumber = message.from;
  const customerMessage = message.text?.body?.trim();

  if (!customerMessage) {
    return;
  }

  console.log("Gelen mesaj:", customerMessage);

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    instructions: `
Sen MV Proje Yönetim ve Danışmanlık şirketinin WhatsApp yapay zekâ asistanısın.

Türkçe, kurumsal, anlaşılır ve kısa cevaplar ver.
KOSGEB, dijital dönüşüm, yapay zekâ dönüşümü ve devlet destekleri konusunda ön bilgilendirme yap.
Kesin destek uygunluğu veya kesin onay sözü verme.
Gerekli olduğunda müşterinin adını, ilini, sektörünü, kuruluş tarihini ve ihtiyacını sor.
Kişisel veya hassas bilgi isteme.
Detaylı inceleme gerektiğinde uzman danışmanın dönüş yapacağını belirt.
`,
    input: customerMessage,
  });

  const aiReply =
    response.output_text ||
    "Mesajınızı aldım. Size yardımcı olabilmem için firmanızın faaliyet alanını ve kuruluş yılını yazar mısınız?";

  await axios.post(
    `https://graph.facebook.com/v25.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: customerNumber,
      type: "text",
      text: {
        preview_url: false,
        body: aiReply,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  console.log("Yanıt gönderildi:", aiReply);
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`MV WhatsApp AI çalışıyor: http://localhost:${PORT}`);
});
