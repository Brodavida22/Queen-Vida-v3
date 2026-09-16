const {
    downloadMediaMessage,
    StatusHelper
} = require('@whiskeysockets/baileys');

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

    // Unwrap WhatsApp containers
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

        // Owner only
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
                        `Example:\n` +
                        `Reply to a picture and send ${prefix}gcstatus`
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
                        `❌ The replied message is not an image or video.\n\n` +
                        `Reply to an image/video and send ${prefix}gcstatus.`
                },
                { quoted: m }
            );
        }

        try {
            const contextInfo = getQuotedContext(m);

            if (!contextInfo.stanzaId) {
                throw new Error(
                    'Could not identify the replied message.'
                );
            }

            // Rebuild the quoted message key
            const quotedKey = {
                remoteJid: from,
                id: contextInfo.stanzaId,
                participant: contextInfo.participant,
                fromMe: false
            };

            // Download media
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
                throw new Error('Downloaded media is empty.');
            }

            // Optional custom caption:
            // .gcstatus My caption
            const customCaption = Array.isArray(args)
                ? args.join(' ').trim()
                : '';

            const originalCaption =
                media.message?.caption || '';

            const caption =
                customCaption ||
                originalCaption ||
                undefined;

            /*
             * IMPORTANT:
             *
             * StatusHelper is used here instead of manually sending
             * groupStatus:true.
             *
             * The InnovatorsSoft Baileys fork specifically supports
             * group JIDs through StatusHelper.send().
             */

            let status;

            if (media.type === 'image') {
                status = StatusHelper.image(
                    buffer,
                    caption
                );
            } else {
                status = StatusHelper.video(
                    buffer,
                    caption
                );
            }

            // Send specifically to THIS group.
            await StatusHelper.send(
                sock,
                status,
                [from]
            );

            // Success message
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
                        `Error: ${error?.message || 'Unknown error'}`
                },
                { quoted: m }
            ).catch(() => {});
        }
    }
};
