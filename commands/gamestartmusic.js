const path = require('path');
const fs = require('fs');

module.exports = {
    name: 'gamestartmusic',
    description: 'Play the game starting music',

    async execute(sock, m, from) {
        try {
            const audioPath = path.join(
                process.cwd(),
                'media',
                'game-start.mp3'
            );

            if (!fs.existsSync(audioPath)) {
                return sock.sendMessage(
                    from,
                    {
                        text:
                            '❌ Game start music is not available yet.\n\n' +
                            'Please add:\n' +
                            'media/game-start.mp3'
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
                '❌ GAME START MUSIC ERROR:',
                error
            );

            await sock.sendMessage(
                from,
                {
                    text: '❌ Failed to play the game starting music.'
                },
                { quoted: m }
            );
        }
    }
};
