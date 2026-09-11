const fs = require('fs');
const path = require('path');

const CREATOR_NUMBERS = ["2348138558590", "2348138558590"];

module.exports = {
    name: 'agm',
    description: 'Toggle Anti-Group-Mention protection for the group (on/off)',
    async execute(sock, m, from, args, isOwner) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ This command can only be used inside groups!' }, { quoted: m });
        }

        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender.replace(/[^0-9]/g, '');
        const isUserOwner = CREATOR_NUMBERS.includes(senderNumber) || m.key.fromMe;

        let isAdmin = isUserOwner;
        if (!isAdmin) {
            try {
                const groupMetadata = await sock.groupMetadata(from);
                const participants = groupMetadata.participants;
                const senderParticipant = participants.find(p => p.id === sender);
                isAdmin = senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin');
            } catch (err) {
                console.error('Error checking admin status:', err);
            }
        }

        if (!isAdmin) {
            return sock.sendMessage(from, { text: '❌ Access Denied! This command can only be used by group admins, the creator, or the bot itself.' }, { quoted: m });
        }

        let groupSettings = fs.existsSync('settings.json') ? JSON.parse(fs.readFileSync('settings.json')) : {};
        if (!groupSettings.agm) groupSettings.agm = {};

        const action = args[0]?.toLowerCase();

        if (action === 'on') {
            groupSettings.agm[from] = 'on';
            fs.writeFileSync('settings.json', JSON.stringify(groupSettings, null, 2));
            return sock.sendMessage(from, { 
                text: `✅ Anti-Group-Mention *ENABLED* with warnings\n\nUsers who mention this group in their status will be warned 3 times and kicked after reaching the warn limit.` 
            }, { quoted: m });
        } else if (action === 'off') {
            groupSettings.agm[from] = 'off';
            fs.writeFileSync('settings.json', JSON.stringify(groupSettings, null, 2));
            return sock.sendMessage(from, { text: `❌ Anti-Group-Mention *DISABLED* for this group.` }, { quoted: m });
        }

        // Default behavior if no argument is provided: toggle current status
        const currentStatus = groupSettings.agm[from] || 'off';
        const newStatus = currentStatus === 'on' ? 'off' : 'on';
        groupSettings.agm[from] = newStatus;

        fs.writeFileSync('settings.json', JSON.stringify(groupSettings, null, 2));

        if (newStatus === 'on') {
            await sock.sendMessage(from, { 
                text: `✅ Anti-Group-Mention *ENABLED* with warnings\n\nUsers who mention this group in their status will be warned 3 times and kicked after reaching the warn limit.\n_Tip: You can also use \`!agm on\` or \`!agm off\`_` 
            }, { quoted: m });
        } else {
            await sock.sendMessage(from, { text: `❌ Anti-Group-Mention *DISABLED* for this group.` }, { quoted: m });
        }
    }
};
