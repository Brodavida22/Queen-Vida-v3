/**
 * ============================================================
 * QUEEN VIDA V3
 * GAME MANAGER CORE
 * ============================================================
 *
 * Handles:
 * - Trivia
 * - Quiz
 * - Scramble
 *
 * FIXES:
 * - Correctly identifies the actual group member answering
 * - Prevents group JID from being used as a player
 * - Accepts A, B, C, D in different formats
 * - Case-insensitive answers
 * - Ignores commands while a round is active
 * - Prevents duplicate answers
 * - Correctly adds +5 points
 * - Keeps scores per player during the game
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

const activeGames = new Map();


/*
 * ============================================================
 * LOAD GAME DATA
 * ============================================================
 */

function loadGameData(name) {
    try {
        const filePath = path.join(
            __dirname,
            '..',
            'games',
            `${name}.json`
        );

        if (!fs.existsSync(filePath)) {
            console.error(
                `❌ [GAME] Missing games/${name}.json`
            );

            return [];
        }

        const data = JSON.parse(
            fs.readFileSync(filePath, 'utf8')
        );

        if (Array.isArray(data)) {
            return data;
        }

        if (Array.isArray(data.questions)) {
            return data.questions;
        }

        return [];

    } catch (error) {
        console.error(
            `❌ [GAME] Failed loading ${name}.json:`,
            error
        );

        return [];
    }
}


/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

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


function isCommand(text) {
    return /^[.!/#]/.test(
        String(text || '').trim()
    );
}


/*
 * IMPORTANT:
 * In WhatsApp groups:
 *
 * m.key.remoteJid = GROUP JID
 * m.key.participant = ACTUAL MEMBER JID
 *
 * Never use remoteJid as the player ID when it is
 * a group message.
 */
function getSenderId(m) {
    const participant =
        m?.key?.participant ||
        m?.participant ||
        m?.sender ||
        m?.key?.participantAlt ||
        null;

    if (
        participant &&
        typeof participant === 'string' &&
        !participant.endsWith('@g.us')
    ) {
        return participant;
    }

    const remoteJid =
        m?.key?.remoteJid ||
        m?.remoteJid ||
        null;

    /*
     * Never score the group itself.
     */
    if (
        !remoteJid ||
        typeof remoteJid !== 'string' ||
        remoteJid.endsWith('@g.us')
    ) {
        return null;
    }

    return remoteJid;
}


/*
 * Normalize WhatsApp JID variants.
 */
function normalizeJid(jid) {
    if (!jid) {
        return null;
    }

    return String(jid)
        .replace(/:\d+(?=@)/, '')
        .trim();
}


/*
 * ============================================================
 * PLAYER NAME
 * ============================================================
 */

function getPlayerName(m, sender) {
    return (
        m?.pushName ||
        m?.verifiedBizName ||
        sender?.split('@')[0] ||
        'Player'
    );
}


/*
 * ============================================================
 * SEND MESSAGE
 * ============================================================
 */

async function send(sock, jid, text) {
    if (!sock || !jid) {
        return;
    }

    try {
        await sock.sendMessage(jid, {
            text: String(text)
        });
    } catch (error) {
        console.error(
            '❌ [GAME SEND ERROR]:',
            error.message || error
        );
    }
}


/*
 * ============================================================
 * TIMER HELPERS
 * ============================================================
 */

function clearGameTimer(game, timerName) {
    if (
        game &&
        game[timerName]
    ) {
        clearTimeout(game[timerName]);
        game[timerName] = null;
    }
}


function clearAllTimers(game) {
    if (!game) {
        return;
    }

    clearGameTimer(game, 'timer');
    clearGameTimer(game, 'nextRoundTimer');
}


/*
 * ============================================================
 * NORMALIZE ANSWERS
 * ============================================================
 */

function normalizeAnswer(text) {
    return String(text || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ' ');
}


/*
 * ============================================================
 * TRIVIA / QUIZ OPTION NORMALIZER
 * ============================================================
 *
 * Accepts:
 *
 * A
 * a
 * A)
 * A.
 * Option A
 * option a
 * Answer A
 *
 * But still allows normal text when required.
 * ============================================================
 */

function normalizeOption(text) {
    const value = normalizeAnswer(text);

    const match = value.match(
        /^(?:OPTION|ANSWER)?\s*([ABCD])(?:[\)\.\:\-]|\s|$)/
    );

    if (!match) {
        return value;
    }

    return match[1];
}


/*
 * ============================================================
 * CHECK ANSWER
 * ============================================================
 */

function isCorrectAnswer(game, question, text) {
    if (!question) {
        return false;
    }

    const cleanText =
        normalizeAnswer(text);

    /*
     * --------------------------------------------------------
     * SCRAMBLE
     * --------------------------------------------------------
     */

    if (game.type === 'scramble') {
        const target =
            question.targetWord ||
            question.answer ||
            question.word ||
            '';

        return (
            cleanText ===
            normalizeAnswer(target)
        );
    }


    /*
     * --------------------------------------------------------
     * TRIVIA / QUIZ
     * --------------------------------------------------------
     */

    const expected =
        question.answer ??
        question.correctAnswer ??
        question.correct ??
        question.option ??
        '';

    if (!expected) {
        return false;
    }

    /*
     * If answer is A/B/C/D, allow flexible formats.
     */
    const expectedNormalized =
        normalizeOption(expected);

    const suppliedNormalized =
        normalizeOption(text);

    if (
        ['A', 'B', 'C', 'D'].includes(
            expectedNormalized
        )
    ) {
        return (
            suppliedNormalized ===
            expectedNormalized
        );
    }

    /*
     * If the JSON contains the full answer text,
     * compare the text itself.
     */
    return (
        cleanText ===
        normalizeAnswer(expected)
    );
}


/*
 * ============================================================
 * GET QUESTION TEXT
 * ============================================================
 */

function getQuestionText(question) {
    return (
        question?.question ||
        question?.q ||
        question?.text ||
        question?.clue ||
        ''
    );
}


/*
 * ============================================================
 * GET OPTIONS
 * ============================================================
 */

function getOptions(question) {
    if (Array.isArray(question?.options)) {
        return question.options;
    }

    if (Array.isArray(question?.choices)) {
        return question.choices;
    }

    return [];
}


/*
 * ============================================================
 * FORMAT QUESTION
 * ============================================================
 */

function formatQuestion(game) {
    const question =
        game.questions[game.current];

    if (!question) {
        return '';
    }

    const questionText =
        getQuestionText(question);

    const options =
        getOptions(question);

    let output =
        `🎮 *${game.type.toUpperCase()}*\n\n`;

    if (questionText) {
        output +=
            `❓ ${questionText}\n`;
    }

    if (options.length) {
        output += '\n';

        options.forEach((option, index) => {
            const letter =
                String.fromCharCode(
                    65 + index
                );

            output +=
                `${letter}. ${option}\n`;
        });
    }

    if (game.type === 'scramble') {
        const scrambled =
            question.scrambled ||
            question.scramble ||
            question.word ||
            question.question ||
            '';

        output =
            `🔤 *SCRAMBLE*\n\n` +
            `Unscramble this word:\n\n` +
            `👉 *${scrambled}*\n`;
    }

    output +=
        '\n⏳ You have 30 seconds!';

    return output;
}


/*
 * ============================================================
 * START GAME
 * ============================================================
 */

async function startGame(
    sock,
    jid,
    type,
    questions
) {
    if (!Array.isArray(questions) || !questions.length) {
        await send(
            sock,
            jid,
            `❌ No questions found for ${type}.`
        );

        return false;
    }

    /*
     * Stop an existing game in this group.
     */
    const existing =
        activeGames.get(jid);

    if (existing) {
        clearAllTimers(existing);
    }

    const game = {
        type,
        jid,
        questions: [...questions],
        current: 0,
        scores: {},
        answeredThisRound: false,
        timer: null,
        nextRoundTimer: null,
        startedAt: Date.now()
    };

    activeGames.set(
        jid,
        game
    );

    /*
     * Shuffle questions.
     */
    for (
        let i = game.questions.length - 1;
        i > 0;
        i--
    ) {
        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [
            game.questions[i],
            game.questions[j]
        ] = [
            game.questions[j],
            game.questions[i]
        ];
    }

    await sendNextRound(
        sock,
        game
    );

    return true;
}


/*
 * ============================================================
 * SEND NEXT ROUND
 * ============================================================
 */

async function sendNextRound(
    sock,
    game
) {
    if (!game) {
        return;
    }

    if (
        !activeGames.has(game.jid) ||
        activeGames.get(game.jid) !== game
    ) {
        return;
    }

    if (
        game.current >=
        game.questions.length
    ) {
        await finishGame(
            sock,
            game.jid
        );

        return;
    }

    clearAllTimers(game);

    game.answeredThisRound = false;

    const question =
        game.questions[game.current];

    const message =
        formatQuestion(game);

    await send(
        sock,
        game.jid,
        message
    );

    game.timer =
        setTimeout(
            async () => {
                try {
                    if (
                        !activeGames.has(game.jid) ||
                        activeGames.get(game.jid) !== game
                    ) {
                        return;
                    }

                    if (
                        game.answeredThisRound
                    ) {
                        return;
                    }

                    game.answeredThisRound =
                        true;

                    await send(
                        sock,
                        game.jid,
                        `⏰ Time's up!\n\n` +
                        `The answer was: *${
                            question.answer ||
                            question.correctAnswer ||
                            question.targetWord ||
                            'Unknown'
                        }*`
                    );

                    game.nextRoundTimer =
                        setTimeout(
                            async () => {
                                game.current++;

                                await sendNextRound(
                                    sock,
                                    game
                                );
                            },
                            2000
                        );

                } catch (error) {
                    console.error(
                        '🔥 [GAME TIMER ERROR]:',
                        error
                    );
                }
            },
            30000
        );
}


/*
 * ============================================================
 * HANDLE GAME ANSWER
 * ============================================================
 */

async function handleGameMessage(
    sock,
    m,
    from,
    body = ''
) {
    try {
        if (
            !from ||
            typeof from !== 'string'
        ) {
            return false;
        }

        const game =
            activeGames.get(from);

        /*
         * No active game in this chat.
         */
        if (!game) {
            return false;
        }

        const text =
            getText(
                m,
                body
            );

        if (!text) {
            return false;
        }

        /*
         * Commands must go to the normal command handler.
         */
        if (isCommand(text)) {
            return false;
        }

        /*
         * Round already answered.
         */
        if (
            game.answeredThisRound
        ) {
            return true;
        }

        /*
         * IMPORTANT FIX:
         * Get the actual WhatsApp member who sent
         * the answer.
         */
        const rawSender =
            getSenderId(m);

        const sender =
            normalizeJid(
                rawSender
            );

        /*
         * Never award a score to the group JID.
         */
        if (
            !sender ||
            sender.endsWith('@g.us')
        ) {
            console.warn(
                '⚠️ [GAME] Could not identify actual player:',
                {
                    remoteJid:
                        m?.key?.remoteJid,
                    participant:
                        m?.key?.participant
                }
            );

            /*
             * Consume the answer so it doesn't fall
             * through into unrelated handlers, but do
             * not create a fake score.
             */
            return true;
        }

        const question =
            game.questions[
                game.current
            ];

        if (!question) {
            return true;
        }

        /*
         * Check answer.
         */
        const correct =
            isCorrectAnswer(
                game,
                question,
                text
            );

        if (!correct) {
            return true;
        }

        /*
         * ----------------------------------------------------
         * CORRECT ANSWER
         * ----------------------------------------------------
         */

        game.answeredThisRound =
            true;

        clearGameTimer(
            game,
            'timer'
        );

        clearGameTimer(
            game,
            'nextRoundTimer'
        );

        /*
         * ACTUAL SCORE UPDATE
         */
        game.scores[sender] =
            (
                game.scores[sender] ||
                0
            ) + 5;

        const playerName =
            getPlayerName(
                m,
                sender
            );

        console.log(
            `✅ [GAME] ${game.type} correct answer`,
            {
                group: from,
                player: sender,
                name: playerName,
                score: game.scores[sender],
                round: game.current + 1
            }
        );

        await send(
            sock,
            from,
            `🎉 *Correct!*\n\n` +
            `👤 ${playerName}\n` +
            `⭐ +5 points\n` +
            `🏆 Score: *${game.scores[sender]}*`
        );

        /*
         * Move to next question.
         */
        game.nextRoundTimer =
            setTimeout(
                async () => {
                    try {
                        if (
                            !activeGames.has(from) ||
                            activeGames.get(from) !== game
                        ) {
                            return;
                        }

                        game.current++;

                        await sendNextRound(
                            sock,
                            game
                        );

                    } catch (error) {
                        console.error(
                            '🔥 [NEXT ROUND ERROR]:',
                            error
                        );
                    }
                },
                2000
            );

        return true;

    } catch (error) {
        console.error(
            '🔥 [GAME ANSWER ERROR]:',
            error
        );

        return false;
    }
}


/*
 * ============================================================
 * FINISH GAME
 * ============================================================
 */

async function finishGame(
    sock,
    jid
) {
    const game =
        activeGames.get(jid);

    if (!game) {
        return false;
    }

    clearAllTimers(game);

    const entries =
        Object.entries(
            game.scores
        );

    entries.sort(
        (a, b) =>
            b[1] - a[1]
    );

    let message =
        `🏁 *${game.type.toUpperCase()} FINISHED!*\n\n`;

    if (!entries.length) {
        message +=
            `😔 Nobody scored any points.`;
    } else {
        message +=
            `🏆 *FINAL SCORES*\n\n`;

        entries.forEach(
            ([jidKey, score], index) => {
                const number =
                    jidKey.split('@')[0];

                message +=
                    `${index + 1}. @${number} — *${score} points*\n`;
            }
        );
    }

    await send(
        sock,
        jid,
        message
    );

    activeGames.delete(jid);

    return true;
}


/*
 * ============================================================
 * STOP GAME
 * ============================================================
 */

function stopGame(jid) {
    const game =
        activeGames.get(jid);

    if (!game) {
        return false;
    }

    clearAllTimers(game);

    activeGames.delete(jid);

    return true;
}


/*
 * ============================================================
 * GET ACTIVE GAME
 * ============================================================
 */

function getActiveGame(jid) {
    return activeGames.get(jid) || null;
}


/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    activeGames,

    startGame,

    handleGameMessage,

    finishGame,

    stopGame,

    getActiveGame,

    getSenderId,

    normalizeAnswer,

    normalizeOption,

    isCorrectAnswer
};
