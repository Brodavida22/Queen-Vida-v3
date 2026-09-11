const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { getPrefix } = require('../utils/prefix');

function getQuotedMessage(m) {
    return m.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
}

function unwrapMediaMessage(message) {
    if (!message) return null;

    const wrapped =
        message.viewOnceMessage?.message ||
        message.viewOnceMessageV2?.message ||
        message.viewOnceMessageV2Extension?.message ||
        message;

    if (wrapped.imageMessage) {
        return {
            type: 'image',
            message: wrapped.imageMessage
        };
    }

    if (wrapped.videoMessage) {
        return {
            type: 'video',
            message: wrapped.videoMessage
        };
    }

    return null;
}

module.exports = {
    name: 'gcstatus',
    description: 'Post replied group media to the bot WhatsApp Status',

    async execute(sock, m, from, args, isOwner) {
        const prefix = getPrefix();

        if (!isOwner) {
            return sock.sendMessage(
                from,
                {
                    text: '❌ This command is restricted to the bot creator only.'
                },
                { quoted: m }
            );
        }

        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(
                from,
                {
                    text: `❌ Use ${prefix}gcstatus inside a group.`
                },
                { quoted: m }
            );
        }

        const quoted = getQuotedMessage(m);

        if (!quoted) {
            return sock.sendMessage(
                from,
                {
                    text: `❌ Reply to an image or video with ${prefix}gcstatus.`
                },
                { quoted: m }
            );
        }

        const media = unwrapMediaMessage(quoted);

        if (!media) {
            return sock.sendMessage(
                from,
                {
                    text:
                        `❌ The message you replied to is not an image or video.\n\n` +
                        `Reply to an image/video and send ${prefix}gcstatus.`
                },
                { quoted: m }
            );
        }

        try {
            const contextInfo =
                m.message?.extendedTextMessage?.contextInfo || {};

            const stanzaId = contextInfo.stanzaId;
            const participant = contextInfo.participant;

            const targetMessage = {
                key: {
                    remoteJid: from,
                    id: stanzaId || `gcstatus-${Date.now()}`,
                    participant
                },
                message: quoted
            };

            const buffer = await downloadMediaMessage(
                targetMessage,
                'buffer',
                {},
                { logger: console }
            );

            if (!buffer || !buffer.length) {
                throw new Error('Downloaded media is empty.');
            }

            // The members of this group become the Status audience.
            const metadata = await sock.groupMetadata(from);

            const statusJidList = (metadata.participants || [])
                .map(p => p.id)
                .filter(Boolean);

            if (!statusJidList.length) {
                throw new Error(
                    'Could not determine the group status audience.'
                );
            }

            const customCaption = args.join(' ').trim();
            const originalCaption = media.message.caption || '';

            const caption =
                customCaption ||
                originalCaption ||
                undefined;

            const statusContent =
                media.type === 'image'
                    ? {
                        image: buffer,
                        ...(caption ? { caption } : {})
                    }
                    : {
                        video: buffer,
                        ...(caption ? { caption } : {})
                    };

            await sock.sendMessage(
                'status@broadcast',
                statusContent,
                {
                    statusJidList,
                    broadcast: true
                }
            );

            await sock.sendMessage(
                from,
                {
                    text:
                        `✅ ${media.type === 'image' ? 'Image' : 'Video'} ` +
                        `posted to my WhatsApp Status.`
                },
                { quoted: m }
            );

        } catch (error) {
            console.error(
                '🔥 [GCSTATUS ERROR]:',
                error
            );

            await sock.sendMessage(
                from,
                {
                    text:
                        '❌ Failed to post the media to WhatsApp Status.\n\n' +
                        `_${error.message || 'Unknown error'}_`
                },
                { quoted: m }
            ).catch(() => {});
        }
    }
};
