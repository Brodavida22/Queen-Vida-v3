const fs = require('fs');
const path = require('path');

const activeWordGames = new Map();

const GAME_CONFIG = {
    starting: {
        file: 'starting.json',
        title: 'WORDS STARTING WITH',
        emoji: '🔤',
        field: 'starting'
    },

    ending: {
        file: 'ending.json',
        title: 'WORDS ENDING WITH',
        emoji: '🔚',
        field: 'ending'
    }
};

function loadWords(gameType) {
    const config = GAME_CONFIG[gameType];

    if (!config) return [];

    const filePath = path.join(
        __dirname,
        '..',
        'games',
        config.file
    );

    try {
        if (!fs.existsSync(filePath)) {
            return [];
        }

        const data = JSON.parse(
            fs.readFileSync(filePath, 'utf8')
        );

        if (!Array.isArray(data)) {
            return [];
        }

        return data
            .map(item =>
                String(item?.[config.field] || '')
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean);

    } catch (error) {
        console.error(
            `[WORD GAME] Failed to load ${gameType}:`,
            error
        );

        return [];
    }
}

function shuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
        const j =
            Math.floor(Math.random() * (i + 1));

        [copy[i], copy[j]] =
            [copy[j], copy[i]];
    }

    return copy;
}

function getMessageText(m) {
    return (
        m?.message?.conversation ||
        m?.message?.extendedTextMessage?.text ||
        m?.message?.imageMessage?.caption ||
        m?.message?.videoMessage?.caption ||
        ''
    );
}

function getSender(m) {
    return (
        m?.key?.participant ||
        m?.participant ||
        m?.key?.remoteJid ||
        'unknown'
    );
}

function isCommand(text) {
    return /^[.!/#]/.test(
        String(text || '').trim()
    );
}

async function send(sock, chatId, text, options = {}) {
    return sock.sendMessage(
        chatId,
        {
            text,
            ...options
        }
    );
}

async function sendRound(sock, chatId) {
    const game = activeWordGames.get(chatId);

    if (!game) return;

    if (game.round >= game.rounds) {
        return finishGame(
            sock,
            chatId
        );
    }

    game.round++;
    game.answered = false;

    const ending =
        game.gameType === 'ending';

    const config =
        GAME_CONFIG[game.gameType];

    const word =
        game.words[game.round - 1];

    game.currentWord = word;

    const directionText =
        ending
            ? `a word ending with *${word.toUpperCase()}*`
            : `a word starting with *${word.toUpperCase()}*`;

    const message =
`╭━━━ ${config.emoji} *${config.title}* ${config.emoji} ━━━╮
┃
┃ 🎮 *Round:* ${game.round}/${game.rounds}
┃
┃ 📝 Give me ${directionText}.
┃
┃ 🏆 First correct answer gets *+5 points*
┃ ⏱️ Time: *30 seconds*
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

    await send(
        sock,
        chatId,
        message
    );

    if (!activeWordGames.has(chatId)) {
        return;
    }

    if (game.timer) {
        clearTimeout(game.timer);
    }

    game.timer = setTimeout(
        async () => {

            const current =
                activeWordGames.get(chatId);

            if (
                !current ||
                current.answered
            ) {
                return;
            }

            current.answered = true;

            await send(
                sock,
                chatId,
                `⏰ *TIME'S UP!*\n\n` +
                `No correct answer this round.\n` +
                `📌 Required ending/starting letters: *${current.currentWord.toUpperCase()}*`
            );

            current.nextTimer =
                setTimeout(() => {

                    const latest =
                        activeWordGames.get(chatId);

                    if (!latest) return;

                    latest.nextTimer = null;

                    sendRound(
                        sock,
                        chatId
                    ).catch(console.error);

                }, 1500);

        },
        30000
    );
}

async function finishGame(sock, chatId) {
    const game =
        activeWordGames.get(chatId);

    if (!game) return;

    if (game.timer) {
        clearTimeout(game.timer);
    }

    if (game.nextTimer) {
        clearTimeout(game.nextTimer);
    }

    const scores =
        Object.entries(game.scores)
            .sort((a, b) => b[1] - a[1]);

    let result =
`🏁 *${GAME_CONFIG[game.gameType].title} GAME FINISHED!*\n\n`;

    if (!scores.length) {
        result +=
            `😢 Nobody scored this game.`;
    } else {

        result += `🏆 *FINAL SCORES*\n\n`;

        scores.forEach(
            ([user, points], index) => {

                const medal =
                    index === 0
                        ? '🥇'
                        : index === 1
                        ? '🥈'
                        : index === 2
                        ? '🥉'
                        : '🏅';

                result +=
                    `${medal} @${user.replace(
                        /[^0-9]/g,
                        ''
                    )} — *${points} pts*\n`;
            }
        );
    }

    activeWordGames.delete(chatId);

    await sock.sendMessage(
        chatId,
        {
            text: result,
            mentions: scores.map(
                ([user]) => user
            )
        }
    );
}

async function startWordGame(
    sock,
    chatId,
    gameType,
    rounds = 5
) {
    if (!chatId.endsWith('@g.us')) {
        return send(
            sock,
            chatId,
            '❌ This game can only be played inside a group.'
        );
    }

    if (activeWordGames.has(chatId)) {
        return send(
            sock,
            chatId,
            '❌ A word game is already running here.\n\nUse `.starting stop` or `.ending stop`.'
        );
    }

    const words =
        shuffle(
            loadWords(gameType)
        );

    if (!words.length) {
        return send(
            sock,
            chatId,
            `❌ No words found for the ${gameType} game.`
        );
    }

    rounds =
        Math.max(
            1,
            Math.min(
                Number(rounds) || 5,
                words.length
            )
        );

    activeWordGames.set(
        chatId,
        {
            gameType,
            words: words.slice(0, rounds),
            rounds,
            round: 0,
            currentWord: null,
            scores: {},
            answered: false,
            timer: null,
            nextTimer: null
        }
    );

    await send(
        sock,
        chatId,
        `🎮 *${GAME_CONFIG[gameType].title} GAME STARTING!*\n\n` +
        `🔄 Rounds: *${rounds}*\n` +
        `🏆 Correct answer: *+5 points*\n` +
        `⏱️ 30 seconds per round\n\n` +
        `Get ready! 🔥`
    );

    setTimeout(() => {
        if (activeWordGames.has(chatId)) {
            sendRound(
                sock,
                chatId
            ).catch(console.error);
        }
    }, 1500);
}

async function stopWordGame(sock, chatId) {
    const game =
        activeWordGames.get(chatId);

    if (!game) {
        return send(
            sock,
            chatId,
            '❌ No active word game in this group.'
        );
    }

    if (game.timer) {
        clearTimeout(game.timer);
    }

    if (game.nextTimer) {
        clearTimeout(game.nextTimer);
    }

    activeWordGames.delete(chatId);

    return send(
        sock,
        chatId,
        '🛑 *WORD GAME STOPPED*\n\nThe game has been cancelled.'
    );
}

async function handleWordGameMessage(
    sock,
    m,
    from,
    text
) {
    const game =
        activeWordGames.get(from);

    if (!game || game.answered) {
        return false;
    }

    const answer =
        String(
            getMessageText(m) || text || ''
        )
            .trim()
            .toLowerCase();

    if (!answer) return false;

    if (isCommand(answer)) {
        return false;
    }

    const target =
        String(game.currentWord || '')
            .toLowerCase();

    let correct = false;

    if (game.gameType === 'starting') {
        correct =
            answer.startsWith(target);
    }

    if (game.gameType === 'ending') {
        correct =
            answer.endsWith(target);
    }

    if (!correct) {
        return false;
    }

    game.answered = true;

    if (game.timer) {
        clearTimeout(game.timer);
        game.timer = null;
    }

    const sender =
        getSender(m);

    game.scores[sender] =
        (game.scores[sender] || 0) + 5;

    await sock.sendMessage(
        from,
        {
            text:
                `🎉 *CORRECT!*\n\n` +
                `👤 @${sender.replace(
                    /[^0-9]/g,
                    ''
                )}\n` +
                `📝 Answer: *${answer}*\n` +
                `💎 +5 Points`,
            mentions: [sender]
        },
        {
            quoted: m
        }
    );

    game.nextTimer =
        setTimeout(() => {

            const latest =
                activeWordGames.get(from);

            if (!latest) return;

            latest.nextTimer = null;

            sendRound(
                sock,
                from
            ).catch(console.error);

        }, 1500);

    return true;
}


/*
 * ============================================================
 * COMMANDS
 * ============================================================
 */

const startingCommand = {
    name: 'starting',

    description:
        'Play Words Starting With',

    async execute(
        sock,
        m,
        from,
        args
    ) {
        const action =
            String(args?.[0] || '')
                .toLowerCase();

        if (action === 'stop') {
            return stopWordGame(
                sock,
                from
            );
        }

        return startWordGame(
            sock,
            from,
            'starting',
            Number(args?.[0]) || 5
        );
    }
};


const endingCommand = {
    name: 'ending',

    description:
        'Play Words Ending With',

    async execute(
        sock,
        m,
        from,
        args
    ) {
        const action =
            String(args?.[0] || '')
                .toLowerCase();

        if (action === 'stop') {
            return stopWordGame(
                sock,
                from
            );
        }

        return startWordGame(
            sock,
            from,
            'ending',
            Number(args?.[0]) || 5
        );
    }
};


module.exports = [
    startingCommand,
    endingCommand
];

module.exports.handleWordGameMessage =
    handleWordGameMessage;

module.exports.isWordGameActive =
    chatId =>
        activeWordGames.has(chatId);

module.exports.stopWordGame =
    stopWordGame;
