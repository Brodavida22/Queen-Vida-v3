const fs = require('fs');

const CREATOR_NUMBERS = ["2348138558590", "2348138558590"];

module.exports = {
    name: 'antilink',
    description: 'Configure independent group anti-link security (Admins/Creators only)',
    async execute(sock, m, from, args) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ This command can only be used inside groups!' }, { quoted: m });
        }

        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender.replace(/[^0-9]/g, '');
        const isOwner = CREATOR_NUMBERS.includes(senderNumber) || m.key.fromMe;

        // Check group admin status (Creators bypass this entirely)
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

        // Access Control: Only Admins or Creators can manage antilink settings
        if (!isOwner && !isAdmin) {
            return sock.sendMessage(from, { text: '❌ *Access Denied:* Only group admins and creators can configure anti-link security settings.' }, { quoted: m });
        }

        const action = args[0]?.toLowerCase();
        const mode = args[1]?.toLowerCase();

        if (!['warn', 'instant'].includes(action) || !['on', 'off'].includes(mode)) {
            const usageText = 
`┏━━━ 🛡️ *ANTILINK CONFIG* 🛡️ ━━━┓\n` +
`┃ Usage:\n` +
`┃ • *!antilink warn on/off*\n` +
`┃   (_3-strike warning system before removal_)\n` +
`┃ • *!antilink instant on/off*\n` +
`┃   (_Deletes link and removes user instantly_)\n` +
`┗━━━━━━━━━━━━━━━━━━━━━━━`;
            return sock.sendMessage(from, { text: usageText }, { quoted: m });
        }

        let settings = {};
        if (fs.existsSync('settings.json')) {
            settings = JSON.parse(fs.readFileSync('settings.json'));
        }
        if (!settings.antilink) settings.antilink = {};
        if (!settings.antilink[from]) settings.antilink[from] = { warn: 'off', instant: 'off' };

        // Independent configuration toggles
        if (action === 'warn') {
            settings.antilink[from].warn = mode;
        } else if (action === 'instant') {
            settings.antilink[from].instant = mode;
        }

        fs.writeFileSync('settings.json', JSON.stringify(settings, null, 2));

        await sock.sendMessage(from, { text: `✅ Anti-link [${action.toUpperCase()}] has been turned *${mode.toUpperCase()}* for this group.` }, { quoted: m });
    }
};
