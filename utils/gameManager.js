const fs = require('fs');
const path = require('path');

const activeGames = {}; // { groupJid: sessionData }

/*
=================================================
BUILT-IN ADVANCED GAME QUESTIONS
=================================================
These games do not require extra JSON files.
*/

// ===============================
// RIDDLES
// ===============================
const RIDDLES = [
    {
        question: 'I have keys but no locks. I have space but no room. You can enter, but you cannot go outside. What am I?',
        answer: 'keyboard',
        aliases: ['a keyboard']
    },
    {
        question: 'The more you take, the more you leave behind. What am I?',
        answer: 'footsteps',
        aliases: ['footsteps']
    },
    {
        question: 'I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?',
        answer: 'echo',
        aliases: ['an echo']
    },
    {
        question: 'I am always in front of you but can never be seen. What am I?',
        answer: 'the future',
        aliases: ['future']
    },
    {
        question: 'What has a head and a tail but no body?',
        answer: 'coin',
        aliases: ['a coin']
    },
    {
        question: 'What gets wetter the more it dries?',
        answer: 'towel',
        aliases: ['a towel']
    },
    {
        question: 'What has many teeth but cannot bite?',
        answer: 'comb',
        aliases: ['a comb']
    },
    {
        question: 'What can travel around the world while staying in one corner?',
        answer: 'stamp',
        aliases: ['a stamp']
    },
    {
        question: 'What has one eye but cannot see?',
        answer: 'needle',
        aliases: ['a needle']
    },
    {
        question: 'What has hands but cannot clap?',
        answer: 'clock',
        aliases: ['a clock']
    },
    {
        question: 'What goes up but never comes down?',
        answer: 'age',
        aliases: ['your age']
    },
    {
        question: 'What has a neck but no head?',
        answer: 'bottle',
        aliases: ['a bottle']
    }
];

// ===============================
// EMOJI GAME
// ===============================
const EMOJI_GAMES = [
    { emojis: '🦁👑', answer: 'lion king', aliases: ['the lion king'] },
    { emojis: '🚢💔🌊', answer: 'titanic', aliases: ['titanic movie'] },
    { emojis: '🕷️👨', answer: 'spiderman', aliases: ['spider man', 'spider-man'] },
    { emojis: '🦇👨', answer: 'batman', aliases: ['bat man'] },
    { emojis: '❄️👸', answer: 'frozen', aliases: ['frozen movie'] },
    { emojis: '🐼🥋', answer: 'kung fu panda', aliases: ['kungfu panda'] },
    { emojis: '👻🚫', answer: 'ghostbusters', aliases: ['ghost busters'] },
    { emojis: '🤖🚗', answer: 'transformers', aliases: ['transformer'] },
    { emojis: '🧙‍♂️💍', answer: 'lord of the rings', aliases: ['lord of rings', 'the lord of the rings'] },
    { emojis: '🦖🏝️', answer: 'jurassic park', aliases: ['jurassic world'] },
    { emojis: '🐠🔎', answer: 'finding nemo', aliases: ['nemo'] },
    { emojis: '👽📞🏠', answer: 'et', aliases: ['e.t.', 'e t'] },
    { emojis: '🎈🏠', answer: 'up', aliases: ['up movie'] },
    { emojis: '🧞‍♂️🪔', answer: 'aladdin', aliases: ['aladin'] },
    { emojis: '🐀👨‍🍳', answer: 'ratatouille', aliases: ['ratatouille movie'] }
];

// ===============================
// GUESS SONG
// ===============================
// Uses song titles only. No lyrics are stored.
// ===============================
const GUESS_SONGS = [
    {
        clue: '🎵 A global hit with a title about the shape of someone.',
        answer: 'shape of you',
        aliases: ['shape of u']
    },
    {
        clue: '🎵 A romantic song whose title says everything is just right.',
        answer: 'perfect',
        aliases: []
    },
    {
        clue: '🎵 A worldwide hit with a title describing bright lights that cannot be seen clearly.',
        answer: 'blinding lights',
        aliases: ['blinding light']
    },
    {
        clue: '🎵 A popular Afrobeats song whose title means to calm down.',
        answer: 'calm down',
        aliases: ['calmdown']
    },
    {
        clue: '🎵 A popular Nigerian hit whose title means the essence or main thing.',
        answer: 'essence',
        aliases: []
    },
    {
        clue: '🎵 A song title describing something that happens after midnight.',
        answer: 'one dance',
        aliases: ['one-dance']
    },
    {
        clue: '🎵 A song title asking someone to stay with you.',
        answer: 'stay',
        aliases: []
    },
    {
        clue: '🎵 A famous song title connected to someone being unable to stop thinking about another person.',
        answer: 'attention',
        aliases: []
    },
    {
        clue: '🎵 A song title that means something is beautiful and amazing.',
        answer: 'lovely',
        aliases: []
    },
    {
        clue: '🎵 A popular song title that simply means someone is happy.',
        answer: 'happy',
        aliases: []
    }
];

// ===============================
// TYPING GAME
// ===============================
const TYPING_PHRASES = [
    'Queen Vida is the best bot',
    'Vibes Till Anytime',
    'Nobody can stop the vibes',
    'I came to win this game',
    'VTA members are unstoppable',
    'Today is going to be a great day',
    'The game has officially started',
    'Fast fingers win the round',
    'I love good vibes',
    'Long live Queen Vida'
];

// ===============================
// QUIZ QUESTIONS
// ===============================
const QUIZ_QUESTIONS = [
    {
        question: 'Which planet is known as the Red Planet?',
        options: {
            A: 'Earth',
            B: 'Mars',
            C: 'Jupiter',
            D: 'Venus'
        },
        answer: 'B'
    },
    {
        question: 'How many days are there in a leap year?',
        options: {
            A: '364',
            B: '365',
            C: '366',
            D: '367'
        },
        answer: 'C'
    },
    {
        question: 'What is the capital of Nigeria?',
        options: {
            A: 'Lagos',
            B: 'Kano',
            C: 'Abuja',
            D: 'Ibadan'
        },
        answer: 'C'
    },
    {
        question: 'Which ocean is the largest?',
        options: {
            A: 'Atlantic Ocean',
            B: 'Indian Ocean',
            C: 'Arctic Ocean',
            D: 'Pacific Ocean'
        },
        answer: 'D'
    },
    {
        question: 'How many continents are there?',
        options: {
            A: '5',
            B: '6',
            C: '7',
            D: '8'
        },
        answer: 'C'
    },
    {
        question: 'Which animal is known as the King of the Jungle?',
        options: {
            A: 'Tiger',
            B: 'Lion',
            C: 'Elephant',
            D: 'Leopard'
        },
        answer: 'B'
    },
    {
        question: 'What is H2O commonly known as?',
        options: {
            A: 'Salt',
            B: 'Oxygen',
            C: 'Water',
            D: 'Hydrogen'
        },
        answer: 'C'
    },
    {
        question: 'Which country is famous for the pyramids of Giza?',
        options: {
            A: 'Egypt',
            B: 'Greece',
            C: 'Italy',
            D: 'Mexico'
        },
        answer: 'A'
    },
    {
        question: 'How many sides does a triangle have?',
        options: {
            A: '2',
            B: '3',
            C: '4',
            D: '5'
        },
        answer: 'B'
    },
    {
        question: 'Which language is primarily used to style web pages?',
        options: {
            A: 'HTML',
            B: 'Python',
            C: 'CSS',
            D: 'SQL'
        },
        answer: 'C'
    },
    {
        question: 'What is the largest mammal in the world?',
        options: {
            A: 'Elephant',
            B: 'Blue Whale',
            C: 'Giraffe',
            D: 'Shark'
        },
        answer: 'B'
    },
    {
        question: 'Which month has 28 days in a normal year?',
        options: {
            A: 'January',
            B: 'February',
            C: 'March',
            D: 'April'
        },
        answer: 'B'
    }
];

/*
=================================================
HELPER FUNCTIONS
=================================================
*/

function shuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}

function normalizeText(text) {
    return String(text || '')
        .toLowerCase()
        .trim()
        .replace(/[“”‘’]/g, "'")
        .replace(/[.,!?;:()[\]{}"'`]/g, '')
        .replace(/\s+/g, ' ');
}

function answerMatches(text, answer, aliases = []) {
    const cleanText = normalizeText(text);

    if (cleanText === normalizeText(answer)) {
        return true;
    }

    return aliases.some(alias => cleanText === normalizeText(alias));
}

function loadQuestions(gameType) {
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
        return JSON.parse(raw);
    } catch (e) {
        console.error(
            `Error loading questions for ${gameType}:`,
            e
        );

        return [];
    }
}

function getGameTitle(gameType) {
    const titles = {
        trivia: '🎯 TRIVIA SHOWDOWN',
        quiz: '🧠 GENERAL QUIZ',
        scramble: '🔤 WORD SCRAMBLE',
        guess: '🔢 NUMBER GUESS',
        guessnumber: '🔢 NUMBER GUESS',
        riddle: '🧩 RIDDLE MASTER',
        emojigame: '😂 EMOJI GUESS',
        guesssong: '🎵 GUESS THE SONG',
        typing: '⌨️ TYPING RACE'
    };

    return titles[gameType] || '🎮 MINI GAME';
}

function getRoundTime(gameType) {
    if (
        gameType === 'trivia' ||
        gameType === 'quiz'
    ) {
        return 25;
    }

    return 45;
}

function buildQuestionSet(gameType, totalRounds) {
    let questions = [];

    /*
    Existing JSON games
    */
    if (
        gameType === 'trivia' ||
        gameType === 'scramble' ||
        gameType === 'guess'
    ) {
        questions = loadQuestions(gameType);
    }

    /*
    Quiz uses built-in questions.
    */
    else if (gameType === 'quiz') {
        questions = QUIZ_QUESTIONS;
    }

    /*
    Riddles.
    */
    else if (gameType === 'riddle') {
        questions = RIDDLES;
    }

    /*
    Emoji game.
    */
    else if (gameType === 'emojigame') {
        questions = EMOJI_GAMES;
    }

    /*
    Guess song.
    */
    else if (gameType === 'guesssong') {
        questions = GUESS_SONGS;
    }

    /*
    Typing.
    */
    else if (gameType === 'typing') {
        questions = TYPING_PHRASES.map(phrase => ({
            phrase
        }));
    }

    return shuffle(questions).slice(
        0,
        Math.min(totalRounds, questions.length)
    );
}

/*
=================================================
START GAME
=================================================
*/

async function startGame(
    sock,
    from,
    gameType,
    totalRounds = 5
) {
    if (activeGames[from]) {
        await sock.sendMessage(from, {
            text:
                '❌ *A game is already active in this group!*\n\n' +
                '🛑 Use `!game stop` to end the current game first.'
        });

        return;
    }

    /*
    Support aliases.
    */
    if (gameType === 'guessnumber') {
        gameType = 'guess';
    }

    const validGames = [
        'trivia',
        'quiz',
        'scramble',
        'guess',
        'riddle',
        'emojigame',
        'guesssong',
        'typing'
    ];

    if (!validGames.includes(gameType)) {
        await sock.sendMessage(from, {
            text:
                '❌ *Unknown game!*\n\n' +
                'Available games:\n' +
                '🎯 Trivia\n' +
                '🧠 Quiz\n' +
                '🔤 Scramble\n' +
                '🔢 Guess Number\n' +
                '🧩 Riddle\n' +
                '😂 Emoji Game\n' +
                '🎵 Guess Song\n' +
                '⌨️ Typing'
        });

        return;
    }

    const questions = buildQuestionSet(
        gameType,
        totalRounds
    );

    if (!questions.length) {
        await sock.sendMessage(from, {
            text:
                `❌ Failed to load questions for *${gameType}*.\n\n` +
                'Please check the game data.'
        });

        return;
    }

    activeGames[from] = {
        gameType,
        rounds: questions.length,
        currentRound: 0,
        questions,
        scores: {},
        activeQuestion: null,
        timer: null,
        answeredThisRound: false,
        sock
    };

    const gameTitle = getGameTitle(gameType);
    const roundDuration = getRoundTime(gameType);

    const startMsg =
`┏━━━ 🎮 *QUEEN VIDA GAME SUITE* 🎮 ━━━┓
┃
┃ 🏆 *Game:* ${gameTitle}
┃ 🔄 *Rounds:* ${questions.length}
┃ ⏱️ *Time:* ${roundDuration}s per round
┃ 💎 *Reward:* +5 points
┃
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🚀 *GAME STARTING!*
┃
┃ 👑 First correct answer
┃    wins the round!
┃
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

    await sock.sendMessage(from, {
        text: startMsg
    });

    setTimeout(() => {
        nextRound(from);
    }, 2000);
}

/*
=================================================
STOP GAME
=================================================
*/

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
            '🛑 *GAME STOPPED!*\n\n' +
            'The current game session has been ended by an admin/creator.'
    });
}

/*
=================================================
NEXT ROUND
=================================================
*/

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

    const gameType = session.gameType;
    const roundTimeLimit = getRoundTime(gameType);

    let roundText = '';

    /*
    =============================================
    TRIVIA
    =============================================
    */

    if (gameType === 'trivia') {
        roundText =
`┏━━━ 🎯 *TRIVIA* ━━━┓
┃ 🔄 Round ${session.currentRound}/${session.rounds}
┃
┃ ❓ *${qData.question}*
┃
┃ 🅰️ ${qData.options.A}
┃ 🅱️ ${qData.options.B}
┃ 🅲 ${qData.options.C}
┃ 🅳 ${qData.options.D}
┃
┃ ⏱️ *${roundTimeLimit}s*
┃
┃ Reply with *A, B, C or D*
┗━━━━━━━━━━━━━━━━━━`;
    }

    /*
    =============================================
    SCRAMBLE
    =============================================
    */

    else if (gameType === 'scramble') {
        let letters = qData.word.split('');

        /*
        Try to make sure the scramble isn't
        accidentally identical to the word.
        */
        let scrambled = qData.word;

        for (let attempt = 0; attempt < 5; attempt++) {
            letters = shuffle(letters);
            scrambled = letters.join(' ');

            if (
                normalizeText(
                    letters.join('')
                ) !== normalizeText(qData.word)
            ) {
                break;
            }
        }

        qData.targetWord = qData.word;

        roundText =
`┏━━━ 🔤 *WORD SCRAMBLE* ━━━┓
┃ 🔄 Round ${session.currentRound}/${session.rounds}
┃
┃ 🔀 *${scrambled}*
┃
┃ 💡 Hint: ${qData.hint || 'No hint available'}
┃
┃ ⏱️ *${roundTimeLimit}s*
┃
┃ Type the correct word!
┗━━━━━━━━━━━━━━━━━━━━━━`;
    }

    /*
    =============================================
    GUESS NUMBER
    =============================================
    */

    else if (gameType === 'guess') {
        qData.targetNumber = Number(qData.target);

        roundText =
`┏━━━ 🔢 *NUMBER GUESS* ━━━┓
┃ 🔄 Round ${session.currentRound}/${session.rounds}
┃
┃ 🎯 Guess a number between
┃ *${qData.min}* and *${qData.max}*
┃
┃ 💡 I'll tell you *Higher* or *Lower*!
┃
┃ ⏱️ *${roundTimeLimit}s*
┃
┃ Type your number!
┗━━━━━━━━━━━━━━━━━━━━━━`;
    }

    /*
    =============================================
    QUIZ
    =============================================
    */

    else if (gameType === 'quiz') {
        roundText =
`┏━━━ 🧠 *GENERAL QUIZ* ━━━┓
┃ 🔄 Round ${session.currentRound}/${session.rounds}
┃
┃ ❓ *${qData.question}*
┃
┃ 🅰️ ${qData.options.A}
┃ 🅱️ ${qData.options.B}
┃ 🅲 ${qData.options.C}
┃ 🅳 ${qData.options.D}
┃
┃ ⏱️ *${roundTimeLimit}s*
┃
┃ Answer with *A, B, C or D*
┗━━━━━━━━━━━━━━━━━━━━━━`;
    }

    /*
    =============================================
    RIDDLE
    =============================================
    */

    else if (gameType === 'riddle') {
        roundText =
`┏━━━ 🧩 *RIDDLE MASTER* ━━━┓
┃ 🔄 Round ${session.currentRound}/${session.rounds}
┃
┃ ❓ *${qData.question}*
┃
┃ ⏱️ *${roundTimeLimit}s*
┃
┃ 🧠 Think carefully...
┃
┃ Type your answer!
┗━━━━━━━━━━━━━━━━━━━━━━`;
    }

    /*
    =============================================
    EMOJI GAME
    =============================================
    */

    else if (gameType === 'emojigame') {
        roundText =
`┏━━━ 😂 *EMOJI GUESS* ━━━┓
┃ 🔄 Round ${session.currentRound}/${session.rounds}
┃
┃ 🎬 Guess the movie:
┃
┃ 👉 *${qData.emojis}*
┃
┃ ⏱️ *${roundTimeLimit}s*
┃
┃ Type your answer!
┗━━━━━━━━━━━━━━━━━━━━━━`;
    }

    /*
    =============================================
    GUESS SONG
    =============================================
    */

    else if (gameType === 'guesssong') {
        roundText =
`┏━━━ 🎵 *GUESS THE SONG* ━━━┓
┃ 🔄 Round ${session.currentRound}/${session.rounds}
┃
┃ 🎧 *CLUE:*
┃ ${qData.clue}
┃
┃ ⏱️ *${roundTimeLimit}s*
┃
┃ 🎤 Type the song title!
┗━━━━━━━━━━━━━━━━━━━━━━`;
    }

    /*
    =============================================
    TYPING
    =============================================
    */

    else if (gameType === 'typing') {
        roundText =
`┏━━━ ⌨️ *TYPING RACE* ━━━┓
┃ 🔄 Round ${session.currentRound}/${session.rounds}
┃
┃ 🚨 *TYPE THIS EXACTLY:*
┃
┃ "${qData.phrase}"
┃
┃ ⏱️ *${roundTimeLimit}s*
┃
┃ ⚡ First person to type it
┃ correctly wins!
┗━━━━━━━━━━━━━━━━━━━━━━`;
    }

    await session.sock.sendMessage(from, {
        text: roundText
    });

    /*
    =============================================
    ROUND TIMER
    =============================================
    */

    session.timer = setTimeout(async () => {
        const currentSession = activeGames[from];

        if (
            !currentSession ||
            currentSession !== session ||
            session.answeredThisRound
        ) {
            return;
        }

        session.answeredThisRound = true;

        let timeOutText =
            '⏰ *TIME IS UP!*\n\n' +
            'Nobody got the correct answer this round.\n\n';

        if (
            gameType === 'trivia' ||
            gameType === 'quiz'
        ) {
            const option =
                qData.options[qData.answer];

            timeOutText +=
                `📌 Correct Answer: *${qData.answer}* — ${option}`;
        }

        else if (gameType === 'scramble') {
            timeOutText +=
                `📌 Correct Word: *${qData.word}*`;
        }

        else if (gameType === 'guess') {
            timeOutText +=
                `📌 Secret Number: *${qData.targetNumber}*`;
        }

        else if (gameType === 'riddle') {
            timeOutText +=
                `📌 Answer: *${qData.answer}*`;
        }

        else if (gameType === 'emojigame') {
            timeOutText +=
                `📌 Movie: *${qData.answer}*`;
        }

        else if (gameType === 'guesssong') {
            timeOutText +=
                `📌 Song: *${qData.answer}*`;
        }

        else if (gameType === 'typing') {
            timeOutText +=
                `📌 Correct Text: *${qData.phrase}*`;
        }

        await session.sock.sendMessage(from, {
            text: timeOutText
        });

        setTimeout(() => {
            if (activeGames[from] === session) {
                nextRound(from);
            }
        }, 3000);

    }, roundTimeLimit * 1000);
}

/*
=================================================
HANDLE PLAYER ANSWERS
=================================================
*/

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

    /*
    Ignore empty messages.
    */
    if (!text || !String(text).trim()) {
        return false;
    }

    const sender =
        m.key.participant ||
        m.key.remoteJid;

    const cleanText = normalizeText(text);
    const cleanUpper = cleanText.toUpperCase();

    const q = session.activeQuestion;

    let isCorrect = false;
    let specialResponse = false;

    /*
    =============================================
    TRIVIA / QUIZ
    =============================================
    */

    if (
        session.gameType === 'trivia' ||
        session.gameType === 'quiz'
    ) {
        /*
        Accept A/B/C/D.
        Also accept the full answer text.
        */
        if (
            ['A', 'B', 'C', 'D'].includes(cleanUpper)
        ) {
            if (cleanUpper === q.answer) {
                isCorrect = true;
            }
        } else {
            const correctOption =
                q.options[q.answer];

            if (
                normalizeText(correctOption) ===
                cleanText
            ) {
                isCorrect = true;
            }
        }
    }

    /*
    =============================================
    SCRAMBLE
    =============================================
    */

    else if (session.gameType === 'scramble') {
        if (
            answerMatches(
                cleanText,
                q.targetWord || q.word
            )
        ) {
            isCorrect = true;
        }
    }

    /*
    =============================================
    GUESS NUMBER
    =============================================
    */

    else if (session.gameType === 'guess') {
        const num = Number(
            String(text).trim()
        );

        if (
            Number.isFinite(num) &&
            Number.isInteger(num)
        ) {
            if (
                num ===
                Number(q.targetNumber)
            ) {
                isCorrect = true;
            } else {
                const hint =
                    num < q.targetNumber
                        ? '📈 *HIGHER!*'
                        : '📉 *LOWER!*';

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

                specialResponse = true;
            }
        }
    }

    /*
    =============================================
    RIDDLE
    =============================================
    */

    else if (session.gameType === 'riddle') {
        if (
            answerMatches(
                cleanText,
                q.answer,
                q.aliases || []
            )
        ) {
            isCorrect = true;
        }
    }

    /*
    =============================================
    EMOJI GAME
    =============================================
    */

    else if (session.gameType === 'emojigame') {
        if (
            answerMatches(
                cleanText,
                q.answer,
                q.aliases || []
            )
        ) {
            isCorrect = true;
        }
    }

    /*
    =============================================
    GUESS SONG
    =============================================
    */

    else if (session.gameType === 'guesssong') {
        if (
            answerMatches(
                cleanText,
                q.answer,
                q.aliases || []
            )
        ) {
            isCorrect = true;
        }
    }

    /*
    =============================================
    TYPING
    =============================================
    */

    else if (session.gameType === 'typing') {
        if (
            normalizeText(text) ===
            normalizeText(q.phrase)
        ) {
            isCorrect = true;
        }
    }

    /*
    If this was a valid game response but
    wasn't correct, leave the game running.
    */
    if (specialResponse) {
        return true;
    }

    /*
    Wrong answer for other games:
    do nothing and let another player try.
    */
    if (!isCorrect) {
        return false;
    }

    /*
    =============================================
    CORRECT ANSWER
    =============================================
    */

    session.answeredThisRound = true;

    if (session.timer) {
        clearTimeout(session.timer);
        session.timer = null;
    }

    session.scores[sender] =
        (session.scores[sender] || 0) + 5;

    const sortedScores =
        Object.entries(session.scores)
            .sort((a, b) => b[1] - a[1]);

    let winAnnouncement =
`🎉 *CORRECT ANSWER!* 🎉

👑 @${sender.replace(/[^0-9]/g, '')}
💎 *+5 POINTS!*

🏆 *CURRENT SCORES:*`;

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

            winAnnouncement +=
                `\n${medal} ${index + 1}. @${user.replace(/[^0-9]/g, '')} — *${pts} pts*`;
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
    Start next round after 3 seconds.
    */
    setTimeout(() => {
        if (activeGames[from] === session) {
            nextRound(from);
        }
    }, 3000);

    return true;
}

/*
=================================================
END GAME
=================================================
*/

async function endGame(from) {
    const session = activeGames[from];

    if (!session) {
        return;
    }

    if (session.timer) {
        clearTimeout(session.timer);
    }

    const sortedScores =
        Object.entries(session.scores)
            .sort((a, b) => b[1] - a[1]);

    const gameTitle =
        getGameTitle(session.gameType);

    let finalDashboard =
`┏━━━ 🏆 *GAME OVER* 🏆 ━━━┓
┃
┃ 🎮 *${gameTitle}*
┃
┃ 🔥 *FINAL LEADERBOARD*
┃`;

    if (sortedScores.length === 0) {
        finalDashboard +=
            `\n┃ ❌ Nobody scored any points.`;
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
                    `\n┃ ${medal} ${index + 1}. @${user.replace(/[^0-9]/g, '')} — *${pts} pts*`;
            }
        );

        const winner =
            sortedScores[0][0];

        finalDashboard +=
            `\n┃\n┃ 👑 *WINNER:* @${winner.replace(/[^0-9]/g, '')} 🎉`;
    }

    finalDashboard +=
`
┃
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

    const mentionsList =
        sortedScores.map(
            ([user]) => user
        );

    await session.sock.sendMessage(
        from,
        {
            text: finalDashboard,
            mentions: mentionsList
        }
    );

    delete activeGames[from];
}

/*
=================================================
CHECK ACTIVE GAME
=================================================
*/

function isGameActive(from) {
    return !!activeGames[from];
}

/*
=================================================
EXPORTS
=================================================
*/

module.exports = {
    startGame,
    stopGame,
    handleGameMessage,
    isGameActive
};
