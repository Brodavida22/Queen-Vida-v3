const path = require('path');
const fs = require('fs');

module.exports = {
    name: 'gameendmusic',
    description: 'Play the game ending music',

    async execute(sock, m, from) {
        try {
            const audioPath = path.join(
                process.cwd(),
                'media',
                'game-end.mp3'
            );

            if (!fs.existsSync(audioPath)) {
                return sock.sendMessage(
                    from,
                    {
                        text:
                            '❌ Game ending music is not available yet.\n\n' +
                            'Please add:\n' +
                            'media/game-end.mp3'
                    },
                    { quoted: m }
                );
            }

            await sock.sendMessage(
                from,
                {
                    audio: {
                        url: audioPath
                    },
                    mimetype: 'audio/mpeg',
                    ptt: false
                },
                { quoted: m }
            );
        } catch (error) {
            console.error(
                '❌ GAME END MUSIC ERROR:',
                error
            );

            await sock.sendMessage(
                from,
                {
                    text: '❌ Failed to play the game ending music.'
                },
                { quoted: m }
            );
        }
    }
};
