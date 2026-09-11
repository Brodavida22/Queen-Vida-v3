const { startGame, stopGame } = require('../utils/gameManager');

const CREATOR_NUMBERS = ["2348138558590", "2348138558590"];

module.exports = {
    name: 'game',
    description: 'Interactive group mini-games suite dashboard and control',
    async execute(sock, m, from, args) {
        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender.replace(/[^0-9]/g, '');
        const isOwner = CREATOR_NUMBERS.includes(senderNumber) || m.key.fromMe;

        // Check group admin status (Creators bypass this entirely)
        const isGroup = from.endsWith('@g.us');
        let isAdmin = false;

        if (isGroup && !isOwner) {
            try {
                const groupMetadata = await sock.groupMetadata(from);
                const participants = groupMetadata.participants || [];
                const participantObj = participants.find(p => p.id.replace(/[^0-9]/g, '') === senderNumber);
                isAdmin = participantObj && (participantObj.admin === 'admin' || participantObj.admin === 'superadmin');
            } catch (e) {
                console.error('Error fetching group metadata for admin check:', e);
            }
        }

        const action = args[0] ? args[0].toLowerCase() : '';

        // If no action or invalid subcommand, show the professional master game menu
        if (!['start', 'stop'].includes(action)) {
            const menuText = 
`┏━━━ 🎮 *QUEEN VIDA GAME SUITE* 🎮 ━━━┓\n` +
`┃ 🌟 *Welcome to Group Mini-Games!* \n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ 📌 *AVAILABLE GAMES:*\n` +
`┃\n` +
`┃ 1️⃣ *!game start trivia <rounds>*\n` +
`┃    _Test your general knowledge with 4-option questions (A, B, C, D)._ \n` +
`┃\n` +
`┃ 2️⃣ *!game start scramble <rounds>*\n` +
`┃    _Unscramble tech/general words using hints before time runs out._\n` +
`┃\n` +
`┃ 3️⃣ *!game start guess <rounds>*\n` +
`┃    _Guess the secret target number. The bot gives Higher/Lower hints!_\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ ⚙️ *RULES & SETTINGS:*\n` +
`┃ • *Min Rounds:* 5 Rounds\n` +
`┃ • *Timer:* 25s (Trivia) | 45s (Scramble/Guess)\n` +
`┃ • *Points:* +5 pts per correct answer\n` +
`┃ • *How to Play:* Just type or reply with your answer directly in the group!\n` +
`┃ • *Stop Game:* \`!game stop\`\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ 🔒 *Access:* Admins & Creators Only\n` +
`┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

            return sock.sendMessage(from, { text: menuText }, { quoted: m });
        }

        // Action controls (start / stop) require admin or creator access (isOwner grants instant bypass)
        if (!isOwner && !isAdmin) {
            return sock.sendMessage(from, { text: '❌ *Access Denied:* Only group admins and creators can start or stop game sessions!' }, { quoted: m });
        }

        if (action === 'stop') {
            return await stopGame(sock, from);
        }

        if (action === 'start') {
            if (!isGroup) {
                return sock.sendMessage(from, { text: '❌ Mini-games can only be played inside WhatsApp groups!' }, { quoted: m });
            }

            const gameType = args[1] ? args[1].toLowerCase() : '';
            const roundsNum = parseInt(args[2]);

            if (!['trivia', 'scramble', 'guess'].includes(gameType)) {
                return sock.sendMessage(from, { text: '❌ Please specify a valid game!\n*Usage:* `!game start <trivia|scramble|guess> <rounds>`' }, { quoted: m });
            }

            if (isNaN(roundsNum) || roundsNum < 5) {
                return sock.sendMessage(from, { text: '❌ Please specify the number of rounds (Minimum is *5 rounds*).\n*Example:* `!game start trivia 5`' }, { quoted: m });
            }

            return await startGame(sock, from, gameType, roundsNum);
        }
    }
};
