const CREATOR_NUMBERS = ["2348138558590", "2348138558590"];

module.exports = {
    name: 'del',
    description: 'Deletes a replied message instantly (Admins and Creators only)',
    async execute(sock, m, from, args) {
        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender.replace(/[^0-9]/g, '');
        const isOwner = CREATOR_NUMBERS.includes(senderNumber) || m.key.fromMe;

        // Check if message is in a group
        const isGroup = from.endsWith('@g.us');
        let isAdmin = false;

        if (isGroup && !isOwner) {
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
            return sock.sendMessage(from, { text: '❌ *Access Denied:* Only group admins and creators can delete messages using this command!' }, { quoted: m });
        }

        // Check if replying to a message
        const quoted = m.message?.extendedTextMessage?.contextInfo;
        if (!quoted || !quoted.stanzaId) {
            return sock.sendMessage(from, { text: '❌ Please reply to the message you want to delete with `!del`!' }, { quoted: m });
        }

        try {
            const messageKey = {
                remoteJid: from,
                id: quoted.stanzaId,
                participant: quoted.participant || undefined
            };

            await sock.sendMessage(from, { delete: messageKey });
        } catch (err) {
            console.error('Delete message error:', err);
            await sock.sendMessage(from, { text: '❌ Failed to delete the message. Make sure the bot has admin privileges.' }, { quoted: m });
        }
    }
};
