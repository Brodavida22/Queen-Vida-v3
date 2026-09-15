const {
    startGame,
    stopGame,
    isGameActive
} = require('../utils/gameManager');


// ============================================================
// AVAILABLE GAMES
// ============================================================

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
    '2truth1lie',
    'lyrics',
    'taboo',
    'memewar'
];


// ============================================================
// GAME COMMAND
// ============================================================

module.exports = {
    name: 'game',

    description: 'Start and manage group games',

    usage: '.game <start|stop|list>',

    async execute(sock, m, from, args, isOwner) {

        const action =
            String(args[0] || '').toLowerCase();


        // ====================================================
        // GAME DASHBOARD
        // ====================================================

        if (
            !action ||
            action === 'list' ||
            action === 'help'
        ) {

            const active =
                isGameActive(from);


            const text =
`┏━━━ 🎮 *QUEEN VIDA GAME CENTER* 🎮 ━━━┓
┃
┃ 🎯 *AVAILABLE GAMES*
┣━━━━━━━━━━━━━━━━━━━━━━━
┃
┃ 1️⃣ 🎯 Trivia
┃ 2️⃣ 🧠 Quiz
┃ 3️⃣ 🔤 Word Scramble
┃ 4️⃣ 🔢 Number Guess
┃ 5️⃣ 🤯 Guess the Emoji
┃ 6️⃣ ❤️ Couples Challenge
┃ 7️⃣ 🔎 Find the Emoji
┃ 8️⃣ 🔚 Words Ending With
┃ 9️⃣ 🔤 Words Starting With
┃ 🔟 🎵 Rhyming Words
┃ 1️⃣1️⃣ 🎬 Emoji Movie
┃ 1️⃣2️⃣ 🕵️ 2 Truths 1 Lie
┃ 1️⃣3️⃣ 🎵 Finish the Line
┃ 1️⃣4️⃣ 🚫 Taboo
┃ 1️⃣5️⃣ 😂 Meme War
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃
┃ 📌 *HOW TO START*
┃
┃ .game start trivia 10
┃ .game start quiz 10 easy
┃ .game start scramble 10
┃ .game start guess 10
┃ .game start emoji 10
┃ .game start couples 10
┃ .game start findemoji 10
┃ .game start ending 10 er
┃ .game start starting 10 ri
┃ .game start rhyme 10 ball
┃ .game start movemoji 10
┃ .game start 2truth1lie 10
┃ .game start lyrics 10
┃ .game start taboo 10
┃ .game start memewar 10
┃
┃ 🛑 *STOP GAME*
┃ .game stop
┃
┃ ${active
    ? '🟢 *A GAME IS CURRENTLY ACTIVE*'
    : '⚪ *NO GAME IS ACTIVE*'}
┃
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

            await sock.sendMessage(from, {
                text
            });

            return;
        }


        // ====================================================
        // STOP GAME
        // ====================================================

        if (action === 'stop') {

            if (!isGameActive(from)) {

                await sock.sendMessage(from, {
                    text:
                        '❌ *No game is currently active in this group.*'
                });

                return;
            }


            await stopGame(sock, from);

            return;
        }


        // ====================================================
        // START GAME
        // ====================================================

        if (action !== 'start') {

            await sock.sendMessage(from, {
                text:
`❌ *Invalid game command.*

Use:
.game list

or:

.game start <game> <rounds>`
            });

            return;
        }


        // ====================================================
        // GAME NAME
        // ====================================================

        const game =
            String(args[1] || '').toLowerCase();


        if (!validGames.includes(game)) {

            await sock.sendMessage(from, {
                text:
`❌ *Unknown game:* ${game || 'none'}

🎮 Use:
.game list

to see all available games.`
            });

            return;
        }


        // ====================================================
        // CHECK ACTIVE GAME
        // ====================================================

        if (isGameActive(from)) {

            await sock.sendMessage(from, {
                text:
                    '⚠️ *A game is already running!*\n\n' +
                    'Use `.game stop` before starting another game.'
            });

            return;
        }


        // ====================================================
        // ROUNDS
        // ====================================================

        let rounds =
            parseInt(args[2], 10);


        if (isNaN(rounds)) {
            rounds = 10;
        }


        if (rounds < 1) {
            rounds = 1;
        }


        if (rounds > 100) {
            rounds = 100;
        }


        // ====================================================
        // DIFFICULTY
        // ====================================================

        let difficulty = 'all';


        if (
            game === 'trivia' ||
            game === 'quiz'
        ) {

            const requestedDifficulty =
                String(args[3] || 'all').toLowerCase();


            const allowedDifficulty = [
                'easy',
                'medium',
                'hard',
                'all'
            ];


            if (
                allowedDifficulty.includes(
                    requestedDifficulty
                )
            ) {

                difficulty =
                    requestedDifficulty;

            } else {

                await sock.sendMessage(from, {
                    text:
`❌ *Invalid difficulty.*

Use:
• easy
• medium
• hard
• all`
                });

                return;
            }
        }


        // ====================================================
        // CUSTOM ARGUMENT
        // ====================================================

        let customArg = null;


        if (
            game === 'ending' ||
            game === 'starting' ||
            game === 'rhyme'
        ) {

            customArg =
                args[3]
                    ? String(args[3]).toLowerCase()
                    : null;


            if (!customArg) {

                const example =
                    game === 'ending'
                        ? '.game start ending 10 er'
                        : game === 'starting'
                            ? '.game start starting 10 ri'
                            : '.game start rhyme 10 ball';


                await sock.sendMessage(from, {
                    text:
`❌ *You need to provide a ${
    game === 'ending'
        ? 'ending'
        : game === 'starting'
            ? 'starting'
            : 'target word'
}.*

Example:
${example}`
                });

                return;
            }
        }


        // ====================================================
        // OTHER GAMES DON'T NEED DIFFICULTY
        // ====================================================

        if (
            [
                'scramble',
                'guess',
                'emoji',
                'couples',
                'findemoji',
                'movemoji',
                '2truth1lie',
                'lyrics',
                'taboo',
                'memewar'
            ].includes(game)
        ) {

            difficulty = 'all';
        }


        // ====================================================
        // START
        // ====================================================

        try {

            await startGame(
                sock,
                from,
                game,
                rounds,
                difficulty,
                customArg
            );

        } catch (error) {

            console.error(
                '❌ Error starting game:',
                error
            );


            await sock.sendMessage(from, {
                text:
`❌ *Unable to start the game.*

Please try again.

Error:
${error.message || 'Unknown error'}`
            });
        }
    }
};
