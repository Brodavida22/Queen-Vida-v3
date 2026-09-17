const {
    downloadMediaMessage,
    StatusHelper
} = require('@whiskeysockets/baileys');

const {
    getPrefix
} = require('../utils/prefix');


// ============================================================
// MESSAGE HELPERS
// ============================================================

function unwrapMessage(message) {
    if (!message) {
        return null;
    }

    let current = message;

    if (current.ephemeralMessage?.message) {
        current =
            current.ephemeralMessage.message;
    }

    if (current.viewOnceMessage?.message) {
        current =
            current.viewOnceMessage.message;
    }

    if (current.viewOnceMessageV2?.message) {
        current =
            current.viewOnceMessageV2.message;
    }

    if (
        current.viewOnceMessageV2Extension
            ?.message
    ) {
        current =
            current.viewOnceMessageV2Extension.message;
    }

    return current;
}


function getQuotedContext(m) {
    return (
        m?.message?.extendedTextMessage
            ?.contextInfo ||
        m?.message?.imageMessage
            ?.contextInfo ||
        m?.message?.videoMessage
            ?.contextInfo ||
        m?.message?.documentMessage
            ?.contextInfo ||
        {}
    );
}


function getQuotedMessage(m) {
    const contextInfo =
        getQuotedContext(m);

    return (
        contextInfo?.quotedMessage ||
        null
    );
}


function getMedia(message) {
    const current =
        unwrapMessage(message);

    if (!current) {
        return null;
    }

    if (current.imageMessage) {
        return {
            type: 'image',
            message:
                current.imageMessage
        };
    }

    if (current.videoMessage) {
        return {
            type: 'video',
            message:
                current.videoMessage
        };
    }

    return null;
}


function getText(message) {
    const current =
        unwrapMessage(message);

    if (!current) {
        return '';
    }

    return (
        current.conversation ||
        current.extendedTextMessage?.text ||
        current.imageMessage?.caption ||
        current.videoMessage?.caption ||
        current.documentMessage?.caption ||
        ''
    ).trim();
}


function getCommandText(args) {
    if (!Array.isArray(args)) {
        return '';
    }

    return args
        .join(' ')
        .trim();
}


// ============================================================
// DOWNLOAD REPLIED MEDIA
// ============================================================

async function downloadQuotedMedia(
    m,
    from,
    quoted
) {
    const contextInfo =
        getQuotedContext(m);

    if (!contextInfo?.stanzaId) {
        throw new Error(
            'Could not identify the replied message.'
        );
    }

    const quotedKey = {
        remoteJid:
            from,

        id:
            contextInfo.stanzaId,

        participant:
            contextInfo.participant,

        fromMe:
            false
    };

    const buffer =
        await downloadMediaMessage(
            {
                key:
                    quotedKey,

                message:
                    quoted
            },

            'buffer',

            {},

            {
                logger:
                    console
            }
        );

    if (
        !buffer ||
        !buffer.length
    ) {
        throw new Error(
            'Downloaded media is empty.'
        );
    }

    return buffer;
}


// ============================================================
// STATUS BUILDERS
// ============================================================

function buildTextStatus(
    text
) {
    if (
        !text ||
        !String(text).trim()
    ) {
        throw new Error(
            'Status text is empty.'
        );
    }

    return StatusHelper.text(
        String(text).trim()
    );
}


function buildImageStatus(
    buffer,
    caption = ''
) {
    if (
        !buffer ||
        !buffer.length
    ) {
        throw new Error(
            'Image buffer is empty.'
        );
    }

    return StatusHelper.image(
        buffer,
        caption ||
            undefined
    );
}


function buildVideoStatus(
    buffer,
    caption = ''
) {
    if (
        !buffer ||
        !buffer.length
    ) {
        throw new Error(
            'Video buffer is empty.'
        );
    }

    return StatusHelper.video(
        buffer,
        caption ||
            undefined
    );
}


// ============================================================
// GROUP STATUS SENDER
// ============================================================

async function sendGroupStatus(
    sock,
    groupJid,
    status
) {
    if (
        !groupJid ||
        !groupJid.endsWith('@g.us')
    ) {
        throw new Error(
            'Invalid group JID.'
        );
    }

    if (
        !sock ||
        typeof sock !== 'object'
    ) {
        throw new Error(
            'WhatsApp socket is unavailable.'
        );
    }

    return StatusHelper.send(
        sock,
        status,
        [groupJid]
    );
}


// ============================================================
// TELEGRAM STATUS HELPERS
// ============================================================

async function sendTelegramTextStatus(
    sock,
    groupJid,
    text
) {
    const status =
        buildTextStatus(text);

    return sendGroupStatus(
        sock,
        groupJid,
        status
    );
}


async function sendTelegramImageStatus(
    sock,
    groupJid,
    buffer,
    caption = ''
) {
    const status =
        buildImageStatus(
            buffer,
            caption
        );

    return sendGroupStatus(
        sock,
        groupJid,
        status
    );
}


async function sendTelegramVideoStatus(
    sock,
    groupJid,
    buffer,
    caption = ''
) {
    const status =
        buildVideoStatus(
            buffer,
            caption
        );

    return sendGroupStatus(
        sock,
        groupJid,
        status
    );
}


// ============================================================
// COMMAND
// ============================================================

module.exports = {
    name:
        'gcstatus',

    description:
        'Post text, links, images or videos to Group Status',

    // Telegram gateway exports
    sendGroupStatus,
    sendTelegramTextStatus,
    sendTelegramImageStatus,
    sendTelegramVideoStatus,

    async execute(
        sock,
        m,
        from,
        args,
        isOwner
    ) {
        const prefix =
            getPrefix();

        // ========================================================
        // OWNER ONLY
        // ========================================================

        if (!isOwner) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ This command is restricted to the bot creator only.'
                },
                {
                    quoted:
                        m
                }
            );
        }

        // ========================================================
        // GROUP ONLY
        // ========================================================

        if (
            !from ||
            !from.endsWith('@g.us')
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
                        `❌ Use ${prefix}gcstatus inside a group.`
                },
                {
                    quoted:
                        m
                }
            );
        }

        try {
            const commandText =
                getCommandText(args);

            const quoted =
                getQuotedMessage(m);

            // ====================================================
            // REPLIED MESSAGE
            // ====================================================

            if (quoted) {
                const media =
                    getMedia(quoted);

                // ==================================================
                // IMAGE / VIDEO
                // ==================================================

                if (media) {
                    const buffer =
                        await downloadQuotedMedia(
                            m,
                            from,
                            quoted
                        );

                    const caption =
                        commandText ||
                        media.message?.caption ||
                        '';

                    if (
                        media.type ===
                        'image'
                    ) {
                        const status =
                            buildImageStatus(
                                buffer,
                                caption
                            );

                        await sendGroupStatus(
                            sock,
                            from,
                            status
                        );
                    } else {
                        const status =
                            buildVideoStatus(
                                buffer,
                                caption
                            );

                        await sendGroupStatus(
                            sock,
                            from,
                            status
                        );
                    }

                    await sock.sendMessage(
                        from,
                        {
                            text:
                                `✅ ${
                                    media.type ===
                                    'image'
                                        ? 'Image'
                                        : 'Video'
                                } posted to the Group Status.`
                        },
                        {
                            quoted:
                                m
                        }
                    );

                    return;
                }

                // ==================================================
                // QUOTED TEXT
                // ==================================================

                const quotedText =
                    getText(quoted);

                if (
                    quotedText &&
                    !commandText
                ) {
                    const status =
                        buildTextStatus(
                            quotedText
                        );

                    await sendGroupStatus(
                        sock,
                        from,
                        status
                    );

                    await sock.sendMessage(
                        from,
                        {
                            text:
                                '✅ Text posted to the Group Status.'
                        },
                        {
                            quoted:
                                m
                        }
                    );

                    return;
                }
            }

            // ====================================================
            // DIRECT TEXT / LINK
            // ====================================================

            if (commandText) {
                const status =
                    buildTextStatus(
                        commandText
                    );

                await sendGroupStatus(
                    sock,
                    from,
                    status
                );

                await sock.sendMessage(
                    from,
                    {
                        text:
                            '✅ Text/link posted to the Group Status.'
                    },
                    {
                        quoted:
                            m
                    }
                );

                return;
            }

            // ====================================================
            // HELP
            // ====================================================

            await sock.sendMessage(
                from,
                {
                    text:
                        `📢 *GCSTATUS*\n\n` +

                        `📝 Text:\n` +
                        `${prefix}gcstatus Hello everyone\n\n` +

                        `🔗 Link:\n` +
                        `${prefix}gcstatus https://example.com\n\n` +

                        `🖼️ Image:\n` +
                        `Reply to an image with ${prefix}gcstatus\n\n` +

                        `🎥 Video:\n` +
                        `Reply to a video with ${prefix}gcstatus Your caption\n\n` +

                        `📱 Telegram:\n` +
                        `Use /gcstatus from your linked Telegram account.`
                },
                {
                    quoted:
                        m
                }
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
                        `❌ *Group Status failed.*\n\n` +
                        `Error: ${
                            error?.message ||
                            'Unknown error'
                        }`
                },
                {
                    quoted:
                        m
                }
            ).catch(
                () => {}
            );
        }
    }
};
