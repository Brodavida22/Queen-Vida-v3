module.exports = {
    name: 'rate',
    description: 'Rate someone',

    async execute(sock, m, from) {
        const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (!mentions.length) {
            return sock.sendMessage(from, {
                text: '⭐ Tag someone to rate!'
            });
        }

        const target = mentions[0];
        const score = Math.floor(Math.random() * 101);

        await sock.sendMessage(from, {
            text: `⭐ *RATING MACHINE* ⭐

👤 @${target.split('@')[0]}

📊 Rating: *${score}/100*

${score >= 90 ? '🔥 Absolutely amazing!' :
  score >= 70 ? '😍 Very good!' :
  score >= 50 ? '🙂 Not bad!' :
  '💀 We need to talk...'}`,
            mentions: [target]
        });
    }
};
