const {
    getPrefix,
    setPrefix,
    getValidPrefixes
} = require('../utils/prefix');

module.exports = {
    name: 'prefix',

    description: 'Change the bot command prefix',

    async execute(sock, m, from, args, isOwner) {

        // Only the creator can change the prefix
        if (!isOwner) {
            return sock.sendMessage(
                from,
                {
                    text: '❌ *ACCESS DENIED*\n\nOnly the QUEEN VIDA creator can change the bot prefix.'
                },
                { quoted: m }
            );
        }

        const currentPrefix = getPrefix();

        // Show current prefix if no argument is given
        if (!args[0]) {
            return sock.sendMessage(
                from,
                {
                    text:
`👑 *QUEEN VIDA-V3 PREFIX SETTINGS*

◈ Current Prefix: *[ ${currentPrefix} ]*

◈ Available Prefixes:
• [ . ]
• [ ! ]
• [ # ]
• [ / ]

📌 *Usage:*
${currentPrefix}prefix .
${currentPrefix}prefix !
${currentPrefix}prefix #
${currentPrefix}prefix /

👑 Only the creator can change the prefix.`
                },
                { quoted: m }
            );
        }

        const newPrefix = args[0].trim();

        if (!getValidPrefixes().includes(newPrefix)) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ *INVALID PREFIX*

You can only use:

• [ . ]
• [ ! ]
• [ # ]
• [ / ]

Example:
${currentPrefix}prefix .`
                },
                { quoted: m }
            );
        }

        if (newPrefix === currentPrefix) {
            return sock.sendMessage(
                from,
                {
                    text: `⚠️ The bot is already using *[ ${currentPrefix} ]* as its prefix.`
                },
                { quoted: m }
            );
        }

        const changed = setPrefix(newPrefix);

        if (!changed) {
            return sock.sendMessage(
                from,
                {
                    text: '❌ Failed to save the new prefix.'
                },
                { quoted: m }
            );
        }

        await sock.sendMessage(
            from,
            {
                text:
`👑 *QUEEN VIDA-V3 PREFIX UPDATED*

━━━━━━━━━━━━━━━━━━━━

◈ Old Prefix : *[ ${currentPrefix} ]*
◈ New Prefix : *[ ${newPrefix} ]*
◈ Status     : *ACTIVE* 🟢

━━━━━━━━━━━━━━━━━━━━

From now on, use:

*${newPrefix}menu*
*${newPrefix}ai*
*${newPrefix}gcstatus*

👑 *QUEEN VIDA-V3*`
            },
            { quoted: m }
        );
    }
};
