const { startGame, stopGame } = require('../utils/gameManager');

const CREATOR_NUMBERS = ["2348138558590"];

module.exports = {
    name: 'game',
    description: 'Interactive group mini-games suite dashboard and control',

    async execute(sock, m, from, args) {
        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender.replace(/[^0-9]/g, '');

        const isOwner =
            CREATOR_NUMBERS.includes(senderNumber) ||
            m.key.fromMe;

        const isGroup = from.endsWith('@g.us');

        let isAdmin = false;

        if (isGroup && !isOwner) {
            try {
                const groupMetadata =
                    await sock.groupMetadata(from);

                const participants =
                    groupMetadata.participants || [];

                const participantObj =
                    participants.find(
                        p =>
                            p.id.replace(/[^0-9]/g, '') ===
                            senderNumber
                    );

                isAdmin =
                    participantObj &&
                    (
                        participantObj.admin === 'admin' ||
                        participantObj.admin === 'superadmin'
                    );
            } catch (e) {
                console.error(
                    'Error fetching group metadata:',
                    e
                );
            }
        }

        const action =
            args[0]
                ? args[0].toLowerCase()
                : '';

        /*
         * GAME DASHBOARD
         */
        if (!['start', 'stop'].includes(action)) {
            const menuText =
`┏━━━ 🎮 *QUEEN VIDA GAME SUITE* 🎮 ━━━┓
┃ 🌟 *WELCOME TO THE GAME ZONE!*
┃ 👑 *Queen Vida is your host!*
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🎯 *CLASSIC GAMES*
┃
┃ 1️⃣ *.game start trivia <difficulty> <rounds>*
┃    🧠 General knowledge
┃
┃ 2️⃣ *.game start quiz <difficulty> <rounds>*
┃    📝 Multiple choice challenge
┃
┃ 3️⃣ *.game start scramble <rounds>*
┃    🔤 Unscramble the word
┃
┃ 4️⃣ *.game start guess <rounds>*
┃    🔢 Guess the secret number
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 😂 *NEW GAMES*
┃
┃ 5️⃣ *.game start emoji <rounds>*
┃    😂 Guess the Emoji
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🚀 *MORE GAMES COMING*
┃
┃ ❤️ Couples Challenge
┃ 🔎 Find the Emoji
┃ 🔤 Words Ending With
┃ 🔡 Words Starting With
┃ 🎵 Rhyming Words
┃ 🎬 Emoji Movie
┃ 🤥 2 Truth 1 Lie
┃ 🎤 Finish the Lyrics
┃ 🚫 Taboo
┃ 😂 Meme War
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ⚙️ *GAME RULES*
┃ • 🎯 Minimum: *5 rounds*
┃ • 💎 Correct answer: *+5 points*
┃ • ⏱️ Trivia/Quiz: *25 seconds*
┃ • ⏱️ Other games: *45 seconds*
┃ • 🏆 Final leaderboard at the end
┃ • 🛑 Use *.game stop* to stop
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 💡 *EXAMPLES*
┃
┃ • *.game start emoji 10*
┃ • *.game start emoji 20*
┃ • *.game start trivia easy 10*
┃ • *.game start quiz hard 15*
┃ • *.game start scramble 10*
┃ • *.game start guess 10*
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🔒 *Access:* Admins & Creator
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

            return sock.sendMessage(
                from,
                { text: menuText },
                { quoted: m }
            );
        }

        /*
         * ACCESS CONTROL
         */
        if (!isOwner && !isAdmin) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ *ACCESS DENIED!*\n\n' +
                        'Only group admins and the creator can start or stop games.'
                },
                { quoted: m }
            );
        }

        /*
         * STOP GAME
         */
        if (action === 'stop') {
            return await stopGame(sock, from);
        }

        /*
         * GROUP ONLY
         */
        if (!isGroup) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ *Mini-games can only be played inside WhatsApp groups!*'
                },
                { quoted: m }
            );
        }

        /*
         * GAME TYPE
         */
        const gameType =
            args[1]
                ? args[1].toLowerCase()
                : '';

        const validGames = [
            'trivia',
            'quiz',
            'scramble',
            'guess',
            'emoji'
        ];

        if (!validGames.includes(gameType)) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ *Invalid game!*

🎮 *Available Games:*

🎯 trivia
🧠 quiz
🔤 scramble
🔢 guess
😂 emoji

*Examples:*

.game start emoji 10
.game start trivia easy 10
.game start quiz medium 15
.game start scramble 10
.game start guess 10`
                },
                { quoted: m }
            );
        }

        /*
         * DIFFICULTY / ROUND SETTINGS
         */
        let difficulty = 'all';
        let roundsIndex = 2;

        if (
            ['trivia', 'quiz'].includes(gameType)
        ) {
            const possibleDifficulty =
                args[2]
                    ? args[2].toLowerCase()
                    : '';

            if (
                ['easy', 'medium', 'hard']
                    .includes(possibleDifficulty)
            ) {
                difficulty =
                    possibleDifficulty;

                roundsIndex = 3;
            }

            else if (
                ['all', 'mixed']
                    .includes(possibleDifficulty)
            ) {
                difficulty = 'all';

                roundsIndex = 3;
            }
        }

        /*
         * EMOJI / SCRAMBLE / GUESS
         */
        if (
            ['emoji', 'scramble', 'guess']
                .includes(gameType)
        ) {
            roundsIndex = 2;
        }

        const roundsNum =
            parseInt(args[roundsIndex], 10);

        /*
         * ROUND VALIDATION
         */
        if (
            isNaN(roundsNum) ||
            roundsNum < 5
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ *Invalid number of rounds!*

Minimum is *5 rounds*.

*Examples:*

.game start emoji 10
.game start emoji 20
.game start trivia easy 10
.game start quiz hard 15
.game start scramble 10
.game start guess 10`
                },
                { quoted: m }
            );
        }

        /*
         * MAXIMUM FOR DIFFICULTY-SPECIFIC
         * TRIVIA / QUIZ
         */
        if (
            roundsNum > 25 &&
            ['trivia', 'quiz'].includes(gameType) &&
            difficulty !== 'all'
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
                        `❌ *Maximum is 25 rounds* for ` +
                        `${difficulty.toUpperCase()} ` +
                        `${gameType.toUpperCase()}.\n\n` +
                        `There are 25 questions available at this difficulty.`
                },
                { quoted: m }
            );
        }

        /*
         * START GAME
         */
        return await startGame(
            sock,
            from,
            gameType,
            roundsNum,
            difficulty
        );
    }
};
