const fs = require('fs');
const path = require('path');

const activeWordGames = new Map();

function loadLetters(type) {
    const file = path.join(
        __dirname,
        '..',
        'games',
        `${type}.json`
    );

    try {
        if (!fs.existsSync(file)) {
            return [];
        }

        const data = JSON.parse(
            fs.readFileSync(file, 'utf8')
        );

        if (!Array.isArray(data)) {
            return [];
        }

        return data
            .map(item =>
                String(
                    item?.[type] || ''
                )
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean);

    } catch (error) {
        console.error(
            `[WORDGAME] Failed to load ${type}.json:`,
            error
        );

        return [];
    }
}

function normalize(text) {
    return String(text || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s'-]/gi, '')
        .replace(/\s+/g, ' ');
}

function getText(m, body = '') {
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

/*
 * Get the actual WhatsApp member who sent the message.
 * Never use the group JID as the player's ID.
 */
function getSenderId(m) {
    const sender =
        m?.key?.participant ||
        m?.participant ||
        m?.sender ||
        m?.key?.remoteJid;

    if (
        !sender ||
        String(sender).endsWith('@g.us')
    ) {
        return null;
    }

    return String(sender);
}

function isCommand(text) {
    return /^[.!/#]/.test(
        String(text || '').trim()
    );
}

function shuffle(array) {
    const copy = [...array];

    for (
        let i = copy.length - 1;
        i > 0;
        i--
    ) {
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

async function startWordGame(
    sock,
    chatId,
    type,
    rounds = 5
) {
    if (!chatId?.endsWith('@g.us')) {
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
            '❌ A Words Starting/Ending game is already running here.'
        );
    }

    const values = shuffle(
        loadLetters(type)
    );

    if (!values.length) {
        return send(
            sock,
            chatId,
            `❌ No ${type} letters were found in games/${type}.json`
        );
    }

    const count = Math.max(
        1,
        Math.min(
            Number(rounds) || 5,
            values.length
        )
    );

    const game = {
        type,

        values: values.slice(
            0,
            count
        ),

        current: 0,

        scores: {},

        answered: false,

        timer: null,

        nextTimer: null,

        sock
    };

    activeWordGames.set(
        chatId,
        game
    );

    return sendNextWordRound(
        sock,
        chatId
    );
}

async function sendNextWordRound(
    sock,
    chatId
) {
    const game =
        activeWordGames.get(chatId);

    if (!game) {
        return;
    }

    if (
        game.current >=
        game.values.length
    ) {
        return finishWordGame(
            sock,
            chatId
        );
    }

    clearTimers(game);

    game.answered = false;

    const letters =
        game.values[
            game.current
        ];

    const starting =
        game.type === 'starting';

    const title =
        starting
            ? '🔤 WORDS STARTING WITH 🔤'
            : '🔚 WORDS ENDING WITH 🔚';

    const instruction =
        starting
            ? `Give me a word starting with ${letters.toUpperCase()}.`
            : `Give me a word ending with ${letters.toUpperCase()}.`;

    await send(
        sock,
        chatId,
        `┏━━━ ${title} ━━━┓\n` +
        `┃ 🎮 *Round:* ${game.current + 1}/${game.values.length}\n` +
        `┃\n` +
        `┃ 📝 ${instruction}\n` +
        `┃\n` +
        `┃ 🏆 First correct answer gets *+5 points*\n` +
        `┃ ⏱️ Time: *30 seconds*\n` +
        `┗━━━━━━━━━━━━━━━━━━┛`
    );

    game.timer = setTimeout(
        async () => {
            const current =
                activeWordGames.get(
                    chatId
                );

            if (
                !current ||
                current.answered
            ) {
                return;
            }

            current.answered = true;

            const required =
                current.values[
                    current.current
                ];

            await send(
                sock,
                chatId,
                `⏰ *TIME'S UP!*\n\n` +
                `No correct answer this round.\n` +
                `📌 Required ${current.type === 'starting' ? 'starting' : 'ending'} letters: *${required.toUpperCase()}*`
            );

            current.current++;

            current.nextTimer =
                setTimeout(() => {
                    const latest =
                        activeWordGames.get(
                            chatId
                        );

                    if (!latest) {
                        return;
                    }

                    latest.nextTimer = null;

                    sendNextWordRound(
                        latest.sock,
                        chatId
                    ).catch(
                        console.error
                    );
                }, 1500);

        },
        30000
    );
}

async function handleWordGameMessage(
    sock,
    m,
    chatId,
    body = ''
) {
    const game =
        activeWordGames.get(chatId);

    if (!game) {
        return false;
    }

    if (game.answered) {
        return false;
    }

    const text =
        getText(m, body);

    if (!text) {
        return false;
    }

    if (isCommand(text)) {
        return false;
    }

    const answer =
        normalize(text);

    const required =
        normalize(
            game.values[
                game.current
            ]
        );

    if (
        !answer ||
        !required
    ) {
        return false;
    }

    let correct = false;

    if (game.type === 'starting') {
        correct =
            answer.startsWith(required) &&
            answer.length > required.length;
    } else {
        correct =
            answer.endsWith(required) &&
            answer.length > required.length;
    }

    if (!correct) {
        return false;
    }

    /*
     * Get the real member who answered.
     */
    const sender =
        getSenderId(m);

    /*
     * Do NOT award the point if we cannot
     * identify the actual member.
     */
    if (!sender) {
        console.error(
            '[WORDGAME] Could not identify sender:',
            m?.key
        );

        return false;
    }

    /*
     * Lock the round BEFORE sending the
     * winner message so two people cannot
     * score the same round.
     */
    game.answered = true;

    if (game.timer) {
        clearTimeout(game.timer);
        game.timer = null;
    }

    /*
     * Award +5 points to the actual player.
     */
    game.scores[sender] =
        Number(
            game.scores[sender] || 0
        ) + 5;

    console.log(
        `[WORDGAME] +5 points -> ${sender} | ` +
        `total=${game.scores[sender]} | ` +
        `chat=${chatId}`
    );

    await send(
        sock,
        chatId,
        `🎉 *CORRECT ANSWER!*\n\n` +
        `👤 Winner: @${String(sender).split('@')[0]}\n` +
        `✅ Answer: *${text}*\n` +
        `🏆 *+5 points!*\n` +
        `📊 Your game score: *${game.scores[sender]} points*`,
        {
            mentions: [sender]
        }
    );

    game.current++;

    game.nextTimer =
        setTimeout(() => {
            const latest =
                activeWordGames.get(
                    chatId
                );

            if (!latest) {
                return;
            }

            latest.nextTimer = null;

            sendNextWordRound(
                latest.sock,
                chatId
            ).catch(
                console.error
            );

        }, 1500);

    return true;
}

async function finishWordGame(
    sock,
    chatId
) {
    const game =
        activeWordGames.get(chatId);

    if (!game) {
        return;
    }

    clearTimers(game);

    const scores =
        Object.entries(
            game.scores
        ).sort(
            (a, b) =>
                Number(b[1]) -
                Number(a[1])
        );

    let text =
        `🏁 *${
            game.type === 'starting'
                ? 'WORDS STARTING'
                : 'WORDS ENDING'
        } GAME FINISHED!*\n\n`;

    if (!scores.length) {
        text +=
            '😢 Nobody scored any points.';
    } else {
        text +=
            '🏆 *FINAL SCORES*\n\n';

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

    activeWordGames.delete(chatId);

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

async function stopWordGame(
    sock,
    chatId
) {
    const game =
        activeWordGames.get(chatId);

    if (!game) {
        return send(
            sock,
            chatId,
            '❌ No Words Starting/Ending game is active here.'
        );
    }

    clearTimers(game);

    activeWordGames.delete(chatId);

    return send(
        sock,
        chatId,
        '🛑 *Words game stopped.*'
    );
}

const startingCommand = {
    name: 'starting',

    aliases: [
        'wordstarting',
        'wordsstarting'
    ],

    description:
        'Give a word starting with the requested letters',

    async execute(
        sock,
        m,
        from,
        args
    ) {
        if (
            String(
                args?.[0] || ''
            ).toLowerCase() ===
            'stop'
        ) {
            return stopWordGame(
                sock,
                from
            );
        }

        return startWordGame(
            sock,
            from,
            'starting',
            args?.[0] || 5
        );
    }
};

const endingCommand = {
    name: 'ending',

    aliases: [
        'wordending',
        'wordsending'
    ],

    description:
        'Give a word ending with the requested letters',

    async execute(
        sock,
        m,
        from,
        args
    ) {
        if (
            String(
                args?.[0] || ''
            ).toLowerCase() ===
            'stop'
        ) {
            return stopWordGame(
                sock,
                from
            );
        }

        return startWordGame(
            sock,
            from,
            'ending',
            args?.[0] || 5
        );
    }
};

module.exports = [
    startingCommand,
    endingCommand
];

module.exports.handleWordGameMessage =
    handleWordGameMessage;

module.exports.isActive =
    chatId =>
        activeWordGames.has(chatId);

module.exports.stop =
    stopWordGame;
