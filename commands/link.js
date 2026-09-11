module.exports = {
    name: 'link',
    description: 'Get the group invite link',

    async execute(sock, m, from) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, {
                text: '❌ This command can only be used in a group.'
            });
        }

        try {
            const code = await sock.groupInviteCode(from);

            await sock.sendMessage(from, {
                text: `🔗 *GROUP INVITE LINK*\n\nhttps://chat.whatsapp.com/${code}`
            });
        } catch (error) {
            console.error('link error:', error);

            await sock.sendMessage(from, {
                text: '❌ I could not get the group invite link.'
            });
        }
    }
};
