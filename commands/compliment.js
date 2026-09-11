module.exports = {
    name: 'compliment',
    description: 'Compliment someone',

    async execute(sock, m, from) {
        const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (!mentions.length) {
            return sock.sendMessage(from, {
                text: '❤️ Tag someone to compliment!'
            });
        }

        const target = mentions[0];

        const compliments = [
            'You have an amazing personality! ❤️',
            'Your energy is honestly unmatched. 🔥',
            'You make this group more fun. 😍',
            'You are genuinely a wonderful person. ❤️',
            'Your vibe is absolutely amazing! ✨',
            'You deserve all the good things coming your way. ❤️',
            'You are one of a kind! 👑',
            'Your presence makes people smile. 😊'
        ];

        await sock.sendMessage(from, {
            text: `💖 *COMPLIMENT* 💖

@${target.split('@')[0]}

${compliments[Math.floor(Math.random() * compliments.length)]}`,
            mentions: [target]
        });
    }
};
