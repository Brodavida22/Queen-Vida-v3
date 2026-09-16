const fs = require('fs');
const path = require('path');

const activeGames = {}; // { groupJid: sessionData }

/*
 * ============================================================
 * GAME TIMER HELPERS
 * ============================================================
 *
 * Every delayed game action is stored inside the session.
 * This allows `.game stop` to cancel ALL pending timers.
 */

function clearGameTimer(session, timerName) {
    if (!session) return;

    if (session[timerName]) {
        clearTimeout(session[timerName]);
        session[timerName] = null;
    }
}

function clearAllGameTimers(session) {
    if (!session) return;

    clearGameTimer(session, 'timer');
    clearGameTimer(session, 'nextRoundTimer');
    clearGameTimer(session, 'finishTimer');
    clearGameTimer(session, 'startTimer');
}

function scheduleNextRound(from, delay = 3000) {
    const session = activeGames[from];

    if (!session || session.stopped) return;

    // Prevent duplicate next-round timers
    clearGameTimer(session, 'nextRoundTimer');

    session.nextRoundTimer = setTimeout(() => {
        const currentSession = activeGames[from];

        // Game was stopped or replaced
        if (!currentSession || currentSession.stopped) {
            return;
        }

        currentSession.nextRoundTimer = null;

        nextRound(from);
    }, delay);
}


/*
 * ============================================================
 * SHUFFLE
 * ============================================================
 */

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [array[i], array[j]] = [
            array[j],
            array[i]
        ];
    }

    return array;
}


/*
 * ============================================================
 * LOAD QUESTIONS
 * ============================================================
 */

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

        const raw = fs.readFileSync(
            filePath,
            'utf8'
        );

        const questions = JSON.parse(raw);

        if (!Array.isArray(questions)) {
            return [];
        }

        if (difficulty === 'all') {
            return questions;
        }

        return questions.filter(
            q =>
                String(q.difficulty || '')
                    .toLowerCase() === difficulty
        );

    } catch (e) {
        console.error(
            `Error loading questions for ${gameType}:`,
            e
        );

        return [];
    }
}


/*
 * ============================================================
 * START GAME
 * ============================================================
 */

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
                '❌ A game is already active in this group! ' +
                'Use `.game stop` to end it first.'
        });

        return;
    }

    gameType = String(
        gameType || ''
    ).toLowerCase();

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

    const sessionQuestions =
        shuffle([...allQuestions])
            .slice(0, totalRounds);

    activeGames[from] = {
        gameType,
        difficulty: validDifficulty,

        rounds: sessionQuestions.length,
        currentRound: 0,

        questions: sessionQuestions,

        scores: {},

        activeQuestion: null,

        // Main round timer
        timer: null,

        // All delayed timers are tracked
        nextRoundTimer: null,
        finishTimer: null,
        startTimer: null,

        // Prevents any delayed callback
        // from continuing after `.game stop`
        stopped: false,

        // Existing games
        answeredThisRound: false,

        // Truth or Dare
        truthDareParticipants: new Set(),
        truthDareWinners: [],

        sock
    };

    const gameTitles = {
        trivia: '🎯 TRIVIA SHOWDOWN',
        quiz: '🧠 QUIZ CHALLENGE',
        scramble: '🔤 WORD SCRAMBLE',
        guess: '🔢 NUMBER GUESSING',
        truthordare: '🔥 TRUTH OR DARE'
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

    let rewardText =
        '💎 *Reward:* 5 Points / Correct Answer';

    if (gameType === 'truthordare') {
        rewardText =
            '💎 *Rewards:* 🥇 10 pts • 🥈 5 pts • 🥉 3 pts\n' +
            '┃ 👥 *Everyone can answer!*';
    }

    const startMsg =
`┏━━━ 🎮 *QUEEN VIDA GAME SUITE* 🎮 ━━━┓
┃ 🏆 *Game:* ${gameTitle}
┃ 🔄 *Total Rounds:* ${sessionQuestions.length}
${difficultyText}┃ ⏱️ *Time Limit:* ${roundDuration} Per Round
┃ ${rewardText}
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🚀 *Game session is starting now!*
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

    await sock.sendMessage(from, {
        text: startMsg
    });

    const session = activeGames[from];

    if (!session || session.stopped) {
        return;
    }

    /*
     * Store the starting delay so `.game stop`
     * can cancel it.
     */
    session.startTimer = setTimeout(() => {
        const currentSession = activeGames[from];

        if (!currentSession || currentSession.stopped) {
            return;
        }

        currentSession.startTimer = null;

        nextRound(from);

    }, 2000);
}


/*
 * ============================================================
 * STOP GAME
 * ============================================================
 */

async function stopGame(sock, from) {
    const session = activeGames[from];

    if (!session) {
        await sock.sendMessage(from, {
            text:
                '❌ No active game session found in this group.'
        });

        return;
    }

    /*
     * Mark it stopped FIRST.
     *
     * This is important because even if a callback is
     * already waiting in the event loop, it will see
     * session.stopped === true and immediately exit.
     */
    session.stopped = true;

    /*
     * Cancel EVERY timer belonging to this game.
     */
    clearAllGameTimers(session);

    /*
     * Remove the active question immediately.
     */
    session.activeQuestion = null;

    /*
     * Reset round state.
     */
    session.answeredThisRound = true;

    /*
     * Remove the game from activeGames.
     *
     * Any delayed callback that somehow fires afterward
     * will find no active session and stop immediately.
     */
    delete activeGames[from];

    await sock.sendMessage(from, {
        text:
            '🛑 *Game session has been manually stopped by an admin/creator!*\n\n' +
            '✅ All game timers have been cancelled.\n' +
            '✅ No more rounds will start.'
    });
}


/*
 * ============================================================
 * NEXT ROUND
 * ============================================================
 */

async function nextRound(from) {
    const session = activeGames[from];

    if (!session || session.stopped) {
        return;
    }

    /*
     * Make sure there isn't an old timer still attached.
     */
    session.nextRoundTimer = null;

    if (session.currentRound >= session.rounds) {
        return endGame(from);
    }

    session.currentRound++;

    session.answeredThisRound = false;

    /*
     * Reset Truth or Dare round data.
     */
    session.truthDareParticipants =
        new Set();

    session.truthDareWinners = [];

    const qData =
        session.questions[
            session.currentRound - 1
        ];

    if (!qData) {
        return endGame(from);
    }

    session.activeQuestion = qData;

    let roundText = '';

    const roundTimeLimit =
        ['trivia', 'quiz'].includes(
            session.gameType
        )
            ? 25
            : 45;


    /*
     * ========================================================
     * TRIVIA / QUIZ
     * ========================================================
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
                ? `┃ 🎚️ *Difficulty:* ${
                    qData.difficulty.toUpperCase()
                }\n`
                : '';

        roundText =
`┏━━━ ${emoji} *${label} (Round ${session.currentRound}/${session.rounds})* ${emoji} ━━━┓
${difficultyLabel}┃ ❓ *Question:* ${qData.question}
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🅰️ *A)* ${qData.options.A}
┃ 🅱️ *B)* ${qData.options.B}
┃ 🅲 *C)* ${qData.options.C}
┃ 🅳 *D)* ${qData.options.D}
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ⏱️ *Type your answer option (A, B, C, or D)!* (${roundTimeLimit}s)
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    /*
     * ========================================================
     * SCRAMBLE
     * ========================================================
     */

    else if (
        session.gameType === 'scramble'
    ) {
        const scrambled =
            qData.word
                .split('')
                .sort(() => Math.random() - 0.5)
                .join(' ');

        session.activeQuestion.targetWord =
            qData.word;

        roundText =
`┏━━━ 🔤 *WORD SCRAMBLE (Round ${session.currentRound}/${session.rounds})* 🔤 ━━━┓
┃ 🔀 *Scrambled:* \`${scrambled}\`
┃ 💡 *Hint:* ${qData.hint}
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ⏱️ *Type the correct unscrambled word below!* (${roundTimeLimit}s)
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    /*
     * ========================================================
     * NUMBER GUESS
     * ========================================================
     */

    else if (
        session.gameType === 'guess'
    ) {
        session.activeQuestion.targetNumber =
            qData.target;

        roundText =
`┏━━━ 🔢 *NUMBER GUESS (Round ${session.currentRound}/${session.rounds})* 🔢 ━━━┓
┃ 🎯 *Guess the number between* ${qData.min} *and* ${qData.max}!
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ⏱️ *Type your guessed number in chat!* (${roundTimeLimit}s - Bot gives hints)
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    /*
     * ========================================================
     * TRUTH OR DARE
     * ========================================================
     */

    else if (
        session.gameType === 'truthordare'
    ) {
        const type =
            String(qData.type || '')
                .toLowerCase();

        const isTruth =
            type === 'truth';

        roundText =
`┏━━━ 🔥 *TRUTH OR DARE* 🔥 ━━━┓
┃ 🎮 *Round:* ${session.currentRound}/${session.rounds}
┃ ${isTruth ? '🧠' : '🎯'} *${isTruth ? 'TRUTH' : 'DARE'}*
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ❓ *${qData.question}*
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 👥 *EVERYONE CAN ANSWER!*
┃ 🥇 First valid answer: *+10 pts*
┃ 🥈 Second valid answer: *+5 pts*
┃ 🥉 Third valid answer: *+3 pts*
┃ ⏱️ *You have ${roundTimeLimit} seconds!*
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    /*
     * ========================================================
     * SEND ROUND
     * ========================================================
     */

    await session.sock.sendMessage(from, {
        text: roundText
    });

    /*
     * The game could theoretically be stopped while
     * sendMessage was running.
     */
    const currentSessionAfterSend =
        activeGames[from];

    if (
        !currentSessionAfterSend ||
        currentSessionAfterSend.stopped
    ) {
        return;
    }


    /*
     * ========================================================
     * ROUND TIMER
     * ========================================================
     */

    clearGameTimer(
        currentSessionAfterSend,
        'timer'
    );

    currentSessionAfterSend.timer =
        setTimeout(async () => {

            const currentSession =
                activeGames[from];

            /*
             * STOP SAFETY CHECK
             */
            if (
                !currentSession ||
                currentSession.stopped
            ) {
                return;
            }

            currentSession.timer = null;

            /*
             * Truth or Dare has a different
             * round-ending system.
             */
            if (
                currentSession.gameType ===
                'truthordare'
            ) {
                await finishTruthOrDareRound(from);
                return;
            }

            /*
             * Someone already answered.
             */
            if (
                currentSession.answeredThisRound
            ) {
                return;
            }

            let timeOutText =
                `⏰ *Time's up!* No one guessed correctly this round.\n`;

            const q =
                currentSession.activeQuestion;

            if (!q) {
                return;
            }

            if (
                currentSession.gameType === 'trivia' ||
                currentSession.gameType === 'quiz'
            ) {
                timeOutText +=
                    `📌 *Correct Answer was:* *${q.answer}* ` +
                    `(${q.options[q.answer]})`;
            }

            else if (
                currentSession.gameType === 'scramble'
            ) {
                timeOutText +=
                    `📌 *Correct Word was:* *${q.word}*`;
            }

            else if (
                currentSession.gameType === 'guess'
            ) {
                timeOutText +=
                    `📌 *Secret Number was:* *${q.target}*`;
            }

            await currentSession.sock.sendMessage(
                from,
                {
                    text: timeOutText
                }
            );

            /*
             * Check AGAIN after sending.
             * The admin could have stopped the game
             * while the message was being sent.
             */
            const sessionAfterTimeout =
                activeGames[from];

            if (
                !sessionAfterTimeout ||
                sessionAfterTimeout.stopped
            ) {
                return;
            }

            scheduleNextRound(from, 3000);

        }, roundTimeLimit * 1000);
}


/*
 * ============================================================
 * HANDLE GAME MESSAGE
 * ============================================================
 */

async function handleGameMessage(
    sock,
    m,
    from,
    text
) {
    const session =
        activeGames[from];

    if (
        !session ||
        session.stopped ||
        !session.activeQuestion
    ) {
        return false;
    }

    const sender =
        m.key.participant ||
        m.key.remoteJid;


    /*
     * ========================================================
     * TRUTH OR DARE
     * ========================================================
     */

    if (
        session.gameType === 'truthordare'
    ) {
        return handleTruthOrDareMessage(
            sock,
            m,
            from,
            text,
            session,
            sender
        );
    }


    /*
     * Existing games use the original
     * one-winner system.
     */

    if (session.answeredThisRound) {
        return false;
    }

    const cleanText =
        String(text || '')
            .trim()
            .toUpperCase();

    const q =
        session.activeQuestion;

    let isCorrect = false;


    /*
     * TRIVIA / QUIZ
     */

    if (
        session.gameType === 'trivia' ||
        session.gameType === 'quiz'
    ) {
        if (
            ['A', 'B', 'C', 'D'].includes(cleanText) &&
            cleanText === q.answer
        ) {
            isCorrect = true;
        }
    }


    /*
     * SCRAMBLE
     */

    else if (
        session.gameType === 'scramble'
    ) {
        if (
            cleanText ===
            String(q.targetWord || '')
                .toUpperCase()
        ) {
            isCorrect = true;
        }
    }


    /*
     * NUMBER GUESS
     */

    else if (
        session.gameType === 'guess'
    ) {
        const num =
            parseInt(cleanText, 10);

        if (!isNaN(num)) {

            if (
                num === q.targetNumber
            ) {
                isCorrect = true;
            }

            else {
                const hintDir =
                    num < q.targetNumber
                        ? '📈 *Higher!*'
                        : '📉 *Lower!*';

                await sock.sendMessage(
                    from,
                    {
                        text:
                            `❌ *${num}* is wrong! ` +
                            `${hintDir} Try again!`
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
     * CORRECT ANSWER
     */

    if (isCorrect) {

        const currentSession =
            activeGames[from];

        if (
            !currentSession ||
            currentSession.stopped
        ) {
            return false;
        }

        currentSession.answeredThisRound =
            true;

        /*
         * Cancel the current round timer.
         */
        clearGameTimer(
            currentSession,
            'timer'
        );

        /*
         * Also cancel an old pending next-round
         * timer if one somehow exists.
         */
        clearGameTimer(
            currentSession,
            'nextRoundTimer'
        );

        currentSession.scores[sender] =
            (currentSession.scores[sender] || 0) + 5;

        let winAnnouncement =
`🎉 *Correct!*
@${sender.replace(/[^0-9]/g, '')} guessed right and earned *+5 Points*!

🏆 *Current Scores:*`;

        const sortedScores =
            Object.entries(
                currentSession.scores
            ).sort(
                (a, b) => b[1] - a[1]
            );

        sortedScores.forEach(
            ([user, pts], index) => {

                winAnnouncement +=
                    `\n${index + 1}. @${user.replace(/[^0-9]/g, '')} — *${pts} pts*`;
            }
        );

        await sock.sendMessage(
            from,
            {
                text: winAnnouncement,
                mentions: sortedScores.map(
                    ([user]) => user
                )
            },
            {
                quoted: m
            }
        );

        /*
         * Check again after sending.
         */
        const sessionAfterWin =
            activeGames[from];

        if (
            !sessionAfterWin ||
            sessionAfterWin.stopped
        ) {
            return true;
        }

        scheduleNextRound(from, 3000);

        return true;
    }

    return false;
}


/*
 * ============================================================
 * TRUTH OR DARE MESSAGE
 * ============================================================
 */

async function handleTruthOrDareMessage(
    sock,
    m,
    from,
    text,
    session,
    sender
) {
    /*
     * Make sure this session is still the active
     * session in the group.
     */
    if (
        activeGames[from] !== session ||
        session.stopped
    ) {
        return false;
    }

    const cleanText =
        String(text || '').trim();

    /*
     * Ignore empty messages.
     */
    if (!cleanText) {
        return false;
    }

    /*
     * A player can only score once per round.
     */
    if (
        session.truthDareParticipants.has(
            sender
        )
    ) {
        return false;
    }

    /*
     * Only first 3 participants receive points.
     */
    if (
        session.truthDareWinners.length >= 3
    ) {
        return false;
    }

    const position =
        session.truthDareWinners.length;

    const rewards = [
        10,
        5,
        3
    ];

    const reward =
        rewards[position];

    session.truthDareParticipants.add(
        sender
    );

    session.truthDareWinners.push({
        user: sender,
        points: reward,
        answer: cleanText
    });

    session.scores[sender] =
        (session.scores[sender] || 0) + reward;

    const place =
        position === 0
            ? '🥇 FIRST'
            : position === 1
                ? '🥈 SECOND'
                : '🥉 THIRD';

    await sock.sendMessage(
        from,
        {
            text:
`🔥 *TRUTH OR DARE — ${place}!*

🎉 @${sender.replace(/[^0-9]/g, '')}
💎 *+${reward} Points!*

👥 *Players can still answer!*
${
    session.truthDareWinners.length >= 3
        ? '🏁 All 3 scoring positions are now filled!'
        : '⚡ There is still a scoring position available!'
}`,
            mentions: [sender]
        },
        {
            quoted: m
        }
    );

    /*
     * Check whether the game was stopped
     * while the message was being sent.
     */
    const currentSession =
        activeGames[from];

    if (
        !currentSession ||
        currentSession.stopped
    ) {
        return true;
    }

    /*
     * Once all 3 positions are filled,
     * finish the round after 1.5 seconds.
     */
    if (
        session.truthDareWinners.length >= 3
    ) {
        clearGameTimer(
            session,
            'timer'
        );

        clearGameTimer(
            session,
            'finishTimer'
        );

        session.finishTimer =
            setTimeout(() => {

                const current =
                    activeGames[from];

                if (
                    !current ||
                    current.stopped
                ) {
                    return;
                }

                current.finishTimer = null;

                finishTruthOrDareRound(from);

            }, 1500);
    }

    return true;
}


/*
 * ============================================================
 * FINISH TRUTH OR DARE ROUND
 * ============================================================
 */

async function finishTruthOrDareRound(from) {
    const session =
        activeGames[from];

    if (
        !session ||
        session.stopped
    ) {
        return;
    }

    clearGameTimer(
        session,
        'timer'
    );

    clearGameTimer(
        session,
        'finishTimer'
    );

    const winners =
        session.truthDareWinners || [];

    let roundResult =
`┏━━━ 🔥 *TRUTH OR DARE ROUND OVER* 🔥 ━━━┓`;

    if (winners.length === 0) {

        roundResult +=
`
┃ ⏰ *Time's up!*
┃ ❌ Nobody answered this round.
`;

    } else {

        roundResult +=
`
┃ 🏆 *ROUND WINNERS:*`;

        winners.forEach(
            (winner, index) => {

                const medal =
                    index === 0
                        ? '🥇'
                        : index === 1
                            ? '🥈'
                            : '🥉';

                roundResult +=
                    `\n┃ ${medal} @${winner.user.replace(/[^0-9]/g, '')} — *+${winner.points} pts*`;
            }
        );

        roundResult +=
`
┃
┃ 👥 *Other answers received no points this round.*
`;
    }

    roundResult +=
`
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🏆 *CURRENT LEADERBOARD:*`;

    const sortedScores =
        Object.entries(
            session.scores
        ).sort(
            (a, b) => b[1] - a[1]
        );

    if (sortedScores.length === 0) {

        roundResult +=
            `\n┃ No points yet.`;

    } else {

        sortedScores.forEach(
            ([user, pts], index) => {

                roundResult +=
                    `\n┃ ${index + 1}. @${user.replace(/[^0-9]/g, '')} — *${pts} pts*`;
            }
        );
    }

    roundResult +=
`
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

    await session.sock.sendMessage(
        from,
        {
            text: roundResult,
            mentions: sortedScores.map(
                ([user]) => user
            )
        }
    );

    /*
     * Check again after sending.
     */
    const currentSession =
        activeGames[from];

    if (
        !currentSession ||
        currentSession.stopped
    ) {
        return;
    }

    currentSession.activeQuestion =
        null;

    /*
     * Use the central scheduler.
     */
    scheduleNextRound(from, 3000);
}


/*
 * ============================================================
 * END GAME
 * ============================================================
 */

async function endGame(from) {
    const session =
        activeGames[from];

    if (
        !session ||
        session.stopped
    ) {
        return;
    }

    /*
     * Clear every remaining timer.
     */
    clearAllGameTimers(session);

    const sortedScores =
        Object.entries(
            session.scores
        ).sort(
            (a, b) => b[1] - a[1]
        );

    let finalDashboard =
`┏━━━ 🏆 *GAME OVER - FINAL LEADERBOARD* 🏆 ━━━┓
┃ 🎮 *Game Session Completed Successfully!*
┣━━━━━━━━━━━━━━━━━━━━━━━`;

    if (sortedScores.length === 0) {

        finalDashboard +=
            `\n┃ ❌ *No players scored any points this session.*`;

    } else {

        sortedScores.forEach(
            ([user, pts], index) => {

                const medal =
                    index === 0
                        ? '🥇'
                        : index === 1
                            ? '🥈'
                            : index === 2
                                ? '🥉'
                                : '▪️';

                finalDashboard +=
                    `\n┃ ${medal} ${index + 1}. @${user.replace(/[^0-9]/g, '')} — *${pts} Points*`;
            }
        );

        const winner =
            sortedScores[0][0];

        finalDashboard +=
            `\n┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `┃ 👑 *WINNER:* @${winner.replace(/[^0-9]/g, '')} 🎉`;
    }

    finalDashboard +=
        `\n┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

    await session.sock.sendMessage(
        from,
        {
            text: finalDashboard,
            mentions: sortedScores.map(
                ([user]) => user
            )
        }
    );

    /*
     * Make absolutely sure all timers are gone.
     */
    clearAllGameTimers(session);

    session.stopped = true;
    session.activeQuestion = null;

    delete activeGames[from];
}


/*
 * ============================================================
 * CHECK GAME STATUS
 * ============================================================
 */

function isGameActive(from) {
    const session =
        activeGames[from];

    return !!(
        session &&
        !session.stopped
    );
}


/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    startGame,
    stopGame,
    handleGameMessage,
    isGameActive
};
