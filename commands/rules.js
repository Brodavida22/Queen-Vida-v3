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
    name: 'rules',
    description: 'Show or set group rules',

    async execute(sock, m, from, args) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, {
                text: '❌ This command can only be used in a group.'
            });
        }

        const data = loadData();
        data[from] = data[from] || {};

        if (!args.length) {
            await sock.sendMessage(from, {
                text: `╭━━━〔 📜 GROUP RULES 〕━━━╮
┃
┃ ${data[from].rules || 'No group rules have been set yet.'}
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
            });
            return;
        }

        const rules = args.join(' ');

        data[from].rules = rules;
        saveData(data);

        await sock.sendMessage(from, {
            text: `✅ Group rules updated.\n\n📜 ${rules}`
        });
    }
};
