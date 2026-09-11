module.exports = {
    name: 'changename',
    description: 'Changes your WhatsApp profile name (Owner/Creator only)',
    async execute(sock, m, from, args, isOwner) {
        if (!isOwner) {
            return sock.sendMessage(from, { text: '❌ Restricted to bot creator (QUEEN VIDA)!' }, { quoted: m });
        }
        const newName = args.join(' ');
        if (!newName) return sock.sendMessage(from, { text: '❌ Provide a new name! Usage: *!changename New Name*' }, { quoted: m });

        try {
            await sock.updateProfileName(newName);
            await sock.sendMessage(from, { text: `✅ Profile name successfully updated to: *${newName}*` }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Failed to update profile name.' }, { quoted: m });
        }
    }
};
