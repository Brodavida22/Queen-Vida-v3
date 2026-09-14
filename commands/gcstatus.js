const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { getPrefix } = require('../utils/prefix');

function getQuotedMessage(m) {
    return m.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
}

function getQuotedContext(m) {
    return m.message?.extendedTextMessage?.contextInfo || {};
}

function unwrapMediaMessage(message) {
    if (!message) return null;

    let current = message;

    // Unwrap common WhatsApp wrappers
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
    description: 'Post replied group media to the bot WhatsApp Status',

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
        if (!from.endsWith('@g.us')) {
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

        // Check whether replied message contains supported media
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

            /*
             * Rebuild the original quoted message key.
             * This makes media downloading more reliable,
             * including media sent by another group member.
             */
            const quotedKey = {
                remoteJid: from,
                id: contextInfo.stanzaId,
                participant: contextInfo.participant
            };

            if (!quotedKey.id) {
                throw new Error('Could not identify the replied message.');
            }

            // Download the replied media
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

            /*
             * WhatsApp does not have a separate "group status".
             * This posts to the bot's normal WhatsApp Status
             * and targets the members of this group as the audience.
             */
            const metadata = await sock.groupMetadata(from);

            const statusJidList = (metadata.participants || [])
                .map(member => member.id)
                .filter(Boolean);

            if (!statusJidList.length) {
                throw new Error(
                    'Could not determine the group members for the Status audience.'
                );
            }

            // Optional caption:
            // .gcstatus Your caption here
            const customCaption = args.join(' ').trim();

            const originalCaption =
                media.message.caption || '';

            const caption =
                customCaption ||
                originalCaption ||
                undefined;

            // Prepare Status content
            let statusContent;

            if (media.type === 'image') {
                statusContent = {
                    image: buffer,
                    ...(caption ? { caption } : {})
                };
            } else {
                statusContent = {
                    video: buffer,
                    ...(caption ? { caption } : {})
                };
            }

            // Post to the bot's WhatsApp Status
            await sock.sendMessage(
                'status@broadcast',
                statusContent,
                {
                    statusJidList,
                    broadcast: true
                }
            );

            // Confirm inside the group
            await sock.sendMessage(
                from,
                {
                    text:
                        `✅ ${media.type === 'image' ? 'Image' : 'Video'} ` +
                        `has been posted to my WhatsApp Status.\n\n` +
                        `👥 Group members can view it.`
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
                        `❌ Failed to post the media to WhatsApp Status.\n\n` +
                        `_${error.message || 'Unknown error'}_`
                },
                { quoted: m }
            ).catch(() => {});
        }
    }
};
