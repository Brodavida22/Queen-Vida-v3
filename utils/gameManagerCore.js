const fs = require('fs');
const path = require('path');

const activeGames = {}; // { groupJid: sessionData }

/*
 * ============================================================
 * GAME TIMER HELPERS
 * ============================================================
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

    clearGameTimer(session, 'nextRoundTimer');

    session.nextRoundTimer = setTimeout(() => {
        const currentSession = activeGames[from];

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

        timer: null,
        nextRoundTimer: null,
        finishTimer: null,
        startTimer: null,

        stopped: false,

        answeredThisRound: false,

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

    session.stopped = true;

    clearAllGameTimers(session);

    session.activeQuestion = null;
    session.answeredThisRound = true;

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

    session.nextRoundTimer = null;

    if (session.currentRound >= session.rounds) {
        return endGame(from);
    }

    session.currentRound++;

    session.answeredThisRound = false;

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

    const currentSessionAfterSend =
        activeGames[from];

    if (
        !currentSessionAfterSend ||
        currentSessionAfterSend.stopped
    ) {
        return;
    }

    clearGameTimer(
        currentSessionAfterSend,
        'timer'
    );

    currentSessionAfterSend.timer =
        setTimeout(async () => {

            const currentSession =
                activeGames[from];

            if (
                !currentSession ||
                currentSession.stopped
            ) {
                return;
            }

            currentSession.timer = null;

            if (
                currentSession.gameType ===
                'truthordare'
            ) {
                await finishTruthOrDareRound(from);
                return;
            }

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
                const answer =
                    String(q.answer || '')
                        .trim()
                        .toUpperCase();

                const optionKey =
                    answer.match(/[A-D]/)?.[0] ||
                    answer;

                timeOutText +=
                    `📌 *Correct Answer was:* *${optionKey}* ` +
                    `(${q.options?.[optionKey] || ''})`;
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

    /*
     * Get the actual WhatsApp member.
     */
    const sender =
        m?.key?.participant ||
        m?.participant ||
        m?.sender ||
        m?.key?.senderPn ||
        m?.key?.participantPn;

    /*
     * In a group, never use the group JID
     * as the player's identity.
     */
    if (
        !sender ||
        (
            from.endsWith('@g.us') &&
            sender === from
        )
    ) {
        return false;
    }


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
     * Existing games use one winner per round.
     */

    if (session.answeredThisRound) {
        return false;
    }

    const cleanText =
        String(text || '')
            .trim()
            .toUpperCase();

    if (!cleanText) {
        return false;
    }

    const q =
        session.activeQuestion;

    let isCorrect = false;


    /*
     * ========================================================
     * TRIVIA / QUIZ
     * ========================================================
     */

    if (
        session.gameType === 'trivia' ||
        session.gameType === 'quiz'
    ) {
        const correctAnswer =
            String(q?.answer || '')
                .trim()
                .toUpperCase()
                .match(/[A-D]/)?.[0] || '';

        /*
         * Accept:
         *
         * A
         * a
         * A)
         * A.
         * A:
         * Option A
         * Option: A
         * Answer A
         * Answer: A
         */
        const submittedMatch =
            cleanText.match(
                /(?:OPTION|ANSWER)?\s*[:.]?\s*([A-D])\b/
            );

        const submittedChoice =
            submittedMatch?.[1] ||
            (
                /^[A-D]$/.test(cleanText)
                    ? cleanText
                    : ''
            );

        if (
            correctAnswer &&
            submittedChoice === correctAnswer
        ) {
            isCorrect = true;
        }
    }


    /*
     * ========================================================
     * SCRAMBLE
     * ========================================================
     */

    else if (
        session.gameType === 'scramble'
    ) {
        const targetWord =
            String(
                q?.targetWord ||
                q?.word ||
                ''
            )
                .trim()
                .toUpperCase();

        const submittedWord =
            cleanText
                .replace(/\s+/g, '');

        const expectedWord =
            targetWord
                .replace(/\s+/g, '');

        if (
            expectedWord &&
            submittedWord === expectedWord
        ) {
            isCorrect = true;
        }
    }


    /*
     * ========================================================
     * NUMBER GUESS
     * ========================================================
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
     * ========================================================
     * CORRECT ANSWER
     * ========================================================
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

        clearGameTimer(
            currentSession,
            'timer'
        );

        clearGameTimer(
            currentSession,
            'nextRoundTimer'
        );

        /*
         * Add 5 points to the actual player.
         */
        currentSession.scores[sender] =
            Number(
                currentSession.scores[sender] || 0
            ) + 5;

        const playerPoints =
            currentSession.scores[sender];

        let winAnnouncement =
`🎉 *Correct!*
@${sender.replace(/[^0-9]/g, '')} guessed right and earned *+5 Points*!

💎 *Your Total:* ${playerPoints} pts

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
    if (
        activeGames[from] !== session ||
        session.stopped
    ) {
        return false;
    }

    const cleanText =
        String(text || '').trim();

    if (!cleanText) {
        return false;
    }

    if (
        session.truthDareParticipants.has(
            sender
        )
    ) {
        return false;
    }

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
        Number(
            session.scores[sender] || 0
        ) + reward;

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

    const currentSession =
        activeGames[from];

    if (
        !currentSession ||
        currentSession.stopped
    ) {
        return true;
    }

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
