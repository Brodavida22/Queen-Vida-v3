const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');

// Helper function to retry promises on network failure
async function retryOperation(fn, retries = 2, delay = 3000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

module.exports = {
    name: 'music',
    description: 'Download music from YouTube by title or link',
    async execute(sock, m, from, args) {
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Please provide a song name or YouTube link!\n_Example: `!music Davido Unavailable`_' }, { quoted: m });
        }

        try {
            await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

            let videoUrl = query;
            let videoTitle = query;
            let videoDuration = 'Unknown';

            // If input is not a direct URL, search YouTube using yt-search
            if (!ytdl.validateURL(query)) {
                const searchResult = await retryOperation(() => yts({ query: query, timeout: 20000 }));
                const videos = searchResult.videos;
                if (!videos || videos.length === 0) {
                    await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
                    return sock.sendMessage(from, { text: '❌ No songs found matching your search query.' }, { quoted: m });
                }
                videoUrl = videos[0].url;
                videoTitle = videos[0].title;
                videoDuration = videos[0].timestamp;
            } else {
                if (!ytdl.validateURL(videoUrl)) {
                    await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
                    return sock.sendMessage(from, { text: '❌ That does not look like a valid YouTube link.' }, { quoted: m });
                }
            }

            const info = await retryOperation(() => ytdl.getInfo(videoUrl));

            videoTitle = info.videoDetails.title || videoTitle;
            const durationSeconds = parseInt(info.videoDetails.lengthSeconds, 10);
            if (!isNaN(durationSeconds)) {
                videoDuration = `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`;
            }

            await sock.sendMessage(from, { text: `🎵 *Downloading Audio...*\n\n📌 *Title:* ${videoTitle}\n⏱ *Duration:* ${videoDuration}\n_Please wait a moment._` }, { quoted: m });

            // Prefer an mp4/m4a audio-only format (widely compatible), fall back to any audio-only format
            const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');

            if (!audioFormats || audioFormats.length === 0) {
                throw new Error('No downloadable audio stream was found for this video.');
            }

            const mp4Formats = audioFormats.filter(f => f.container === 'mp4');
            const chosenFormats = mp4Formats.length > 0 ? mp4Formats : audioFormats;
            const format = ytdl.chooseFormat(chosenFormats, { quality: 'highestaudio' });

            const isMp4 = format.container === 'mp4';
            const fileExtension = isMp4 ? 'm4a' : (format.container || 'webm');
            const mimeType = isMp4 ? 'audio/mp4' : 'audio/webm';

            const tempFilePath = path.join(__dirname, `../temp_${Date.now()}.${fileExtension}`);

            await new Promise((resolve, reject) => {
                const stream = ytdl.downloadFromInfo(info, { format });
                const writeStream = fs.createWriteStream(tempFilePath);

                stream.on('error', reject);
                writeStream.on('error', reject);
                writeStream.on('finish', resolve);

                stream.pipe(writeStream);
            });

            if (!fs.existsSync(tempFilePath)) {
                throw new Error('Failed to download audio file.');
            }

            // Send audio file to WhatsApp
            await sock.sendMessage(from, {
                audio: fs.readFileSync(tempFilePath),
                mimetype: mimeType,
                fileName: `${videoTitle.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`,
                ptt: false
            }, { quoted: m });

            // Clean up local temp file safely
            try {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            } catch (err) {}

            await sock.sendMessage(from, { react: { text: '✅', key: m.key } });

        } catch (err) {
            console.error('🔥 [MUSIC COMMAND ERROR]:', err);
            await sock.sendMessage(from, { react: { text: '❌', key: m.key } });

            let userFriendlyMsg = err.message || 'Unknown error';
            if (userFriendlyMsg.includes('429') || userFriendlyMsg.includes('Too Many Requests') || userFriendlyMsg.includes('Sign in to confirm')) {
                userFriendlyMsg = 'YouTube temporarily blocked requests. Please try again in a few moments or try a different song title.';
            }

            await sock.sendMessage(from, { text: `❌ *Error downloading music*\n_Reason:_ ${userFriendlyMsg}` }, { quoted: m });
        }
    }
};
