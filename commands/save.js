const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'save',
    description: 'Downloads and saves disappearing view-once media or replied status',
    async execute(sock, m, from) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return sock.sendMessage(from, { text: '❌ Please reply to a view-once image, video, or status to save it!' }, { quoted: m });
        }

        const messageType = Object.keys(quoted)[0];
        const mediaMsg = quoted[messageType];

        if (!mediaMsg || (!mediaMsg.viewOnce && messageType !== 'imageMessage' && messageType !== 'videoMessage')) {
            return sock.sendMessage(from, { text: '❌ The replied message is not a valid view-once or downloadable media!' }, { quoted: m });
        }

        try {
            const stream = await downloadContentFromMessage(mediaMsg, messageType.replace('Message', ''));
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            const caption = mediaMsg.caption || 'Downloaded via QUEEN VIDA-V3 👑';
            if (messageType.includes('image') || mediaMsg.mimetype?.includes('image')) {
                await sock.sendMessage(from, { image: buffer, caption: caption }, { quoted: m });
            } else if (messageType.includes('video') || mediaMsg.mimetype?.includes('video')) {
                await sock.sendMessage(from, { video: buffer, caption: caption }, { quoted: m });
            }
        } catch (error) {
            console.error('Error saving media:', error);
            await sock.sendMessage(from, { text: '❌ Failed to download and save the media.' }, { quoted: m });
        }
    }
};
