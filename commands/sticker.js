const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'sticker',
    description: 'Converts a replied image or video into a WhatsApp sticker',
    async execute(sock, m, from) {
        const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const isQuotedImage = quotedMsg?.imageMessage;
        const isQuotedVideo = quotedMsg?.videoMessage;
        const isDirectImage = m.message.imageMessage;
        const isDirectVideo = m.message.videoMessage;

        if (!isQuotedImage && !isQuotedVideo && !isDirectImage && !isDirectVideo) {
            return sock.sendMessage(from, { text: '❌ Please send an image/video with *!sticker* or reply to one!' }, { quoted: m });
        }

        try {
            // Target the message containing the media
            const targetMessage = {
                key: {
                    remoteJid: from,
                    id: m.message.extendedTextMessage?.contextInfo?.stanzaId || m.key.id,
                    participant: m.message.extendedTextMessage?.contextInfo?.participant
                },
                message: quotedMsg || m.message
            };

            const mediaBuffer = await downloadMediaMessage(
                targetMessage,
                'buffer',
                {},
                { logger: console }
            );

            const tempInput = path.join(__dirname, `../temp_${Date.now()}.${isQuotedVideo || isDirectVideo ? 'mp4' : 'jpg'}`);
            const tempOutput = path.join(__dirname, `../temp_${Date.now()}.webp`);

            fs.writeFileSync(tempInput, mediaBuffer);

            // Convert using ffmpeg to webp sticker format (max 5 seconds for video animations)
            const ffmpegCommand = `ffmpeg -i "${tempInput}" -vcodec libwebp -filter:v "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=transparent@0" -lossless 0 -compression_level 4 -q:v 60 -loop 0 -an -vsync 0 "${tempOutput}"`;

            exec(ffmpegCommand, async (error) => {
                try {
                    if (error) {
                        // Fallback command if complex filter fails
                        exec(`ffmpeg -i "${tempInput}" -vcodec libwebp -vf "scale=320:320:force_original_aspect_ratio=decrease,format=rgba,pad=320:320:(ow-iw)/2:(oh-ih)/2" -lossless 0 -q:v 60 "${tempOutput}"`, async (err2) => {
                            if (err2) {
                                if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
                                return sock.sendMessage(from, { text: '❌ Failed to process sticker conversion. Make sure ffmpeg is installed on your system.' }, { quoted: m });
                            }
                            const stickerBuffer = fs.readFileSync(tempOutput);
                            await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: m });
                            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
                            if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
                        });
                    } else {
                        const stickerBuffer = fs.readFileSync(tempOutput);
                        await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: m });
                        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
                        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
                    }
                } catch (sendErr) {
                    if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
                    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
                }
            });

        } catch (err) {
            console.error('Error generating sticker:', err);
            await sock.sendMessage(from, { text: '❌ An error occurred while downloading or converting the media.' }, { quoted: m });
        }
    }
};
