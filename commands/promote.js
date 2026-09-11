const CREATOR_NUMBERS = ["2348138558590", "2348138558590"];

module.exports = {
    name: 'promote',
    description: 'Promotes a member to group admin (Admins/Creators/Bot only)',
    async execute(sock, m, from, args) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ This command can only be used inside groups!' }, { quoted: m });
        }

        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender.replace(/[^0-9]/g, '');
        const isOwner = CREATOR_NUMBERS.includes(senderNumber) || m.key.fromMe;

        // Check group admin status (Bot, Creators, and Group Admins bypass this)
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

        // Access Control: Only Bot, Creators, or Group Admins can promote
        if (!isOwner && !isAdmin) {
            return sock.sendMessage(from, { text: '❌ *Access Denied:* Only group admins and creators can promote members.' }, { quoted: m });
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
            return sock.sendMessage(from, { text: '❌ Please tag, reply to, or provide the number of the user to promote.\nUsage: *!promote @user*' }, { quoted: m });
        }

        try {
            await sock.groupParticipantsUpdate(from, [targetJid], 'promote');
            await sock.sendMessage(from, { text: `✅ Successfully promoted @${targetJid.split('@')[0]} to Admin!`, mentions: [targetJid] }, { quoted: m });
        } catch (error) {
            console.error('Error promoting user:', error);
            await sock.sendMessage(from, { text: '❌ Failed to promote user. Ensure the bot has admin privileges in this group.' }, { quoted: m });
        }
    }
};
