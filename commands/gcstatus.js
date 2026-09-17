const {
    downloadMediaMessage
} = require('@whiskeysockets/baileys');

const { getPrefix } = require('../utils/prefix');


/*
 * ============================================================
 * QUEEN VIDA V3
 * GCSTATUS
 *
 * Supports:
 *   .gcstatus Hello everyone
 *   .gcstatus https://example.com
 *
 * Reply to IMAGE:
 *   .gcstatus
 *   .gcstatus My caption
 *
 * Reply to VIDEO:
 *   .gcstatus
 *   .gcstatus My caption
 *
 * Reply to TEXT:
 *   .gcstatus
 *
 * Uses groupStatus:true so the post appears in the
 * actual WhatsApp Group Status, not normal group chat.
 *
 * Also supplies cachedGroupMetadata on every send.
 * This is important for large groups.
 * ============================================================
 */


/*
 * ============================================================
 * GET QUOTED MESSAGE
 * ============================================================
 */

function getQuotedMessage(m) {
    return (
        m?.message?.extendedTextMessage?.contextInfo
            ?.quotedMessage ||
        m?.message?.imageMessage?.contextInfo
            ?.quotedMessage ||
        m?.message?.videoMessage?.contextInfo
            ?.quotedMessage ||
        m?.message?.documentMessage?.contextInfo
            ?.quotedMessage ||
        null
    );
}


/*
 * ============================================================
 * GET QUOTED CONTEXT
 * ============================================================
 */

function getQuotedContext(m) {
    return (
        m?.message?.extendedTextMessage?.contextInfo ||
        {}
    );
}


/*
 * ============================================================
 * UNWRAP WHATSAPP MESSAGE
 * ============================================================
 */

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


/*
 * ============================================================
 * DETECT MEDIA
 * ============================================================
 */

function getMediaType(message) {
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


/*
 * ============================================================
 * GET TEXT FROM MESSAGE
 * ============================================================
 */

function getMessageText(message) {
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


/*
 * ============================================================
 * GET CURRENT COMMAND TEXT
 * ============================================================
 */

function getArgsText(args) {
    if (!Array.isArray(args)) {
        return '';
    }

    return args
        .join(' ')
        .trim();
}


/*
 * ============================================================
 * LARGE GROUP METADATA
 *
 * This is deliberately supplied directly to sendMessage.
 * It prevents Baileys from repeatedly fetching group
 * participants while building the Group Status message.
 * ============================================================
 */

async function getGroupMetadata(sock, jid) {
    try {
        const metadata =
            await sock.groupMetadata(jid);

        if (
            metadata &&
            Array.isArray(
                metadata.participants
            )
        ) {
            console.log(
                `📦 [GCSTATUS] Group metadata loaded: ${metadata.participants.length} participants`
            );

            return metadata;
        }

        return undefined;

    } catch (error) {
        console.error(
            '⚠️ [GCSTATUS] Could not load group metadata:',
            error?.message || error
        );

        return undefined;
    }
}


/*
 * ============================================================
 * SEND GROUP STATUS
 * ============================================================
 */

async function sendGroupStatus(
    sock,
    groupJid,
    content
) {
    /*
     * IMPORTANT:
     *
     * We fetch the group metadata ourselves and give it
     * directly to Baileys for this send.
     *
     * This is especially important for large groups.
     */

    const metadata =
        await getGroupMetadata(
            sock,
            groupJid
        );

    const options = {
        useCachedGroupMetadata: true
    };

    if (metadata) {
        options.cachedGroupMetadata =
            async () => metadata;
    }

    /*
     * InnovatorsSoft Baileys supports:
     *
     * groupStatus: true
     *
     * which creates the actual Group Status message.
     */

    return sock.sendMessage(
        groupJid,
        {
            ...content,
            groupStatus: true
        },
        options
    );
}


/*
 * ============================================================
 * DOWNLOAD QUOTED MEDIA
 * ============================================================
 */

async function downloadQuotedMedia(
    sock,
    m,
    from,
    quoted
) {
    const contextInfo =
        getQuotedContext(m);

    if (!contextInfo.stanzaId) {
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


/*
 * ============================================================
 * COMMAND
 * ============================================================
 */

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

        /*
         * ----------------------------------------------------
         * OWNER ONLY
         * ----------------------------------------------------
         */

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


        /*
         * ----------------------------------------------------
         * GROUP ONLY
         * ----------------------------------------------------
         */

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

            /*
             * ------------------------------------------------
             * COMMAND TEXT
             * ------------------------------------------------
             */

            const commandText =
                getArgsText(args);


            /*
             * ------------------------------------------------
             * QUOTED MESSAGE
             * ------------------------------------------------
             */

            const quoted =
                getQuotedMessage(m);


            /*
             * ------------------------------------------------
             * 1. IF USER REPLIED TO MEDIA
             * ------------------------------------------------
             */

            if (quoted) {

                const media =
                    getMediaType(
                        quoted
                    );

                /*
                 * IMAGE / VIDEO
                 */
                if (media) {

                    const buffer =
                        await downloadQuotedMedia(
                            sock,
                            m,
                            from,
                            quoted
                        );

                    /*
                     * Caption priority:
                     *
                     * 1. Text after .gcstatus
                     * 2. Original media caption
                     */

                    const caption =
                        commandText ||
                        media.message?.caption ||
                        undefined;


                    if (
                        media.type ===
                        'image'
                    ) {

                        await sendGroupStatus(
                            sock,
                            from,
                            {
                                image:
                                    buffer,
                                caption
                            }
                        );

                    } else {

                        await sendGroupStatus(
                            sock,
                            from,
                            {
                                video:
                                    buffer,
                                caption
                            }
                        );
                    }


                    await sock.sendMessage(
                        from,
                        {
                            text:
                                `✅ ${media.type === 'image' ? 'Image' : 'Video'} posted to the Group Status.`
                        },
                        {
                            quoted: m
                        }
                    );

                    return;
                }


                /*
                 * ------------------------------------------------
                 * REPLIED TO TEXT
                 * ------------------------------------------------
                 */

                const quotedText =
                    getMessageText(
                        quoted
                    );

                if (
                    quotedText &&
                    !commandText
                ) {

                    await sendGroupStatus(
                        sock,
                        from,
                        {
                            text:
                                quotedText
                        }
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


            /*
             * ------------------------------------------------
             * 2. DIRECT TEXT / LINK
             *
             * Example:
             *
             * .gcstatus Hello everyone
             *
             * .gcstatus https://chat.whatsapp.com/xxxx
             * ------------------------------------------------
             */

            if (commandText) {

                await sendGroupStatus(
                    sock,
                    from,
                    {
                        text:
                            commandText
                    }
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


            /*
             * ------------------------------------------------
             * 3. NOTHING PROVIDED
             * ------------------------------------------------
             */

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

            const errorMessage =
                error?.message ||
                'Unknown error';

            await sock.sendMessage(
                from,
                {
                    text:
                        `❌ *Group Status failed.*\n\n` +
                        `Error: ${errorMessage}`
                },
                {
                    quoted: m
                }
            ).catch(
                () => {}
            );
        }
    }
};
