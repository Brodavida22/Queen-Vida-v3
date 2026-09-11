const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'downloadviewonce',
    description: 'Downloads and reveals a quoted view-once media message (Creator/Bot only)',
    async execute(sock, m, from, args, isOwner) {
        if (!isOwner) {
            return sock.sendMessage(from, { text: '❌ This command is restricted to the bot creator only!' }, { quoted: m });
        }

        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quoted) {
            return sock.sendMessage(from, { text: '❌ Please reply to a View-Once image or video with *!downloadviewonce*!' }, { quoted: m });
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

            const caption = actualMessage.caption || '🔓 *Revealed View-Once Media*';

            if (mediaType === 'image') {
                await sock.sendMessage(from, { image: buffer, caption }, { quoted: m });
            } else if (mediaType === 'video') {
                await sock.sendMessage(from, { video: buffer, caption }, { quoted: m });
            }
        } catch (error) {
            console.error('Error downloading view once:', error);
            await sock.sendMessage(from, { text: '❌ Failed to download view-once media. It may have already expired or been viewed.' }, { quoted: m });
        }
    }
};
