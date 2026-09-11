module.exports = {
    name: 'roast',
    description: 'Roast someone',

    async execute(sock, m, from) {
        const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (!mentions.length) {
            return sock.sendMessage(from, {
                text: '🔥 Tag someone you want me to roast 😂'
            });
        }

        const target = mentions[0];

        const roasts = [
            'Your WiFi signal has more personality than you. 😂',
            'Even Google would struggle to find your common sense. 💀',
            'You bring everyone so much joy... when you leave. 😂',
            'Your brain is definitely running on battery saver mode.',
            'I would roast you harder, but I respect the weak. 😭',
            'You are proof that updates are not always improvements. 😂',
            'Your confidence is impressive considering the evidence. 💀',
            'You have something on your face... oh, never mind, that is your face. 😂'
        ];

        await sock.sendMessage(from, {
            text: `🔥 *ROAST SESSION* 🔥

@${target.split('@')[0]}

${roasts[Math.floor(Math.random() * roasts.length)]}`,
            mentions: [target]
        });
    }
};
