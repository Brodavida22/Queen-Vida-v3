const fs = require('fs');
const CREATOR_NUMBERS = ["2348138558590", "2348138558590"];

module.exports = {
    name: 'antispam',
    description: 'Enables or disables anti-spam protection in the group (Admins/Creators/Bot only)',
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
            return sock.sendMessage(from, { text: '❌ *Access Denied:* Only group admins and creators can configure anti-spam settings.' }, { quoted: m });
        }

        const action = args[0]?.toLowerCase();
        if (!['on', 'off'].includes(action)) {
            return sock.sendMessage(from, { text: '❌ Please specify status! Usage: *!antispam on* or *!antispam off*' }, { quoted: m });
        }

        let settings = fs.existsSync('settings.json') ? JSON.parse(fs.readFileSync('settings.json')) : {};
        if (!settings.antispam) settings.antispam = {};

        settings.antispam[from] = action;
        fs.writeFileSync('settings.json', JSON.stringify(settings, null, 2));

        const statusText = action === 'on' ? 'activated 🟢' : 'deactivated 🔴';
        await sock.sendMessage(from, { text: `✅ Anti-spam protection has been successfully *${statusText}* for this group.` }, { quoted: m });
    }
};
