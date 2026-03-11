const { openaiModel, openaiImageModel, maxAIHistory } = require("../config");
const db = require("./datastore");
const fs = require("fs");
const path = require("path");

let openai = null;

function getClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    const { OpenAI } = require("openai");
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const HISTORY_DEFAULTS = { conversations: {} };

const SYSTEM_PROMPT = `You are IgniteBot, a friendly and helpful WhatsApp assistant. 
You respond concisely and helpfully. You use WhatsApp formatting: *bold*, _italic_, ~strikethrough~.
Keep responses brief and relevant. Use emojis appropriately.`;

function getUserHistory(jid) {
  const data = db.read("ai_history", HISTORY_DEFAULTS);
  return data.conversations[jid] || [];
}

function saveHistory(jid, messages) {
  db.update("ai_history", HISTORY_DEFAULTS, (data) => {
    data.conversations[jid] = messages.slice(-maxAIHistory * 2);
  });
}

function clearHistory(jid) {
  db.update("ai_history", HISTORY_DEFAULTS, (data) => {
    delete data.conversations[jid];
  });
}

async function chat(jid, userMessage) {
  const client = getClient();
  if (!client) {
    return "⚠️ AI features require an OpenAI API key. Set OPENAI_API_KEY in your environment.";
  }

  const history = getUserHistory(jid);
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMessage },
  ];

  try {
    const response = await client.chat.completions.create({
      model: openaiModel,
      messages,
      max_tokens: 500,
    });
    const reply = response.choices[0].message.content;
    saveHistory(jid, [
      ...history,
      { role: "user", content: userMessage },
      { role: "assistant", content: reply },
    ]);
    return reply;
  } catch (err) {
    return `❌ AI error: ${err.message}`;
  }
}

async function ask(question) {
  const client = getClient();
  if (!client) {
    return "⚠️ AI features require an OpenAI API key. Set OPENAI_API_KEY in your environment.";
  }
  try {
    const response = await client.chat.completions.create({
      model: openaiModel,
      messages: [
        { role: "system", content: "You are a helpful assistant. Answer questions accurately and concisely. Use WhatsApp markdown: *bold*, _italic_." },
        { role: "user", content: question },
      ],
      max_tokens: 600,
    });
    return response.choices[0].message.content;
  } catch (err) {
    return `❌ Error: ${err.message}`;
  }
}

async function summarize(text) {
  const client = getClient();
  if (!client) {
    return "⚠️ AI features require an OpenAI API key.";
  }
  try {
    const response = await client.chat.completions.create({
      model: openaiModel,
      messages: [
        { role: "system", content: "Summarize the following text clearly and concisely in bullet points. Use WhatsApp formatting." },
        { role: "user", content: text },
      ],
      max_tokens: 400,
    });
    return response.choices[0].message.content;
  } catch (err) {
    return `❌ Error: ${err.message}`;
  }
}

async function generateImage(prompt) {
  const client = getClient();
  if (!client) {
    return { error: "⚠️ AI features require an OpenAI API key." };
  }
  try {
    const response = await client.images.generate({
      model: openaiImageModel,
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "url",
    });
    return { url: response.data[0].url, revisedPrompt: response.data[0].revised_prompt };
  } catch (err) {
    return { error: `❌ Image generation error: ${err.message}` };
  }
}

async function textToSpeech(text, outputPath) {
  const client = getClient();
  if (!client) {
    return { error: "⚠️ TTS requires an OpenAI API key." };
  }
  try {
    const response = await client.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: text.slice(0, 4096),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    return { path: outputPath };
  } catch (err) {
    return { error: `❌ TTS error: ${err.message}` };
  }
}

async function translateWithAI(text, targetLang) {
  const client = getClient();
  if (!client) return null;
  try {
    const response = await client.chat.completions.create({
      model: openaiModel,
      messages: [
        {
          role: "system",
          content: `Translate the following text to ${targetLang}. Return only the translated text, nothing else.`,
        },
        { role: "user", content: text },
      ],
      max_tokens: 500,
    });
    return response.choices[0].message.content;
  } catch {
    return null;
  }
}

module.exports = { chat, ask, summarize, generateImage, textToSpeech, translateWithAI, clearHistory };
