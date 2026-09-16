const {
    startGame,
    stopGame
} = require('../utils/gameManager');

const CREATOR_NUMBERS = [
    "2348138558590"
];

const GAME_ALIASES = {
    triviagame: 'trivia',
    quizgame: 'quiz',
    scramblegame: 'scramble',

    guessnumber: 'guess',
    numberguess: 'guess',

    truth: 'truthordare',
    dare: 'truthordare',

    emojigame: 'emoji',
    emojiguess: 'emoji',

    movieemoji: 'movemoji',
    movieguess: 'movemoji',

    find: 'findemoji',

    lyric: 'lyrics',
    rhyming: 'rhyme',

    meme: 'memewar'
};

const VALID_GAMES = [
    'trivia',
    'quiz',
    'scramble',
    'guess',
    'truthordare',
    'emoji',
    'movemoji',
    'findemoji',
    'lyrics',
    'rhyme',
    'taboo',
    '2truth1lie',
    'memewar'
];

function normalizeGame(name) {
    const value =
        String(name || '')
            .toLowerCase()
            .trim();

    return GAME_ALIASES[value] || value;
}

function gameMenu(prefix) {
    return `
┏━━━ 🎮 *QUEEN VIDA GAME SUITE* 🎮 ━━━┓
┃
┃ 🎯 *AVAILABLE GAMES*
┃
┃ 1️⃣ Trivia
┃    ${prefix}game start trivia easy 5
┃
┃ 2️⃣ Quiz
┃    ${prefix}game start quiz medium 5
┃
┃ 3️⃣ Word Scramble
┃    ${prefix}game start scramble 5
┃
┃ 4️⃣ Number Guess
┃    ${prefix}game start guess 5
┃
┃ 5️⃣ Truth or Dare
┃    ${prefix}game start truthordare 5
┃
┃ 6️⃣ Emoji Guess
┃    ${prefix}game start emoji 5
┃
┃ 7️⃣ Movie Emoji
┃    ${prefix}game start movemoji 5
┃
┃ 8️⃣ Find Emoji
┃    ${prefix}game start findemoji 5
┃
┃ 9️⃣ Lyrics
┃    ${prefix}game start lyrics 5
┃
┃ 🔟 Rhyme
┃    ${prefix}game start rhyme 5
┃
┃ 1️⃣1️⃣ Taboo
┃    ${prefix}game start taboo 5
┃
┃ 1️⃣2️⃣ Two Truths One Lie
┃    ${prefix}game start 2truth1lie 5
┃
┃ 1️⃣3️⃣ Meme War
┃    ${prefix}game start memewar 5
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 📌 *TRIVIA / QUIZ*
┃
┃ easy
┃ medium
┃ hard
┃
┃ 📌 *MINIMUM ROUNDS:* 5
┃ 📌 *MAXIMUM ROUNDS:* 100
┃
┃ 🛑 Stop:
┃ ${prefix}game stop
┃
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛
`;
}

module.exports = {
    name: 'game',

    description:
        'Interactive group mini-games suite',

    async execute(
        sock,
        m,
        from,
        args
    ) {

        const sender =
            m.key.participant ||
            m.key.remoteJid;

        const senderNumber =
            String(sender)
                .replace(/[^0-9]/g, '');

        const isOwner =
            CREATOR_NUMBERS.includes(
                senderNumber
            ) ||
            m.key.fromMe;

        const isGroup =
            from.endsWith('@g.us');

        let isAdmin = false;

        /*
         * ========================================================
         * ADMIN CHECK
         * ========================================================
         */

        if (
            isGroup &&
            !isOwner
        ) {

            try {

                const metadata =
                    await sock.groupMetadata(
                        from
                    );

                const participant =
                    (metadata.participants || [])
                        .find(
                            p =>
                                String(p.id)
                                    .replace(
                                        /[^0-9]/g,
                                        ''
                                    ) ===
                                senderNumber
                        );

                isAdmin =
                    !!participant &&
                    (
                        participant.admin ===
                            'admin' ||
                        participant.admin ===
                            'superadmin'
                    );

            } catch (error) {

                console.error(
                    'Game admin check error:',
                    error
                );
            }
        }


        /*
         * ========================================================
         * SHOW MENU
         * ========================================================
         */

        const action =
            String(args[0] || '')
                .toLowerCase();

        if (
            !action ||
            !['start', 'stop'].includes(action)
        ) {

            const prefix =
                process.env.PREFIX ||
                '.';

            return sock.sendMessage(
                from,
                {
                    text:
                        gameMenu(prefix)
                },
                {
                    quoted: m
                }
            );
        }


        /*
         * ========================================================
         * PERMISSION
         * ========================================================
         */

        if (
            !isOwner &&
            !isAdmin
        ) {

            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ *Access Denied!*\n\n' +
                        'Only group admins and the bot creator can start or stop games.'
                },
                {
                    quoted: m
                }
            );
        }


        /*
         * ========================================================
         * STOP
         * ========================================================
         */

        if (
            action === 'stop'
        ) {

            return stopGame(
                sock,
                from
            );
        }


        /*
         * ========================================================
         * GROUP ONLY
         * ========================================================
         */

        if (!isGroup) {

            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ Games can only be played in WhatsApp groups.'
                },
                {
                    quoted: m
                }
            );
        }


        /*
         * ========================================================
         * GAME NAME
         * ========================================================
         */

        const gameType =
            normalizeGame(
                args[1]
            );

        if (
            !VALID_GAMES.includes(
                gameType
            )
        ) {

            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ *Invalid game!*\n\n' +
                        gameMenu(
                            process.env.PREFIX || '.'
                        )
                },
                {
                    quoted: m
                }
            );
        }


        /*
         * ========================================================
         * DIFFICULTY
         * ========================================================
         */

        let difficulty = 'all';

        let roundsIndex = 2;

        if (
            gameType === 'trivia' ||
            gameType === 'quiz'
        ) {

            const requested =
                String(
                    args[2] || ''
                ).toLowerCase();

            if (
                [
                    'easy',
                    'medium',
                    'hard'
                ].includes(
                    requested
                )
            ) {

                difficulty =
                    requested;

                roundsIndex = 3;

            } else if (
                requested === 'all' ||
                requested === 'mixed'
            ) {

                difficulty = 'all';

                roundsIndex = 3;
            }
        }


        /*
         * ========================================================
         * ROUNDS
         * ========================================================
         */

        let rounds =
            parseInt(
                args[roundsIndex],
                10
            );

        /*
         * Allow:
         *
         * .game start emoji
         *
         * to automatically use 5 rounds.
         */

        if (
            isNaN(rounds)
        ) {
            rounds = 5;
        }

        if (
            rounds < 5
        ) {

            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ Minimum is *5 rounds*.\n\n' +
                        `Example:\n` +
                        `.${'game'} start ${gameType} 5`
                },
                {
                    quoted: m
                }
            );
        }

        if (
            rounds > 100
        ) {

            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ Maximum is *100 rounds*.'
                },
                {
                    quoted: m
                }
            );
        }


        /*
         * ========================================================
         * START GAME
         * ========================================================
         */

        return startGame(
            sock,
            from,
            gameType,
            rounds,
            difficulty
        );
    }
};
