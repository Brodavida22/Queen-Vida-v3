const {
    downloadMediaMessage,
    StatusHelper
} = require('@whiskeysockets/baileys');

const { getPrefix } = require('../utils/prefix');


// ============================================================
// MESSAGE HELPERS
// ============================================================

function unwrapMessage(message) {
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

    return current;
}


function getQuotedContext(m) {
    return (
        m?.message?.extendedTextMessage?.contextInfo ||
        m?.message?.imageMessage?.contextInfo ||
        m?.message?.videoMessage?.contextInfo ||
        m?.message?.documentMessage?.contextInfo ||
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
        remoteJid: from,
        id: contextInfo.stanzaId,
        participant:
            contextInfo.participant,
        fromMe: false
    };

    const buffer =
        await downloadMediaMessage(
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

    /*
     * IMPORTANT:
     *
     * Do NOT use:
     *
     * sock.sendMessage(groupJid, {
     *     groupStatus: true
     * })
     *
     * here.
     *
     * We use the dedicated InnovatorsSoft
     * StatusHelper group-audience path.
     *
     * This is specifically documented to accept
     * group JIDs.
     */

    return StatusHelper.send(
        sock,
        status,
        [groupJid]
    );
}


// ============================================================
// COMMAND
// ============================================================

module.exports = {
    name: 'gcstatus',

    description:
        'Post text, links, images or videos to Group Status',

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
                    quoted: m
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
                    quoted: m
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
                // REPLIED IMAGE / VIDEO
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
                        undefined;


                    if (
                        media.type ===
                        'image'
                    ) {

                        const status =
                            StatusHelper.image(
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
                            StatusHelper.video(
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
                            quoted: m
                        }
                    );

                    return;
                }


                // ==================================================
                // REPLIED TEXT
                // ==================================================

                const quotedText =
                    getText(quoted);

                if (
                    quotedText &&
                    !commandText
                ) {

                    const status =
                        StatusHelper.text(
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
                            quoted: m
                        }
                    );

                    return;
                }
            }


            // ====================================================
            // DIRECT TEXT / LINK
            // ====================================================

            if (commandText) {

                /*
                 * Links are intentionally sent as text.
                 *
                 * WhatsApp will recognize normal URLs
                 * such as:
                 *
                 * https://example.com
                 */

                const status =
                    StatusHelper.text(
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
                        quoted: m
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
                        `Reply to a video with ${prefix}gcstatus\n\n` +

                        `💬 Caption:\n` +
                        `Reply to media with ${prefix}gcstatus Your caption`
                },
                {
                    quoted: m
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
                    quoted: m
                }
            ).catch(() => {});
        }
    }
};
