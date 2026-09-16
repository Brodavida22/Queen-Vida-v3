const { startGame, stopGame } = require('../utils/gameManager');

const CREATOR_NUMBERS = ["2348138558590"];

module.exports = {
    name: 'game',
    description: 'Interactive group mini-games suite dashboard and control',

    async execute(sock, m, from, args) {
        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender.replace(/[^0-9]/g, '');
        const isOwner = CREATOR_NUMBERS.includes(senderNumber) || m.key.fromMe;

        const isGroup = from.endsWith('@g.us');
        let isAdmin = false;

        if (isGroup && !isOwner) {
            try {
                const groupMetadata = await sock.groupMetadata(from);
                const participants = groupMetadata.participants || [];

                const participantObj = participants.find(
                    p => p.id.replace(/[^0-9]/g, '') === senderNumber
                );

                isAdmin =
                    participantObj &&
                    (
                        participantObj.admin === 'admin' ||
                        participantObj.admin === 'superadmin'
                    );
            } catch (e) {
                console.error('Error fetching group metadata for admin check:', e);
            }
        }

        const action = args[0] ? args[0].toLowerCase() : '';

        if (!['start', 'stop'].includes(action)) {
            const menuText =
`┏━━━ 🎮 *QUEEN VIDA GAME SUITE* 🎮 ━━━┓
┃ 🌟 *Welcome to Group Mini-Games!*
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 📌 *AVAILABLE GAMES:*
┃
┃ 1️⃣ *.game start trivia <difficulty> <rounds>*
┃    _General knowledge with A, B, C or D answers._
┃    _Difficulty: easy / medium / hard_
┃
┃ 2️⃣ *.game start quiz <difficulty> <rounds>*
┃    _Challenge your knowledge with fresh questions._
┃    _Difficulty: easy / medium / hard_
┃
┃ 3️⃣ *.game start scramble <rounds>*
┃    _Unscramble words using hints before time runs out._
┃
┃ 4️⃣ *.game start guess <rounds>*
┃    _Guess the secret number with Higher/Lower hints._
┃
┃ 5️⃣ *.game start truthordare <rounds>*
┃    _Everyone can answer. Fastest correct players score points._
┃    _Truth & Dare — group competition mode._
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ⚙️ *RULES & SETTINGS:*
┃ • *Trivia:* 25 Easy + 25 Medium + 25 Hard
┃ • *Quiz:* 25 Easy + 25 Medium + 25 Hard
┃ • *Truth or Dare:* 40 prompts
┃ • *Timer:* 25s (Trivia/Quiz) | 45s (Others)
┃ • *Truth/Dare Points:* 10 / 5 / 3
┃ • *Minimum:* 5 rounds
┃ • *Stop:* .game stop
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 💡 *Examples:*
┃ • .game start trivia easy 10
┃ • .game start trivia hard 25
┃ • .game start quiz medium 15
┃ • .game start scramble 10
┃ • .game start guess 10
┃ • .game start truthordare 10
┃
┃ 🔒 *Access:* Admins & Creators Only
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

            return sock.sendMessage(from, { text: menuText }, { quoted: m });
        }

        if (!isOwner && !isAdmin) {
            return sock.sendMessage(from, {
                text: '❌ *Access Denied:* Only group admins and creators can start or stop game sessions!'
            }, { quoted: m });
        }

        if (action === 'stop') {
            return await stopGame(sock, from);
        }

        if (!isGroup) {
            return sock.sendMessage(from, {
                text: '❌ Mini-games can only be played inside WhatsApp groups!'
            }, { quoted: m });
        }

        const gameType = args[1] ? args[1].toLowerCase() : '';

        const validGames = [
            'trivia',
            'quiz',
            'scramble',
            'guess',
            'truthordare'
        ];

        if (!validGames.includes(gameType)) {
            return sock.sendMessage(from, {
                text:
                    '❌ Please specify a valid game!\n\n' +
                    '*Usage:*\n' +
                    '`.game start trivia <easy|medium|hard> <rounds>`\n' +
                    '`.game start quiz <easy|medium|hard> <rounds>`\n' +
                    '`.game start scramble <rounds>`\n' +
                    '`.game start guess <rounds>`\n' +
                    '`.game start truthordare <rounds>`'
            }, { quoted: m });
        }

        let difficulty = 'all';
        let roundsIndex = 2;

        if (['trivia', 'quiz'].includes(gameType)) {
            const possibleDifficulty = args[2]
                ? args[2].toLowerCase()
                : '';

            if (['easy', 'medium', 'hard'].includes(possibleDifficulty)) {
                difficulty = possibleDifficulty;
                roundsIndex = 3;
            } else if (
                possibleDifficulty === 'all' ||
                possibleDifficulty === 'mixed'
            ) {
                difficulty = 'all';
                roundsIndex = 3;
            }
        }

        const roundsNum = parseInt(args[roundsIndex], 10);

        if (isNaN(roundsNum) || roundsNum < 5) {
            return sock.sendMessage(from, {
                text:
                    '❌ Please specify the number of rounds.\n' +
                    'Minimum is *5 rounds*.\n\n' +
                    '*Examples:*\n' +
                    '`.game start trivia easy 5`\n' +
                    '`.game start trivia hard 25`\n' +
                    '`.game start quiz medium 10`\n' +
                    '`.game start truthordare 10`'
            }, { quoted: m });
        }

        if (
            roundsNum > 25 &&
            ['trivia', 'quiz'].includes(gameType) &&
            difficulty !== 'all'
        ) {
            return sock.sendMessage(from, {
                text:
                    `❌ *Maximum is 25 rounds* for ${difficulty.toUpperCase()} ${gameType.toUpperCase()}.\n` +
                    `There are exactly 25 questions available at this difficulty.`
            }, { quoted: m });
        }

        if (gameType === 'truthordare' && roundsNum > 40) {
            return sock.sendMessage(from, {
                text:
                    '❌ *Maximum is 40 rounds* for Truth or Dare.\n' +
                    'There are exactly 40 prompts available.'
            }, { quoted: m });
        }

        return await startGame(
            sock,
            from,
            gameType,
            roundsNum,
            difficulty
        );
    }
};
