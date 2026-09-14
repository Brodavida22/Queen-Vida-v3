// ============================================================
// QUEEN VIDA-V3 — GAME MENU
// ============================================================

const {
    startGame,
    stopGame,
    isGameActive
} = require('../utils/gameManager');

const CREATOR_NUMBERS = [
    '2348138558590'
];

// ============================================================
// GET SENDER
// ============================================================

function getSender(m) {
    return (
        m.key.participant ||
        m.key.remoteJid ||
        ''
    );
}

// ============================================================
// CHECK GROUP ADMIN
// ============================================================

async function isGroupAdmin(sock, chatId, sender) {
    try {
        const metadata = await sock.groupMetadata(chatId);

        const participant = metadata.participants.find(
            p => p.id === sender
        );

        return !!(
            participant &&
            (
                participant.admin === 'admin' ||
                participant.admin === 'superadmin'
            )
        );
    } catch (error) {
        console.error('Game admin check error:', error);
        return false;
    }
}

// ============================================================
// CHECK CREATOR
// ============================================================

function isCreator(sender) {
    const number = String(sender)
        .split('@')[0]
        .split(':')[0]
        .replace(/\D/g, '');

    return CREATOR_NUMBERS.includes(number);
}

// ============================================================
// GAME MENU
// ============================================================

function gameMenu(prefix) {
    return `
╭━━━〔 🎮 *QUEEN VIDA GAME ZONE* 〕━━━╮
┃
┃ 🏆 *AVAILABLE GAMES*
┃
┃ 🎯 ${prefix}trivia
┃ 🧠 ${prefix}quiz
┃ 🔤 ${prefix}scramble
┃ 🔢 ${prefix}guess
┃ 🔢 ${prefix}guessnumber
┃ 🧩 ${prefix}riddle
┃ 😂 ${prefix}emojigame
┃ 🎵 ${prefix}guesssong
┃ ⌨️ ${prefix}typing
┃
┣━━━━━━━━━━━━━━━━━━━━
┃
┃ 👑 *ADMIN GAME CONTROL*
┃
┃ ${prefix}game start <game> <rounds>
┃ ${prefix}game stop
┃
┃ Example:
┃ ${prefix}game start quiz 5
┃
╰━━━〔 👑 *QUEEN VIDA-V3* 〕━━━╯
`;
}

// ============================================================
// COMMAND
// ============================================================

module.exports = {
    name: 'game',
    aliases: ['games'],
    description: 'Game menu and game controls',

    async execute(sock, m, from, args, isOwner) {

        // ----------------------------------------------------
        // GROUP ONLY
        // ----------------------------------------------------

        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ *Games can only be played inside a group.*'
                },
                { quoted: m }
            );
        }

        const sender = getSender(m);

        // ----------------------------------------------------
        // PREFIX
        // ----------------------------------------------------

        let prefix = '!';

        try {
            const prefixModule = require('../utils/prefix');

            if (typeof prefixModule.getPrefix === 'function') {
                prefix = prefixModule.getPrefix();
            }

            if (typeof prefixModule === 'string') {
                prefix = prefixModule;
            }
        } catch {
            prefix = '!';
        }

        // ----------------------------------------------------
        // NO ARGUMENT = SHOW MENU
        // ----------------------------------------------------

        if (!args || !args.length) {
            return sock.sendMessage(
                from,
                {
                    text: gameMenu(prefix)
                },
                { quoted: m }
            );
        }

        const action = String(args[0])
            .toLowerCase()
            .trim();

        // ====================================================
        // START GAME
        // ====================================================

        if (action === 'start') {

            // -----------------------------------------------
            // ADMIN / CREATOR CHECK
            // -----------------------------------------------

            const admin = await isGroupAdmin(
                sock,
                from,
                sender
            );

            const creator =
                isCreator(sender) ||
                isOwner === true ||
                m.key.fromMe === true;

            if (!admin && !creator) {
                return sock.sendMessage(
                    from,
                    {
                        text:
                            '🚫 *ACCESS DENIED*\n\n' +
                            'Only group admins or the bot creator can start games from the game control menu.'
                    },
                    { quoted: m }
                );
            }

            // -----------------------------------------------
            // GAME TYPE
            // -----------------------------------------------

            let gameType = String(args[1] || '')
                .toLowerCase()
                .trim();

            if (!gameType) {
                return sock.sendMessage(
                    from,
                    {
                        text:
                            '❌ *Choose a game first!*\n\n' +
                            gameMenu(prefix)
                    },
                    { quoted: m }
                );
            }

            // -----------------------------------------------
            // GAME ALIASES
            // -----------------------------------------------

            const gameAliases = {
                trivia: 'trivia',
                triviagame: 'trivia',

                quiz: 'quiz',
                quizgame: 'quiz',

                scramble: 'scramble',
                wordscramble: 'scramble',

                guess: 'guess',
                guessnumber: 'guess',
                numberguess: 'guess',

                riddle: 'riddle',
                riddles: 'riddle',
                brain: 'riddle',

                emojigame: 'emojigame',
                emoji: 'emojigame',
                emojiguess: 'emojigame',

                guesssong: 'guesssong',
                songguess: 'guesssong',
                song: 'guesssong',

                typing: 'typing',
                typingrace: 'typing',
                typerace: 'typing'
            };

            gameType =
                gameAliases[gameType];

            if (!gameType) {
                return sock.sendMessage(
                    from,
                    {
                        text:
                            '❌ *Unknown game!*\n\n' +
                            'Available games:\n\n' +
                            '🎯 trivia\n' +
                            '🧠 quiz\n' +
                            '🔤 scramble\n' +
                            '🔢 guess\n' +
                            '🔢 guessnumber\n' +
                            '🧩 riddle\n' +
                            '😂 emojigame\n' +
                            '🎵 guesssong\n' +
                            '⌨️ typing'
                    },
                    { quoted: m }
                );
            }

            // -----------------------------------------------
            // ROUNDS
            // -----------------------------------------------

            let rounds = parseInt(
                args[2],
                10
            );

            if (!Number.isFinite(rounds)) {
                rounds = 5;
            }

            if (rounds < 1) {
                rounds = 1;
            }

            if (rounds > 50) {
                rounds = 50;
            }

            // -----------------------------------------------
            // START
            // -----------------------------------------------

            return startGame(
                sock,
                from,
                gameType,
                rounds
            );
        }

        // ====================================================
        // STOP GAME
        // ====================================================

        if (
            action === 'stop' ||
            action === 'end' ||
            action === 'cancel'
        ) {

            // -----------------------------------------------
            // ADMIN / CREATOR CHECK
            // -----------------------------------------------

            const admin = await isGroupAdmin(
                sock,
                from,
                sender
            );

            const creator =
                isCreator(sender) ||
                isOwner === true ||
                m.key.fromMe === true;

            if (!admin && !creator) {
                return sock.sendMessage(
                    from,
                    {
                        text:
                            '🚫 *ACCESS DENIED*\n\n' +
                            'Only group admins or the bot creator can stop the game.'
                    },
                    { quoted: m }
                );
            }

            if (!isGameActive(from)) {
                return sock.sendMessage(
                    from,
                    {
                        text:
                            '❌ *There is no active game in this group.*'
                    },
                    { quoted: m }
                );
            }

            return stopGame(
                sock,
                from
            );
        }

        // ====================================================
        // HELP
        // ====================================================

        return sock.sendMessage(
            from,
            {
                text:
                    `❌ *Unknown game command!*\n\n` +
                    gameMenu(prefix)
            },
            { quoted: m }
        );
    }
};
