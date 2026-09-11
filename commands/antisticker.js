const fs = require('fs');

function loadSettings() {
    try {
        return fs.existsSync('settings.json')
            ? JSON.parse(fs.readFileSync('settings.json', 'utf8'))
            : {};
    } catch {
        return {};
    }
}

function saveSettings(settings) {
    fs.writeFileSync(
        'settings.json',
        JSON.stringify(settings, null, 2)
    );
}

module.exports = {
    name: 'antisticker',
    description: 'Automatically delete stickers sent by members',

    async execute(sock, m, from, args, isOwner) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(
                from,
                {
                    text: '❌ *GROUP ONLY*\n\nThis command can only be used inside a group.'
                },
                { quoted: m }
            );
        }

        try {
            const metadata = await sock.groupMetadata(from);
            const sender = m.key.participant || m.key.remoteJid;

            const participant = metadata.participants.find(
                p => p.id === sender
            );

            const isAdmin =
                participant &&
                (participant.admin === 'admin' ||
                 participant.admin === 'superadmin');

            if (!isOwner && !isAdmin) {
                return sock.sendMessage(
                    from,
                    {
                        text: '❌ *ACCESS DENIED*\n\nOnly group admins can control AntiSticker.'
                    },
                    { quoted: m }
                );
            }

            const settings = loadSettings();

            if (!settings.antisticker) {
                settings.antisticker = {};
            }

            const currentStatus =
                settings.antisticker[from] === 'on'
                    ? 'on'
                    : 'off';

            const action = args[0]?.toLowerCase();

            if (!action) {
                return sock.sendMessage(
                    from,
                    {
                        text:
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 👑 *QUEEN VIDA* 👑
┃     *ANTISTICKER*
╰━━━━━━━━━━━━━━━━━━━━━━╯

📌 *Current Status:* ${
    currentStatus === 'on'
        ? '🟢 ON'
        : '🔴 OFF'
}

━━━━━━━━━━━━━━━━━━━━━━

Use:

• *!antisticker on*
• *!antisticker off*

When ON, stickers sent by normal members will be automatically deleted.

👑 *Admin Control Only*`
                    },
                    { quoted: m }
                );
            }

            if (action !== 'on' && action !== 'off') {
                return sock.sendMessage(
                    from,
                    {
                        text:
`❌ *INVALID OPTION*

Use:

• *!antisticker on*
• *!antisticker off*`
                    },
                    { quoted: m }
                );
            }

            settings.antisticker[from] = action;
            saveSettings(settings);

            const statusText =
                action === 'on'
                    ? '🟢 ACTIVATED'
                    : '🔴 DEACTIVATED';

            await sock.sendMessage(
                from,
                {
                    text:
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 👑 *QUEEN VIDA* 👑
┃     *ANTISTICKER*
╰━━━━━━━━━━━━━━━━━━━━━━╯

${statusText}

AntiSticker is now *${action.toUpperCase()}*.

${
    action === 'on'
        ? '🚫 Stickers from normal members will now be deleted automatically.'
        : '✅ Members can now send stickers normally.'
}

━━━━━━━━━━━━━━━━━━━━━━

👑 *QUEEN VIDA-V3*`
                },
                { quoted: m }
            );

        } catch (error) {
            console.error('❌ AntiSticker Error:', error);

            await sock.sendMessage(
                from,
                {
                    text: '❌ Failed to update AntiSticker settings.'
                },
                { quoted: m }
            );
        }
    }
};
