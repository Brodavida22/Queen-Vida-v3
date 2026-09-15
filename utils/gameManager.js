const fs = require('fs');
const path = require('path');

const activeGames = new Map();

function loadQuestions(game) {
    try {
        const filePath = path.join(__dirname, '..', 'games', `${game}.json`);

        if (!fs.existsSync(filePath)) {
            console.error(`❌ Game file not found: ${filePath}`);
            return [];
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (!Array.isArray(data)) {
            console.error(`❌ Game file must contain an array: ${game}.json`);
            return [];
        }

        return data;
    } catch (error) {
        console.error(`❌ Failed to load ${game}.json:`, error);
        return [];
    }
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
        .replace(/[.,!?'"`]/g, '');
}

function extractWords(text) {
    return String(text || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

function checkEndingWords(text, qData) {
    const words = extractWords(text);

    if (words.length !== 3) return false;

    const ending = String(qData.ending || '').toLowerCase();

    const uniqueWords = [...new Set(words.map(w => normalizeText(w)))];

    if (uniqueWords.length !== 3) return false;

    return uniqueWords.every(word => word.endsWith(ending));
}

function checkStartingWords(text, qData) {
    const words = extractWords(text);

    if (words.length !== 3) return false;

    const starting = String(qData.starting || '').toLowerCase();

    const uniqueWords = [...new Set(words.map(w => normalizeText(w)))];

    if (uniqueWords.length !== 3) return false;

    return uniqueWords.every(word => word.startsWith(starting));
}

function checkRhymeWords(text, qData) {
    const words = extractWords(text);

    if (words.length !== 3) return false;

    const uniqueWords = [...new Set(words.map(w => normalizeText(w)))];

    if (uniqueWords.length !== 3) return false;

    const rhymes = Array.isArray(qData.rhymes)
        ? qData.rhymes.map(word => normalizeText(word))
        : [];

    const target = normalizeText(qData.word);

    return uniqueWords.every(word =>
        word !== target && rhymes.includes(word)
    );
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
        movemoji: '🎬 EMOJI MOVIE'
    };

    return titles[game] || game.toUpperCase();
}

function formatPlayer(jid) {
    return jid ? `@${jid.split('@')[0]}` : 'Player';
}

async function startGame(sock, from, game, rounds = 10, difficulty = null, customArg = null) {
    if (activeGames.has(from)) {
        await sock.sendMessage(from, {
            text: '⚠️ There is already an active game in this group.\n\nUse `.game stop` to stop it first.'
        });
        return false;
    }

    let questions = loadQuestions(game);

    if (!questions.length) {
        await sock.sendMessage(from, {
            text: `❌ No questions found for *${game}*.\n\nMake sure games/${game}.json exists and contains valid JSON.`
        });
        return false;
    }

    if (difficulty) {
        const filtered = questions.filter(
            q => String(q.difficulty || '').toLowerCase() === String(difficulty).toLowerCase()
        );

        if (filtered.length > 0) {
            questions = filtered;
        }
    }

    questions = shuffle(questions);

    const totalRounds = Math.min(
        Math.max(parseInt(rounds, 10) || 10, 1),
        questions.length
    );

    const gameData = {
        game,
        rounds: totalRounds,
        currentRound: 0,
        questions,
        difficulty,
        customArg,
        scores: {},
        currentQuestion: null,
        timer: null,
        startedAt: Date.now()
    };

    activeGames.set(from, gameData);

    await sock.sendMessage(from, {
        text:
            `🎮 *${getGameTitle(game)} STARTED!*\n\n` +
            `👥 Group Game\n` +
            `🏆 Rounds: *${totalRounds}*\n` +
            (difficulty ? `📊 Difficulty: *${difficulty}*\n` : '') +
            `\n🔥 Everybody can play!\n` +
            `⚡ First correct answer gets the point!\n\n` +
            `Get ready...`
    });

    await new Promise(resolve => setTimeout(resolve, 1200));

    await nextRound(sock, from);

    return true;
}

async function nextRound(sock, from) {
    const gameData = activeGames.get(from);

    if (!gameData) return;

    if (gameData.currentRound >= gameData.rounds) {
        await endGame(sock, from);
        return;
    }

    gameData.currentRound++;

    const questionIndex = gameData.currentRound - 1;
    const qData = gameData.questions[questionIndex];

    if (!qData) {
        await endGame(sock, from);
        return;
    }

    gameData.currentQuestion = qData;

    let text = '';

    switch (gameData.game) {
        case 'trivia':
        case 'quiz':
            text =
                `🧠 *ROUND ${gameData.currentRound}/${gameData.rounds}*\n\n` +
                `❓ ${qData.question || qData.q || 'Question'}\n\n`;

            if (Array.isArray(qData.options)) {
                text += qData.options
                    .map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`)
                    .join('\n');

                text += '\n\n💬 Reply with the answer or option letter.';
            } else {
                text += '💬 Reply with your answer!';
            }
            break;

        case 'scramble':
            text =
                `🔤 *ROUND ${gameData.currentRound}/${gameData.rounds}*\n\n` +
                `🔀 Unscramble this word:\n\n` +
                `*${qData.scrambled || qData.word || qData.question}*\n\n` +
                `💬 First correct answer wins!`;
            break;

        case 'guess':
            text =
                `🔢 *ROUND ${gameData.currentRound}/${gameData.rounds}*\n\n` +
                `🎯 Guess the number!\n\n` +
                `🔢 Range: *${qData.min || 1} - ${qData.max || 100}*\n\n` +
                `💬 Send your guess!`;
            break;

        case 'emoji':
            text =
                `🤯 *ROUND ${gameData.currentRound}/${gameData.rounds}*\n\n` +
                `${qData.emoji || qData.emojis || '❓'}\n\n` +
                `🎯 What does this emoji combination mean?\n\n` +
                `💬 First correct answer wins!`;
            break;

        case 'couples':
            text =
                `❤️ *COUPLES CHALLENGE — ROUND ${gameData.currentRound}/${gameData.rounds}*\n\n` +
                `💞 ${qData.challenge || qData.question}\n\n` +
                `💬 Get involved and reply!`;
            break;

        case 'findemoji':
            text =
                `🔎 *FIND THE EMOJI — ROUND ${gameData.currentRound}/${gameData.rounds}*\n\n` +
                `${qData.emojis || '❓'}\n\n` +
                `🎯 Find the hidden/different emoji!\n\n` +
                `💬 Send your answer!`;
            break;

        case 'ending':
            text =
                `🔚 *WORDS THAT END WITH — ROUND ${gameData.currentRound}/${gameData.rounds}*\n\n` +
                `🎯 Give me *3 words* that end with:\n\n` +
                `👉 *${qData.ending}*\n\n` +
                `💬 Send all 3 words in one message!`;
            break;

        case 'starting':
            text =
                `🔤 *WORDS THAT START WITH — ROUND ${gameData.currentRound}/${gameData.rounds}*\n\n` +
                `🎯 Give me *3 words* that start with:\n\n` +
                `👉 *${qData.starting}*\n\n` +
                `💬 Send all 3 words in one message!`;
            break;

        case 'rhyme':
            text =
                `🎵 *RHYMING WORDS — ROUND ${gameData.currentRound}/${gameData.rounds}*\n\n` +
                `🎯 Give me *3 words* that rhyme with:\n\n` +
                `👉 *${qData.word}*\n\n` +
                `💬 Send all 3 words in one message!`;
            break;

        case 'movemoji':
            text =
                `🎬 *EMOJI MOVIE — ROUND ${gameData.currentRound}/${gameData.rounds}*\n\n` +
                `${qData.emojis || qData.emoji || '❓'}\n\n` +
                `🎯 Guess the movie represented by these emojis!\n\n` +
                `💬 First correct answer wins!`;
            break;

        default:
            text =
                `🎮 *ROUND ${gameData.currentRound}/${gameData.rounds}*\n\n` +
                `${qData.question || qData.challenge || 'Your turn!'}\n\n` +
                `💬 Send your answer!`;
    }

    await sock.sendMessage(from, { text });

    if (gameData.timer) {
        clearTimeout(gameData.timer);
    }

    gameData.timer = setTimeout(async () => {
        const currentGame = activeGames.get(from);

        if (!currentGame || currentGame.currentRound !== gameData.currentRound) {
            return;
        }

        let timeoutText = `⏰ *TIME'S UP!*\n\n`;

        if (gameData.game === 'trivia' || gameData.game === 'quiz') {
            timeoutText += `✅ Answer: *${qData.answer || 'Unknown'}*`;
        } else if (gameData.game === 'scramble') {
            timeoutText += `✅ Answer: *${qData.answer || qData.word || 'Unknown'}*`;
        } else if (gameData.game === 'guess') {
            timeoutText += `🎯 Number was: *${qData.answer || qData.number || 'Unknown'}*`;
        } else if (gameData.game === 'emoji' || gameData.game === 'movemoji') {
            timeoutText += `🎯 Answer: *${qData.answer || 'Unknown'}*`;
        } else if (gameData.game === 'ending') {
            timeoutText += `📝 Examples: *${qData.examples || qData.ending || 'Unknown'}*`;
        } else if (gameData.game === 'starting') {
            timeoutText += `📝 Examples: *${qData.examples || qData.starting || 'Unknown'}*`;
        } else if (gameData.game === 'rhyme') {
            const examples = Array.isArray(qData.rhymes)
                ? qData.rhymes.slice(0, 8).join(', ')
                : 'No examples available';

            timeoutText += `📝 Possible rhymes: *${examples}*`;
        } else if (gameData.game === 'couples') {
            timeoutText += `❤️ Challenge skipped!`;
        } else if (gameData.game === 'findemoji') {
            timeoutText += `🔎 Answer: *${qData.answer || 'Unknown'}*`;
        } else {
            timeoutText += `🎯 Round skipped!`;
        }

        await sock.sendMessage(from, { text: timeoutText });

        await new Promise(resolve => setTimeout(resolve, 1000));

        const latestGame = activeGames.get(from);

        if (latestGame && latestGame.currentRound === gameData.currentRound) {
            await nextRound(sock, from);
        }
    }, 30000);
}

async function handleGameMessage(sock, m, from, body) {
    const gameData = activeGames.get(from);

    if (!gameData) return false;

    const text = String(body || '').trim();

    if (!text) return true;

    if (text.toLowerCase() === '.game stop') {
        await stopGame(sock, from);
        return true;
    }

    const qData = gameData.currentQuestion;

    if (!qData) return true;

    let correct = false;

    switch (gameData.game) {
        case 'trivia':
        case 'quiz': {
            const answer = normalizeText(qData.answer);

            const possibleAnswers = [
                answer,
                normalizeText(qData.correctAnswer)
            ].filter(Boolean);

            const userAnswer = normalizeText(text);

            correct = possibleAnswers.includes(userAnswer);

            if (!correct && Array.isArray(qData.options)) {
                const index = qData.options.findIndex(
                    option => normalizeText(option) === userAnswer
                );

                if (index >= 0) {
                    const letter = String.fromCharCode(65 + index).toLowerCase();

                    if (possibleAnswers.includes(letter)) {
                        correct = true;
                    }
                }
            }

            if (!correct && /^[a-d]$/i.test(text)) {
                correct = possibleAnswers.includes(text.toLowerCase());
            }

            break;
        }

        case 'scramble': {
            const answer = normalizeText(qData.answer || qData.word);
            correct = normalizeText(text) === answer;
            break;
        }

        case 'guess': {
            const number = parseInt(text, 10);
            const answer = Number(qData.answer ?? qData.number);

            if (!Number.isNaN(number) && !Number.isNaN(answer)) {
                if (number === answer) {
                    correct = true;
                }
            }

            break;
        }

        case 'emoji':
        case 'movemoji': {
            const answer = normalizeText(qData.answer);

            if (answer) {
                const userAnswer = normalizeText(text);

                correct =
                    userAnswer === answer ||
                    userAnswer.includes(answer) ||
                    answer.includes(userAnswer);
            }

            break;
        }

        case 'findemoji': {
            const answer = normalizeText(qData.answer);

            if (answer) {
                const userAnswer = normalizeText(text);

                correct =
                    userAnswer === answer ||
                    userAnswer.includes(answer) ||
                    answer.includes(userAnswer);
            }

            break;
        }

        case 'ending':
            correct = checkEndingWords(text, qData);
            break;

        case 'starting':
            correct = checkStartingWords(text, qData);
            break;

        case 'rhyme':
            correct = checkRhymeWords(text, qData);
            break;

        case 'couples':
            // Couples challenges are participation-based.
            // Any non-empty response counts as participation.
            correct = text.length > 0;
            break;

        default: {
            const answer = normalizeText(qData.answer);

            if (answer) {
                correct = normalizeText(text) === answer;
            }

            break;
        }
    }

    if (!correct) {
        return true;
    }

    if (gameData.timer) {
        clearTimeout(gameData.timer);
        gameData.timer = null;
    }

    const participant =
        m?.pushName ||
        m?.name ||
        (m?.key?.participant ? formatPlayer(m.key.participant) : 'Player');

    const participantJid = m?.key?.participant || m?.participant;

    const scoreKey = participantJid || participant;

    gameData.scores[scoreKey] =
        (gameData.scores[scoreKey] || 0) + 1;

    let answerDisplay = qData.answer || '';

    if (gameData.game === 'rhyme') {
        answerDisplay = qData.word;
    }

    await sock.sendMessage(from, {
        text:
            `🎉 *CORRECT!*\n\n` +
            `🏆 @${String(scoreKey).split('@')[0]} gets *+1 point!*\n\n` +
            `📊 Score: *${gameData.scores[scoreKey]}*\n` +
            (answerDisplay ? `✅ Answer: *${answerDisplay}*\n` : '') +
            `\n🔥 Next round coming up...`,
        mentions: participantJid ? [participantJid] : []
    });

    await new Promise(resolve => setTimeout(resolve, 1200));

    const currentGame = activeGames.get(from);

    if (currentGame && currentGame.currentRound === gameData.currentRound) {
        await nextRound(sock, from);
    }

    return true;
}

async function stopGame(sock, from) {
    const gameData = activeGames.get(from);

    if (!gameData) {
        await sock.sendMessage(from, {
            text: 'ℹ️ There is no active game in this group.'
        });

        return false;
    }

    if (gameData.timer) {
        clearTimeout(gameData.timer);
    }

    activeGames.delete(from);

    await sock.sendMessage(from, {
        text: '🛑 *GAME STOPPED!*\n\nThe current game has been cancelled.'
    });

    return true;
}

async function endGame(sock, from) {
    const gameData = activeGames.get(from);

    if (!gameData) return;

    if (gameData.timer) {
        clearTimeout(gameData.timer);
    }

    const scores = Object.entries(gameData.scores)
        .sort((a, b) => b[1] - a[1]);

    let text =
        `🏁 *${getGameTitle(gameData.game)} FINISHED!*\n\n` +
        `🔥 Great game everyone!\n\n`;

    if (!scores.length) {
        text += '😅 Nobody scored this time!';
    } else {
        text += '🏆 *FINAL SCORES*\n\n';

        scores.slice(0, 10).forEach(([jid, score], index) => {
            const medal =
                index === 0 ? '🥇' :
                index === 1 ? '🥈' :
                index === 2 ? '🥉' :
                '🏅';

            text += `${medal} @${String(jid).split('@')[0]} — *${score} point${score === 1 ? '' : 's'}*\n`;
        });

        text += '\n🎉 Thanks for playing!';
    }

    const mentions = scores
        .slice(0, 10)
        .map(([jid]) => jid)
        .filter(jid => jid.includes('@'));

    activeGames.delete(from);

    await sock.sendMessage(from, {
        text,
        mentions
    });
}

function isGameActive(from) {
    return activeGames.has(from);
}

module.exports = {
    startGame,
    stopGame,
    nextRound,
    handleGameMessage,
    endGame,
    isGameActive,
    loadQuestions
};
