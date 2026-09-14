const fs = require('fs');

const CREATOR_NUMBERS = ["2348138558590"];

module.exports = {
    name: 'antispam',
    description: 'Enables or disables anti-spam protection in the group',

    async execute(sock, m, from, args, isOwner, context = {}) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(
                from,
                { text: '❌ This command can only be used inside groups!' },
                { quoted: m }
            );
        }

        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender.replace(/[^0-9]/g, '');

        const creator =
            CREATOR_NUMBERS.includes(senderNumber) ||
            m.key.fromMe ||
            isOwner;

        // Check group admin status
        let isAdmin = false;

        if (!creator) {
            try {
                const groupMetadata = await sock.groupMetadata(from);
                const participants = groupMetadata.participants || [];

                const participantObj = participants.find(
                    p => p.id.replace(/[^0-9]/g, '') === senderNumber
                );

                isAdmin =
                    participantObj &&
                    (
                        participantObj.admin === 'admin' ||
                        participantObj.admin === 'superadmin'
                    );
            } catch (e) {
                console.error(
                    'Error fetching group metadata for admin check:',
                    e
                );
            }
        }

        // Access control
        if (!creator && !isAdmin) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ *Access Denied!*\n\n' +
                        'Only group admins and the bot creator can configure anti-spam settings.'
                },
                { quoted: m }
            );
        }

        const action = args[0]?.toLowerCase();

        if (!['on', 'off'].includes(action)) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ *Invalid option!*\n\n' +
                        'Usage:\n' +
                        '• *antispam on*\n' +
                        '• *antispam off*'
                },
                { quoted: m }
            );
        }

        // Use the settings file belonging to this bot session
        const settingsFile =
            context.settingsFile ||
            'settings.json';

        let settings = {};

        try {
            if (fs.existsSync(settingsFile)) {
                const raw = fs.readFileSync(settingsFile, 'utf8');

                if (raw.trim()) {
                    settings = JSON.parse(raw);
                }
            }
        } catch (error) {
            console.error(
                `❌ Error reading ${settingsFile}:`,
                error
            );

            return sock.sendMessage(
                from,
                {
                    text: '❌ Failed to read the group security settings.'
                },
                { quoted: m }
            );
        }

        if (!settings.antispam) {
            settings.antispam = {};
        }

        settings.antispam[from] = action;

        try {
            fs.writeFileSync(
                settingsFile,
                JSON.stringify(settings, null, 2)
            );
        } catch (error) {
            console.error(
                `❌ Error writing ${settingsFile}:`,
                error
            );

            return sock.sendMessage(
                from,
                {
                    text: '❌ Failed to save the anti-spam settings.'
                },
                { quoted: m }
            );
        }

        const statusText =
            action === 'on'
                ? 'ACTIVATED 🟢'
                : 'DEACTIVATED 🔴';

        await sock.sendMessage(
            from,
            {
                text:
                    `🛡️ *ANTI-SPAM UPDATED*\n\n` +
                    `Status: *${statusText}*\n\n` +
                    (
                        action === 'on'
                            ? '⚠️ Anti-spam protection is now active in this group.'
                            : '✅ Anti-spam protection is now disabled in this group.'
                    )
            },
            { quoted: m }
        );
    }
};
