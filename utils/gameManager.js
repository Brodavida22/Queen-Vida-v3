const fs = require('fs');
const path = require('path');

const activeGames = {};


// ============================================================
// VALID GAMES
// ============================================================

const VALID_GAMES = [
    'trivia',
    'quiz',
    'scramble',
    'guess',
    'emoji',
    'couples',
    'findemoji',
    'ending',
    'starting',
    'rhyme',
    'movemoji',
    '2truth1lie',
    'lyrics',
    'taboo',
    'memewar'
];


// ============================================================
// RANDOM SHUFFLE
// ============================================================

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
}


// ============================================================
// NORMALIZE JID
// ============================================================

function normalizeJid(jid) {
    return String(jid || '')
        .split(':')[0]
        .trim();
}


// ============================================================
// LOAD QUESTIONS
// ============================================================

function loadQuestions(gameType, difficulty = 'all') {
    try {
        const filePath = path.join(
            __dirname,
            '..',
            'games',
            `${gameType}.json`
        );

        if (!fs.existsSync(filePath)) {
            console.error(`❌ Game file not found: ${gameType}.json`);
            return [];
        }

        const raw = fs.readFileSync(filePath, 'utf8');
        const questions = JSON.parse(raw);

        if (!Array.isArray(questions)) {
            console.error(`❌ ${gameType}.json is not an array.`);
            return [];
        }

        if (difficulty === 'all') {
            return questions;
        }

        return questions.filter(q =>
            String(q.difficulty || '')
                .toLowerCase() === difficulty.toLowerCase()
        );

    } catch (error) {
        console.error(
            `🔥 Error loading questions for ${gameType}:`,
            error
        );

        return [];
    }
}


// ============================================================
// TEXT NORMALIZER
// ============================================================

function normalizeText(text) {
    return String(text || '')
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ');
}


// ============================================================
// DISPLAY NAME
// ============================================================

function mentionNumber(jid) {
    return normalizeJid(jid)
        .replace(/[^0-9]/g, '');
}


// ============================================================
// GAME TITLE
// ============================================================

function getGameTitle(gameType) {
    const titles = {
        trivia: '🎯 TRIVIA SHOWDOWN',
        quiz: '🧠 QUIZ CHALLENGE',
        scramble: '🔤 WORD SCRAMBLE',
        guess: '🔢 NUMBER GUESS',
        emoji: '🤯 GUESS THE EMOJI',
        couples: '❤️ COUPLES CHALLENGE',
        findemoji: '🔎 FIND THE EMOJI',
        ending: '🔚 WORDS THAT END WITH',
        starting: '🔤 WORDS THAT START WITH',
        rhyme: '🎵 RHYMING WORDS',
        movemoji: '🎬 EMOJI MOVIE',
        '2truth1lie': '🕵️ 2 TRUTHS 1 LIE',
        lyrics: '🎵 FINISH THE LINE',
        taboo: '🚫 TABOO',
        memewar: '😂 MEME WAR'
    };

    return titles[gameType] || String(gameType).toUpperCase();
}


// ============================================================
// GET GROUP PARTICIPANTS
// ============================================================

async function getGroupPlayers(sock, from) {
    try {
        if (!String(from).endsWith('@g.us')) {
            return [];
        }

        const metadata = await sock.groupMetadata(from);

        if (!metadata || !Array.isArray(metadata.participants)) {
            return [];
        }

        const botJid = normalizeJid(sock.user?.id);

        return metadata.participants
            .map(p => p.id)
            .filter(Boolean)
            .filter(jid => normalizeJid(jid) !== botJid);

    } catch (error) {
        console.error('❌ Could not get group participants:', error);
        return [];
    }
}


// ============================================================
// CHOOSE TABOO DESCRIBER
// ============================================================

async function chooseTabooDescriber(sock, from, previous = null) {
    const players = await getGroupPlayers(sock, from);

    if (!players.length) {
        return null;
    }

    let available = players;

    if (players.length > 1 && previous) {
        available = players.filter(
            jid => normalizeJid(jid) !== normalizeJid(previous)
        );
    }

    if (!available.length) {
        available = players;
    }

    return available[
        Math.floor(Math.random() * available.length)
    ];
}


// ============================================================
// START GAME
// ============================================================

async function startGame(
    sock,
    from,
    gameType,
    totalRounds,
    difficulty = 'all',
    customArg = null
) {
    gameType = String(gameType || '').toLowerCase();

    if (!VALID_GAMES.includes(gameType)) {
        await sock.sendMessage(from, {
            text:
                `❌ *Invalid game!*\n\n` +
                `Use `.game list` to see all available games.`
        });

        return;
    }

    if (activeGames[from]) {
        await sock.sendMessage(from, {
            text:
                '❌ *A game is already active in this group!*\n\n' +
                'Use `.game stop` to end the current game first.'
        });

        return;
    }

    // Taboo requires a group because players need to participate.
    if (
        gameType === 'taboo' &&
        !String(from).endsWith('@g.us')
    ) {
        await sock.sendMessage(from, {
            text:
                '❌ *Taboo can only be played inside a group.*'
        });

        return;
    }

    const validDifficulty = [
        'easy',
        'medium',
        'hard',
        'all'
    ].includes(String(difficulty).toLowerCase())
        ? String(difficulty).toLowerCase()
        : 'all';

    let allQuestions = loadQuestions(
        gameType,
        validDifficulty
    );

    // --------------------------------------------------------
    // CUSTOM WORD
    // --------------------------------------------------------

    if (
        ['ending', 'starting', 'rhyme'].includes(gameType) &&
        customArg
    ) {
        const custom = normalizeText(customArg);

        if (gameType === 'ending') {
            allQuestions = allQuestions.filter(
                q => normalizeText(q.ending) === custom
            );
        }

        if (gameType === 'starting') {
            allQuestions = allQuestions.filter(
                q => normalizeText(q.starting) === custom
            );
        }

        if (gameType === 'rhyme') {
            allQuestions = allQuestions.filter(
                q => normalizeText(q.word) === custom
            );
        }
    }

    if (!allQuestions.length) {
        await sock.sendMessage(from, {
            text:
                `❌ *No questions found!*\n\n` +
                `🎮 Game: *${getGameTitle(gameType)}*\n` +
                `🎚️ Difficulty: *${validDifficulty.toUpperCase()}*`
        });

        return;
    }

    let rounds = parseInt(totalRounds, 10);

    if (isNaN(rounds)) {
        rounds = 10;
    }

    rounds = Math.max(
        1,
        Math.min(rounds, allQuestions.length)
    );

    const sessionQuestions = shuffle([
        ...allQuestions
    ]).slice(0, rounds);

    activeGames[from] = {
        gameType,
        difficulty: validDifficulty,
        customArg,
        rounds: sessionQuestions.length,
        currentRound: 0,
        questions: sessionQuestions,
        scores: {},
        activeQuestion: null,
        timer: null,
        answeredThisRound: false,
        sock,

        // Taboo
        tabooDescriber: null,
        previousTabooDescriber: null
    };

    const roundDuration =
        ['trivia', 'quiz'].includes(gameType)
            ? 25
            : 45;

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
┃ 🏆 *Game:* ${getGameTitle(gameType)}
┃ 🔄 *Total Rounds:* ${sessionQuestions.length}
${difficultyText}┃ ⏱️ *Time Limit:* ${roundDuration}s Per Round
┃ 💎 *Reward:* 5 Points / Correct Answer
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🚀 *Game session is starting!*
┃ 🔥 Get ready...
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

    await sock.sendMessage(from, {
        text: startMsg
    });

    setTimeout(() => {
        nextRound(from);
    }, 2000);
}


// ============================================================
// STOP GAME
// ============================================================

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
            '🛑 *Game session stopped!*\n\n' +
            'The game has been cancelled by an admin/creator.'
    });
}


// ============================================================
// NEXT ROUND
// ============================================================

async function nextRound(from) {
    const session = activeGames[from];

    if (!session) {
        return;
    }

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


    // ========================================================
    // TRIVIA / QUIZ
    // ========================================================

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
`┏━━━ ${emoji} *${label} — ROUND ${session.currentRound}/${session.rounds}* ${emoji} ━━━┓
${difficultyLabel}┃ ❓ *Question:*
┃ ${qData.question}
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🅰️ *A)* ${qData.options?.A || ''}
┃ 🅱️ *B)* ${qData.options?.B || ''}
┃ 🅲 *C)* ${qData.options?.C || ''}
┃ 🅳 *D)* ${qData.options?.D || ''}
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ⏱️ *Reply A, B, C or D*
┃ ⚡ ${roundTimeLimit} seconds!
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    // ========================================================
    // SCRAMBLE
    // ========================================================

    else if (session.gameType === 'scramble') {
        const word =
            qData.word ||
            qData.targetWord ||
            '';

        let letters = word.split('');

        shuffle(letters);

        let scrambled = letters.join(' ');

        if (
            normalizeText(
                scrambled.replace(/\s/g, '')
            ) === normalizeText(word)
        ) {
            letters.reverse();
            scrambled = letters.join(' ');
        }

        session.activeQuestion.targetWord = word;

        roundText =
`┏━━━ 🔤 *WORD SCRAMBLE — ROUND ${session.currentRound}/${session.rounds}* 🔤 ━━━┓
┃ 🔀 *Scrambled Word:*
┃ \`${scrambled}\`
┃
┃ 💡 *Hint:* ${qData.hint || 'No hint'}
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ⏱️ Unscramble it!
┃ ⚡ ${roundTimeLimit} seconds!
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    // ========================================================
    // NUMBER GUESS
    // ========================================================

    else if (session.gameType === 'guess') {
        const target =
            qData.target ??
            qData.answer ??
            qData.number;

        session.activeQuestion.targetNumber =
            Number(target);

        roundText =
`┏━━━ 🔢 *NUMBER GUESS — ROUND ${session.currentRound}/${session.rounds}* 🔢 ━━━┓
┃ 🎯 Guess a number between
┃ *${qData.min}* and *${qData.max}*
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 💡 The bot will tell you
┃ whether to go HIGHER or LOWER.
┃
┃ ⏱️ *${roundTimeLimit} seconds!*
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    // ========================================================
    // GUESS THE EMOJI
    // ========================================================

    else if (session.gameType === 'emoji') {
        roundText =
`┏━━━ 🤯 *GUESS THE EMOJI* — ROUND ${session.currentRound}/${session.rounds} ━━━┓
┃
┃ ${qData.emoji || ''}
┃
┃ 🤔 *What does this emoji represent?*
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 💬 Type your answer!
┃ ⚡ ${roundTimeLimit} seconds!
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    // ========================================================
    // COUPLES
    // ========================================================

    else if (session.gameType === 'couples') {
        roundText =
`┏━━━ ❤️ *COUPLES CHALLENGE* — ROUND ${session.currentRound}/${session.rounds} ❤️ ━━━┓
┃
┃ 💕 *Challenge:*
┃ ${qData.challenge || ''}
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 👥 Everyone can participate!
┃ 💬 Drop your answer/vote below.
┃ ⚡ First valid response gets 5 points!
┃ ⏱️ ${roundTimeLimit} seconds!
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    // ========================================================
    // FIND EMOJI
    // ========================================================

    else if (session.gameType === 'findemoji') {
        roundText =
`┏━━━ 🔎 *FIND THE EMOJI* — ROUND ${session.currentRound}/${session.rounds} ━━━┓
┃
┃ ${qData.emojis || ''}
┃
┃ 👀 *Find the odd/different emoji!*
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 💬 Type the emoji or answer.
┃ ⚡ ${roundTimeLimit} seconds!
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    // ========================================================
    // ENDING
    // ========================================================

    else if (session.gameType === 'ending') {
        roundText =
`┏━━━ 🔚 *WORDS THAT END WITH* — ROUND ${session.currentRound}/${session.rounds} ━━━┓
┃
┃ 🔤 *Ending:* \`${qData.ending}\`
┃
┃ 🎯 Send *3 different words*
┃ that end with *${qData.ending}*
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ⚡ First correct player gets 5 points!
┃ ⏱️ ${roundTimeLimit} seconds!
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    // ========================================================
    // STARTING
    // ========================================================

    else if (session.gameType === 'starting') {
        roundText =
`┏━━━ 🔤 *WORDS THAT START WITH* — ROUND ${session.currentRound}/${session.rounds} ━━━┓
┃
┃ 🔤 *Starting:* \`${qData.starting}\`
┃
┃ 🎯 Send *3 different words*
┃ that start with *${qData.starting}*
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ⚡ First correct player gets 5 points!
┃ ⏱️ ${roundTimeLimit} seconds!
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    // ========================================================
    // RHYME
    // ========================================================

    else if (session.gameType === 'rhyme') {
        roundText =
`┏━━━ 🎵 *RHYMING WORDS* — ROUND ${session.currentRound}/${session.rounds} ━━━┓
┃
┃ 🎤 *Target Word:* \`${qData.word}\`
┃
┃ 🎯 Send *3 different words*
┃ that rhyme with *${qData.word}*
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ ⚡ First correct player gets 5 points!
┃ ⏱️ ${roundTimeLimit} seconds!
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    // ========================================================
    // EMOJI MOVIE
    // ========================================================

    else if (session.gameType === 'movemoji') {
        roundText =
`┏━━━ 🎬 *EMOJI MOVIE* — ROUND ${session.currentRound}/${session.rounds} ━━━┓
┃
┃ 🎞️ *Movie:*
┃ ${qData.emojis || qData.emoji || ''}
┃
┃ 🤔 Guess the movie!
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 💬 Type the movie title.
┃ ⚡ ${roundTimeLimit} seconds!
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    // ========================================================
    // 2 TRUTHS 1 LIE
    // ========================================================

    else if (session.gameType === '2truth1lie') {
        roundText =
`┏━━━ 🕵️ *2 TRUTHS 1 LIE* — ROUND ${session.currentRound}/${session.rounds} ━━━┓
┃
┃ 1️⃣ ${qData.statements?.[0] || ''}
┃
┃ 2️⃣ ${qData.statements?.[1] || ''}
┃
┃ 3️⃣ ${qData.statements?.[2] || ''}
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🤔 Which one is the LIE?
┃ 💬 Reply *1, 2 or 3*
┃ ⚡ ${roundTimeLimit} seconds!
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    // ========================================================
    // FINISH THE LINE
    // ========================================================

    else if (session.gameType === 'lyrics') {
        roundText =
`┏━━━ 🎵 *FINISH THE LINE* — ROUND ${session.currentRound}/${session.rounds} ━━━┓
┃
┃ 🎤 *Complete this line:*
┃
┃ ${qData.question || ''}
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 💬 Type the missing word/answer!
┃ ⚡ ${roundTimeLimit} seconds!
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    // ========================================================
    // TABOO
    // ========================================================

    else if (session.gameType === 'taboo') {

        /*
         * IMPORTANT:
         * The target and forbidden words are NOT sent
         * to the group.
         */

        const describer =
            await chooseTabooDescriber(
                session.sock,
                from,
                session.previousTabooDescriber
            );

        session.tabooDescriber = describer;

        if (describer) {
            session.previousTabooDescriber = describer;
        }

        if (describer) {

            // Send secret information privately.
            try {
                await session.sock.sendMessage(
                    describer,
                    {
                        text:
`🚫 *QUEEN VIDA TABOO — SECRET CARD* 🚫

🎯 *YOUR WORD:*
*${qData.word}*

🚫 *FORBIDDEN WORDS:*
• ${qData.forbidden?.[0] || ''}
• ${qData.forbidden?.[1] || ''}
• ${qData.forbidden?.[2] || ''}

🎤 *Your job:*
Describe the secret word WITHOUT saying the word itself or any forbidden word.

👥 Everyone in the group will try to guess it.

⚠️ Do NOT send this secret card to the group!`
                    }
                );
            } catch (error) {
                console.error(
                    '❌ Failed to DM Taboo describer:',
                    error
                );
            }

            roundText =
`┏━━━ 🚫 *TABOO* — ROUND ${session.currentRound}/${session.rounds} 🚫 ━━━┓
┃
┃ 👤 *DESCRIBER:*
┃ @${mentionNumber(describer)}
┃
┃ 🎤 The describer has received
┃ a secret word privately.
┃
┃ 👥 Everyone else must guess!
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🚫 The secret word is hidden.
┃ 🤫 Don't ask the describer to reveal it!
┃ ⚡ ${roundTimeLimit} seconds!
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

        } else {

            roundText =
`┏━━━ 🚫 *TABOO* — ROUND ${session.currentRound}/${session.rounds} 🚫 ━━━┓
┃
┃ ⚠️ *Unable to select a describer.*
┃
┃ Please wait for the next round.
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
        }
    }


    // ========================================================
    // MEME WAR
    // ========================================================

    else if (session.gameType === 'memewar') {
        roundText =
`┏━━━ 😂 *MEME WAR* — ROUND ${session.currentRound}/${session.rounds} 😂 ━━━┓
┃
┃ 🎯 *PROMPT:*
┃ ${qData.prompt || qData.question || ''}
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 😂 Drop your funniest meme/reply!
┃ 🏆 First valid submission gets 5 points.
┃ ⏱️ ${roundTimeLimit} seconds!
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }


    // ========================================================
    // SEND ROUND
    // ========================================================

    const mentions =
        session.gameType === 'taboo' &&
        session.tabooDescriber
            ? [session.tabooDescriber]
            : [];

    await session.sock.sendMessage(from, {
        text: roundText,
        mentions
    });


    // ========================================================
    // ROUND TIMER
    // ========================================================

    session.timer = setTimeout(async () => {

        if (
            !activeGames[from] ||
            session.answeredThisRound
        ) {
            return;
        }

        session.answeredThisRound = true;

        let timeOutText =
            `⏰ *TIME'S UP!*\n\n` +
            `❌ Nobody got this round.\n`;


        // ----------------------------------------------------
        // TRIVIA / QUIZ
        // ----------------------------------------------------

        if (
            session.gameType === 'trivia' ||
            session.gameType === 'quiz'
        ) {
            const answer =
                qData.answer;

            const answerText =
                qData.options?.[answer] ||
                answer;

            timeOutText +=
                `📌 *Correct Answer:* ` +
                `*${answer} — ${answerText}*`;
        }


        // ----------------------------------------------------
        // SCRAMBLE
        // ----------------------------------------------------

        else if (session.gameType === 'scramble') {
            timeOutText +=
                `📌 *Correct Word:* ` +
                `*${qData.targetWord || qData.word || ''}*`;
        }


        // ----------------------------------------------------
        // GUESS
        // ----------------------------------------------------

        else if (session.gameType === 'guess') {
            timeOutText +=
                `📌 *Secret Number:* ` +
                `*${qData.target ?? qData.answer ?? qData.number ?? ''}*`;
        }


        // ----------------------------------------------------
        // EMOJI
        // ----------------------------------------------------

        else if (
            session.gameType === 'emoji' ||
            session.gameType === 'findemoji'
        ) {
            timeOutText +=
                `📌 *Answer:* ` +
                `*${qData.answer || ''}*`;
        }


        // ----------------------------------------------------
        // MOVIE
        // ----------------------------------------------------

        else if (session.gameType === 'movemoji') {
            timeOutText +=
                `📌 *Movie:* ` +
                `*${qData.answer || ''}*`;
        }


        // ----------------------------------------------------
        // 2 TRUTHS 1 LIE
        // ----------------------------------------------------

        else if (session.gameType === '2truth1lie') {
            timeOutText +=
                `📌 *The lie was statement:* ` +
                `*${qData.lie}️⃣*`;
        }


        // ----------------------------------------------------
        // LYRICS
        // ----------------------------------------------------

        else if (session.gameType === 'lyrics') {
            timeOutText +=
                `📌 *Answer:* ` +
                `*${qData.answer || ''}*`;
        }


        // ----------------------------------------------------
        // ENDING
        // ----------------------------------------------------

        else if (session.gameType === 'ending') {
            timeOutText +=
                `📌 Send 3 words ending with ` +
                `*${qData.ending || ''}*`;
        }


        // ----------------------------------------------------
        // STARTING
        // ----------------------------------------------------

        else if (session.gameType === 'starting') {
            timeOutText +=
                `📌 Send 3 words starting with ` +
                `*${qData.starting || ''}*`;
        }


        // ----------------------------------------------------
        // RHYME
        // ----------------------------------------------------

        else if (session.gameType === 'rhyme') {
            timeOutText +=
                `📌 Some valid rhymes were: ` +
                `*${(qData.rhymes || []).slice(0, 3).join(', ')}*`;
        }


        // ----------------------------------------------------
        // COUPLES
        // ----------------------------------------------------

        else if (session.gameType === 'couples') {
            timeOutText +=
                `📌 *Challenge:* ` +
                `*${qData.challenge || ''}*`;
        }


        // ----------------------------------------------------
        // TABOO
        // ----------------------------------------------------

        else if (session.gameType === 'taboo') {
            timeOutText +=
                `📌 *The secret word was:* ` +
                `*${qData.word || ''}*`;

            if (session.tabooDescriber) {
                timeOutText +=
                    `\n👤 Describer: @${mentionNumber(
                        session.tabooDescriber
                    )}`;
            }
        }


        // ----------------------------------------------------
        // MEME WAR
        // ----------------------------------------------------

        else if (session.gameType === 'memewar') {
            timeOutText +=
                `\n😂 No winning submission this round.`;
        }


        await session.sock.sendMessage(from, {
            text: timeOutText,
            mentions:
                session.gameType === 'taboo' &&
                session.tabooDescriber
                    ? [session.tabooDescriber]
                    : []
        });


        setTimeout(() => {
            nextRound(from);
        }, 3000);

    }, roundTimeLimit * 1000);
}


// ============================================================
// EXTRACT WORDS
// ============================================================

function extractWords(text) {
    return String(text || '')
        .trim()
        .split(/[\s,]+/)
        .map(word => normalizeText(word))
        .filter(Boolean);
}


// ============================================================
// ENDING WORD CHECK
// ============================================================

function checkEndingWords(text, ending) {
    const words = extractWords(text);

    if (words.length !== 3) {
        return false;
    }

    const uniqueWords = new Set(words);

    if (uniqueWords.size !== 3) {
        return false;
    }

    const suffix = normalizeText(ending);

    if (!suffix) {
        return false;
    }

    return words.every(word =>
        word.endsWith(suffix)
    );
}


// ============================================================
// STARTING WORD CHECK
// ============================================================

function checkStartingWords(text, starting) {
    const words = extractWords(text);

    if (words.length !== 3) {
        return false;
    }

    const uniqueWords = new Set(words);

    if (uniqueWords.size !== 3) {
        return false;
    }

    const prefix = normalizeText(starting);

    if (!prefix) {
        return false;
    }

    return words.every(word =>
        word.startsWith(prefix)
    );
}


// ============================================================
// RHYME CHECK
// ============================================================

function checkRhymeWords(text, qData) {
    const words = extractWords(text);

    if (words.length !== 3) {
        return false;
    }

    const uniqueWords = new Set(words);

    if (uniqueWords.size !== 3) {
        return false;
    }

    const target =
        normalizeText(qData.word);

    const validRhymes =
        Array.isArray(qData.rhymes)
            ? qData.rhymes.map(normalizeText)
            : [];

    return words.every(word =>
        word !== target &&
        validRhymes.includes(word)
    );
}


// ============================================================
// TABOO FORBIDDEN WORD CHECK
// ============================================================

function containsForbiddenWord(text, forbidden) {
    const clean = normalizeText(text);

    if (!clean) {
        return false;
    }

    return forbidden.some(word => {
        const forbiddenWord =
            normalizeText(word);

        if (!forbiddenWord) {
            return false;
        }

        return clean
            .split(/\s+/)
            .includes(forbiddenWord);
    });
}


// ============================================================
// HANDLE GAME MESSAGES
// ============================================================

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
        session.answeredThisRound ||
        !session.activeQuestion
    ) {
        return false;
    }

    const sender =
        m.key.participant ||
        m.key.remoteJid;

    const senderNormalized =
        normalizeJid(sender);

    const cleanText =
        normalizeText(text);

    const cleanUpper =
        String(text || '')
            .trim()
            .toUpperCase();

    const q =
        session.activeQuestion;

    let isCorrect = false;


    // ========================================================
    // TABOO SPECIAL HANDLING
    // ========================================================

    if (session.gameType === 'taboo') {

        // Describer must never score.
        if (
            session.tabooDescriber &&
            senderNormalized ===
                normalizeJid(session.tabooDescriber)
        ) {

            const target =
                normalizeText(q.word);

            const forbidden =
                Array.isArray(q.forbidden)
                    ? q.forbidden
                    : [];

            // If describer accidentally says the secret word
            // or a forbidden word, warn them privately/group.
            if (
                cleanText === target ||
                containsForbiddenWord(
                    cleanText,
                    forbidden
                )
            ) {
                await sock.sendMessage(
                    from,
                    {
                        text:
                            `🚫 *TABOO VIOLATION!*\n\n` +
                            `@${mentionNumber(sender)} ` +
                            `You used the secret/forbidden word.\n` +
                            `⚠️ Keep describing without saying it!`,
                        mentions: [sender]
                    },
                    {
                        quoted: m
                    }
                );
            }

            // Describer's message is consumed.
            return true;
        }


        const target =
            normalizeText(q.word);

        if (
            cleanText &&
            cleanText === target
        ) {
            isCorrect = true;
        }

        // Any other guess simply waits for another player.
        if (!isCorrect) {
            return true;
        }
    }


    // ========================================================
    // TRIVIA / QUIZ
    // ========================================================

    else if (
        session.gameType === 'trivia' ||
        session.gameType === 'quiz'
    ) {
        if (
            ['A', 'B', 'C', 'D'].includes(cleanUpper) &&
            cleanUpper ===
                String(q.answer).toUpperCase()
        ) {
            isCorrect = true;
        }
    }


    // ========================================================
    // SCRAMBLE
    // ========================================================

    else if (session.gameType === 'scramble') {
        const answer =
            normalizeText(
                q.targetWord ||
                q.word
            );

        if (cleanText === answer) {
            isCorrect = true;
        }
    }


    // ========================================================
    // NUMBER GUESS
    // ========================================================

    else if (session.gameType === 'guess') {
        const num =
            parseInt(
                String(text).trim(),
                10
            );

        if (!isNaN(num)) {

            const target =
                Number(q.targetNumber);

            if (num === target) {
                isCorrect = true;
            } else {

                const hintDir =
                    num < target
                        ? '📈 *Higher!*'
                        : '📉 *Lower!*';

                await sock.sendMessage(
                    from,
                    {
                        text:
                            `❌ *${num}* is wrong!\n` +
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


    // ========================================================
    // EMOJI
    // ========================================================

    else if (session.gameType === 'emoji') {
        const answer =
            normalizeText(q.answer);

        if (
            cleanText === answer ||
            (
                cleanText.length >= 3 &&
                (
                    cleanText.includes(answer) ||
                    answer.includes(cleanText)
                )
            )
        ) {
            isCorrect = true;
        }
    }


    // ========================================================
    // FIND EMOJI
    // ========================================================

    else if (session.gameType === 'findemoji') {
        const answer =
            normalizeText(q.answer);

        if (
            cleanText === answer ||
            (
                cleanText.length >= 3 &&
                (
                    cleanText.includes(answer) ||
                    answer.includes(cleanText)
                )
            )
        ) {
            isCorrect = true;
        }
    }


    // ========================================================
    // EMOJI MOVIE
    // ========================================================

    else if (session.gameType === 'movemoji') {
        const answer =
            normalizeText(q.answer);

        if (
            cleanText === answer ||
            (
                cleanText.length >= 3 &&
                (
                    cleanText.includes(answer) ||
                    answer.includes(cleanText)
                )
            )
        ) {
            isCorrect = true;
        }
    }


    // ========================================================
    // 2 TRUTHS 1 LIE
    // ========================================================

    else if (session.gameType === '2truth1lie') {

        const choice =
            parseInt(
                String(text).trim(),
                10
            );

        if (
            [1, 2, 3].includes(choice) &&
            choice === Number(q.lie)
        ) {
            isCorrect = true;
        }

        else if (
            [1, 2, 3].includes(choice)
        ) {
            await sock.sendMessage(
                from,
                {
                    text:
                        `❌ *Wrong!* @${mentionNumber(sender)}\n` +
                        `That wasn't the lie. Keep watching!`,
                    mentions: [sender]
                },
                {
                    quoted: m
                }
            );

            return true;
        }
    }


    // ========================================================
    // FINISH THE LINE
    // ========================================================

    else if (session.gameType === 'lyrics') {

        const answer =
            normalizeText(q.answer);

        if (
            cleanText === answer ||
            (
                cleanText.length >= 2 &&
                (
                    cleanText.includes(answer) ||
                    answer.includes(cleanText)
                )
            )
        ) {
            isCorrect = true;
        }
    }


    // ========================================================
    // ENDING
    // ========================================================

    else if (session.gameType === 'ending') {

        if (
            checkEndingWords(
                text,
                q.ending
            )
        ) {
            isCorrect = true;
        }
    }


    // ========================================================
    // STARTING
    // ========================================================

    else if (session.gameType === 'starting') {

        if (
            checkStartingWords(
                text,
                q.starting
            )
        ) {
            isCorrect = true;
        }
    }


    // ========================================================
    // RHYME
    // ========================================================

    else if (session.gameType === 'rhyme') {

        if (
            checkRhymeWords(
                text,
                q
            )
        ) {
            isCorrect = true;
        }
    }


    // ========================================================
    // COUPLES
    // ========================================================

    else if (session.gameType === 'couples') {

        if (cleanText.length > 0) {
            isCorrect = true;
        }
    }


    // ========================================================
    // MEME WAR
    // ========================================================

    else if (session.gameType === 'memewar') {

        if (cleanText.length > 0) {
            isCorrect = true;
        }
    }


    // ========================================================
    // CORRECT ANSWER
    // ========================================================

    if (isCorrect) {

        session.answeredThisRound = true;

        if (session.timer) {
            clearTimeout(session.timer);
        }

        session.scores[senderNormalized] =
            (session.scores[senderNormalized] || 0) + 5;

        const sortedScores =
            Object.entries(session.scores)
                .sort(
                    (a, b) =>
                        b[1] - a[1]
                );

        let winAnnouncement =
`🎉 *CORRECT!*

🏆 @${mentionNumber(senderNormalized)}
💎 *+5 POINTS*

📊 *CURRENT SCORE:*`;

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

                winAnnouncement +=
                    `\n${medal} ${index + 1}. ` +
                    `@${mentionNumber(user)} — ` +
                    `*${points} pts*`;
            }
        );

        await sock.sendMessage(
            from,
            {
                text: winAnnouncement,
                mentions:
                    sortedScores.map(
                        ([user]) => user
                    )
            },
            {
                quoted: m
            }
        );

        setTimeout(() => {
            nextRound(from);
        }, 3000);

        return true;
    }

    return false;
}


// ============================================================
// END GAME
// ============================================================

async function endGame(from) {

    const session =
        activeGames[from];

    if (!session) {
        return;
    }

    if (session.timer) {
        clearTimeout(session.timer);
    }

    const sortedScores =
        Object.entries(session.scores)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            );

    let finalDashboard =
`┏━━━ 🏆 *GAME OVER* 🏆 ━━━┓
┃ 🎮 *${getGameTitle(session.gameType)}*
┃
┃ 🎉 *FINAL LEADERBOARD*
┣━━━━━━━━━━━━━━━━━━━━━━━`;

    if (sortedScores.length === 0) {

        finalDashboard +=
            `\n┃ ❌ No players scored points.`;

    } else {

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
                    `\n┃ ${medal} ${index + 1}. ` +
                    `@${mentionNumber(user)} — ` +
                    `*${points} Points*`;
            }
        );

        const winner =
            sortedScores[0][0];

        finalDashboard +=
            `\n┣━━━━━━━━━━━━━━━━━━━━━━━` +
            `\n┃ 👑 *WINNER:* @${mentionNumber(winner)} 🎉`;
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


// ============================================================
// CHECK ACTIVE GAME
// ============================================================

function isGameActive(from) {
    return !!activeGames[from];
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    startGame,
    stopGame,
    handleGameMessage,
    isGameActive
};
