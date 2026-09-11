const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'changeprofile',
    description: 'Updates the bot profile picture using a sent or quoted image (Owner/Creator only)',
    async execute(sock, m, from, args, isOwner) {
        if (!isOwner) {
            return sock.sendMessage(from, { text: '❌ Restricted to bot creator (QUEEN VIDA)!' }, { quoted: m });
        }

        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const targetMessage = m.message?.imageMessage ? m : (quoted?.imageMessage ? { message: quoted } : null);

        if (!targetMessage) {
            return sock.sendMessage(from, { text: '❌ Please send an image or reply to an image with *!changeprofile* to update the picture!' }, { quoted: m });
        }

        try {
            const buffer = await downloadMediaMessage(
                targetMessage,
                'buffer',
                {},
                { logger: console }
            );

            const botJid = sock.user.id;
            await sock.updateProfilePicture(botJid, buffer);
            await sock.sendMessage(from, { text: `✅ Profile picture updated successfully!` }, { quoted: m });
        } catch (error) {
            console.error('Error updating profile picture:', error);
            await sock.sendMessage(from, { text: '❌ Failed to update profile picture. Ensure the media is a valid image.' }, { quoted: m });
        }
    }
};
