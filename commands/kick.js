const CREATOR_NUMBERS = ["2348138558590", "2348138558590"];

module.exports = {
    name: 'kick',
    description: 'Removes a target user from the group (Admins/Creators/Bot only)',
    async execute(sock, m, from, args) {
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
            return sock.sendMessage(from, { text: '❌ *Access Denied:* Only group admins and creators can kick members.' }, { quoted: m });
        }

        let targetJid;
        if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            targetJid = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else if (m.message?.extendedTextMessage?.contextInfo?.participant) {
            targetJid = m.message.extendedTextMessage.contextInfo.participant;
        } else if (args.length > 0) {
            targetJid = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        }

        if (!targetJid) {
            return sock.sendMessage(from, { text: '❌ Please tag, reply to, or provide the number of the user to kick.\nUsage: *!kick @user*' }, { quoted: m });
        }

        try {
            await sock.groupParticipantsUpdate(from, [targetJid], 'remove');
            await sock.sendMessage(from, { text: `✅ Successfully removed @${targetJid.split('@')[0]} from the group.`, mentions: [targetJid] }, { quoted: m });
        } catch (error) {
            console.error('Error kicking user:', error);
            await sock.sendMessage(from, { text: '❌ Failed to kick user. Ensure the bot has admin rights.' }, { quoted: m });
        }
    }
};
