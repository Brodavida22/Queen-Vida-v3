const CREATOR_NUMBERS = ["2348138558590", "2348138558590"];

module.exports = {
    name: 'mute',
    description: 'Locks the group so only admins can send messages (Admins/Creators/Bot only)',
    async execute(sock, m, from) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ This command can only be used inside groups!' }, { quoted: m });
        }

        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender.replace(/[^0-9]/g, '');
        const isOwner = CREATOR_NUMBERS.includes(senderNumber) || m.key.fromMe;

        let isAdmin = false;
        if (!isOwner) {
            try {
                const groupMetadata = await sock.groupMetadata(from);
                const participants = groupMetadata.participants || [];
                const participantObj = participants.find(p => p.id.replace(/[^0-9]/g, '') === senderNumber);
                isAdmin = participantObj && (participantObj.admin === 'admin' || participantObj.admin === 'superadmin');
            } catch (e) {
                console.error('Error fetching group metadata for admin check:', e);
            }
        }

        if (!isOwner && !isAdmin) {
            return sock.sendMessage(from, { text: '❌ *Access Denied:* Only group admins and creators can mute the group.' }, { quoted: m });
        }

        try {
            await sock.groupSettingUpdate(from, 'announcement');
            await sock.sendMessage(from, { text: '🔒 Group has been *muted*. Only admins can now send messages.' }, { quoted: m });
        } catch (error) {
            console.error('Error muting group:', error);
            await sock.sendMessage(from, { text: '❌ Failed to mute group. Ensure the bot is an admin.' }, { quoted: m });
        }
    }
};
