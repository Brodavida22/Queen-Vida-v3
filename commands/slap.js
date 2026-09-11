module.exports = {
    name: 'slap',
    description: 'Slap someone',

    async execute(sock, m, from) {
        const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (!mentions.length) {
            return sock.sendMessage(from, {
                text: '👋 Tag someone to slap 😂'
            });
        }

        const target = mentions[0];

        const lines = [
            `👋 @${target.split('@')[0]} has been slapped! 😂`,
            `🥴 @${target.split('@')[0]} received a premium slap!`,
            `👋💥 @${target.split('@')[0]} WHAT DID YOU DO?! 😂`,
            `🫲 @${target.split('@')[0]} caught a flying slap!`
        ];

        await sock.sendMessage(from, {
            text: lines[Math.floor(Math.random() * lines.length)],
            mentions: [target]
        });
    }
};
