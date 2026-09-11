const {
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');

const {
    execFile
} = require('child_process');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');


// ============================================================
// HELPERS
// ============================================================

function unwrapMessage(message) {
    if (!message) return null;

    let msg = message;

    while (
        msg.ephemeralMessage?.message ||
        msg.viewOnceMessage?.message ||
        msg.viewOnceMessageV2?.message ||
        msg.viewOnceMessageV2Extension?.message ||
        msg.documentWithCaptionMessage?.message
    ) {
        msg =
            msg.ephemeralMessage?.message ||
            msg.viewOnceMessage?.message ||
            msg.viewOnceMessageV2?.message ||
            msg.viewOnceMessageV2Extension?.message ||
            msg.documentWithCaptionMessage?.message;
    }

    return msg;
}


function getMediaFromMessage(message) {
    const msg = unwrapMessage(message);

    if (!msg) return null;

    if (msg.imageMessage) {
        return {
            type: 'image',
            message: msg.imageMessage
        };
    }

    if (msg.videoMessage) {
        return {
            type: 'video',
            message: msg.videoMessage
        };
    }

    return null;
}


function getQuotedMessage(m) {
    const message = unwrapMessage(m.message);

    if (!message) return null;

    const contextInfo =
        message.extendedTextMessage?.contextInfo ||
        message.imageMessage?.contextInfo ||
        message.videoMessage?.contextInfo;

    if (!contextInfo?.quotedMessage) {
        return null;
    }

    return contextInfo.quotedMessage;
}


async function downloadMedia(mediaMessage, type) {
    const stream = await downloadContentFromMessage(
        mediaMessage,
        type
    );

    const chunks = [];

    for await (const chunk of stream) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}


function runFFmpeg(input, output, isVideo) {
    return new Promise((resolve, reject) => {

        const args = [
            '-y',
            '-i',
            input
        ];

        if (isVideo) {

            args.push(
                '-t',
                '5',
                '-vf',
                'scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
                '-r',
                '15',
                '-an',
                '-c:v',
                'libwebp',
                '-loop',
                '0',
                '-preset',
                'default',
                '-q:v',
                '50',
                output
            );

        } else {

            args.push(
                '-vf',
                'scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
                '-frames:v',
                '1',
                '-c:v',
                'libwebp',
                '-lossless',
                '0',
                '-q:v',
                '60',
                output
            );
        }


        execFile(
            'ffmpeg',
            args,
            {
                maxBuffer: 20 * 1024 * 1024
            },
            (error, stdout, stderr) => {

                if (error) {
                    console.error(
                        '🔥 [STICKER FFMPEG ERROR]:',
                        stderr || error.message
                    );

                    return reject(error);
                }

                resolve();
            }
        );
    });
}


// ============================================================
// STICKER COMMAND
// ============================================================

module.exports = {

    name: 'sticker',

    description:
        'Converts a replied image or video into a WhatsApp sticker',

    async execute(sock, m, from) {

        let tempInput = null;
        let tempOutput = null;

        try {

            const message = unwrapMessage(m.message);

            // ----------------------------------------------------
            // CHECK DIRECT MEDIA
            // ----------------------------------------------------

            let media = getMediaFromMessage(message);


            // ----------------------------------------------------
            // CHECK REPLIED MEDIA
            // ----------------------------------------------------

            if (!media) {

                const quotedMessage =
                    getQuotedMessage(m);

                if (quotedMessage) {
                    media =
                        getMediaFromMessage(
                            quotedMessage
                        );
                }
            }


            // ----------------------------------------------------
            // NO IMAGE / VIDEO
            // ----------------------------------------------------

            if (!media) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            '❌ Reply to an *image or video* with *!sticker*.\n\n' +
                            'Example:\n' +
                            '1️⃣ Send an image\n' +
                            '2️⃣ Reply to it with *!sticker*'
                    },
                    {
                        quoted: m
                    }
                );
            }


            // ----------------------------------------------------
            // DOWNLOAD MEDIA
            // ----------------------------------------------------

            console.log(
                `🎨 [STICKER] Downloading ${media.type}...`
            );


            const mediaBuffer =
                await downloadMedia(
                    media.message,
                    media.type
                );


            if (
                !mediaBuffer ||
                !mediaBuffer.length
            ) {
                throw new Error(
                    'Downloaded media is empty.'
                );
            }


            // ----------------------------------------------------
            // TEMP FILES
            // ----------------------------------------------------

            const id =
                crypto.randomBytes(8).toString('hex');


            const extension =
                media.type === 'video'
                    ? 'mp4'
                    : 'jpg';


            tempInput =
                path.join(
                    __dirname,
                    `../sticker_${id}.${extension}`
                );


            tempOutput =
                path.join(
                    __dirname,
                    `../sticker_${id}.webp`
                );


            fs.writeFileSync(
                tempInput,
                mediaBuffer
            );


            // ----------------------------------------------------
            // CONVERT TO WEBP
            // ----------------------------------------------------

            console.log(
                `🎨 [STICKER] Converting ${media.type} to WebP...`
            );


            await runFFmpeg(
                tempInput,
                tempOutput,
                media.type === 'video'
            );


            // ----------------------------------------------------
            // CHECK OUTPUT
            // ----------------------------------------------------

            if (
                !fs.existsSync(tempOutput)
            ) {
                throw new Error(
                    'FFmpeg did not create the sticker file.'
                );
            }


            const stickerBuffer =
                fs.readFileSync(
                    tempOutput
                );


            if (!stickerBuffer.length) {
                throw new Error(
                    'Sticker file is empty.'
                );
            }


            // ----------------------------------------------------
            // SEND STICKER
            // ----------------------------------------------------

            console.log(
                '🎨 [STICKER] Sending sticker...'
            );


            await sock.sendMessage(
                from,
                {
                    sticker: stickerBuffer
                },
                {
                    quoted: m
                }
            );


            console.log(
                '✅ [STICKER] Sticker sent successfully.'
            );


        } catch (error) {

            console.error(
                '🔥 [STICKER ERROR]:',
                error
            );


            await sock.sendMessage(
                from,
                {
                    text:
                        '❌ Failed to create the sticker.\n\n' +
                        'Make sure the image/video is valid and try again.'
                },
                {
                    quoted: m
                }
            ).catch(() => {});


        } finally {

            // ----------------------------------------------------
            // CLEAN TEMP FILES
            // ----------------------------------------------------

            try {

                if (
                    tempInput &&
                    fs.existsSync(tempInput)
                ) {
                    fs.unlinkSync(tempInput);
                }

                if (
                    tempOutput &&
                    fs.existsSync(tempOutput)
                ) {
                    fs.unlinkSync(tempOutput);
                }

            } catch (cleanupError) {

                console.error(
                    '⚠️ [STICKER CLEANUP ERROR]:',
                    cleanupError.message
                );
            }
        }
    }
};
