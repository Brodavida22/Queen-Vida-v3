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
    name: 'viewstatus',
    description: 'Toggle automatic WhatsApp status viewing (Creator Only)',
    async execute(sock, m, from, args, isOwner) {
        if (!isOwner) {
            return sock.sendMessage(from, { text: '❌ Access Denied! Only the bot creator can toggle auto view status.' }, { quoted: m });
        }

        const action = args[0]?.toLowerCase();
        const currentStatus = getSetting('autoViewStatus', 'on').toUpperCase();

        if (!action || (action !== 'on' && action !== 'off')) {
            return sock.sendMessage(from, { 
                text: `👁️ *Auto View Status:* *${currentStatus}*\n\n*Usage:* \`!viewstatus on\` or \`!viewstatus off\`` 
            }, { quoted: m });
        }

        updateSetting('autoViewStatus', action);

        await sock.sendMessage(from, { 
            text: `✅ Auto view status has been turned *${action.toUpperCase()}* successfully!` 
        }, { quoted: m });
    }
};
