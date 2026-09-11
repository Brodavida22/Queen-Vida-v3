module.exports = {
    name: 'unblock',
    description: 'Restores a blocked user (Owner/Creator only)',
    async execute(sock, m, from, args, isOwner) {
        if (!isOwner) {
            return sock.sendMessage(from, { text: '❌ Restricted to bot creator (QUEEN VIDA)!' }, { quoted: m });
        }

        const target = args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null;
        if (!target) {
            return sock.sendMessage(from, { text: '❌ Provide the number to unblock! Usage: *!unblock 23480xxxxxxx*' }, { quoted: m });
        }

        try {
            await sock.updateBlockStatus(target, 'unblock');
            await sock.sendMessage(from, { text: `✅ User successfully unblocked.` }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Failed to unblock user.' }, { quoted: m });
        }
    }
};
