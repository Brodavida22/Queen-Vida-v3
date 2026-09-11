const { setMode, getMode } = require('../utils/mode');

module.exports = {
    name: 'mode',
    description: 'Switch bot between public and private mode',
    async execute(sock, m, from, args, isOwner) {
        // Strict check: Only the owner/creator can change the mode
        if (!isOwner) {
            return sock.sendMessage(from, { text: '❌ *Access Denied:* Only the bot creator can change the bot mode!' }, { quoted: m });
        }

        const subCommand = args[0] ? args[0].toLowerCase() : '';

        if (subCommand === 'public') {
            setMode('public');
            await sock.sendMessage(from, { text: '🌐 *Bot Mode Updated:* Successfully switched to **PUBLIC** mode. Everyone can use commands.' }, { quoted: m });
        } else if (subCommand === 'private') {
            setMode('private');
            await sock.sendMessage(from, { text: '🔒 *Bot Mode Updated:* Successfully switched to **PRIVATE** mode. Only the creator can use commands.' }, { quoted: m });
        } else {
            const current = getMode().toUpperCase();
            await sock.sendMessage(from, { 
                text: `⚙️ *Current Bot Mode:* *${current}*\n\n*Usage:*\n• \`!mode public\` - Allow everyone\n• \`!mode private\` - Restrict to owner only` 
            }, { quoted: m });
        }
    }
};
