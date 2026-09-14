const fs = require('fs');
const path = require('path');

const activeGames = {};

const GAME_DIR = path.join(__dirname, '..', 'games');

const GAME_CONFIG = {
    trivia: {
        file: 'trivia.json',
        time: 25,
        points: 5
    },
    quiz: {
        file: 'quiz.json',
        time: 25,
        points: 5
    },
    scramble: {
        file: 'scramble.json',
        time: 45,
        points: 5
    },
    guess: {
        file: 'guess.json',
        time: 45,
        points: 5
    }
};

/* =========================
   HELPERS
========================= */

function shuffle(array) {
    return [...array].sort(() => Math.random() - 0.5);
}

function normalizeDifficulty(value) {
    if (!value) return null;

    const difficulty = String(value).toLowerCase();

    if (['easy', 'medium', 'hard'].includes(difficulty)) {
        return difficulty;
    }

    return null;
}

function loadQuestions(gameType) {
    const config = GAME_CONFIG[gameType];

    if (!config) {
        throw new Error(`Unknown game type: ${gameType}`);
    }

    const filePath = path.join(GAME_DIR, config.file);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Game file not found: ${config.file}`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!Array.isArray(data)) {
        throw new Error(`${config.file} must contain an array of questions.`);
    }

    return data;
}

function getQuestionText(question) {
    return (
        question.question ||
        question.q ||
        question.text ||
        'No question provided.'
    );
}

function getOptions(question) {
    if (Array.isArray(question.options)) {
        return question.options;
    }

    if (Array.isArray(question.choices)) {
        return question.choices;
    }

    return [];
}

function getAnswer(question) {
    return (
        question.answer ??
        question.correctAnswer ??
        question.correct ??
        question.answerIndex
    );
}

function formatOptions(options) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    return options
        .map((option, index) => {
            return `${letters[index] || index + 1}. ${option}`;
        })
        .join('\n');
}

function normalizeAnswer(answer, options) {
    if (answer === undefined || answer === null) {
        return null;
    }

    const value = String(answer).trim();

    // A / B / C / D
    const letterIndex = value.toUpperCase().charCodeAt(0) - 65;

    if (
        value.length === 1 &&
        letterIndex >= 0 &&
        letterIndex < options.length
    ) {
        return String(letterIndex);
    }

    // Numeric index
    if (/^\d+$/.test(value)) {
        const number = Number(value);

        if (number >= 0 && number < options.length) {
            return String(number);
        }

        // Also support 1-based answers
        if (number >= 1 && number <= options.length) {
            return String(number - 1);
        }
    }

    // Text answer
    const textIndex = options.findIndex(
        option =>
            String(option).trim().toLowerCase() ===
            value.toLowerCase()
    );

    if (textIndex !== -1) {
        return String(textIndex);
    }

    return value.toLowerCase();
}

function getSenderId(message) {
    return (
        message?.key?.participant ||
        message?.participant ||
        message?.key?.remoteJid ||
        'unknown'
    );
}

/* =========================
   START GAME
========================= */

async function startGame(
    sock,
    from,
    gameType,
    totalRounds = 10,
    difficulty = null
) {
    gameType = String(gameType || '').toLowerCase();

    if (!GAME_CONFIG[gameType]) {
        await sock.sendMessage(
            from,
            {
                text:
                    '❌ Invalid game!\n\n' +
                    'Available games:\n' +
                    '• trivia\n' +
                    '• quiz\n' +
                    '• scramble\n' +
                    '• guess'
            }
        );

        return;
    }

    if (activeGames[from]) {
        await sock.sendMessage(
            from,
            {
                text:
                    '⚠️ A game is already running in this group!\n\n' +
                    'Use *!game stop* to stop the current game.'
            }
        );

        return;
    }

    totalRounds = Number(totalRounds);

    if (!Number.isInteger(totalRounds) || totalRounds < 1) {
        totalRounds = 10;
    }

    let questions;

    try {
        questions = loadQuestions(gameType);
    } catch (error) {
        console.error('❌ Error loading game questions:', error);

        await sock.sendMessage(
            from,
            {
                text: `❌ Unable to load the ${gameType} question bank.`
            }
        );

        return;
    }

    difficulty = normalizeDifficulty(difficulty);

    // Filter by difficulty if requested
    if (difficulty) {
        questions = questions.filter(
            question =>
                String(question.difficulty || '').toLowerCase() ===
                difficulty
        );
    }

    if (questions.length === 0) {
        await sock.sendMessage(
            from,
            {
                text:
                    `❌ No *${difficulty || 'available'}* questions ` +
                    `were found for ${gameType}.`
            }
        );

        return;
    }

    if (totalRounds > questions.length) {
        totalRounds = questions.length;
    }

    const selectedQuestions = shuffle(questions).slice(
        0,
        totalRounds
    );

    activeGames[from] = {
        gameType,
        difficulty,
        questions: selectedQuestions,
        currentRound: 0,
        scores: {},
        timer: null,
        startedAt: Date.now()
    };

    const difficultyText = difficulty
        ? `\n🎯 Difficulty: *${difficulty.toUpperCase()}*`
        : '';

    await sock.sendMessage(from, {
        text:
            `🎮 *${gameType.toUpperCase()} GAME STARTED!*\n\n` +
            `🏆 Rounds: *${totalRounds}*${difficultyText}\n` +
            `⭐ Correct answer: *+${GAME_CONFIG[gameType].points} points*\n\n` +
            `🔥 Get ready!`
    });

    await sendNextQuestion(sock, from);
}

/* =========================
   SEND NEXT QUESTION
========================= */

async function sendNextQuestion(sock, from) {
    const game = activeGames[from];

    if (!game) return;

    if (game.currentRound >= game.questions.length) {
        await endGame(sock, from);
        return;
    }

    const question =
        game.questions[game.currentRound];

    game.currentQuestion = question;

    const config = GAME_CONFIG[game.gameType];

    let text = '';

    if (
        game.gameType === 'trivia' ||
        game.gameType === 'quiz'
    ) {
        const options = getOptions(question);

        text =
            `🎯 *${game.gameType.toUpperCase()}*\n\n` +
            `📍 Round ${game.currentRound + 1}/${game.questions.length}\n\n` +
            `❓ *${getQuestionText(question)}*\n\n`;

        if (options.length > 0) {
            text += formatOptions(options) + '\n\n';
        }

        text +=
            `⏱️ You have *${config.time} seconds*!\n` +
            `💡 Reply with *A, B, C,* or *D*.`;
    }

    else if (game.gameType === 'scramble') {
        const scrambled =
            question.scrambled ||
            question.scramble ||
            question.question ||
            question.word ||
            '';

        text =
            `🔀 *SCRAMBLE GAME*\n\n` +
            `📍 Round ${game.currentRound + 1}/${game.questions.length}\n\n` +
            `🔤 Unscramble this word:\n\n` +
            `👉 *${scrambled}*\n\n` +
            `⏱️ You have *${config.time} seconds*!`;
    }

    else if (game.gameType === 'guess') {
        text =
            `🎯 *GUESS GAME*\n\n` +
            `📍 Round ${game.currentRound + 1}/${game.questions.length}\n\n` +
            `❓ *${getQuestionText(question)}*\n\n` +
            `⏱️ You have *${config.time} seconds*!`;
    }

    await sock.sendMessage(from, { text });

    if (game.timer) {
        clearTimeout(game.timer);
    }

    game.timer = setTimeout(async () => {
        const currentGame = activeGames[from];

        if (!currentGame) return;

        await sock.sendMessage(from, {
            text:
                `⏰ *TIME'S UP!*\n\n` +
                `❌ Nobody got this round.\n` +
                `➡️ Moving to the next round...`
        });

        currentGame.currentRound++;

        await sendNextQuestion(sock, from);
    }, config.time * 1000);
}

/* =========================
   HANDLE ANSWERS
========================= */

async function handleGameMessage(sock, from, message) {
    const game = activeGames[from];

    if (!game || !game.currentQuestion) {
        return false;
    }

    const messageText =
        message?.message?.conversation ||
        message?.message?.extendedTextMessage?.text ||
        message?.text ||
        '';

    const answerText = String(messageText).trim();

    if (!answerText) {
        return false;
    }

    const sender = getSenderId(message);

    const question = game.currentQuestion;
    const config = GAME_CONFIG[game.gameType];

    const options = getOptions(question);
    const correctAnswer = getAnswer(question);

    let userAnswer = answerText.toLowerCase();

    // For trivia / quiz, allow A/B/C/D answers
    if (
        game.gameType === 'trivia' ||
        game.gameType === 'quiz'
    ) {
        if (options.length > 0) {
            const letter = answerText
                .trim()
                .toUpperCase();

            const index =
                letter.charCodeAt(0) - 65;

            if (
                letter.length === 1 &&
                index >= 0 &&
                index < options.length
            ) {
                userAnswer = String(index);
            }
        }
    }

    const normalizedCorrect =
        normalizeAnswer(correctAnswer, options);

    let isCorrect = false;

    if (normalizedCorrect !== null) {
        if (options.length > 0) {
            isCorrect =
                userAnswer ===
                String(normalizedCorrect).toLowerCase();
        } else {
            isCorrect =
                userAnswer ===
                String(normalizedCorrect).toLowerCase();
        }
    }

    if (isCorrect) {
        if (game.timer) {
            clearTimeout(game.timer);
            game.timer = null;
        }

        game.scores[sender] =
            (game.scores[sender] || 0) +
            config.points;

        const playerName =
            sender.split('@')[0];

        await sock.sendMessage(from, {
            text:
                `✅ *CORRECT!*\n\n` +
                `🎉 @${playerName} got it!\n` +
                `⭐ +${config.points} points\n` +
                `🏆 Total: *${game.scores[sender]} points*`,
            mentions: [sender]
        });

        game.currentRound++;

        await new Promise(resolve =>
            setTimeout(resolve, 800)
        );

        await sendNextQuestion(sock, from);

        return true;
    }

    // For wrong answers, don't end the round.
    // This allows another player to answer.
    return false;
}

/* =========================
   STOP GAME
========================= */

async function stopGame(sock, from) {
    const game = activeGames[from];

    if (!game) {
        await sock.sendMessage(from, {
            text: '❌ There is no active game in this group.'
        });

        return;
    }

    if (game.timer) {
        clearTimeout(game.timer);
    }

    delete activeGames[from];

    await sock.sendMessage(from, {
        text:
            `🛑 *GAME STOPPED!*\n\n` +
            `The ${game.gameType.toUpperCase()} game has been stopped by an admin.`
    });
}

/* =========================
   END GAME
========================= */

async function endGame(sock, from) {
    const game = activeGames[from];

    if (!game) return;

    if (game.timer) {
        clearTimeout(game.timer);
    }

    const scores = Object.entries(game.scores);

    scores.sort((a, b) => b[1] - a[1]);

    let leaderboard =
        `🏆 *${game.gameType.toUpperCase()} GAME OVER!*\n\n`;

    if (scores.length === 0) {
        leaderboard +=
            `😅 Nobody scored any points this time!`;
    } else {
        const medals = ['🥇', '🥈', '🥉'];

        scores.forEach(
            ([jid, score], index) => {
                const medal =
                    medals[index] || '🏅';

                leaderboard +=
                    `${medal} @${jid.split('@')[0]} — *${score} points*\n`;
            }
        );

        leaderboard +=
            `\n🎉 Congratulations to everyone who played!`;
    }

    await sock.sendMessage(from, {
        text: leaderboard,
        mentions: scores.map(
            ([jid]) => jid
        )
    });

    delete activeGames[from];
}

/* =========================
   STATUS
========================= */

function isGameActive(from) {
    return Boolean(activeGames[from]);
}

module.exports = {
    startGame,
    stopGame,
    handleGameMessage,
    isGameActive,
    endGame
};
