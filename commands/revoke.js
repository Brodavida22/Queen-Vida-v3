module.exports = {
    name: 'revoke',
    description: 'Revoke the group invite link',

    async execute(sock, m, from) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, {
                text: '❌ This command can only be used in a group.'
            });
        }

        try {
            await sock.groupRevokeInvite(from);

            await sock.sendMessage(from, {
                text: '✅ Group invite link has been revoked successfully.\n\n🔐 The previous link can no longer be used.'
            });
        } catch (error) {
            console.error('revoke error:', error);

            await sock.sendMessage(from, {
                text: '❌ Failed to revoke the group invite link.'
            });
        }
    }
};
