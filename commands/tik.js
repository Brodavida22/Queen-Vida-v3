const axios = require('axios');

module.exports = {
    name: 'tik',
    description: 'Download TikTok videos without watermark',
    async execute(sock, m, from, args) {
        if (!args[0]) return sock.sendMessage(from, { text: '❌ Please provide a TikTok link.\n*Usage:* `!tik <url>`' }, { quoted: m });

        const targetUrl = args[0];
        
        // Validate if it's actually a TikTok link
        if (!targetUrl.includes('tiktok.com') && !targetUrl.includes('vt.tiktok.com')) {
            return sock.sendMessage(from, { text: '❌ Invalid link! This command is strictly for TikTok videos.' }, { quoted: m });
        }

        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        try {
            const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`);
            
            if (!res.data || res.data.code !== 0) {
                throw new Error('Failed to fetch TikTok video data.');
            }

            const downloadUrl = res.data.data.play || res.data.data.wmplay;
            const videoTitle = res.data.data.title || 'TikTok Video';

            if (!downloadUrl) {
                throw new Error('Could not extract direct stream URL.');
            }

            await sock.sendMessage(from, { 
                video: { url: downloadUrl }, 
                caption: `👑 *QUEEN VIDA-V3 TIKTOK DOWNLOADER*\n\n📝 *Title:* ${videoTitle}`,
                mimetype: 'video/mp4'
            }, { quoted: m });

            await sock.sendMessage(from, { react: { text: '✅', key: m.key } });

        } catch (err) {
            console.error('TikTok DL Error:', err.message);
            await sock.sendMessage(from, { text: '❌ Failed to download the TikTok video. Ensure the link is public.' }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
        }
    }
};
