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
    name: 'setwelcome',
    description: 'Set a custom welcome message',

    async execute(sock, m, from, args) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, {
                text: '❌ This command can only be used in a group.'
            });
        }

        const message = args.join(' ').trim();

        if (!message) {
            return sock.sendMessage(from, {
                text: '❌ Give me the welcome message.\n\nExample:\n!setwelcome Welcome @user 🎉'
            });
        }

        const data = loadData();

        data[from] = data[from] || {};
        data[from].welcomeMessage = message;

        saveData(data);

        await sock.sendMessage(from, {
            text: `✅ Welcome message updated!\n\n📝 ${message}`
        });
    }
};
