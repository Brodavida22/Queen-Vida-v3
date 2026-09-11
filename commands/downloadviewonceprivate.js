const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'downloadviewonceprivate',
    description: 'Downloads a quoted view-once media message and sends it silently to your DM (Creator/Bot only)',
    async execute(sock, m, from, args, isOwner) {
        if (!isOwner) {
            return sock.sendMessage(from, { text: '❌ This command is restricted to the bot creator only!' }, { quoted: m });
        }

        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quoted) {
            return sock.sendMessage(from, { text: '❌ Please reply to a View-Once image or video with *!downloadviewonceprivate*!' }, { quoted: m });
        }

        const viewOnceMsg = quoted.viewOnceMessage?.message || quoted.viewOnceMessageV2?.message || quoted;
        const mediaType = viewOnceMsg?.imageMessage ? 'image' : viewOnceMsg?.videoMessage ? 'video' : null;
        const actualMessage = viewOnceMsg?.imageMessage || viewOnceMsg?.videoMessage;

        if (!mediaType || !actualMessage) {
            return sock.sendMessage(from, { text: '❌ The replied message is not a valid View-Once media!' }, { quoted: m });
        }

        try {
            const buffer = await downloadMediaMessage(
                { message: { [mediaType + 'Message']: actualMessage } },
                'buffer',
                {},
                { logger: console }
            );

            const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const caption = `🔒 *Private View-Once Backup*\n${actualMessage.caption || ''}`;

            if (mediaType === 'image') {
                await sock.sendMessage(botJid, { image: buffer, caption });
            } else if (mediaType === 'video') {
                await sock.sendMessage(botJid, { video: buffer, caption });
            }

            // Silently react or acknowledge completion without spamming chat text
            try {
                await sock.sendMessage(from, { react: { text: '✅', key: m.key } });
            } catch (e) {}

        } catch (error) {
            console.error('Error downloading view once privately:', error);
            await sock.sendMessage(from, { text: '❌ Failed to download view-once media privately.' }, { quoted: m });
        }
    }
};
