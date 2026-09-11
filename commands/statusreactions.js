
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

function getSetting(key, defaultValue = 'off') {
    if (fs.existsSync(SETTINGS_PATH)) {
        try {
            const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH));
            return settings[key] !== undefined ? settings[key] : defaultValue;
        } catch (e) {}
    }
    return defaultValue;
}

module.exports = {
    name: 'statusreactions',
    description: 'Toggle automatic reactions specifically for WhatsApp status updates (Creator & Bot Only)',
    async execute(sock, m, from, args, isOwner) {
        const sender = m.key.participant || m.key.remoteJid;
        const isBotSelf = m.key.fromMe || sender === sock.user.id || sender?.includes(sock.user.id.split(':')[0]);

        if (!isOwner && !isBotSelf) {
            return sock.sendMessage(from, { text: '❌ Access Denied! This command can only be used by the bot creator or the bot itself.' }, { quoted: m });
        }

        const action = args[0]?.toLowerCase();
        const currentStatus = getSetting('statusReaction', 'off').toUpperCase();

        if (!action || (action !== 'on' && action !== 'off')) {
            return sock.sendMessage(from, { 
                text: `💚 *Status Auto Reactions:* *${currentStatus}*\n\n*Usage:* \`!statusreactions on\` or \`!statusreactions off\`` 
            }, { quoted: m });
        }

        updateSetting('statusReaction', action);

        await sock.sendMessage(from, { 
            text: `✅ Automatic reactions for WhatsApp status updates have been turned *${action.toUpperCase()}* successfully!` 
        }, { quoted: m });
    }
};

