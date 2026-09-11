module.exports = {
    name: 'ship',
    description: 'Ship two group members',

    async execute(sock, m, from) {
        const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (mentions.length < 2) {
            return sock.sendMessage(from, {
                text: '💘 Tag two people to ship!\n\nExample: !ship @person1 @person2'
            });
        }

        const first = mentions[0];
        const second = mentions[1];

        const score = Math.floor(Math.random() * 101);

        let message;

        if (score >= 90) {
            message = '💍 THIS ONE IS MARRIAGE MATERIAL! 😂❤️';
        } else if (score >= 70) {
            message = '❤️ Serious chemistry detected!';
        } else if (score >= 50) {
            message = '💕 There might be something here 👀';
        } else if (score >= 30) {
            message = '😂 Friendship is safer.';
        } else {
            message = '💀 Please stay far away from each other!';
        }

        await sock.sendMessage(from, {
            text: `💘 *SHIP METER* 💘

👤 @${first.split('@')[0]}
❤️
👤 @${second.split('@')[0]}

🔥 Compatibility: *${score}%*

${message}`,
            mentions: [first, second]
        });
    }
};
