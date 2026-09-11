module.exports = {
    name: 'changebio',
    description: 'Updates your profile status/bio description (Owner/Creator only)',
    async execute(sock, m, from, args, isOwner) {
        if (!isOwner) {
            return sock.sendMessage(from, { text: '❌ Restricted to bot creator (QUEEN VIDA)!' }, { quoted: m });
        }
        const newBio = args.join(' ');
        if (!newBio) return sock.sendMessage(from, { text: '❌ Provide a new bio! Usage: *!changebio Queen Vida Active*' }, { quoted: m });

        try {
            await sock.updateProfileStatus(newBio);
            await sock.sendMessage(from, { text: `✅ Profile status updated successfully!` }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Failed to update profile status.' }, { quoted: m });
        }
    }
};
