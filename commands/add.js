module.exports = {
    name: 'add',
    description: 'Adds a user to the group (Admin only)',
    async execute(sock, m, from, args) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ This command can only be used inside groups!' }, { quoted: m });
        }

        const target = args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null;

        if (!target) {
            const usageText = 
`┏━━━ 👑 *ADD COMMAND* 👑 ━━━┓\n` +
`┃ Usage:\n` +
`┃ • *!add <phone number>*\n` +
`┃   _Description: Adds a user to the group using their phone number (with country code)_`;
            return sock.sendMessage(from, { text: usageText }, { quoted: m });
        }

        try {
            const response = await sock.groupParticipantsUpdate(from, [target], 'add');
            
            // Check if user was successfully added or needs an invite link
            if (response && response[0]?.status === '403') {
                await sock.sendMessage(from, { text: `❌ Could not add user directly due to their privacy settings. They must be invited via link.` }, { quoted: m });
            } else {
                await sock.sendMessage(from, { text: `✅ Successfully added the user to the group.` }, { quoted: m });
            }
        } catch (error) {
            console.error('Error adding user:', error);
            await sock.sendMessage(from, { text: '❌ Failed to add user. Ensure the bot has admin privileges and the number is valid.' }, { quoted: m });
        }
    }
};
