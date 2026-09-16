/**
 * QUEEN VIDA V3
 * GCSTATUS - Group Status
 *
 * Usage:
 * Reply to an image/video:
 * .gcstatus
 *
 * This uses groupStatusMessage instead of
 * status@broadcast.
 */

const {
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');

async function streamToBuffer(stream) {
    const chunks = [];

    for await (const chunk of stream) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

function getQuotedMessage(m) {
    return (
        m?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
        m?.message?.imageMessage?.contextInfo?.quotedMessage ||
        m?.message?.videoMessage?.contextInfo?.quotedMessage ||
        m?.message?.contextInfo?.quotedMessage ||
        null
    );
}

async function getQuotedMedia(m) {
    const quoted = getQuotedMessage(m);

    if (!quoted) return null;

    if (quoted.imageMessage) {
        const stream = await downloadContentFromMessage(
            quoted.imageMessage,
            'image'
        );

        return {
            type: 'image',
            buffer: await streamToBuffer(stream),
            caption: quoted.imageMessage.caption || ''
        };
    }

    if (quoted.videoMessage) {
        const stream = await downloadContentFromMessage(
            quoted.videoMessage,
            'video'
        );

        return {
            type: 'video',
            buffer: await streamToBuffer(stream),
            caption: quoted.videoMessage.caption || ''
        };
    }

    return null;
}

async function sendReply(sock, jid, text) {
    await sock.sendMessage(jid, {
        text
    });
}

async function execute(sock, m) {
    const from = m.key.remoteJid;

    if (!from || !from.endsWith('@g.us')) {
        await sendReply(
            sock,
            from,
            '❌ GCSTATUS can only be used inside a group.'
        );
        return true;
    }

    try {
        const media = await getQuotedMedia(m);

        if (!media) {
            await sendReply(
                sock,
                from,
                '❌ Reply to an image or video with .gcstatus'
            );
            return true;
        }

        /*
         * IMPORTANT:
         * Group Status uses groupStatusMessage.
         * It must NOT use status@broadcast.
         */

        let content;

        if (media.type === 'image') {
            content = {
                groupStatusMessage: {
                    image: media.buffer,
                    caption: media.caption
                }
            };
        } else {
            content = {
                groupStatusMessage: {
                    video: media.buffer,
                    caption: media.caption
                }
            };
        }

        await sock.sendMessage(from, content);

        await sendReply(
            sock,
            from,
            '✅ Group Status posted successfully.'
        );

        return true;

    } catch (error) {
        console.error('[GCSTATUS ERROR]', error);

        await sendReply(
            sock,
            from,
            '❌ Group Status failed.\n\n' +
            'Your current Baileys build may not support groupStatusMessage.'
        );

        return true;
    }
}

module.exports = {
    name: 'gcstatus',
    aliases: ['groupstatus'],
    description: 'Post replied image/video as Group Status',
    execute
};
