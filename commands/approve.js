module.exports = {
    name: 'approve',
    description: 'Approve a pending group join request',

    async execute(sock, m, from) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, {
                text: '❌ This command can only be used in a group.'
            });
        }

        try {
            const requests = await sock.groupRequestParticipantsList(from);

            if (!requests || !requests.length) {
                return sock.sendMessage(from, {
                    text: '📭 There are no pending join requests.'
                });
            }

            const user = requests[0];

            await sock.groupRequestParticipantsUpdate(
                from,
                [user.jid],
                'approve'
            );

            await sock.sendMessage(from, {
                text: `✅ Approved @${user.jid.split('@')[0]}`,
                mentions: [user.jid]
            });

        } catch (error) {
            console.error('approve error:', error);

            await sock.sendMessage(from, {
                text: '❌ Unable to approve the pending request.'
            });
        }
    }
};
