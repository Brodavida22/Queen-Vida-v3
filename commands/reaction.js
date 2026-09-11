
const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '..', 'settings.json');

function updateSetting(key, value) {
    let settings = {};
    if (fs.existsSync(SETTINGS_PATH)) {
        try { settings = JSON.parse(fs.readFileSync(SETTINGS_PATH)); } catch (e) {}
    }
    settings[key] = value;
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

function getSetting(key, defaultValue = 'on') {
    if (fs.existsSync(SETTINGS_PATH)) {
        try {
            const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH));
            return settings[key] !== undefined ? settings[key] : defaultValue;
        } catch (e) {}
    }
    return defaultValue;
}

module.exports = {
    name: 'reaction',
    description: 'Toggle automatic context-aware reactions for groups and channels (Admins & Creator)',
    async execute(sock, m, from, args, isOwner) {
        let isAdmin = isOwner;
        if (from.endsWith('@g.us') && !isOwner) {
            try {
                const groupMetadata = await sock.groupMetadata(from);
                const sender = m.key.participant || m.key.remoteJid;
                const participant = groupMetadata.participants.find(p => p.id === sender);
                isAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
            } catch (e) {}
        }

        if (!isAdmin) {
            return sock.sendMessage(from, { text: '❌ Access Denied! Only group admins and the creator can toggle auto reactions.' }, { quoted: m });
        }

        const action = args[0]?.toLowerCase();
        const currentStatus = getSetting('autoReaction', 'on').toUpperCase();

        if (!action || (action !== 'on' && action !== 'off')) {
            return sock.sendMessage(from, { 
                text: `🤖 *Auto Reaction (Groups & Channels):* *${currentStatus}*\n\n*Usage:* \`!reaction on\` or \`!reaction off\`` 
            }, { quoted: m });
        }

        updateSetting('autoReaction', action);

        await sock.sendMessage(from, { 
            text: `✅ Auto reactions for groups and channels have been turned *${action.toUpperCase()}* successfully!` 
        }, { quoted: m });
    }
};

