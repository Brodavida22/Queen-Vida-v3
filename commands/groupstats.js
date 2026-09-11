module.exports = {
    name: 'groupstats',
    description: 'Show basic group statistics',

    async execute(sock, m, from) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, {
                text: '❌ This command can only be used in a group.'
            });
        }

        try {
            const metadata = await sock.groupMetadata(from);
            const members = metadata.participants || [];

            const admins = members.filter(
                p => p.admin === 'admin' || p.admin === 'superadmin'
            );

            const owners = members.filter(
                p => p.admin === 'superadmin'
            );

            const regularMembers = members.length - admins.length;

            await sock.sendMessage(from, {
                text: `╭━━━〔 📊 GROUP STATS 〕━━━╮
┃
┃ 🏷️ Group: ${metadata.subject}
┃ 👥 Total Members: ${members.length}
┃ 👤 Regular Members: ${regularMembers}
┃ 🛡️ Admins: ${admins.length}
┃ 👑 Owner(s): ${owners.length}
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
            });

        } catch (error) {
            console.error('groupstats error:', error);

            await sock.sendMessage(from, {
                text: '❌ Failed to retrieve group statistics.'
            });
        }
    }
};
