const {
    startGame,
    stopGame,
    isGameActive
} = require('../utils/gameManager');

const validGames = [
    'trivia',
    'quiz',
    'scramble',
    'guess',
    'emoji',
    'couples',
    'findemoji',
    'ending',
    'starting',
    'rhyme',
    'movemoji',
    '2truth1lie'
];

module.exports = {
    name: 'game',
    aliases: ['games'],
    description: 'Start and manage group games',
    usage: '.game start <game> <rounds> [difficulty/argument]',

    async execute(sock, m, from, args, isOwner) {
        try {
            const action = (args[0] || '').toLowerCase();

            // =========================
            // GAME DASHBOARD
            // =========================
            if (!action || action === 'list' || action === 'help') {
                return await sock.sendMessage(from, {
                    text:
                        `🎮 *QUEEN VIDA GAME CENTER* 🎮\n\n` +
                        `Available games:\n\n` +
                        `🧠 trivia\n` +
                        `❓ quiz\n` +
                        `🔤 scramble\n` +
                        `🔢 guess\n` +
                        `🤯 emoji\n` +
                        `❤️ couples\n` +
                        `🔎 findemoji\n` +
                        `🔚 ending\n` +
                        `🔤 starting\n` +
                        `🎵 rhyme\n` +
                        `🎬 movemoji\n` +
                        `🕵️ 2truth1lie\n\n` +
                        `━━━━━━━━━━━━━━\n` +
                        `▶️ *Start a game:*\n` +
                        `.game start <game> <rounds>\n\n` +
                        `Example:\n` +
                        `.game start 2truth1lie 10\n\n` +
                        `🛑 *Stop current game:*\n` +
                        `.game stop`
                });
            }

            // =========================
            // STOP GAME
            // =========================
            if (action === 'stop') {
                return await stopGame(sock, from);
            }

            // =========================
            // START GAME
            // =========================
            if (action !== 'start') {
                return await sock.sendMessage(from, {
                    text:
                        `❌ Invalid game command.\n\n` +
                        `Use *.game list* to see available games.`
                });
            }

            const game = (args[1] || '').toLowerCase();

            if (!validGames.includes(game)) {
                return await sock.sendMessage(from, {
                    text:
                        `❌ Unknown game: *${game || 'none'}*\n\n` +
                        `Available games:\n` +
                        validGames.map(g => `• ${g}`).join('\n')
                });
            }

            if (isGameActive(from)) {
                return await sock.sendMessage(from, {
                    text:
                        `⚠️ A game is already running in this group!\n\n` +
                        `🛑 Use *.game stop* to stop it first.`
                });
            }

            let rounds = parseInt(args[2], 10);

            if (Number.isNaN(rounds)) {
                rounds = 10;
            }

            if (rounds < 5) {
                return await sock.sendMessage(from, {
                    text: `⚠️ Minimum number of rounds is *5*.`
                });
            }

            if (rounds > 100) {
                rounds = 100;
            }

            let difficulty = null;
            let customArg = null;

            // Trivia / Quiz difficulty
            if (game === 'trivia' || game === 'quiz') {
                const requestedDifficulty = (args[3] || '').toLowerCase();

                if (['easy', 'medium', 'hard'].includes(requestedDifficulty)) {
                    difficulty = requestedDifficulty;
                }
            }

            // Words ending
            if (game === 'ending') {
                customArg = args[3] || null;

                if (!customArg) {
                    return await sock.sendMessage(from, {
                        text:
                            `❌ You need to specify the ending.\n\n` +
                            `Example:\n` +
                            `*.game start ending 10 er*`
                    });
                }
            }

            // Words starting
            if (game === 'starting') {
                customArg = args[3] || null;

                if (!customArg) {
                    return await sock.sendMessage(from, {
                        text:
                            `❌ You need to specify the starting letters.\n\n` +
                            `Example:\n` +
                            `*.game start starting 10 ri*`
                    });
                }
            }

            // Rhyming words
            if (game === 'rhyme') {
                customArg = args[3] || null;
            }

            // Emoji Movie
            if (game === 'movemoji') {
                difficulty = null;
            }

            // 2 Truths 1 Lie
            if (game === '2truth1lie') {
                difficulty = null;
            }

            await startGame(
                sock,
                from,
                game,
                rounds,
                difficulty,
                customArg
            );

        } catch (error) {
            console.error('❌ Game command error:', error);

            await sock.sendMessage(from, {
                text:
                    `❌ Something went wrong while starting the game.\n\n` +
                    `Please try again.`
            });
        }
    }
};
