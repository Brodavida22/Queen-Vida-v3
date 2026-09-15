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
    'movemoji'
];

module.exports = {
    name: 'game',
    description: 'Start and manage group games',
    usage: '.game start <game> <rounds> [option]',

    async execute(sock, m, from, args, isOwner) {
        try {
            // =====================================================
            // GAME DASHBOARD
            // =====================================================
            if (!args[0]) {
                const active = isGameActive(from);

                const text = `
╭━━━ 🎮 *QUEEN VIDA GAME ZONE* 🎮 ━━━╮

🔥 *AVAILABLE GAMES*

1️⃣ 🧠 Trivia
2️⃣ ❓ Quiz
3️⃣ 🔀 Scramble
4️⃣ 🔢 Number Guess
5️⃣ 😎 Guess the Emoji
6️⃣ 💑 Couples Challenge
7️⃣ 🔎 Find the Emoji
8️⃣ 🔚 Words Ending With
9️⃣ 🚀 Words Starting With
🔟 🎵 Rhyming Words
1️⃣1️⃣ 🎬 Emoji Movie

━━━━━━━━━━━━━━━━━━━━

📌 *HOW TO PLAY*

.game start <game> <rounds>

Examples:

.game start trivia 10
.game start quiz 10
.game start scramble 10
.game start guess 10
.game start emoji 10
.game start couples 10
.game start findemoji 10
.game start ending 10 er
.game start starting 10 ri
.game start rhyme 10 ball
.game start movemoji 10

━━━━━━━━━━━━━━━━━━━━

🛑 *STOP GAME*

.game stop

${active
    ? '🟢 *A GAME IS CURRENTLY ACTIVE!*'
    : '⚪ No game is currently active.'}

╰━━━━━━━━━━━━━━━━━━━━╯
`;

                return await sock.sendMessage(from, { text });
            }

            // =====================================================
            // STOP GAME
            // =====================================================
            if (args[0].toLowerCase() === 'stop') {
                if (!isGameActive(from)) {
                    return await sock.sendMessage(from, {
                        text: '⚪ There is no active game in this group.'
                    });
                }

                if (!isOwner) {
                    return await sock.sendMessage(from, {
                        text: '🚫 Only the bot owner can stop the current game.'
                    });
                }

                await stopGame(sock, from);
                return;
            }

            // =====================================================
            // START GAME
            // =====================================================
            if (args[0].toLowerCase() !== 'start') {
                return await sock.sendMessage(from, {
                    text: '❌ Invalid game command.\n\nUse `.game` to see the available games.'
                });
            }

            const gameType = (args[1] || '').toLowerCase();

            // =====================================================
            // VALIDATE GAME
            // =====================================================
            if (!validGames.includes(gameType)) {
                return await sock.sendMessage(from, {
                    text:
`❌ *INVALID GAME*

Available games:

🧠 trivia
❓ quiz
🔀 scramble
🔢 guess
😎 emoji
💑 couples
🔎 findemoji
🔚 ending
🚀 starting
🎵 rhyme
🎬 movemoji

Example:

.game start movemoji 10`
                });
            }

            // =====================================================
            // ROUND COUNT
            // =====================================================
            const rounds = parseInt(args[2], 10);

            if (isNaN(rounds) || rounds < 5) {
                return await sock.sendMessage(from, {
                    text:
`❌ Please enter at least *5 rounds*.

Example:

.game start movemoji 10`
                });
            }

            const roundsNum = Math.min(rounds, 100);

            // =====================================================
            // DIFFICULTY
            // =====================================================
            let difficulty = null;

            if (gameType === 'trivia' || gameType === 'quiz') {
                const requestedDifficulty = (args[3] || '').toLowerCase();

                if (
                    requestedDifficulty &&
                    ['easy', 'medium', 'hard'].includes(requestedDifficulty)
                ) {
                    difficulty = requestedDifficulty;
                }
            }

            // =====================================================
            // ENDING GAME
            // =====================================================
            if (gameType === 'ending') {
                const ending = args[3];

                if (!ending) {
                    return await sock.sendMessage(from, {
                        text:
`❌ Please provide the ending letters.

Example:

.game start ending 10 er

Other examples:

.game start ending 10 st
.game start ending 10 rp
.game start ending 10 ing`
                    });
                }

                difficulty = ending.toLowerCase();
            }

            // =====================================================
            // STARTING GAME
            // =====================================================
            if (gameType === 'starting') {
                const starting = args[3];

                if (!starting) {
                    return await sock.sendMessage(from, {
                        text:
`❌ Please provide the starting letters.

Example:

.game start starting 10 ri

Other examples:

.game start starting 10 st
.game start starting 10 ab
.game start starting 10 re`
                    });
                }

                difficulty = starting.toLowerCase();
            }

            // =====================================================
            // RHYME GAME
            // =====================================================
            if (gameType === 'rhyme') {
                const rhymeWord = args[3];

                if (!rhymeWord) {
                    return await sock.sendMessage(from, {
                        text:
`❌ Please provide a word to rhyme with.

Example:

.game start rhyme 10 ball

Other examples:

.game start rhyme 10 car
.game start rhyme 10 light
.game start rhyme 10 day`
                    });
                }

                difficulty = rhymeWord.toLowerCase();
            }

            // =====================================================
            // EMOJI MOVIE
            // =====================================================
            if (gameType === 'movemoji') {
                difficulty = null;
            }

            // =====================================================
            // CHECK ACTIVE GAME
            // =====================================================
            if (isGameActive(from)) {
                return await sock.sendMessage(from, {
                    text:
`⚠️ *A GAME IS ALREADY RUNNING!*

Finish or stop the current game before starting another one.

🛑 Owner:

.game stop`
                });
            }

            // =====================================================
            // START GAME
            // =====================================================
            return await startGame(
                sock,
                from,
                gameType,
                roundsNum,
                difficulty
            );

        } catch (error) {
            console.error('GAME COMMAND ERROR:', error);

            return await sock.sendMessage(from, {
                text: '❌ Something went wrong while starting the game.'
            });
        }
    }
};
