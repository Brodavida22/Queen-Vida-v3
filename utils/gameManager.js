const fs = require('fs');
const path = require('path');

const activeGames = new Map();

function loadQuestions(game) {
    const filePath = path.join(__dirname, '..', 'games', `${game}.json`);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Game file not found: ${game}.json`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error(`No questions found for ${game}`);
    }

    return data;
}

function shuffle(array) {
    const arr = [...array];

    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;
}

function normalizeText(text) {
    return String(text || '')
        .toLowerCase()
        .trim()
        .replace(/[.,!?'"`]/g, '')
        .replace(/\s+/g, ' ');
}

function extractWords(text) {
    return normalizeText(text)
        .split(/\s+/)
        .map(word => word.replace(/[^a-z0-9'-]/g, ''))
        .filter(Boolean);
}

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

    return words.every(word => word.endsWith(suffix));
}

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

    return words.every(word => word.startsWith(prefix));
}

function checkRhymeWords(text, question) {
    const words = extractWords(text);

    if (words.length !== 3) {
        return false;
    }

    const uniqueWords = new Set(words);

    if (uniqueWords.size !== 3) {
        return false;
    }

    if (!Array.isArray(question.rhymes)) {
        return false;
    }

    const validRhymes = question.rhymes.map(word => normalizeText(word));

    return words.every(word => validRhymes.includes(word));
}

function getGameTitle(game) {
    const titles = {
        trivia: '🧠 TRIVIA',
        quiz: '❓ QUIZ',
        scramble: '🔤 WORD SCRAMBLE',
        guess: '🔢 NUMBER GUESS',
        emoji: '🤯 GUESS THE EMOJI',
        couples: '❤️ COUPLES CHALLENGE',
        findemoji: '🔎 FIND THE EMOJI',
        ending: '🔚 WORDS THAT END WITH',
        starting: '🔤 WORDS THAT START WITH',
        rhyme: '🎵 RHYMING WORDS',
        movemoji: '🎬 EMOJI MOVIE',
        '2truth1lie': '🕵️ 2 TRUTHS 1 LIE'
    };

    return titles[game] || game.toUpperCase();
}

async function startGame(sock, from, game, rounds = 10, difficulty = null, customArg = null) {
    try {
        let questions = loadQuestions(game);

        if (difficulty) {
            const filtered = questions.filter(
                q => String(q.difficulty || '').toLowerCase() === String(difficulty).toLowerCase()
            );

            if (filtered.length > 0) {
                questions = filtered;
            }
        }

        questions = shuffle(questions);

        rounds = Math.max(
            1,
            Math.min(Number(rounds) || 10, questions.length)
        );

        const gameData = {
            game,
            questions: questions.slice(0, rounds),
            currentRound: 0,
            scores: {},
            timer: null,
            difficulty,
            customArg
        };

        activeGames.set(from, gameData);

        await sock.sendMessage(from, {
            text:
                `🎮 *${getGameTitle(game)} STARTED!*\n\n` +
                `📚 Game: *${getGameTitle(game)}*\n` +
                `🔢 Rounds: *${rounds}*\n` +
                (difficulty ? `🎯 Difficulty: *${difficulty}*\n` : '') +
                `⏱️ You have *30 seconds* per round!\n\n` +
                `🔥 LET THE GAME BEGIN!`
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        await nextRound(sock, from);

        return true;
    } catch (error) {
        console.error('startGame error:', error);

        await sock.sendMessage(from, {
            text: `❌ Could not start *${game}*.\n\n${error.message}`
        });

        return false;
    }
}

async function nextRound(sock, from) {
    const gameData = activeGames.get(from);

    if (!gameData) {
        return;
    }

    if (gameData.timer) {
        clearTimeout(gameData.timer);
        gameData.timer = null;
    }

    gameData.currentRound++;

    if (gameData.currentRound > gameData.questions.length) {
        await endGame(sock, from);
        return;
    }

    const qData = gameData.questions[gameData.currentRound - 1];

    let text = '';

    switch (gameData.game) {
        case 'trivia':
        case 'quiz': {
            text =
                `🧠 *${getGameTitle(gameData.game)} — ROUND ${gameData.currentRound}/${gameData.questions.length}*\n\n` +
                `❓ ${qData.question}\n\n`;

            if (Array.isArray(qData.options)) {
                qData.options.forEach((option, index) => {
                    text += `${String.fromCharCode(65 + index)}️⃣ ${option}\n`;
                });

                text += `\n💬 Reply with the correct option!`;
            } else {
                text += `💬 Reply with your answer!`;
            }

            break;
        }

        case 'scramble':
            text =
                `🔤 *WORD SCRAMBLE — ROUND ${gameData.currentRound}/${gameData.questions.length}*\n\n` +
                `🧩 Unscramble this word:\n\n` +
                `👉 *${qData.scrambled || qData.word || qData.question}*\n\n` +
                `💬 Type the correct word!`;
            break;

        case 'guess':
            text =
                `🔢 *NUMBER GUESS — ROUND ${gameData.currentRound}/${gameData.questions.length}*\n\n` +
                `🎯 Guess the number!\n\n` +
                `💡 ${qData.hint || 'Take your best guess!'}\n\n` +
                `💬 Send a number between ${qData.min || 1} and ${qData.max || 100}.`;
            break;

        case 'emoji':
            text =
                `🤯 *GUESS THE EMOJI — ROUND ${gameData.currentRound}/${gameData.questions.length}*\n\n` +
                `${qData.emoji}\n\n` +
                `🎯 What does this emoji represent?\n` +
                `💬 Send your answer!`;
            break;

        case 'findemoji':
            text =
                `🔎 *FIND THE EMOJI — ROUND ${gameData.currentRound}/${gameData.questions.length}*\n\n` +
                `${qData.emojis || qData.emoji}\n\n` +
                `🎯 Find the odd/different emoji!\n` +
                `💬 Reply with your answer.`;
            break;

        case 'movemoji':
            text =
                `🎬 *EMOJI MOVIE — ROUND ${gameData.currentRound}/${gameData.questions.length}*\n\n` +
                `${qData.emojis || qData.emoji}\n\n` +
                `🎯 Guess the movie!\n` +
                `💬 Send the movie title.`;
            break;

        case 'couples':
            text =
                `❤️ *COUPLES CHALLENGE — ROUND ${gameData.currentRound}/${gameData.questions.length}*\n\n` +
                `💞 ${qData.challenge}\n\n` +
                `💬 Participate to earn a point!`;
            break;

        case 'ending':
            text =
                `🔚 *WORDS THAT END WITH — ROUND ${gameData.currentRound}/${gameData.questions.length}*\n\n` +
                `🎯 Give me *3 words* that end with:\n\n` +
                `👉 *${qData.ending}*\n\n` +
                `💬 Example: if the ending is "er" → player, water, tiger\n\n` +
                `⚡ First correct answer gets the point!`;
            break;

        case 'starting':
            text =
                `🔤 *WORDS THAT START WITH — ROUND ${gameData.currentRound}/${gameData.questions.length}*\n\n` +
                `🎯 Give me *3 words* that start with:\n\n` +
                `👉 *${qData.starting}*\n\n` +
                `💬 Example: if the starting is "st" → star, stone, story\n\n` +
                `⚡ First correct answer gets the point!`;
            break;

        case 'rhyme':
            text =
                `🎵 *RHYMING WORDS — ROUND ${gameData.currentRound}/${gameData.questions.length}*\n\n` +
                `🎯 Give me *3 words* that rhyme with:\n\n` +
                `👉 *${qData.word}*\n\n` +
                `💬 Send exactly 3 words!\n\n` +
                `⚡ First correct answer gets the point!`;
            break;

        case '2truth1lie':
            text =
                `🕵️ *2 TRUTHS 1 LIE — ROUND ${gameData.currentRound}/${gameData.questions.length}*\n\n` +
                `1️⃣ ${qData.statements?.[0] || ''}\n` +
                `2️⃣ ${qData.statements?.[1] || ''}\n` +
                `3️⃣ ${qData.statements?.[2] || ''}\n\n` +
                `🎯 *Which statement is the LIE?*\n\n` +
                `💬 Reply with *1*, *2*, or *3*!`;
            break;

        default:
            text =
                `🎮 *ROUND ${gameData.currentRound}/${gameData.questions.length}*\n\n` +
                `${qData.question || 'Answer this challenge!'}\n\n` +
                `💬 Reply with your answer!`;
    }

    await sock.sendMessage(from, { text });

    gameData.timer = setTimeout(async () => {
        const currentGame = activeGames.get(from);

        if (!currentGame || currentGame !== gameData) {
            return;
        }

        let answerText = '';

        if (gameData.game === '2truth1lie') {
            answerText =
                `⏰ *TIME'S UP!*\n\n` +
                `The lie was statement *${qData.lie}*.\n\n` +
                `😅 Better luck next round!`;
        } else if (
            gameData.game === 'emoji' ||
            gameData.game === 'movemoji' ||
            gameData.game === 'scramble' ||
            gameData.game === 'trivia' ||
            gameData.game === 'quiz'
        ) {
            answerText =
                `⏰ *TIME'S UP!*\n\n` +
                `✅ Correct answer: *${qData.answer || qData.word || 'See the next round'}*`;
        } else {
            answerText =
                `⏰ *TIME'S UP!*\n\n` +
                `Nobody got it this round! 😭`;
        }

        await sock.sendMessage(from, { text: answerText });

        setTimeout(async () => {
            if (activeGames.get(from) === gameData) {
                await nextRound(sock, from);
            }
        }, 2000);
    }, 30000);
}

async function handleGameMessage(sock, m, from, body) {
    const gameData = activeGames.get(from);

    if (!gameData) {
        return false;
    }

    const text = String(body || '').trim();

    if (!text) {
        return true;
    }

    const qData = gameData.questions[gameData.currentRound - 1];

    if (!qData) {
        return true;
    }

    let correct = false;

    switch (gameData.game) {
        case 'trivia':
        case 'quiz': {
            const answer = normalizeText(qData.answer);

            const userAnswer = normalizeText(text);

            if (
                userAnswer === answer ||
                (Array.isArray(qData.options) &&
                    qData.options.some(
                        (option, index) =>
                            userAnswer === String.fromCharCode(97 + index) &&
                            normalizeText(option) === answer
                    ))
            ) {
                correct = true;
            }

            break;
        }

        case 'scramble': {
            const answer = normalizeText(qData.answer || qData.word);
            correct = normalizeText(text) === answer;
            break;
        }

        case 'guess': {
            const userNumber = Number(text);
            const answer = Number(qData.answer);

            if (!Number.isNaN(userNumber) && userNumber === answer) {
                correct = true;
            }

            break;
        }

        case 'emoji':
        case 'movemoji': {
            const answer = normalizeText(qData.answer);
            correct = normalizeText(text) === answer;
            break;
        }

        case 'findemoji': {
            const answer = normalizeText(qData.answer);
            correct = normalizeText(text) === answer;
            break;
        }

        case 'couples':
            correct = text.length > 0;
            break;

        case 'ending':
            correct = checkEndingWords(text, qData.ending);
            break;

        case 'starting':
            correct = checkStartingWords(text, qData.starting);
            break;

        case 'rhyme':
            correct = checkRhymeWords(text, qData);
            break;

        case '2truth1lie': {
            const answer = Number(text);

            if ([1, 2, 3].includes(answer)) {
                correct = answer === Number(qData.lie);
            }

            break;
        }

        default:
            correct = normalizeText(text) === normalizeText(qData.answer);
    }

    if (!correct) {
        return true;
    }

    if (gameData.timer) {
        clearTimeout(gameData.timer);
        gameData.timer = null;
    }

    const participant =
        m.pushName ||
        m.notifyName ||
        m.sender ||
        'Player';

    if (!gameData.scores[participant]) {
        gameData.scores[participant] = 0;
    }

    gameData.scores[participant]++;

    let answerMessage = '';

    if (gameData.game === '2truth1lie') {
        answerMessage =
            `🎯 *CORRECT!*\n\n` +
            `🕵️ ${participant} found the lie!\n` +
            `✅ Statement *${qData.lie}* was the lie.\n\n` +
            `🏆 *+1 POINT*`;
    } else {
        answerMessage =
            `🎉 *CORRECT!*\n\n` +
            `👑 ${participant} got it first!\n` +
            `🏆 *+1 POINT*`;
    }

    await sock.sendMessage(from, {
        text: answerMessage
    });

    setTimeout(async () => {
        if (activeGames.get(from) === gameData) {
            await nextRound(sock, from);
        }
    }, 2000);

    return true;
}

async function stopGame(sock, from) {
    const gameData = activeGames.get(from);

    if (!gameData) {
        await sock.sendMessage(from, {
            text: `❌ There is no active game in this group.`
        });

        return false;
    }

    if (gameData.timer) {
        clearTimeout(gameData.timer);
    }

    activeGames.delete(from);

    await sock.sendMessage(from, {
        text:
            `🛑 *GAME STOPPED!*\n\n` +
            `🎮 ${getGameTitle(gameData.game)}\n` +
            `📊 Round: ${gameData.currentRound}/${gameData.questions.length}`
    });

    return true;
}

async function endGame(sock, from) {
    const gameData = activeGames.get(from);

    if (!gameData) {
        return;
    }

    if (gameData.timer) {
        clearTimeout(gameData.timer);
        gameData.timer = null;
    }

    const scores = Object.entries(gameData.scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    let text =
        `🏁 *GAME OVER!*\n\n` +
        `🎮 *${getGameTitle(gameData.game)}*\n` +
        `📊 ${gameData.questions.length} rounds completed\n\n`;

    if (scores.length === 0) {
        text += `😅 Nobody scored this time!`;
    } else {
        text += `🏆 *FINAL LEADERBOARD*\n\n`;

        scores.forEach(([name, score], index) => {
            const medals = ['🥇', '🥈', '🥉'];

            text += `${medals[index] || `${index + 1}.`} *${name}* — ${score} point${score === 1 ? '' : 's'}\n`;
        });

        text += `\n🔥 Thanks for playing!`;
    }

    activeGames.delete(from);

    await sock.sendMessage(from, { text });
}

function isGameActive(from) {
    return activeGames.has(from);
}

module.exports = {
    startGame,
    nextRound,
    handleGameMessage,
    stopGame,
    endGame,
    isGameActive,
    getGameTitle
};
