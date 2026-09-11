module.exports = {
    name: 'requests',
    description: 'Show pending group join requests',

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
                    text: '📭 No pending join requests.'
                });
            }

            let text = `╭━━━〔 📥 JOIN REQUESTS 〕━━━╮\n┃\n`;

            requests.forEach((user, index) => {
                text += `┃ ${index + 1}. @${user.jid.split('@')[0]}\n`;
            });

            text += `┃\n┃ Total: ${requests.length}\n╰━━━━━━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(from, {
                text,
                mentions: requests.map(user => user.jid)
            });

        } catch (error) {
            console.error('requests error:', error);

            await sock.sendMessage(from, {
                text: '❌ Failed to retrieve join requests.'
            });
        }
    }
};
