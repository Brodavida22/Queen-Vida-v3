module.exports = {
    name: 'kiss',
    description: 'Kiss someone',

    async execute(sock, m, from) {
        const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (!mentions.length) {
            return sock.sendMessage(from, {
                text: '💋 Tag someone to kiss!\n\nExample: !kiss @person'
            });
        }

        const target = mentions[0];

        await sock.sendMessage(from, {
            text: `💋 @${target.split('@')[0]} just received a kiss! 😘❤️`,
            mentions: [target]
        });
    }
};
