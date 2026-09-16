const fs = require('fs');
const path = require('path');

const riddleFile = path.join(__dirname, '..', 'games', 'riddle.json');

const activeRiddles = new Map();

function loadRiddles() {
    try {
        if (!fs.existsSync(riddleFile)) {
            return [];
        }

        const data = JSON.parse(
            fs.readFileSync(riddleFile, 'utf8')
        );

        if (!Array.isArray(data)) {
            return [];
        }

        return data.filter(
            r =>
                r &&
                typeof r.question === 'string' &&
                typeof r.answer === 'string'
        );
    } catch (error) {
        console.error(
            '[RIDDLE] Failed to load riddle.json:',
            error
        );

        return [];
    }
}

function normalize(text) {
    return String(text || '')
        .toLowerCase()
        .trim()
        .replace(/[!?.,'"`]/g, '')
        .replace(/\s+/g, ' ');
}

function shuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [copy[i], copy[j]] = [
            copy[j],
            copy[i]
        ];
    }

    return copy;
}

function getSenderId(m) {
    return (
        m?.key?.participant ||
        m?.participant ||
        m?.sender ||
        m?.key?.remoteJid ||
        'unknown'
    );
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

function isGroup(jid) {
    return (
        typeof jid === 'string' &&
        jid.endsWith('@g.us')
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

function startRiddle(sock, chatId, rounds = 5) {
    if (activeRiddles.has(chatId)) {
        return send(
            sock,
            chatId,
            '🧩 A riddle game is already running here!\n\nUse *.riddle stop* to stop it.'
        );
    }

    const riddles = shuffle(loadRiddles());

    if (!riddles.length) {
        return send(
            sock,
            chatId,
            '❌ No riddles were found in games/riddle.json'
        );
    }

    rounds = Math.max(
        1,
        Math.min(
            Number(rounds) || 5,
            riddles.length
        )
    );

    const game = {
        riddles: riddles.slice(0, rounds),
        current: 0,
        scores: {},
        answered: false,
        timer: null,
        nextTimer: null,
        sock
    };

    activeRiddles.set(chatId, game);

    return sendNextRiddle(
        sock,
        chatId
    );
}

async function sendNextRiddle(sock, chatId) {
    const game = activeRiddles.get(chatId);

    if (!game) {
        return;
    }

    if (
        game.current >=
        game.riddles.length
    ) {
        return finishGame(
            sock,
            chatId
        );
    }

    const riddle =
        game.riddles[
            game.current
        ];

    game.answered = false;

    const difficulty =
        riddle.difficulty
            ? `\n🎚️ Difficulty: ${String(
                  riddle.difficulty
              ).toUpperCase()}`
            : '';

    const message =
        `🧩 *RIDDLE GAME*\n\n` +
        `📖 *Riddle ${
            game.current + 1
        }/${game.riddles.length}*\n\n` +
        `${riddle.question}` +
        `${difficulty}\n\n` +
        `⏱️ You have *30 seconds* to answer!\n` +
        `🏆 First correct answer gets the point!`;

    await send(
        sock,
        chatId,
        message
    );

    if (game.timer) {
        clearTimeout(game.timer);
    }

    game.timer = setTimeout(
        async () => {
            const currentGame =
                activeRiddles.get(chatId);

            if (
                !currentGame ||
                currentGame.answered
            ) {
                return;
            }

            currentGame.answered = true;

            await send(
                sock,
                chatId,
                `⏰ *TIME'S UP!*\n\n` +
                `The answer was: *${riddle.answer}*\n\n` +
                `➡️ Next riddle coming up...`
            );

            currentGame.current++;

            currentGame.nextTimer =
                setTimeout(
                    () => {
                        const latest =
                            activeRiddles.get(
                                chatId
                            );

                        if (!latest) {
                            return;
                        }

                        latest.nextTimer =
                            null;

                        sendNextRiddle(
                            sock,
                            chatId
                        ).catch(
                            console.error
                        );
                    },
                    1500
                );
        },
        30000
    );
}

async function handleRiddleMessage(
    sock,
    m,
    chatId
) {
    const game =
        activeRiddles.get(chatId);

    if (
        !game ||
        game.answered
    ) {
        return false;
    }

    const text =
        getMessageText(m);

    if (!text) {
        return false;
    }

    const currentRiddle =
        game.riddles[
            game.current
        ];

    if (!currentRiddle) {
        return false;
    }

    const correctAnswer =
        normalize(
            currentRiddle.answer
        );

    const userAnswer =
        normalize(text);

    if (!userAnswer) {
        return false;
    }

    if (
        userAnswer ===
        correctAnswer
    ) {
        game.answered = true;

        if (game.timer) {
            clearTimeout(
                game.timer
            );

            game.timer = null;
        }

        const userId =
            getSenderId(m);

        game.scores[userId] =
            (game.scores[userId] || 0) +
            1;

        await send(
            sock,
            chatId,
            `🎉 *CORRECT!*\n\n` +
            `👤 Winner: @${userId.split('@')[0]}\n` +
            `✅ Answer: *${currentRiddle.answer}*\n` +
            `🏆 +1 point\n\n` +
            `➡️ Next riddle...`,
            {
                mentions: [userId]
            }
        );

        game.current++;

        game.nextTimer =
            setTimeout(
                () => {
                    const latest =
                        activeRiddles.get(
                            chatId
                        );

                    if (!latest) {
                        return;
                    }

                    latest.nextTimer =
                        null;

                    sendNextRiddle(
                        sock,
                        chatId
                    ).catch(
                        console.error
                    );
                },
                1500
            );

        return true;
    }

    return false;
}

async function finishGame(
    sock,
    chatId
) {
    const game =
        activeRiddles.get(chatId);

    if (!game) {
        return;
    }

    if (game.timer) {
        clearTimeout(
            game.timer
        );
    }

    if (game.nextTimer) {
        clearTimeout(
            game.nextTimer
        );
    }

    const scores =
        Object.entries(
            game.scores
        ).sort(
            (a, b) =>
                b[1] - a[1]
        );

    let result =
        `🏁 *RIDDLE GAME FINISHED!*\n\n`;

    if (!scores.length) {
        result +=
            `😢 Nobody got a correct answer.`;
    } else {
        result +=
            `🏆 *FINAL SCORES*\n\n`;

        scores.forEach(
            (
                [userId, score],
                index
            ) => {
                const medal =
                    index === 0
                        ? '🥇'
                        : index === 1
                        ? '🥈'
                        : index === 2
                        ? '🥉'
                        : '🏅';

                result +=
                    `${medal} @${userId.split('@')[0]} — *${score} point${
                        score === 1
                            ? ''
                            : 's'
                    }*\n`;
            }
        );

        result +=
            `\n🎮 Thanks for playing!`;
    }

    const mentions =
        scores.map(
            ([userId]) =>
                userId
        );

    activeRiddles.delete(
        chatId
    );

    await sock.sendMessage(
        chatId,
        {
            text: result,
            mentions
        }
    );
}

async function stopRiddle(
    sock,
    chatId
) {
    const game =
        activeRiddles.get(chatId);

    if (!game) {
        return send(
            sock,
            chatId,
            '❌ There is no active riddle game in this chat.'
        );
    }

    if (game.timer) {
        clearTimeout(
            game.timer
        );
    }

    if (game.nextTimer) {
        clearTimeout(
            game.nextTimer
        );
    }

    activeRiddles.delete(
        chatId
    );

    return send(
        sock,
        chatId,
        '🛑 *RIDDLE GAME STOPPED*\n\nThe current game has been cancelled.'
    );
}

module.exports = {
    name: 'riddle',

    description:
        'Play a 100-question interactive riddle game',

    async execute(
        sock,
        m,
        from,
        args
    ) {
        const action =
            String(
                args?.[0] || ''
            ).toLowerCase();

        if (action === 'stop') {
            return stopRiddle(
                sock,
                from
            );
        }

        if (!isGroup(from)) {
            return send(
                sock,
                from,
                '🧩 The riddle game is designed for WhatsApp groups.'
            );
        }

        const rounds =
            Number(args?.[0]) || 5;

        return startRiddle(
            sock,
            from,
            rounds
        );
    },

    handleMessage:
        handleRiddleMessage,

    isActive(chatId) {
        return activeRiddles.has(
            chatId
        );
    },

    stop: stopRiddle
};
