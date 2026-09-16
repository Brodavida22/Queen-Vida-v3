const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { getPrefix } = require('../utils/prefix');

function getQuotedMessage(m) {
    return (
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
        m.message?.imageMessage?.contextInfo?.quotedMessage ||
        m.message?.videoMessage?.contextInfo?.quotedMessage ||
        null
    );
}

function getQuotedContext(m) {
    return m.message?.extendedTextMessage?.contextInfo || {};
}

function unwrapMediaMessage(message) {
    if (!message) return null;

    let current = message;

    if (current.ephemeralMessage?.message) {
        current = current.ephemeralMessage.message;
    }

    if (current.viewOnceMessage?.message) {
        current = current.viewOnceMessage.message;
    }

    if (current.viewOnceMessageV2?.message) {
        current = current.viewOnceMessageV2.message;
    }

    if (current.viewOnceMessageV2Extension?.message) {
        current = current.viewOnceMessageV2Extension.message;
    }

    if (current.imageMessage) {
        return {
            type: 'image',
            message: current.imageMessage
        };
    }

    if (current.videoMessage) {
        return {
            type: 'video',
            message: current.videoMessage
        };
    }

    return null;
}

module.exports = {
    name: 'gcstatus',
    description: 'Post replied image/video as Group Status',

    async execute(sock, m, from, args, isOwner) {
        const prefix = getPrefix();

        // Creator only
        if (!isOwner) {
            return sock.sendMessage(
                from,
                {
                    text: '❌ This command is restricted to the bot creator only.'
                },
                { quoted: m }
            );
        }

        // Group only
        if (!from || !from.endsWith('@g.us')) {
            return sock.sendMessage(
                from,
                {
                    text: `❌ Use ${prefix}gcstatus inside a group.`
                },
                { quoted: m }
            );
        }

        // Get replied message
        const quoted = getQuotedMessage(m);

        if (!quoted) {
            return sock.sendMessage(
                from,
                {
                    text:
                        `❌ Reply to an image or video with ${prefix}gcstatus.\n\n` +
                        `Example: Reply to a picture and send ${prefix}gcstatus`
                },
                { quoted: m }
            );
        }

        // Detect image/video
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
            const contextInfo = getQuotedContext(m);

            const quotedKey = {
                remoteJid: from,
                id: contextInfo.stanzaId,
                participant: contextInfo.participant
            };

            if (!quotedKey.id) {
                throw new Error(
                    'Could not identify the replied message.'
                );
            }

            // Download replied media
            const buffer = await downloadMediaMessage(
                {
                    key: quotedKey,
                    message: quoted
                },
                'buffer',
                {},
                {
                    logger: console
                }
            );

            if (!buffer || !buffer.length) {
                throw new Error(
                    'Downloaded media is empty.'
                );
            }

            // Optional custom caption
            const customCaption = Array.isArray(args)
                ? args.join(' ').trim()
                : '';

            const originalCaption =
                media.message.caption || '';

            const caption =
                customCaption ||
                originalCaption ||
                undefined;

            /*
             * ============================================
             * TRUE GROUP STATUS
             * ============================================
             *
             * IMPORTANT:
             * Do NOT use status@broadcast here.
             *
             * @innovatorssoft/baileys supports:
             *
             * groupStatus: true
             *
             * This causes the library to wrap the message
             * as a groupStatusMessageV2.
             */

            let statusContent;

            if (media.type === 'image') {
                statusContent = {
                    image: buffer,
                    ...(caption ? { caption } : {}),
                    groupStatus: true
                };
            } else {
                statusContent = {
                    video: buffer,
                    ...(caption ? { caption } : {}),
                    groupStatus: true
                };
            }

            // Send TRUE GROUP STATUS
            await sock.sendMessage(
                from,
                statusContent
            );

            // Confirmation
            await sock.sendMessage(
                from,
                {
                    text:
                        `✅ ${media.type === 'image' ? 'Image' : 'Video'} ` +
                        `posted to the Group Status.`
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
                        `❌ Group Status failed.\n\n` +
                        `Error: ${error.message || 'Unknown error'}`
                },
                { quoted: m }
            ).catch(() => {});
        }
    }
};
