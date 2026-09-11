const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'welcome.json');

function loadData() {
    try {
        if (!fs.existsSync(file)) return {};
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return {};
    }
}

function saveData(data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports = {
    name: 'welcome',
    description: 'Enable or disable welcome messages',

    async execute(sock, m, from, args) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, {
                text: '❌ This command can only be used in a group.'
            });
        }

        const action = (args[0] || '').toLowerCase();
        const data = loadData();

        if (!['on', 'off'].includes(action)) {
            return sock.sendMessage(from, {
                text: `╭━━━〔 👋 WELCOME 〕━━━╮
┃
┃ Use:
┃ • !welcome on
┃ • !welcome off
┃
╰━━━━━━━━━━━━━━━━━━╯`
            });
        }

        data[from] = data[from] || {};
        data[from].welcome = action === 'on';
        saveData(data);

        await sock.sendMessage(from, {
            text: action === 'on'
                ? '✅ Welcome messages are now *ON*.'
                : '🔕 Welcome messages are now *OFF*.'
        });
    }
};
