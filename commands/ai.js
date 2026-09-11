require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

module.exports = {
    name: 'ai',
    description: 'Chat with Gemini AI',
    async execute(sock, m, from, args, isOwner) {
        if (!ai) {
            return sock.sendMessage(from, { text: '❌ Gemini API key is missing or not configured in environment variables!' }, { quoted: m });
        }

        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Please provide a prompt for the AI. Example: `!ai Hello`' }, { quoted: m });
        }

        try {
            await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

            const response = await ai.models.generateContent({
                model: 'gemini-flash-latest',
                contents: query,
            });

            const replyText = response.text || 'No response generated.';
            await sock.sendMessage(from, { text: `🤖 *Gemini AI*\n\n${replyText}` }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '✅', key: m.key } });
        } catch (err) {
            console.error('Gemini API Error:', err);
            await sock.sendMessage(from, { text: `❌ *AI Error:* ${err.message}` }, { quoted: m });
        }
    }
};
