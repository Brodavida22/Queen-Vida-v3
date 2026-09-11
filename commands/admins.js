module.exports = {
    name: 'admins',
    description: 'Show group administrators',

    async execute(sock, m, from) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, {
                text: '❌ This command can only be used in a group.'
            });
        }

        try {
            const metadata = await sock.groupMetadata(from);

            const admins = metadata.participants.filter(
                p => p.admin === 'admin' || p.admin === 'superadmin'
            );

            if (!admins.length) {
                return sock.sendMessage(from, {
                    text: '❌ No group admins found.'
                });
            }

            let text = `╭━━━〔 🛡️ GROUP ADMINS 〕━━━╮\n┃\n`;

            admins.forEach((admin, index) => {
                const role =
                    admin.admin === 'superadmin'
                        ? '👑 Owner'
                        : '🛡️ Admin';

                text += `┃ ${index + 1}. @${admin.id.split('@')[0]} — ${role}\n`;
            });

            text += `┃\n╰━━━━━━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(from, {
                text,
                mentions: admins.map(a => a.id)
            });

        } catch (error) {
            console.error('admins error:', error);

            await sock.sendMessage(from, {
                text: '❌ Failed to retrieve group admins.'
            });
        }
    }
};
