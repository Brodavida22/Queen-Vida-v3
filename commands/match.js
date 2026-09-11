module.exports = {
    name: 'match',
    description: 'Match two people',

    async execute(sock, m, from) {
        const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (mentions.length < 2) {
            return sock.sendMessage(from, {
                text: '❤️ Tag two people to check their match!'
            });
        }

        const score = Math.floor(Math.random() * 101);

        await sock.sendMessage(from, {
            text: `❤️ *MATCH RESULT* ❤️

👤 @${mentions[0].split('@')[0]}
💞
👤 @${mentions[1].split('@')[0]}

📊 Match: *${score}%*

${score >= 80 ? '🔥 Perfect match!' :
  score >= 60 ? '😍 Looking promising!' :
  score >= 40 ? '😏 There is potential...' :
  '😂 Better luck next time!'}`,
            mentions
        });
    }
};
