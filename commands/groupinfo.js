module.exports = {
    name: 'groupinfo',
    description: 'Show group information',

    async execute(sock, m, from) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, {
                text: '❌ This command can only be used in a group.'
            });
        }

        try {
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants || [];

            const admins = participants.filter(
                p => p.admin === 'admin' || p.admin === 'superadmin'
            ).length;

            const owner = metadata.owner
                ? `@${metadata.owner.split('@')[0]}`
                : 'Unknown';

            const text = `╭━━━〔 👥 GROUP INFO 〕━━━╮
┃
┃ 🏷️ Name: ${metadata.subject}
┃ 👥 Members: ${participants.length}
┃ 🛡️ Admins: ${admins}
┃ 👑 Owner: ${owner}
┃ 🆔 ID: ${from}
┃
┃ 📝 Description:
┃ ${metadata.desc || 'No description'}
┃
╰━━━━━━━━━━━━━━━━━━╯`;

            const mentions = metadata.owner ? [metadata.owner] : [];

            await sock.sendMessage(from, {
                text,
                mentions
            });

        } catch (error) {
            console.error('groupinfo error:', error);

            await sock.sendMessage(from, {
                text: '❌ Unable to retrieve group information.'
            });
        }
    }
};
