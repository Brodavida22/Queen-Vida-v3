module.exports = {
    name: 'tagall',
    description: 'Tags every member in the group with an optional custom message',
    async execute(sock, m, from, args) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ This command can only be used inside groups!' }, { quoted: m });
        }

        try {
            const groupMetadata = await sock.groupMetadata(from);
            const participants = groupMetadata.participants;
            const customMessage = args.join(' ') || 'Attention everyone!';

            let text = `┏━━━ 👑 *TAGALL* 👑 ━━━┓\n`;
            text += `┃ 📢 *Message:* ${customMessage}\n`;
            text += `┣━━━━━━━━━━━━━━━━━━━━━━━\n`;

            const mentions = [];
            for (let member of participants) {
                text += `┃ @${member.id.split('@')[0]}\n`;
                mentions.push(member.id);
            }
            text += `┗━━━━━━━━━━━━━━━━━━━━━━━`;

            await sock.sendMessage(from, { text: text, mentions: mentions }, { quoted: m });
        } catch (error) {
            console.error('Error executing tagall:', error);
            await sock.sendMessage(from, { text: '❌ Failed to tag group members.' }, { quoted: m });
        }
    }
};
