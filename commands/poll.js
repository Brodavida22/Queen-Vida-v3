const CREATOR_NUMBERS = ["2348138558590", "2348138558590"];

module.exports = {
    name: 'poll',
    description: 'Creates an interactive poll in the chat (Admins/Creators/Bot only)',
    async execute(sock, m, from, args) {
        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender.replace(/[^0-9]/g, '');
        const isOwner = CREATOR_NUMBERS.includes(senderNumber) || m.key.fromMe;

        let isAdmin = false;
        if (!isOwner && from.endsWith('@g.us')) {
            try {
                const groupMetadata = await sock.groupMetadata(from);
                const participants = groupMetadata.participants || [];
                const participantObj = participants.find(p => p.id.replace(/[^0-9]/g, '') === senderNumber);
                isAdmin = participantObj && (participantObj.admin === 'admin' || participantObj.admin === 'superadmin');
            } catch (e) {
                console.error('Error fetching group metadata for admin check:', e);
            }
        }

        if (from.endsWith('@g.us') && !isOwner && !isAdmin) {
            return sock.sendMessage(from, { text: '❌ *Access Denied:* Only group admins and creators can create polls.' }, { quoted: m });
        }

        const query = args.join(' ');
        if (!query.includes('|')) {
            return sock.sendMessage(from, { text: '❌ Invalid format! Usage: *!poll Question | Option1 | Option2 | Option3*' }, { quoted: m });
        }

        const parts = query.split('|').map(p => p.trim());
        const pollName = parts[0];
        const pollOptions = parts.slice(1);

        if (pollOptions.length < 2) {
            return sock.sendMessage(from, { text: '❌ A poll must have at least 2 options!' }, { quoted: m });
        }

        await sock.sendMessage(from, {
            poll: {
                name: pollName,
                values: pollOptions
            }
        });
    }
};
