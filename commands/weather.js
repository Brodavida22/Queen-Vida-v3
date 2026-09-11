const https = require('https');

module.exports = {
    name: 'weather',
    description: 'Fetches current weather information for a specified city',
    async execute(sock, m, from, args) {
        const city = args.join(' ');
        if (!city) {
            return sock.sendMessage(from, { text: '❌ Please specify a city! Usage: *!weather London* or *!weather Port Harcourt*' }, { quoted: m });
        }

        const encodedCity = encodeURIComponent(city);
        const url = `https://wttr.in/${encodedCity}?format=3`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', async () => {
                if (res.statusCode === 200 && data.trim()) {
                    await sock.sendMessage(from, { text: `🌤️ *Weather Report:*\n\n${data.trim()}` }, { quoted: m });
                } else {
                    await sock.sendMessage(from, { text: `❌ Could not find weather data for "${city}". Please check the spelling and try again.` }, { quoted: m });
                }
            });
        }).on('error', async () => {
            await sock.sendMessage(from, { text: '❌ Failed to connect to the weather service. Try again later.' }, { quoted: m });
        });
    }
};
