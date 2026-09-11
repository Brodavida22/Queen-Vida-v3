module.exports = {
    name: 'members',
    description: 'Show group member count',

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
            ).length;

            const regular = members.length - admins;

            await sock.sendMessage(from, {
                text: `╭━━━〔 👥 MEMBERS 〕━━━╮
┃
┃ 👥 Total Members: *${members.length}*
┃ 🛡️ Admins: *${admins}*
┃ 👤 Regular Members: *${regular}*
┃
╰━━━━━━━━━━━━━━━━━━╯`
            });

        } catch (error) {
            console.error('members error:', error);

            await sock.sendMessage(from, {
                text: '❌ Could not retrieve members.'
            });
        }
    }
};
