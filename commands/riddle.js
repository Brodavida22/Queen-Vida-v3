const fs = require('fs');
const path = require('path');

const riddleFile = path.join(
    __dirname,
    '..',
    'games',
    'riddle.json'
);

const activeRiddles = new Map();

function loadRiddles() {
    try {
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
            '[RIDDLE] Failed to load riddles:',
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

function getMessageText(m, body = '') {
    return String(
        body ||
        m?.message?.conversation ||
        m?.message?.extendedTextMessage?.text ||
        m?.message?.imageMessage?.caption ||
        m?.message?.videoMessage?.caption ||
        m?.message?.documentMessage?.caption ||
        ''
    ).trim();
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

function isCommand(text) {
    return /^[.!/#]/.test(
        String(text || '').trim()
    );
}

function shuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [copy[i], copy[j]] = [
            copy[j],
            copy[i]
        ];
    }

    return copy;
}

async function send(
    sock,
    chatId,
    text,
    options = {}
) {
    return sock.sendMessage(
        chatId,
        {
            text,
            ...options
        }
    );
}

function clearTimers(game) {
    if (!game) return;

    if (game.timer) {
        clearTimeout(game.timer);
    }

    if (game.nextTimer) {
        clearTimeout(game.nextTimer);
    }

    game.timer = null;
    game.nextTimer = null;
}

async function startRiddle(
    sock,
    chatId,
    rounds = 5
) {
    if (!chatId?.endsWith('@g.us')) {
        return send(
            sock,
            chatId,
            '🧩 The riddle game can only be played inside a group.'
        );
    }

    if (activeRiddles.has(chatId)) {
        return send(
            sock,
            chatId,
            '❌ A riddle game is already running here.\n\nUse *.riddle stop* to stop it.'
        );
    }

    const riddles =
        shuffle(loadRiddles());

    if (!riddles.length) {
        return send(
            sock,
            chatId,
            '❌ No riddles were found in games/riddle.json'
        );
    }

    const count =
        Math.max(
            1,
            Math.min(
                Number(rounds) || 5,
                riddles.length
            )
        );

    const game = {
        riddles:
            riddles.slice(0, count),

        current: 0,

        scores: {},

        answered: false,

        timer: null,

        nextTimer: null,

        sock
    };

    activeRiddles.set(
        chatId,
        game
    );

    return sendNextRiddle(
        sock,
        chatId
    );
}

async function sendNextRiddle(
    sock,
    chatId
) {
    const game =
        activeRiddles.get(chatId);

    if (!game) {
        return;
    }

    if (
        game.current >=
        game.riddles.length
    ) {
        return finishRiddle(
            sock,
            chatId
        );
    }

    clearTimers(game);

    game.answered = false;

    const riddle =
        game.riddles[
            game.current
        ];

    const difficulty =
        riddle.difficulty
            ? `\n🎚️ Difficulty: *${String(
                  riddle.difficulty
              ).toUpperCase()}*`
            : '';

    await send(
        sock,
        chatId,
        `┏━━━ 🧩 *RIDDLE GAME* 🧩 ━━━┓\n` +
        `┃ 🎮 *Round:* ${game.current + 1}/${game.riddles.length}\n` +
        `┃\n` +
        `┃ ❓ ${riddle.question}${difficulty}\n` +
        `┃\n` +
        `┃ 🏆 First correct answer gets *+5 points*\n` +
        `┃ ⏱️ Time: *30 seconds*\n` +
        `┗━━━━━━━━━━━━━━━━━━━━┛`
    );

    game.timer =
        setTimeout(
            async () => {
                const current =
                    activeRiddles.get(
                        chatId
                    );

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
                    `📌 Correct answer: *${riddle.answer}*\n\n` +
                    `➡️ Next riddle coming up...`
                );

                current.current++;

                current.nextTimer =
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
                                latest.sock,
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
    chatId,
    body = ''
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
        getMessageText(
            m,
            body
        );

    if (!text) {
        return false;
    }

    if (isCommand(text)) {
        return false;
    }

    const riddle =
        game.riddles[
            game.current
        ];

    if (!riddle) {
        return false;
    }

    const userAnswer =
        normalize(text);

    const correctAnswer =
        normalize(
            riddle.answer
        );

    if (
        userAnswer !==
        correctAnswer
    ) {
        return false;
    }

    /*
     * IMPORTANT:
     * Mark the round answered BEFORE sending anything.
     * This prevents two people from winning simultaneously.
     */
    game.answered = true;

    if (game.timer) {
        clearTimeout(
            game.timer
        );

        game.timer = null;
    }

    const sender =
        getSenderId(m);

    game.scores[sender] =
        (game.scores[sender] || 0) +
        5;

    await send(
        sock,
        chatId,
        `🎉 *CORRECT ANSWER!*\n\n` +
        `👤 Winner: @${String(sender).split('@')[0]}\n` +
        `✅ Answer: *${riddle.answer}*\n` +
        `🏆 *+5 points!*\n` +
        `📊 Your riddle score: *${game.scores[sender]} points*`,
        {
            mentions: [sender]
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
                    latest.sock,
                    chatId
                ).catch(
                    console.error
                );
            },
            1500
        );

    return true;
}

async function finishRiddle(
    sock,
    chatId
) {
    const game =
        activeRiddles.get(chatId);

    if (!game) {
        return;
    }

    clearTimers(game);

    const scores =
        Object.entries(
            game.scores
        ).sort(
            (a, b) => b[1] - a[1]
        );

    let text =
        `🏁 *RIDDLE GAME FINISHED!*\n\n`;

    if (!scores.length) {
        text +=
            `😢 Nobody scored any points.`;
    } else {
        text +=
            `🏆 *FINAL SCORES*\n\n`;

        scores.forEach(
            ([user, score], index) => {
                const medal =
                    index === 0
                        ? '🥇'
                        : index === 1
                        ? '🥈'
                        : index === 2
                        ? '🥉'
                        : '🏅';

                text +=
                    `${medal} @${String(user).split('@')[0]} — *${score} points*\n`;
            }
        );
    }

    activeRiddles.delete(
        chatId
    );

    return send(
        sock,
        chatId,
        text,
        {
            mentions:
                scores.map(
                    ([user]) => user
                )
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

    clearTimers(game);

    activeRiddles.delete(
        chatId
    );

    return send(
        sock,
        chatId,
        '🛑 *RIDDLE GAME STOPPED*'
    );
}

module.exports = {
    name: 'riddle',

    aliases: [
        'riddles',
        'brain'
    ],

    description:
        'Play an interactive riddle game',

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

        if (
            !from?.endsWith(
                '@g.us'
            )
        ) {
            return send(
                sock,
                from,
                '🧩 The riddle game can only be played inside a group.'
            );
        }

        return startRiddle(
            sock,
            from,
            args?.[0] || 5
        );
    },

    handleMessage:
        handleRiddleMessage,

    isActive(chatId) {
        return activeRiddles.has(
            chatId
        );
    },

    stop:
        stopRiddle
};
