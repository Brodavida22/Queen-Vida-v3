const { startGame, stopGame } = require('../utils/gameManager');

const CREATOR_NUMBERS = ['2348138558590'];

module.exports = {
    name: 'game',
    description: 'Interactive group mini-games suite',

    async execute(sock, m, from, args) {
        const sender =
            m.key.participant ||
            m.key.remoteJid;

        const senderNumber =
            sender.replace(/[^0-9]/g, '');

        const isOwner =
            CREATOR_NUMBERS.includes(senderNumber) ||
            m.key.fromMe;

        const isGroup =
            from.endsWith('@g.us');

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
                            p.id.replace(
                                /[^0-9]/g,
                                ''
                            ) === senderNumber
                    );

                isAdmin =
                    participantObj &&
                    (
                        participantObj.admin === 'admin' ||
                        participantObj.admin === 'superadmin'
                    );
            } catch (e) {
                console.error(
                    'Error checking group admin:',
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
`┏━━━ 🎮 *QUEEN VIDA GAME CENTER* 🎮 ━━━┓
┃
┃ 👑 *Available Games*
┃
┃ 1️⃣ *Trivia*
┃    \`.game start trivia <difficulty> <rounds>\`
┃
┃ 2️⃣ *Quiz*
┃    \`.game start quiz <difficulty> <rounds>\`
┃
┃ 3️⃣ *Word Scramble*
┃    \`.game start scramble <rounds>\`
┃
┃ 4️⃣ *Number Guess*
┃    \`.game start guess <rounds>\`
┃
┃ 5️⃣ *Guess The Emoji*
┃    \`.game start emoji <rounds>\`
┃
┃ 6️⃣ *Couples Challenge*
┃    \`.game start couples <rounds>\`
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ⚙️ *RULES*
┃
┃ • Minimum: *5 rounds*
┃ • Correct answer: *+5 points*
┃ • Trivia/Quiz: *25 seconds*
┃ • Other games: *45 seconds*
┃ • Only one game per group
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 💡 *Examples*
┃
┃ • \`.game start trivia easy 10\`
┃ • \`.game start quiz medium 10\`
┃ • \`.game start scramble 10\`
┃ • \`.game start guess 10\`
┃ • \`.game start emoji 10\`
┃ • \`.game start couples 10\`
┃
┃ 🛑 Stop:
┃ \`.game stop\`
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🔒 *Access:* Group Admins & Creator
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

            return sock.sendMessage(
                from,
                {
                    text: menuText
                },
                {
                    quoted: m
                }
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
                        '❌ *Access Denied!*\n\n' +
                        'Only group admins and the creator can start or stop games.'
                },
                {
                    quoted: m
                }
            );
        }

        /*
         * STOP GAME
         */
        if (action === 'stop') {
            return await stopGame(
                sock,
                from
            );
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
                {
                    quoted: m
                }
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
            'emoji',
            'couples'
        ];

        if (!validGames.includes(gameType)) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ *Invalid game!*

🎮 *Available Games:*

1️⃣ \`trivia\`
2️⃣ \`quiz\`
3️⃣ \`scramble\`
4️⃣ \`guess\`
5️⃣ \`emoji\`
6️⃣ \`couples\`

📌 *Example:*
\`.game start couples 10\`

Use \`.game\` to open the full game dashboard.`
                },
                {
                    quoted: m
                }
            );
        }

        /*
         * DIFFICULTY
         *
         * Only Trivia and Quiz use difficulty.
         */
        let difficulty = 'all';

        let roundsIndex = 2;

        if (
            ['trivia', 'quiz'].includes(
                gameType
            )
        ) {
            const possibleDifficulty =
                args[2]
                    ? args[2].toLowerCase()
                    : '';

            if (
                [
                    'easy',
                    'medium',
                    'hard'
                ].includes(
                    possibleDifficulty
                )
            ) {
                difficulty =
                    possibleDifficulty;

                roundsIndex = 3;
            } else if (
                ['all', 'mixed'].includes(
                    possibleDifficulty
                )
            ) {
                difficulty = 'all';

                roundsIndex = 3;
            }
        }

        /*
         * NUMBER OF ROUNDS
         */
        const roundsNum =
            parseInt(
                args[roundsIndex],
                10
            );

        if (
            isNaN(roundsNum) ||
            roundsNum < 5
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ *Invalid number of rounds!*

🎯 Minimum is *5 rounds*.

📌 *Examples:*
\`.game start couples 10\`
\`.game start emoji 10\`
\`.game start trivia easy 10\``
                },
                {
                    quoted: m
                }
            );
        }

        /*
         * TRIVIA / QUIZ DIFFICULTY LIMIT
         */
        if (
            roundsNum > 25 &&
            ['trivia', 'quiz'].includes(
                gameType
            ) &&
            difficulty !== 'all'
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ *Maximum 25 rounds* ' +
                        'for a single Trivia/Quiz difficulty.'
                },
                {
                    quoted: m
                }
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
