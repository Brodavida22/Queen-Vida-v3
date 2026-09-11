module.exports = {
    name: 'creategroup',
    description: 'Creates a brand new WhatsApp group with just the bot inside (Owner/Creator only)',
    async execute(sock, m, from, args, isOwner) {
        if (!isOwner) {
            return sock.sendMessage(from, { text: '❌ This command is restricted to the bot creator (QUEEN VIDA) only!' }, { quoted: m });
        }

        const groupName = args.join(' ');
        if (!groupName) {
            return sock.sendMessage(from, { text: '❌ Please provide a name for the group!\nUsage: *!creategroup My New Group*' }, { quoted: m });
        }

        try {
            // WhatsApp requires at least one participant to initialize a group, 
            // so we add the bot itself and then immediately remove any extra participant if needed,
            // or pass just the bot's own JID.
            const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

            const group = await sock.groupCreate(groupName, [botJid]);
            const groupJid = group.id || group.gid;

            await sock.sendMessage(from, { text: `✅ Successfully created group: *${groupName}* with just the bot inside!` }, { quoted: m });

            try {
                const inviteCode = await sock.groupInviteCode(groupJid);
                await sock.sendMessage(from, { text: `🔗 *Invite Link:* https://chat.whatsapp.com/${inviteCode}` }, { quoted: m });
            } catch (e) {
                // Ignore if invite generation fails
            }
        } catch (error) {
            console.error('Error creating group:', error);
            await sock.sendMessage(from, { text: '❌ Failed to create the group. Ensure your account is connected and has permission to create groups.' }, { quoted: m });
        }
    }
};
