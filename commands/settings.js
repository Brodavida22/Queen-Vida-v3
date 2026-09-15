const fs = require('fs');

module.exports = {
    name: 'settings',
    description: 'Show the current group security settings',

    async execute(sock, m, from, args, isOwner, context = {}) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(
                from,
                {
                    text: '❌ This command can only be used inside groups!'
                },
                { quoted: m }
            );
        }

        const settingsFile =
            context.settingsFile ||
            'settings.json';

        let settings = {};

        try {
            if (fs.existsSync(settingsFile)) {
                const raw = fs.readFileSync(
                    settingsFile,
                    'utf8'
                );

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
                    text: '❌ Unable to read group settings.'
                },
                { quoted: m }
            );
        }

        const antiLink =
            settings.antilink?.[from] || {};

        const antiSpam =
            settings.antispam?.[from] || 'off';

        const antiTag =
            settings.antitag?.[from] || 'off';

        const badWords =
            settings.badwords?.[from];

        const antiSticker =
            settings.antisticker?.[from] || 'off';

        // Auto-reaction is OFF by default.
        const autoReaction =
            settings.autoReaction !== undefined
                ? settings.autoReaction
                : 'off';

        const status = value =>
            String(value).toLowerCase() === 'on'
                ? '🟢 ON'
                : '🔴 OFF';

        let badWordsStatus = '🔴 OFF';

        if (
            Array.isArray(badWords)
                ? badWords.length > 0
                : String(badWords).toLowerCase() === 'on'
        ) {
            badWordsStatus = '🟢 ON';
        }

        const text =
`┏━━━ 🛡️ *GROUP SETTINGS* 🛡️ ━━━┓
┃
┃ 🔗 *ANTI-LINK*
┃ ├ Warn: ${status(antiLink.warn)}
┃ └ Instant: ${status(antiLink.instant)}
┃
┃ 🚫 *ANTI-SPAM*
┃ └ Status: ${status(antiSpam)}
┃
┃ 🏷️ *ANTI-TAG*
┃ └ Status: ${status(antiTag)}
┃
┃ 🤬 *BAD WORDS*
┃ └ Status: ${badWordsStatus}
┃
┃ 🧩 *ANTI-STICKER*
┃ └ Status: ${status(antiSticker)}
┃
┃ 🤖 *AUTO-REACTION*
┃ └ Status: ${status(autoReaction)}
┃
┗━━━━━━━━━━━━━━━━━━━━━━━`;

        await sock.sendMessage(
            from,
            { text },
            { quoted: m }
        );
    }
};
