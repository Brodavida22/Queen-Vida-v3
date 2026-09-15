const fs = require('fs');
const path = require('path');

const activeGames = {}; // { groupJid: sessionData }

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[j], array[i]] = [array[i], array[j]];
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

        if (!fs.existsSync(filePath)) return [];

        const raw = fs.readFileSync(filePath, 'utf8');
        const questions = JSON.parse(raw);

        if (!Array.isArray(questions)) return [];

        if (difficulty === 'all') return questions;

        return questions.filter(
            q =>
                String(q.difficulty || '').toLowerCase() ===
                difficulty
        );
    } catch (e) {
        console.error(`Error loading questions for ${gameType}:`, e);
        return [];
    }
}

/*
 * Clean a player's word list.
 *
 * Supports:
 * river ring right
 * river, ring, right
 * river / ring / right
 * river - ring - right
 */
function extractWords(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z\s,\/-]/g, ' ')
        .split(/[\s,\/-]+/)
        .map(word => word.trim())
        .filter(Boolean);
}

/*
 * Check Words Ending With.
 *
 * Player must provide at least 3 different words,
 * and every word must end with the required ending.
 */
function checkEndingWords(text, ending) {
    const words = extractWords(text);

    if (words.length < 3) {
        return false;
    }

    const uniqueWords = [...new Set(words)];

    if (uniqueWords.length < 3) {
        return false;
    }

    const validWords = uniqueWords.filter(word =>
        word.endsWith(String(ending).toLowerCase())
    );

    return validWords.length >= 3;
}

/*
 * Check Words Starting With.
 *
 * Player must provide at least 3 different words,
 * and every word must start with the required combination.
 */
function checkStartingWords(text, starting) {
    const words = extractWords(text);

    if (words.length < 3) {
        return false;
    }

    const uniqueWords = [...new Set(words)];

    if (uniqueWords.length < 3) {
        return false;
    }

    const validWords = uniqueWords.filter(word =>
        word.startsWith(String(starting).toLowerCase())
    );

    return validWords.length >= 3;
}

/*
 * Check Rhyming Words.
 *
 * Player must provide at least 3 different words
 * that are listed as valid rhymes for the target word.
 */
function checkRhymeWords(text, qData) {
    const words = extractWords(text);

    if (words.length < 3) {
        return false;
    }

    const uniqueWords = [...new Set(words)];

    if (uniqueWords.length < 3) {
        return false;
    }

    const validRhymes = Array.isArray(qData.rhymes)
        ? qData.rhymes.map(word =>
              String(word).toLowerCase().trim()
          )
        : [];

    const targetWord =
        String(qData.word || '').toLowerCase().trim();

    const validWords = uniqueWords.filter(word =>
        validRhymes.includes(word) &&
        word !== targetWord
    );

    return validWords.length >= 3;
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
                '❌ *A game is already active in this group!*\n\n' +
                'Use `.game stop` to end the current game first.'
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
                `❌ No questions found for *${gameType}*` +
                ` at *${validDifficulty}* difficulty.`
        });
        return;
    }

    if (totalRounds > allQuestions.length) {
        await sock.sendMessage(from, {
            text:
                `❌ *Not enough questions!*\n\n` +
                `🎮 Game: *${gameType.toUpperCase()}*\n` +
                `📚 Available: *${allQuestions.length}*\n` +
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
        guess: '🔢 NUMBER GUESSING',
        emoji: '😂 GUESS THE EMOJI',
        couples: '💑 COUPLES CHALLENGE',
        ending: '🔚 WORDS ENDING WITH',
        starting: '🔤 WORDS STARTING WITH',
        rhyme: '🎵 RHYMING WORDS'
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
┃
┃ 🔥 Get ready everybody!
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

    await sock.sendMessage(from, {
        text: startMsg
    });

    setTimeout(() => nextRound(from), 2000);
}

async function stopGame(sock, from) {
    if (!activeGames[from]) {
        await sock.sendMessage(from, {
            text:
                '❌ *No active game session found in this group.*'
        });
        return;
    }

    if (activeGames[from].timer) {
        clearTimeout(activeGames[from].timer);
    }

    delete activeGames[from];

    await sock.sendMessage(from, {
        text:
            '🛑 *Game session has been manually stopped!*'
    });
}

async function nextRound(from) {
    const session = activeGames[from];

    if (!session) return;

    if (session.currentRound >= session.rounds) {
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
        ['trivia', 'quiz'].includes(session.gameType)
            ? 25
            : 45;

    /*
     * TRIVIA / QUIZ
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
`┏━━━ ${emoji} *${label} (Round ${session.currentRound}/${session.rounds})* ${emoji} ━━━┓
${difficultyLabel}┃ ❓ *Question:* ${qData.question}
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🅰️ *A)* ${qData.options.A}
┃ 🅱️ *B)* ${qData.options.B}
┃ 🅲 *C)* ${qData.options.C}
┃ 🅳 *D)* ${qData.options.D}
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ⏱️ *Type A, B, C or D!* (${roundTimeLimit}s)
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }

    /*
     * WORD SCRAMBLE
     */
    else if (session.gameType === 'scramble') {
        const scrambled = qData.word
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
┃ ⏱️ *Unscramble the word!* (${roundTimeLimit}s)
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }

    /*
     * NUMBER GUESS
     */
    else if (session.gameType === 'guess') {
        session.activeQuestion.targetNumber =
            qData.target;

        roundText =
`┏━━━ 🔢 *NUMBER GUESS (Round ${session.currentRound}/${session.rounds})* 🔢 ━━━┓
┃ 🎯 *Guess a number between* ${qData.min} *and* ${qData.max}!
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ⏱️ *Type your number!* (${roundTimeLimit}s)
┃ 💡 Queen Vida will give Higher/Lower hints.
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }

    /*
     * GUESS THE EMOJI
     */
    else if (session.gameType === 'emoji') {
        roundText =
`┏━━━ 😂 *GUESS THE EMOJI (Round ${session.currentRound}/${session.rounds})* 😂 ━━━┓
┃
┃ 🎭 *What does this emoji combination mean?*
┃
┃     ${qData.emoji}
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 💡 *Type your answer in the chat!*
┃ ⏱️ *Time:* 45s
┃ 🏆 *First correct answer gets +5 points!*
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }

    /*
     * COUPLES CHALLENGE
     */
    else if (session.gameType === 'couples') {
        roundText =
`┏━━━ 💑 *COUPLES CHALLENGE* 💑 ━━━┓
┃ 🔥 *Round ${session.currentRound}/${session.rounds}*
┃
┃ 💘 *${qData.challenge}*
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🗳️ *Vote in the chat!*
┃
┃ 👤 Tag the person you choose
┃ ❤️ Be honest!
┃ 😂 No fighting!
┃
┃ ⏱️ *Time:* 45s
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }

    /*
     * WORDS ENDING WITH
     */
    else if (session.gameType === 'ending') {
        roundText =
`┏━━━ 🔚 *WORDS ENDING WITH* 🔚 ━━━┓
┃ 🔥 *Round ${session.currentRound}/${session.rounds}*
┃
┃ 🎯 *Ending:* \`${qData.ending}\`
┃
┃ 📝 Give *3 different words*
┃ that end with *${qData.ending}*
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 💡 Example format:
┃ word1 word2 word3
┃
┃ 🏆 *First correct player gets +5 points!*
┃ ⏱️ *Time:* 45s
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }

    /*
     * WORDS STARTING WITH
     */
    else if (session.gameType === 'starting') {
        roundText =
`┏━━━ 🔤 *WORDS STARTING WITH* 🔤 ━━━┓
┃ 🔥 *Round ${session.currentRound}/${session.rounds}*
┃
┃ 🎯 *Starting:* \`${qData.starting}\`
┃
┃ 📝 Give *3 different words*
┃ that start with *${qData.starting}*
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 💡 Example format:
┃ word1 word2 word3
┃
┃ 🏆 *First correct player gets +5 points!*
┃ ⏱️ *Time:* 45s
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }

    /*
     * RHYMING WORDS
     */
    else if (session.gameType === 'rhyme') {
        roundText =
`┏━━━ 🎵 *RHYMING WORDS* 🎵 ━━━┓
┃ 🔥 *Round ${session.currentRound}/${session.rounds}*
┃
┃ 🎯 *Target Word:* \`${qData.word}\`
┃
┃ 📝 Give *3 different words*
┃ that rhyme with *${qData.word}*
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 💡 Example format:
┃ word1 word2 word3
┃
┃ 🏆 *First correct player gets +5 points!*
┃ ⏱️ *Time:* 45s
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }

    await session.sock.sendMessage(from, {
        text: roundText
    });

    session.timer = setTimeout(() => {
        if (
            !activeGames[from] ||
            session.answeredThisRound
        ) {
            return;
        }

        let timeOutText =
            `⏰ *Time's up!*\n\n`;

        if (
            session.gameType === 'trivia' ||
            session.gameType === 'quiz'
        ) {
            timeOutText +=
                `📌 *Correct Answer:* *${qData.answer}* ` +
                `(${qData.options[qData.answer]})`;
        }

        else if (session.gameType === 'scramble') {
            timeOutText +=
                `📌 *Correct Word:* *${qData.word}*`;
        }

        else if (session.gameType === 'guess') {
            timeOutText +=
                `📌 *Secret Number:* *${qData.target}*`;
        }

        else if (session.gameType === 'emoji') {
            timeOutText +=
                `📌 *Answer:* *${qData.answer}*`;
        }

        else if (session.gameType === 'couples') {
            timeOutText +=
                `💑 *Challenge closed!*\n` +
                `🔥 Get ready for the next one!`;
        }

        else if (session.gameType === 'ending') {
            timeOutText +=
                `📌 *Required ending:* \`${qData.ending}\`\n` +
                `📝 *You needed 3 different words ending with it.*`;
        }

        else if (session.gameType === 'starting') {
            timeOutText +=
                `📌 *Required beginning:* \`${qData.starting}\`\n` +
                `📝 *You needed 3 different words starting with it.*`;
        }

        else if (session.gameType === 'rhyme') {
            const rhymeList =
                Array.isArray(qData.rhymes)
                    ? qData.rhymes.slice(0, 8).join(', ')
                    : '';

            timeOutText +=
                `📌 *Target Word:* \`${qData.word}\`\n` +
                `🎵 *Possible rhymes:* ${rhymeList}`;
        }

        session.sock.sendMessage(from, {
            text: timeOutText
        });

        setTimeout(
            () => nextRound(from),
            3000
        );
    }, roundTimeLimit * 1000);
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
        String(text || '').trim();

    const upperText =
        cleanText.toUpperCase();

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
            ['A', 'B', 'C', 'D'].includes(
                upperText
            ) &&
            upperText ===
                String(q.answer).toUpperCase()
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
            upperText ===
            String(
                q.targetWord || q.word
            ).toUpperCase()
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
                num ===
                q.targetNumber
            ) {
                isCorrect = true;
            } else {
                const hintDir =
                    num <
                    q.targetNumber
                        ? '📈 *Higher!*'
                        : '📉 *Lower!*';

                await sock.sendMessage(
                    from,
                    {
                        text:
                            `❌ *${num}* is wrong!\n` +
                            `${hintDir} Try again!`
                    },
                    { quoted: m }
                );

                return true;
            }
        }
    }

    /*
     * GUESS THE EMOJI
     */
    else if (
        session.gameType === 'emoji'
    ) {
        const answer =
            String(
                q.answer || ''
            )
            .trim()
            .toLowerCase();

        const playerAnswer =
            cleanText.toLowerCase();

        if (
            playerAnswer &&
            answer &&
            (
                playerAnswer === answer ||
                playerAnswer.includes(answer) ||
                answer.includes(playerAnswer)
            )
        ) {
            isCorrect = true;
        }
    }

    /*
     * COUPLES CHALLENGE
     */
    else if (
        session.gameType === 'couples'
    ) {
        if (
            cleanText.length >= 2
        ) {
            isCorrect = true;
        }
    }

    /*
     * WORDS ENDING WITH
     */
    else if (
        session.gameType === 'ending'
    ) {
        if (
            checkEndingWords(
                cleanText,
                q.ending
            )
        ) {
            isCorrect = true;
        }
    }

    /*
     * WORDS STARTING WITH
     */
    else if (
        session.gameType === 'starting'
    ) {
        if (
            checkStartingWords(
                cleanText,
                q.starting
            )
        ) {
            isCorrect = true;
        }
    }

    /*
     * RHYMING WORDS
     */
    else if (
        session.gameType === 'rhyme'
    ) {
        if (
            checkRhymeWords(
                cleanText,
                q
            )
        ) {
            isCorrect = true;
        }
    }

    /*
     * WINNER / SCORE
     */
    if (isCorrect) {
        session.answeredThisRound = true;

        if (session.timer) {
            clearTimeout(session.timer);
        }

        session.scores[sender] =
            (session.scores[sender] || 0) +
            5;

        let winAnnouncement =
`🎉 *ROUND COMPLETE!*

👑 @${sender.replace(/[^0-9]/g, '')} wins this round and gets *+5 Points!*

🏆 *Current Scores:*`;

        const sortedScores =
            Object.entries(
                session.scores
            ).sort(
                (a, b) => b[1] - a[1]
            );

        sortedScores.forEach(
            ([user, pts], index) => {
                winAnnouncement +=
                    `\n${index + 1}. @${user.replace(
                        /[^0-9]/g,
                        ''
                    )} — *${pts} pts*`;
            }
        );

        if (
            session.gameType === 'couples'
        ) {
            winAnnouncement =
`🔥 *VOTE RECEIVED!*

👤 @${sender.replace(/[^0-9]/g, '')} has voted!

💎 *+5 Points*

🏆 *Current Scores:*`;

            sortedScores.forEach(
                ([user, pts], index) => {
                    winAnnouncement +=
                        `\n${index + 1}. @${user.replace(
                            /[^0-9]/g,
                            ''
                        )} — *${pts} pts*`;
                }
            );
        }

        if (
            session.gameType === 'ending'
        ) {
            winAnnouncement =
`🔥 *CORRECT!*

👑 @${sender.replace(/[^0-9]/g, '')} gave 3 valid words!

📝 *Ending:* \`${q.ending}\`

💎 *+5 Points*

🏆 *Current Scores:*`;

            sortedScores.forEach(
                ([user, pts], index) => {
                    winAnnouncement +=
                        `\n${index + 1}. @${user.replace(
                            /[^0-9]/g,
                            ''
                        )} — *${pts} pts*`;
                }
            );
        }

        if (
            session.gameType === 'starting'
        ) {
            winAnnouncement =
`🔥 *CORRECT!*

👑 @${sender.replace(/[^0-9]/g, '')} gave 3 valid words!

📝 *Starting:* \`${q.starting}\`

💎 *+5 Points*

🏆 *Current Scores:*`;

            sortedScores.forEach(
                ([user, pts], index) => {
                    winAnnouncement +=
                        `\n${index + 1}. @${user.replace(
                            /[^0-9]/g,
                            ''
                        )} — *${pts} pts*`;
                }
            );
        }

        if (
            session.gameType === 'rhyme'
        ) {
            winAnnouncement =
`🔥 *CORRECT!*

👑 @${sender.replace(/[^0-9]/g, '')} gave 3 valid rhyming words!

🎯 *Target:* \`${q.word}\`

💎 *+5 Points*

🏆 *Current Scores:*`;

            sortedScores.forEach(
                ([user, pts], index) => {
                    winAnnouncement +=
                        `\n${index + 1}. @${user.replace(
                            /[^0-9]/g,
                            ''
                        )} — *${pts} pts*`;
                }
            );
        }

        await sock.sendMessage(
            from,
            {
                text: winAnnouncement,
                mentions:
                    sortedScores.map(
                        ([user]) => user
                    )
            },
            { quoted: m }
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

    if (!session) return;

    if (session.timer) {
        clearTimeout(session.timer);
    }

    const sortedScores =
        Object.entries(
            session.scores
        ).sort(
            (a, b) => b[1] - a[1]
        );

    let finalDashboard =
`┏━━━ 🏆 *GAME OVER* 🏆 ━━━┓
┃ 🎮 *Game Session Completed!*
┣━━━━━━━━━━━━━━━━━━━━━━━`;

    if (
        sortedScores.length === 0
    ) {
        finalDashboard +=
            `\n┃ ❌ *Nobody scored this game.*`;
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
                    `\n┃ ${medal} ${index + 1}. @${user.replace(
                        /[^0-9]/g,
                        ''
                    )} — *${pts} Points*`;
            }
        );

        const winner =
            sortedScores[0][0];

        finalDashboard +=
            `\n┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `┃ 👑 *WINNER:* @${winner.replace(
                /[^0-9]/g,
                ''
            )} 🎉`;
    }

    finalDashboard +=
        `\n┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

    await session.sock.sendMessage(
        from,
        {
            text: finalDashboard,
            mentions:
                sortedScores.map(
                    ([user]) => user
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
