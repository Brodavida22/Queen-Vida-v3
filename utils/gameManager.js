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

function loadQuestions(gameType) {
    try {
        const filePath = path.join(__dirname, '..', 'games', `${gameType}.json`);
        if (!fs.existsSync(filePath)) return [];
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        console.error(`Error loading questions for ${gameType}:`, e);
        return [];
    }
}

async function startGame(sock, from, gameType, totalRounds) {
    if (activeGames[from]) {
        await sock.sendMessage(from, { text: '❌ A game is already active in this group! Use `!game stop` to end it first.' });
        return;
    }

    const allQuestions = loadQuestions(gameType);
    if (allQuestions.length === 0) {
        await sock.sendMessage(from, { text: `❌ Failed to load questions for *${gameType}*. Please check data files.` });
        return;
    }

    shuffle(allQuestions);
    const sessionQuestions = allQuestions.slice(0, Math.min(totalRounds, allQuestions.length));

    activeGames[from] = {
        gameType,
        rounds: sessionQuestions.length,
        currentRound: 0,
        questions: sessionQuestions,
        scores: {}, 
        activeQuestion: null,
        timer: null,
        answeredThisRound: false,
        sock
    };

    let gameTitle = gameType === 'trivia' ? '🎯 TRIVIA SHOWDOWN' : gameType === 'scramble' ? '🔤 WORD SCRAMBLE' : '🔢 NUMBER GUESSING';
    const roundDuration = gameType === 'trivia' ? '25s' : '45s';

    const startMsg = 
`┏━━━ 🎮 *QUEEN VIDA GAME SUITE* 🎮 ━━━┓\n` +
`┃ 🏆 *Game:* ${gameTitle}\n` +
`┃ 🔄 *Total Rounds:* ${sessionQuestions.length}\n` +
`┃ ⏱️ *Time Limit:* ${roundDuration} Per Round\n` +
`┃ 💎 *Reward:* 5 Points / Correct Answer\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ 🚀 *Game session is starting now!*\n` +
`┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

    await sock.sendMessage(from, { text: startMsg });
    setTimeout(() => nextRound(from), 2000);
}

async function stopGame(sock, from) {
    if (!activeGames[from]) {
        await sock.sendMessage(from, { text: '❌ No active game session found in this group.' });
        return;
    }

    if (activeGames[from].timer) clearTimeout(activeGames[from].timer);
    delete activeGames[from];
    await sock.sendMessage(from, { text: '🛑 *Game session has been manually stopped by an admin/creator!*' });
}

async function nextRound(from) {
    const session = activeGames[from];
    if (!session) return;

    if (session.currentRound >= session.rounds) {
        return endGame(from);
    }

    session.currentRound++;
    session.answeredThisRound = false;
    const qData = session.questions[session.currentRound - 1];
    session.activeQuestion = qData;

    let roundText = '';
    let roundTimeLimit = session.gameType === 'trivia' ? 25 : 45;

    if (session.gameType === 'trivia') {
        roundText = 
`┏━━━ 🎯 *TRIVIA (Round ${session.currentRound}/${session.rounds})* 🎯 ━━━┓\n` +
`┃ ❓ *Question:* ${qData.question}\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ 🅰️ *A)* ${qData.options.A}\n` +
`┃ 🅱️ *B)* ${qData.options.B}\n` +
`┃ 🅲 *C)* ${qData.options.C}\n` +
`┃ 🅳 *D)* ${qData.options.D}\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ ⏱️ *Type your answer option (A, B, C, or D) below!* (${roundTimeLimit}s)\n` +
`┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    } else if (session.gameType === 'scramble') {
        const scrambled = qData.word.split('').sort(() => Math.random() - 0.5).join(' ');
        session.activeQuestion.targetWord = qData.word;

        roundText = 
`┏━━━ 🔤 *WORD SCRAMBLE (Round ${session.currentRound}/${session.rounds})* 🔤 ━━━┓\n` +
`┃ 🔀 *Scrambled:* \`${scrambled}\`\n` +
`┃ 💡 *Hint:* ${qData.hint}\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ ⏱️ *Type the correct unscrambled word below!* (${roundTimeLimit}s)\n` +
`┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    } else if (session.gameType === 'guess') {
        session.activeQuestion.targetNumber = qData.target;

        roundText = 
`┏━━━ 🔢 *NUMBER GUESS (Round ${session.currentRound}/${session.rounds})* 🔢 ━━━┓\n` +
`┃ 🎯 *Guess the number between* ${qData.min} *and* ${qData.max}!\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ ⏱️ *Type your guessed number in chat!* (${roundTimeLimit}s - Bot gives hints)\n` +
`┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;
    }

    await session.sock.sendMessage(from, { text: roundText });

    session.timer = setTimeout(() => {
        if (!activeGames[from] || activeGames[from].answeredThisRound) return;
        
        let timeOutText = `⏰ *Time's up!* No one guessed correctly this round.\n`;
        if (session.gameType === 'trivia') timeOutText += `📌 *Correct Answer was:* *${qData.answer}* (${qData.options[qData.answer]})`;
        else if (session.gameType === 'scramble') timeOutText += `📌 *Correct Word was:* *${qData.word}*`;
        else if (session.gameType === 'guess') timeOutText += `📌 *Secret Number was:* *${qData.target}*`;

        session.sock.sendMessage(from, { text: timeOutText });
        setTimeout(() => nextRound(from), 3000);
    }, roundTimeLimit * 1000);
}

async function handleGameMessage(sock, m, from, text) {
    const session = activeGames[from];
    if (!session || session.answeredThisRound || !session.activeQuestion) return false;

    const sender = m.key.participant || m.key.remoteJid;
    const cleanText = text.trim().toUpperCase();
    const q = session.activeQuestion;
    let isCorrect = false;

    if (session.gameType === 'trivia') {
        if (['A', 'B', 'C', 'D'].includes(cleanText)) {
            if (cleanText === q.answer) {
                isCorrect = true;
            }
        }
    } else if (session.gameType === 'scramble') {
        if (cleanText === q.targetWord.toUpperCase()) {
            isCorrect = true;
        }
    } else if (session.gameType === 'guess') {
        const num = parseInt(cleanText);
        if (!isNaN(num)) {
            if (num === q.targetNumber) {
                isCorrect = true;
            } else {
                const hintDir = num < q.targetNumber ? '📈 *Higher!*' : '📉 *Lower!*';
                await sock.sendMessage(from, { text: `❌ *${num}* is wrong! ${hintDir} Try again!` }, { quoted: m });
                return true;
            }
        }
    }

    if (isCorrect) {
        session.answeredThisRound = true;
        if (session.timer) clearTimeout(session.timer);

        session.scores[sender] = (session.scores[sender] || 0) + 5;

        let winAnnouncement = 
`🎉 *Correct!* @${sender.replace(/[^0-9]/g, '')} guessed right and earned *+5 Points*!\n` +
`🏆 *Current Scores:*`;

        const sortedScores = Object.entries(session.scores).sort((a, b) => b[1] - a[1]);
        sortedScores.forEach(([user, pts], index) => {
            winAnnouncement += `\n${index + 1}. @${user.replace(/[^0-9]/g, '')} — *${pts} pts*`;
        });

        await sock.sendMessage(from, { 
            text: winAnnouncement,
            mentions: sortedScores.map(([user]) => user)
        }, { quoted: m });

        setTimeout(() => nextRound(from), 3000);
        return true;
    }

    return false;
}

async function endGame(from) {
    const session = activeGames[from];
    if (!session) return;

    if (session.timer) clearTimeout(session.timer);

    const sortedScores = Object.entries(session.scores).sort((a, b) => b[1] - a[1]);
    let finalDashboard = 
`┏━━━ 🏆 *GAME OVER - FINAL LEADERBOARD* 🏆 ━━━┓\n` +
`┃ 🎮 *Game Session Completed Successfully!*\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (sortedScores.length === 0) {
        finalDashboard += `┃ ❌ *No players scored any points this session.*\n`;
    } else {
        sortedScores.forEach(([user, pts], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '▪️';
            finalDashboard += `┃ ${medal} ${index + 1}. @${user.replace(/[^0-9]/g, '')} — *${pts} Points*\n`;
        });

        const winner = sortedScores[0][0];
        finalDashboard += `┣━━━━━━━━━━━━━━━━━━━━━━━\n`;
        finalDashboard += `┃ 👑 *WINNER:* @${winner.replace(/[^0-9]/g, '')} 🎉\n`;
    }

    finalDashboard += `┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛`;

    const mentionsList = sortedScores.map(([user]) => user);
    await session.sock.sendMessage(from, { 
        text: finalDashboard,
        mentions: mentionsList
    });

    delete activeGames[from];
}

function isGameActive(from) {
    return !!activeGames[from];
}

module.exports = { startGame, stopGame, handleGameMessage, isGameActive };
