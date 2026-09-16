const { getPrefix } = require('../utils/prefix');

const REPO_URL = 'https://github.com/Brodavida22/Queen-Vida-v3';

module.exports = {
    name: 'repo',
    description: 'Show the Queen Vida GitHub repository',

    async execute(sock, m, from, args, isOwner) {
        const prefix = getPrefix();

        const message =
            `╭━━━〔 👑 QUEEN VIDA REPOSITORY 〕━━━╮\n` +
            `┃\n` +
            `┃ 📦 *Queen Vida v3*\n` +
            `┃\n` +
            `┃ 🔗 *GitHub Repository:*\n` +
            `┃ ${REPO_URL}\n` +
            `┃\n` +
            `┃ ⭐ Star the repository if you like the bot!\n` +
            `┃\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(
            from,
            {
                text: message,
                contextInfo: {
                    externalAdReply: {
                        title: '👑 Queen Vida v3',
                        body: 'GitHub Repository',
                        mediaType: 1,
                        sourceUrl: REPO_URL,
                        thumbnailUrl: 'https://github.com/Brodavida22.png',
                        renderLargerThumbnail: true,
                        showAdAttribution: false
                    }
                }
            },
            { quoted: m }
        );
    }
};
