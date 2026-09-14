const fs = require('fs');

const CREATOR_NUMBERS = ["2348138558590"];

module.exports = {
    name: 'antilink',
    description: 'Configure independent group anti-link security (Admins/Creators only)',

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
                        'Only group admins and the bot creator can configure anti-link security.'
                },
                { quoted: m }
            );
        }

        const action = args[0]?.toLowerCase();
        const mode = args[1]?.toLowerCase();

        // Help / usage
        if (
            !['warn', 'instant'].includes(action) ||
            !['on', 'off'].includes(mode)
        ) {
            const usageText =
`┏━━━ 🛡️ *ANTILINK CONFIG* 🛡️ ━━━┓
┃
┃ • *antilink warn on*
┃ • *antilink warn off*
┃
┃ 3 strikes → removal
┃
┃ • *antilink instant on*
┃ • *antilink instant off*
┃
┃ Deletes link + removes user
┃ instantly.
┃
┗━━━━━━━━━━━━━━━━━━━━━━━`;

            return sock.sendMessage(
                from,
                { text: usageText },
                { quoted: m }
            );
        }

        // IMPORTANT:
        // messageHandler now passes the correct settings file
        // for the current bot session.
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

        if (!settings.antilink) {
            settings.antilink = {};
        }

        if (!settings.antilink[from]) {
            settings.antilink[from] = {
                warn: 'off',
                instant: 'off'
            };
        }

        // Update requested mode
        settings.antilink[from][action] = mode;

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
                    text: '❌ Failed to save the anti-link settings.'
                },
                { quoted: m }
            );
        }

        let statusText = '';

        if (action === 'warn') {
            statusText =
                mode === 'on'
                    ? '⚠️ *Warning mode enabled.*\nLinks will be deleted and users will receive up to 3 warnings before removal.'
                    : '✅ *Warning mode disabled.*';
        }

        if (action === 'instant') {
            statusText =
                mode === 'on'
                    ? '🚨 *Instant mode enabled.*\nAny detected link will be deleted and the sender will be removed immediately.'
                    : '✅ *Instant mode disabled.*';
        }

        await sock.sendMessage(
            from,
            {
                text:
                    `🛡️ *ANTI-LINK UPDATED*\n\n` +
                    `Mode: *${action.toUpperCase()}*\n` +
                    `Status: *${mode.toUpperCase()}*\n\n` +
                    statusText
            },
            { quoted: m }
        );
    }
};
