module.exports = {
    name: 'hug',
    description: 'Hug someone',

    async execute(sock, m, from) {
        const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (!mentions.length) {
            return sock.sendMessage(from, {
                text: '🤗 Tag someone you want to hug!'
            });
        }

        const target = mentions[0];

        await sock.sendMessage(from, {
            text: `🤗 @${target.split('@')[0]} has received a big warm hug! ❤️🫂`,
            mentions: [target]
        });
    }
};
