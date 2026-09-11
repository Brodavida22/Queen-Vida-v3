module.exports = {
    name: 'block',
    description: 'Instantly blocks a target user (Owner/Creator only)',
    async execute(sock, m, from, args, isOwner) {
        if (!isOwner) {
            return sock.sendMessage(from, { text: '❌ Restricted to bot creator (QUEEN VIDA)!' }, { quoted: m });
        }

        const quoted = m.message?.extendedTextMessage?.contextInfo?.participant;
        const target = quoted || (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);

        if (!target) {
            return sock.sendMessage(from, { text: '❌ Tag a user or reply to their message to block them!' }, { quoted: m });
        }

        try {
            await sock.updateBlockStatus(target, 'block');
            await sock.sendMessage(from, { text: `✅ User successfully blocked.` }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Failed to block user.' }, { quoted: m });
        }
    }
};
