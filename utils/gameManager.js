const fs = require('fs');
const path = require('path');

const activeGames = {}; // { groupJid: sessionData }

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function loadQuestions(gameType, difficulty = 'all') {
    try {
        const filePath = path.join(
            __dirname,
            '..',
            'games',
            `${gameType}.json`
        );

        if (!fs.existsSync(filePath)) {
            return [];
        }

        const raw = fs.readFileSync(filePath, 'utf8');
        const questions = JSON.parse(raw);

        if (!Array.isArray(questions)) {
            return [];
        }

        if (difficulty === 'all') {
            return questions;
        }

        return questions.filter(
            q =>
                String(q.difficulty || '').toLowerCase() ===
                difficulty
        );
    } catch (error) {
        console.error(
            `❌ Error loading questions for ${gameType}:`,
            error
        );

        return [];
    }
}

async function startGame(
    sock,
    from,
    gameType,
    totalRounds,
    difficulty = 'all'
) {
    if (activeGames[from]) {
        await sock.sendMessage(from, {
            text:
                '❌ A game is already active in this group!\n\n' +
                'Use *.game stop* to end it first.'
        });

        return;
    }

    const validDifficulty = [
        'easy',
        'medium',
        'hard',
        'all'
    ].includes(difficulty)
        ? difficulty
        : 'all';

    const allQuestions = loadQuestions(
        gameType,
        validDifficulty
    );

    if (allQuestions.length === 0) {
        await sock.sendMessage(from, {
            text:
                `❌ No questions found for *${gameType}* ` +
                `at *${validDifficulty}* difficulty.`
        });

        return;
    }

    if (totalRounds > allQuestions.length) {
        await sock.sendMessage(from, {
            text:
                `❌ *Not enough questions!*\n\n` +
                `🎮 Game: *${gameType.toUpperCase()}*\n` +
                `📚 Difficulty: *${validDifficulty.toUpperCase()}*\n` +
                `❓ Available: *${allQuestions.length}*\n` +
                `🎯 Requested: *${totalRounds}*`
        });

        return;
    }

    const sessionQuestions = shuffle([
        ...allQuestions
    ]).slice(0, totalRounds);

    activeGames[from] = {
        gameType,
        difficulty: validDifficulty,
        rounds: sessionQuestions.length,
        currentRound: 0,
        questions: sessionQuestions,
        scores: {},
        activeQuestion: null,
        timer: null,
        answeredThisRound: false,
        sock
    };

    const gameTitles = {
        trivia: '🎯 TRIVIA SHOWDOWN',
        quiz: '🧠 QUIZ CHALLENGE',
        scramble: '🔤 WORD SCRAMBLE',
        guess: '🔢 NUMBER GUESSING'
    };

    const gameTitle =
        gameTitles[gameType] ||
        gameType.toUpperCase();

    const roundDuration =
        ['trivia', 'quiz'].includes(gameType)
            ? '25s'
            : '45s';

    const difficultyText =
        ['trivia', 'quiz'].includes(gameType)
            ? `┃ 🎚️ *Difficulty:* ${
                  validDifficulty === 'all'
                      ? 'MIXED'
                      : validDifficulty.toUpperCase()
              }\n`
            : '';

    const startMsg =
`┏━━━ 🎮 *QUEEN VIDA GAME SUITE* 🎮 ━━━┓
┃ 🏆 *Game:* ${gameTitle}
┃ 🔄 *Total Rounds:* ${sessionQuestions.length}
${difficultyText}┃ ⏱️ *Time Limit:* ${roundDuration} Per Round
┃ 💎 *Reward:* 5 Points / Correct Answer
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🚀 *Game session is starting now!*
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

    await sock.sendMessage(from, {
        text: startMsg
    });

    setTimeout(
        () => nextRound(from),
        2000
    );
}

async function stopGame(sock, from) {
    if (!activeGames[from]) {
        await sock.sendMessage(from, {
            text:
                '❌ No active game session found in this group.'
        });

        return;
    }

    if (activeGames[from].timer) {
        clearTimeout(
            activeGames[from].timer
        );
    }

    delete activeGames[from];

    await sock.sendMessage(from, {
        text:
            '🛑 *Game session has been manually stopped!*'
    });
}

async function nextRound(from) {
    const session = activeGames[from];

    if (!session) {
        return;
    }

    if (
        session.currentRound >=
        session.rounds
    ) {
        return endGame(from);
    }

    session.currentRound++;
    session.answeredThisRound = false;

    const qData =
        session.questions[
            session.currentRound - 1
        ];

    session.activeQuestion = qData;

    let roundText = '';

    const roundTimeLimit =
        ['trivia', 'quiz'].includes(
            session.gameType
        )
            ? 25
            : 45;

    /*
     * ================================
     * TRIVIA / QUIZ
     * ================================
     */

    if (
        session.gameType === 'trivia' ||
        session.gameType === 'quiz'
    ) {
        const label =
            session.gameType === 'trivia'
                ? 'TRIVIA'
                : 'QUIZ';

        const emoji =
            session.gameType === 'trivia'
                ? '🎯'
                : '🧠';

        const difficultyLabel =
            qData.difficulty
                ? `┃ 🎚️ *Difficulty:* ${qData.difficulty.toUpperCase()}\n`
                : '';

        roundText =
`┏━━━ ${emoji} *${label}* ${emoji} ━━━┓
┃
┃ 📍 *Round ${session.currentRound}/${session.rounds}*
${difficultyLabel}┃
┃ ❓ *${qData.question}*
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🅰️ *A)* ${qData.options.A}
┃ 🅱️ *B)* ${qData.options.B}
┃ 🅲 *C)* ${qData.options.C}
┃ 🅳 *D)* ${qData.options.D}
┣━━━━━━━━━━━━━━━━━━━━━━━
┃
┃ ⏱️ *You have ${roundTimeLimit} seconds!*
┃ 💡 *Reply with A, B, C, or D.*
┃
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

    /*
     * ================================
     * WORD SCRAMBLE
     * ================================
     */

    } else if (
        session.gameType === 'scramble'
    ) {
        const scrambled =
            qData.word
                .split('')
                .sort(
                    () =>
                        Math.random() - 0.5
                )
                .join(' ');

        session.activeQuestion.targetWord =
            qData.word;

        roundText =
`┏━━━ 🔤 *WORD SCRAMBLE* 🔤 ━━━┓
┃
┃ 📍 *Round ${session.currentRound}/${session.rounds}*
┃
┃ 🔀 *Scrambled:* ${scrambled}
┃ 💡 *Hint:* ${qData.hint}
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ⏱️ *You have ${roundTimeLimit} seconds!*
┃ ✍️ *Type the correct word!*
┃
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

    /*
     * ================================
     * NUMBER GUESS
     * ================================
     */

    } else if (
        session.gameType === 'guess'
    ) {
        session.activeQuestion.targetNumber =
            qData.target;

        roundText =
`┏━━━ 🔢 *NUMBER GUESS* 🔢 ━━━┓
┃
┃ 📍 *Round ${session.currentRound}/${session.rounds}*
┃
┃ 🎯 Guess the number between
┃ *${qData.min}* and *${qData.max}*
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ⏱️ *You have ${roundTimeLimit} seconds!*
┃ 💡 *Type your guessed number!*
┃
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }

    await session.sock.sendMessage(
        from,
        {
            text: roundText
        }
    );

    /*
     * ================================
     * ROUND TIMER
     * ================================
     */

    session.timer = setTimeout(
        async () => {
            if (
                !activeGames[from] ||
                session.answeredThisRound
            ) {
                return;
            }

            let timeOutText =
                `⏰ *TIME'S UP!*\n\n` +
                `❌ Nobody got this round.\n`;

            if (
                session.gameType === 'trivia' ||
                session.gameType === 'quiz'
            ) {
                timeOutText +=
                    `\n📌 *Correct Answer:* ` +
                    `*${qData.answer}* — ` +
                    `${qData.options[qData.answer]}`;
            }

            else if (
                session.gameType === 'scramble'
            ) {
                timeOutText +=
                    `\n📌 *Correct Word:* ` +
                    `*${qData.word}*`;
            }

            else if (
                session.gameType === 'guess'
            ) {
                timeOutText +=
                    `\n📌 *Secret Number:* ` +
                    `*${qData.target}*`;
            }

            await session.sock.sendMessage(
                from,
                {
                    text: timeOutText
                }
            );

            setTimeout(
                () => nextRound(from),
                3000
            );
        },
        roundTimeLimit * 1000
    );
}

async function handleGameMessage(
    sock,
    m,
    from,
    text
) {
    const session = activeGames[from];

    if (
        !session ||
        session.answeredThisRound ||
        !session.activeQuestion
    ) {
        return false;
    }

    const sender =
        m.key.participant ||
        m.key.remoteJid;

    const cleanText =
        String(text || '')
            .trim()
            .toUpperCase();

    const q =
        session.activeQuestion;

    let isCorrect = false;

    /*
     * ================================
     * TRIVIA / QUIZ ANSWERS
     * ================================
     */

    if (
        session.gameType === 'trivia' ||
        session.gameType === 'quiz'
    ) {
        /*
         * Only A, B, C or D can be accepted.
         */

        if (
            ['A', 'B', 'C', 'D'].includes(
                cleanText
            )
        ) {
            if (
                cleanText ===
                String(q.answer)
                    .trim()
                    .toUpperCase()
            ) {
                isCorrect = true;
            }
        }

    /*
     * ================================
     * SCRAMBLE ANSWERS
     * ================================
     */

    } else if (
        session.gameType === 'scramble'
    ) {
        if (
            cleanText ===
            String(
                q.targetWord
            ).toUpperCase()
        ) {
            isCorrect = true;
        }

    /*
     * ================================
     * NUMBER GUESS ANSWERS
     * ================================
     */

    } else if (
        session.gameType === 'guess'
    ) {
        const num =
            parseInt(
                cleanText,
                10
            );

        if (!isNaN(num)) {
            if (
                num ===
                q.targetNumber
            ) {
                isCorrect = true;
            } else {
                const hint =
                    num < q.targetNumber
                        ? '📈 *Higher!*'
                        : '📉 *Lower!*';

                await sock.sendMessage(
                    from,
                    {
                        text:
                            `❌ *${num}* is wrong!\n` +
                            `${hint} Try again!`
                    },
                    {
                        quoted: m
                    }
                );

                return true;
            }
        }
    }

    /*
     * ================================
     * CORRECT ANSWER
     * ================================
     */

    if (isCorrect) {
        session.answeredThisRound = true;

        if (session.timer) {
            clearTimeout(
                session.timer
            );
        }

        session.scores[sender] =
            (session.scores[sender] || 0) +
            5;

        const sortedScores =
            Object.entries(
                session.scores
            ).sort(
                (a, b) =>
                    b[1] - a[1]
            );

        let winAnnouncement =
`🎉 *CORRECT ANSWER!* 🎉

👑 @${sender.replace(
    /[^0-9]/g,
    ''
)} got it right!

💎 *+5 POINTS*

🏆 *CURRENT SCORES:*`;

        sortedScores.forEach(
            ([user, points], index) => {
                winAnnouncement +=
                    `\n${index + 1}. @${user.replace(
                        /[^0-9]/g,
                        ''
                    )} — *${points} pts*`;
            }
        );

        await sock.sendMessage(
            from,
            {
                text:
                    winAnnouncement,
                mentions:
                    sortedScores.map(
                        ([user]) =>
                            user
                    )
            },
            {
                quoted: m
            }
        );

        setTimeout(
            () => nextRound(from),
            3000
        );

        return true;
    }

    return false;
}

async function endGame(from) {
    const session =
        activeGames[from];

    if (!session) {
        return;
    }

    if (session.timer) {
        clearTimeout(
            session.timer
        );
    }

    const sortedScores =
        Object.entries(
            session.scores
        ).sort(
            (a, b) =>
                b[1] - a[1]
        );

    let finalDashboard =
`┏━━━ 🏆 *GAME OVER* 🏆 ━━━┓
┃
┃ 🎮 *GAME COMPLETED!*
┃
┣━━━━━━━━━━━━━━━━━━━━━━━`;

    if (
        sortedScores.length === 0
    ) {
        finalDashboard +=
            `\n┃ ❌ *Nobody scored points this session.*`;
    } else {
        finalDashboard +=
            `\n┃ 🏆 *FINAL LEADERBOARD:*`;

        sortedScores.forEach(
            ([user, points], index) => {
                const medal =
                    index === 0
                        ? '🥇'
                        : index === 1
                        ? '🥈'
                        : index === 2
                        ? '🥉'
                        : '▪️';

                finalDashboard +=
                    `\n┃ ${medal} ${
                        index + 1
                    }. @${user.replace(
                        /[^0-9]/g,
                        ''
                    )} — *${points} Points*`;
            }
        );

        const winner =
            sortedScores[0][0];

        finalDashboard +=
            `\n┃\n┃ 👑 *WINNER:* @${winner.replace(
                /[^0-9]/g,
                ''
            )} 🎉`;
    }

    finalDashboard +=
        `\n┃\n┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

    await session.sock.sendMessage(
        from,
        {
            text:
                finalDashboard,
            mentions:
                sortedScores.map(
                    ([user]) =>
                        user
                )
        }
    );

    delete activeGames[from];
}

function isGameActive(from) {
    return !!activeGames[from];
}

module.exports = {
    startGame,
    stopGame,
    handleGameMessage,
    isGameActive
};
