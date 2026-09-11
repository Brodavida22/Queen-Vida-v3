const https = require('https');

module.exports = {
    name: 'lyrics',
    description: 'Searches for and displays full song lyrics',
    async execute(sock, m, from, args) {
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Please provide a song name or artist!\n*Usage:* `!lyrics <song name>`' }, { quoted: m });
        }

        const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;

        https.get(url, { headers: { 'User-Agent': 'QueenVidaBot/3.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', async () => {
                try {
                    const results = JSON.parse(data);
                    if (!Array.isArray(results) || results.length === 0) {
                        return sock.sendMessage(from, { text: `❌ No lyrics found for *"${query}"*.` }, { quoted: m });
                    }

                    const track = results[0];
                    const lyricsText = track.plainLyrics;

                    if (!lyricsText) {
                        return sock.sendMessage(from, { text: `❌ Full lyrics unavailable for *${track.trackName}* by *${track.artistName}*.` }, { quoted: m });
                    }

                    const responseMessage = 
`┏━━━ 🎵 *SONG LYRICS* 🎵 ━━━┓\n` +
`┃ 🎶 *Track:* ${track.trackName}\n` +
`┃ 🎤 *Artist:* ${track.artistName}\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`${lyricsText}\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ 📌 *Credits:* LRCLIB\n` +
`┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

                    await sock.sendMessage(from, { text: responseMessage }, { quoted: m });
                } catch (e) {
                    console.error('Lyrics parse error:', e);
                    await sock.sendMessage(from, { text: '❌ Failed to fetch lyrics. Please try again later.' }, { quoted: m });
                }
            });
        }).on('error', (err) => {
            console.error('Lyrics network error:', err);
            sock.sendMessage(from, { text: '❌ Network error while searching for lyrics.' }, { quoted: m });
        });
    }
};
