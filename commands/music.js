
const yts = require('yt-search');
const youtubedl = require('youtube-dl-exec');
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
    description: 'Download music from YouTube by title or link using alternative client extractors',
    async execute(sock, m, from, args) {
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Please provide a song name or YouTube link!\n_Example: `!music Davido Unavailable`_' }, { quoted: m });
        }

        try {
            await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

            let videoUrl = query;
            let videoTitle = query;
            let videoThumbnail = null;
            let videoDuration = 'Unknown';

            // If input is not a direct URL, search YouTube using yt-search
            if (!query.startsWith('http://') && !query.startsWith('https://')) {
                const searchResult = await retryOperation(() => yts({ query: query, timeout: 20000 }));
                const videos = searchResult.videos;
                if (!videos || videos.length === 0) {
                    await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
                    return sock.sendMessage(from, { text: '❌ No songs found matching your search query.' }, { quoted: m });
                }
                videoUrl = videos[0].url;
                videoTitle = videos[0].title;
                videoThumbnail = videos[0].thumbnail;
                videoDuration = videos[0].timestamp;
            } else {
                try {
                    const info = await retryOperation(() => youtubedl(videoUrl, { dumpSingleJson: true, noCheckCertificates: true, extractorArgs: 'youtube:player_client=android' }));
                    videoTitle = info.title || 'Audio Track';
                    videoThumbnail = info.thumbnail;
                    videoDuration = info.duration ? `${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, '0')}` : 'Unknown';
                } catch (e) {}
            }

            await sock.sendMessage(from, { text: `🎵 *Downloading Audio...*\n\n📌 *Title:* ${videoTitle}\n⏱ *Duration:* ${videoDuration}\n_Please wait a moment._` }, { quoted: m });

            const tempFilePath = path.join(__dirname, `../temp_${Date.now()}.mp3`);

            // Download audio using yt-dlp with the android client extractor flag to completely bypass web 429 rate limits & bot checks
            await retryOperation(() => youtubedl(videoUrl, {
                extractAudio: true,
                audioFormat: 'mp3',
                audioQuality: '0',
                output: tempFilePath,
                socketTimeout: 30,
                noCheckCertificates: true,
                extractorArgs: 'youtube:player_client=android'
            }));

            if (!fs.existsSync(tempFilePath)) {
                throw new Error('Failed to download audio file.');
            }

            // Send audio file to WhatsApp
            await sock.sendMessage(from, {
                audio: fs.readFileSync(tempFilePath),
                mimetype: 'audio/mp4',
                fileName: `${videoTitle.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`,
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
                userFriendlyMsg = 'YouTube temporarily blocked web requests. Please try again in a few moments or try a different song title.';
            }

            await sock.sendMessage(from, { text: `❌ *Error downloading music*\n_Reason:_ ${userFriendlyMsg}` }, { quoted: m });
        }
    }
};

