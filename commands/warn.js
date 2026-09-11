const fs = require('fs');
const CREATOR_NUMBERS = ["2348138558590", "2348138558590"];

module.exports = {
    name: 'warn',
    description: 'Issues a manual warning strike to a targeted group member (Admins/Creators/Bot only)',
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

        // Access Control: Only Bot, Creators, or Group Admins can warn
        if (!isOwner && !isAdmin) {
            return sock.sendMessage(from, { text: '❌ *Access Denied:* Only group admins and creators can issue warnings.' }, { quoted: m });
        }

        const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const target = mentioned[0] || (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);

        if (!target) {
            return sock.sendMessage(from, { text: '❌ Please tag or specify the user you want to warn! Usage: *!warn @user*' }, { quoted: m });
        }

        const targetNumber = target.replace(/[^0-9]/g, '');
        let settings = fs.existsSync('settings.json') ? JSON.parse(fs.readFileSync('settings.json')) : {};
        if (!settings.warnings) settings.warnings = {};
        if (!settings.warnings[from]) settings.warnings[from] = {};
        if (!settings.warnings[from][target]) settings.warnings[from][target] = 0;

        settings.warnings[from][target] += 1;
        const currentWarnings = settings.warnings[from][target];
        fs.writeFileSync('settings.json', JSON.stringify(settings, null, 2));

        if (currentWarnings < 3) {
            await sock.sendMessage(from, { text: `⚠️ *@${targetNumber}* has been issued a warning by an administrator. Total warnings: *[${currentWarnings}/3]*`, mentions: [target] }, { quoted: m });
        } else {
            settings.warnings[from][target] = 0;
            fs.writeFileSync('settings.json', JSON.stringify(settings, null, 2));

            await sock.sendMessage(from, { text: `🚨 *@${targetNumber}* has reached 3 warning strikes and has been kicked from the group!`, mentions: [target] }, { quoted: m });
            try { await sock.groupParticipantsUpdate(from, [target], 'remove'); } catch (e) {}
        }
    }
};
