const CREATOR_NUMBERS = ["2348138558590", "2348138558590"];

module.exports = {
    name: 'leave',
    description: 'Commands the bot to leave the current group (Creators only)',
    async execute(sock, m, from) {
        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender.replace(/[^0-9]/g, '');

        if (!CREATOR_NUMBERS.includes(senderNumber) && !m.key.fromMe) {
            return sock.sendMessage(from, { text: '❌ *Access Denied:* Only creators can use the leave command!' }, { quoted: m });
        }

        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ This command can only be used inside a group chat!' }, { quoted: m });
        }

        try {
            await sock.sendMessage(from, { text: '👋 Goodbye! Leaving group...' }, { quoted: m });
            await sock.groupLeave(from);
        } catch (err) {
            console.error('Leave group error:', err);
            await sock.sendMessage(from, { text: `❌ Failed to leave group: ${err.message}` }, { quoted: m });
        }
    }
};
