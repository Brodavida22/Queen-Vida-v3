const fs = require('fs');
const CREATOR_NUMBERS = ["2348138558590", "2348138558590"];

module.exports = {
    name: 'warnings',
    description: 'Checks accumulated warning count for a member (Admins/Creators/Bot only)',
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

        // Access Control: Only Bot, Creators, or Group Admins can check warnings
        if (!isOwner && !isAdmin) {
            return sock.sendMessage(from, { text: '❌ *Access Denied:* Only group admins and creators can check warnings.' }, { quoted: m });
        }

        const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const target = mentioned[0] || (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : sender);
        const targetNumber = target.replace(/[^0-9]/g, '');

        let settings = fs.existsSync('settings.json') ? JSON.parse(fs.readFileSync('settings.json')) : {};
        const count = settings.warnings?.[from]?.[target] || 0;

        await sock.sendMessage(from, { text: `📋 *@${targetNumber}* currently has *${count}/3* warning strikes.`, mentions: [target] }, { quoted: m });
    }
};
