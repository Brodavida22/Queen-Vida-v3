const fs = require('fs');
const { getPrefix } = require('../utils/prefix');

const SETTINGS_FILE = 'settings.json';

function loadSettings() {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) {
            return {};
        }

        return JSON.parse(
            fs.readFileSync(SETTINGS_FILE, 'utf8')
        );
    } catch (error) {
        console.error(
            '❌ Failed to load settings:',
            error.message
        );

        return {};
    }
}

function saveSettings(settings) {
    try {
        fs.writeFileSync(
            SETTINGS_FILE,
            JSON.stringify(settings, null, 2)
        );

        return true;
    } catch (error) {
        console.error(
            '❌ Failed to save settings:',
            error.message
        );

        return false;
    }
}

module.exports = {
    name: 'antisticker',

    description:
        'Automatically delete stickers sent by normal members',

    async execute(sock, m, from, args, isOwner) {

        const PREFIX = getPrefix();

        // GROUP ONLY
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ *GROUP ONLY*

AntiSticker can only be used inside a WhatsApp group.`
                },
                { quoted: m }
            );
        }

        try {

            const metadata =
                await sock.groupMetadata(from);

            const sender =
                m.key.participant ||
                m.key.remoteJid;

            const participant =
                metadata.participants.find(
                    p => p.id === sender
                );

            const isAdmin =
                participant &&
                (
                    participant.admin === 'admin' ||
                    participant.admin === 'superadmin'
                );

            // ONLY OWNER OR GROUP ADMIN
            if (!isOwner && !isAdmin) {
                return sock.sendMessage(
                    from,
                    {
                        text:
`❌ *ACCESS DENIED*

Only the group admins or QUEEN VIDA creator can control AntiSticker.`
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

            const action =
                args[0]
                    ?.toLowerCase()
                    .trim();

            // SHOW STATUS
            if (!action) {

                return sock.sendMessage(
                    from,
                    {
                        text:
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 👑 *QUEEN VIDA* 👑
┃     *ANTISTICKER*
╰━━━━━━━━━━━━━━━━━━━━━━╯

📌 *Current Status:*

${
    currentStatus === 'on'
        ? '🟢 *ON*'
        : '🔴 *OFF*'
}

━━━━━━━━━━━━━━━━━━━━━━

📖 *USAGE*

• *${PREFIX}antisticker on*
• *${PREFIX}antisticker off*

━━━━━━━━━━━━━━━━━━━━━━

🛡️ When AntiSticker is *ON*:

Normal members' stickers
will be automatically deleted.

👑 Group admins and the
QUEEN VIDA creator are protected.`
                    },
                    { quoted: m }
                );
            }

            // INVALID OPTION
            if (
                action !== 'on' &&
                action !== 'off'
            ) {

                return sock.sendMessage(
                    from,
                    {
                        text:
`❌ *INVALID OPTION*

Use:

• *${PREFIX}antisticker on*
• *${PREFIX}antisticker off*`
                    },
                    { quoted: m }
                );
            }

            // SAVE NEW STATUS
            settings.antisticker[from] =
                action;

            const saved =
                saveSettings(settings);

            if (!saved) {

                return sock.sendMessage(
                    from,
                    {
                        text:
`❌ *SAVE ERROR*

I couldn't save the AntiSticker settings.`
                    },
                    { quoted: m }
                );
            }

            if (action === 'on') {

                await sock.sendMessage(
                    from,
                    {
                        text:
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 👑 *QUEEN VIDA* 👑
┃     *ANTISTICKER*
╰━━━━━━━━━━━━━━━━━━━━━━╯

🟢 *ANTISTICKER ACTIVATED*

🚫 Stickers sent by normal
members will now be deleted
automatically.

🛡️ Admins are protected.

━━━━━━━━━━━━━━━━━━━━━━

Use *${PREFIX}antisticker off*
to disable it.`
                    },
                    { quoted: m }
                );

            } else {

                await sock.sendMessage(
                    from,
                    {
                        text:
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 👑 *QUEEN VIDA* 👑
┃     *ANTISTICKER*
╰━━━━━━━━━━━━━━━━━━━━━━╯

🔴 *ANTISTICKER DEACTIVATED*

✅ Members can now send
stickers normally.

━━━━━━━━━━━━━━━━━━━━━━

Use *${PREFIX}antisticker on*
to activate it again.`
                    },
                    { quoted: m }
                );
            }

        } catch (error) {

            console.error(
                '❌ ANTISTICKER ERROR:',
                error
            );

            await sock.sendMessage(
                from,
                {
                    text:
`❌ *ANTISTICKER ERROR*

Something went wrong while
updating AntiSticker.

Please try again.`
                },
                { quoted: m }
            );
        }
    }
};
