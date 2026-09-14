// ============================================================
// QUEEN VIDA-V3 — ADVANCED FUN GAMES
//
// Commands:
// .guess
// .guessnumber
// .guesssong
// .emojigame
// .riddle
// .quiz
// .trivia
// .typing
// ============================================================


// ============================================================
// RANDOM HELPER
// ============================================================

function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}


// ============================================================
// NUMBER GUESS
// ============================================================

const numberGames = new Map();

async function guessNumber(sock, message, chatId, args) {
    let max = parseInt(args?.[0], 10);

    if (!Number.isFinite(max)) {
        max = 100;
    }

    if (max < 10) {
        max = 10;
    }

    if (max > 10000) {
        max = 10000;
    }

    const number = Math.floor(Math.random() * max) + 1;

    numberGames.set(chatId, {
        number,
        max,
        attempts: 0
    });

    await sock.sendMessage(
        chatId,
        {
            text:
                `🎯 *GUESS THE NUMBER*\n\n` +
                `I've picked a number between *1 - ${max}*.\n\n` +
                `🔢 Send your guess now!\n` +
                `💡 Example: *50*\n\n` +
                `⏳ You have unlimited attempts.`
        },
        { quoted: message }
    );
}


// ============================================================
// SIMPLE GUESS
// ============================================================

async function guess(sock, message, chatId) {
    const number = Math.floor(Math.random() * 10) + 1;

    numberGames.set(chatId, {
        number,
        max: 10,
        attempts: 0
    });

    await sock.sendMessage(
        chatId,
        {
            text:
                `🎯 *GUESSING GAME*\n\n` +
                `I'm thinking of a number between *1 and 10*.\n\n` +
                `🤔 What is it?`
        },
        { quoted: message }
    );
}


// ============================================================
// GUESS SONG
// ============================================================

const songGames = [
    {
        clues: [
            "🎵 This song became a huge global hit.",
            "🎤 The artist is known for Afrobeats.",
            "🔥 The title contains the word 'Love'."
        ],
        answer: "Love"
    },
    {
        clues: [
            "🎵 This song is popular at parties.",
            "🎤 It has a strong dance beat.",
            "🔥 The artist is from Nigeria."
        ],
        answer: "Unavailable"
    },
    {
        clues: [
            "🎵 This song is about money and success.",
            "💰 It became popular across Africa.",
            "🎤 It is an Afrobeats song."
        ],
        answer: "Unavailable"
    },
    {
        clues: [
            "🎵 This is a very popular Nigerian music style.",
            "🔥 It is commonly played at parties.",
            "🎤 Many Nigerian artists use it."
        ],
        answer: "Afrobeats"
    },
    {
        clues: [
            "🎵 This song is associated with heartbreak.",
            "💔 The lyrics are emotional.",
            "🎤 The singer is known for emotional songs."
        ],
        answer: "Heartbreak"
    }
];

async function guessSong(sock, message, chatId) {
    const game = randomItem(songGames);

    await sock.sendMessage(
        chatId,
        {
            text:
                `🎵 *GUESS THE SONG*\n\n` +
                `${game.clues.join("\n")}\n\n` +
                `🤔 What song do you think it is?\n\n` +
                `⚠️ *Hint:* Reply with your answer!`
        },
        { quoted: message }
    );
}


// ============================================================
// EMOJI GAME
// ============================================================

const emojiGames = [
    {
        emojis: "🦁👑",
        answer: "The Lion King"
    },
    {
        emojis: "🚢💔🌊",
        answer: "Titanic"
    },
    {
        emojis: "🕷️👨",
        answer: "Spider-Man"
    },
    {
        emojis: "❄️👸",
        answer: "Frozen"
    },
    {
        emojis: "🦇👨",
        answer: "Batman"
    },
    {
        emojis: "🧙‍♂️⚡🏰",
        answer: "Harry Potter"
    },
    {
        emojis: "👻🚫",
        answer: "Ghostbusters"
    },
    {
        emojis: "🐠🔍",
        answer: "Finding Nemo"
    },
    {
        emojis: "🤖🚗",
        answer: "Transformers"
    },
    {
        emojis: "🦖🏝️",
        answer: "Jurassic Park"
    },
    {
        emojis: "👽📞🏠",
        answer: "E.T."
    },
    {
        emojis: "🐀👨‍🍳",
        answer: "Ratatouille"
    },
    {
        emojis: "👸🐸",
        answer: "The Princess and the Frog"
    },
    {
        emojis: "🧜‍♀️🌊",
        answer: "The Little Mermaid"
    },
    {
        emojis: "👠🎃👸",
        answer: "Cinderella"
    }
];

async function emojiGame(sock, message, chatId) {
    const game = randomItem(emojiGames);

    await sock.sendMessage(
        chatId,
        {
            text:
                `🧩 *EMOJI GUESS GAME*\n\n` +
                `Guess the movie from these emojis:\n\n` +
                `👉 *${game.emojis}*\n\n` +
                `🤔 What movie is this?`
        },
        { quoted: message }
    );
}


// ============================================================
// RIDDLES
// ============================================================

const riddles = [
    {
        question: "What has keys but cannot open locks?",
        answer: "A piano"
    },
    {
        question: "What has hands but cannot clap?",
        answer: "A clock"
    },
    {
        question: "What gets wetter the more it dries?",
        answer: "A towel"
    },
    {
        question: "What has a head and a tail but no body?",
        answer: "A coin"
    },
    {
        question: "What can travel around the world while staying in one corner?",
        answer: "A stamp"
    },
    {
        question: "What has many teeth but cannot bite?",
        answer: "A comb"
    },
    {
        question: "What goes up but never comes down?",
        answer: "Your age"
    },
    {
        question: "What has one eye but cannot see?",
        answer: "A needle"
    },
    {
        question: "What has a neck but no head?",
        answer: "A bottle"
    },
    {
        question: "What belongs to you but other people use it more than you?",
        answer: "Your name"
    },
    {
        question: "What is full of holes but still holds water?",
        answer: "A sponge"
    },
    {
        question: "What has words but never speaks?",
        answer: "A book"
    },
    {
        question: "What can you catch but not throw?",
        answer: "A cold"
    },
    {
        question: "What has four legs in the morning, two legs at noon and three legs in the evening?",
        answer: "A human"
    },
    {
        question: "What disappears as soon as you say its name?",
        answer: "Silence"
    }
];

async function riddle(sock, message, chatId) {
    const game = randomItem(riddles);

    await sock.sendMessage(
        chatId,
        {
            text:
                `🧠 *RIDDLE TIME*\n\n` +
                `❓ ${game.question}\n\n` +
                `🤔 Think carefully!\n` +
                `👇 Send your answer.`
        },
        { quoted: message }
    );
}


// ============================================================
// QUIZ
// ============================================================

const quizzes = [
    {
        question: "What is the capital of Nigeria?",
        options: [
            "A️⃣ Lagos",
            "B️⃣ Abuja",
            "C️⃣ Kano",
            "D️⃣ Ibadan"
        ],
        answer: "b"
    },
    {
        question: "How many days are in a leap year?",
        options: [
            "A️⃣ 364",
            "B️⃣ 365",
            "C️⃣ 366",
            "D️⃣ 367"
        ],
        answer: "c"
    },
    {
        question: "Which planet is known as the Red Planet?",
        options: [
            "A️⃣ Earth",
            "B️⃣ Mars",
            "C️⃣ Venus",
            "D️⃣ Jupiter"
        ],
        answer: "b"
    },
    {
        question: "How many continents are there?",
        options: [
            "A️⃣ 5",
            "B️⃣ 6",
            "C️⃣ 7",
            "D️⃣ 8"
        ],
        answer: "c"
    },
    {
        question: "Which animal is known as the King of the Jungle?",
        options: [
            "A️⃣ Tiger",
            "B️⃣ Lion",
            "C️⃣ Elephant",
            "D️⃣ Leopard"
        ],
        answer: "b"
    },
    {
        question: "What is 10 × 10?",
        options: [
            "A️⃣ 10",
            "B️⃣ 50",
            "C️⃣ 100",
            "D️⃣ 1000"
        ],
        answer: "c"
    },
    {
        question: "Which ocean is the largest?",
        options: [
            "A️⃣ Atlantic Ocean",
            "B️⃣ Indian Ocean",
            "C️⃣ Pacific Ocean",
            "D️⃣ Arctic Ocean"
        ],
        answer: "c"
    },
    {
        question: "Which language is primarily spoken in Brazil?",
        options: [
            "A️⃣ Spanish",
            "B️⃣ Portuguese",
            "C️⃣ English",
            "D️⃣ French"
        ],
        answer: "b"
    },
    {
        question: "What is the largest planet in our solar system?",
        options: [
            "A️⃣ Earth",
            "B️⃣ Saturn",
            "C️⃣ Jupiter",
            "D️⃣ Neptune"
        ],
        answer: "c"
    },
    {
        question: "How many sides does a triangle have?",
        options: [
            "A️⃣ 2",
            "B️⃣ 3",
            "C️⃣ 4",
            "D️⃣ 5"
        ],
        answer: "b"
    }
];

async function quiz(sock, message, chatId) {
    const game = randomItem(quizzes);

    await sock.sendMessage(
        chatId,
        {
            text:
                `🧠 *QUIZ TIME*\n\n` +
                `❓ ${game.question}\n\n` +
                `${game.options.join("\n")}\n\n` +
                `👇 Reply with *A, B, C or D*`
        },
        { quoted: message }
    );
}


// ============================================================
// TRIVIA
// ============================================================

const triviaQuestions = [
    {
        question: "Which country has the largest population in Africa?",
        answer: "Nigeria"
    },
    {
        question: "What is the fastest land animal?",
        answer: "Cheetah"
    },
    {
        question: "How many colors are in a rainbow?",
        answer: "7"
    },
    {
        question: "Which planet is closest to the Sun?",
        answer: "Mercury"
    },
    {
        question: "What is the largest mammal in the world?",
        answer: "Blue whale"
    },
    {
        question: "Which country is famous for the pyramids of Giza?",
        answer: "Egypt"
    },
    {
        question: "How many players are on a football team on the field?",
        answer: "11"
    },
    {
        question: "What gas do humans need to breathe?",
        answer: "Oxygen"
    },
    {
        question: "Which instrument has black and white keys?",
        answer: "Piano"
    },
    {
        question: "What is the hardest natural substance?",
        answer: "Diamond"
    }
];

async function trivia(sock, message, chatId) {
    const game = randomItem(triviaQuestions);

    await sock.sendMessage(
        chatId,
        {
            text:
                `🌍 *TRIVIA TIME*\n\n` +
                `❓ ${game.question}\n\n` +
                `🤔 Do you know the answer?\n\n` +
                `👇 Drop your answer!`
        },
        { quoted: message }
    );
}


// ============================================================
// TYPING GAME
// ============================================================

const typingTexts = [
    "Queen Vida",
    "Vibe Till Anytime",
    "WhatsApp Bot",
    "Queen Vida V3",
    "VTA Family",
    "No Wahala Zone",
    "Everybody Catch Cruise",
    "Fast Fingers",
    "VTA Never Dies",
    "Stay Active"
];

async function typing(sock, message, chatId) {
    const text = randomItem(typingTexts);

    await sock.sendMessage(
        chatId,
        {
            text:
                `⌨️ *TYPING CHALLENGE*\n\n` +
                `Type this exactly:\n\n` +
                `🔥 *${text}*\n\n` +
                `🏃 First person to type it correctly wins!`
        },
        { quoted: message }
    );
}


// ============================================================
// EXPORT COMMANDS
// ============================================================

module.exports = [
    {
        name: "guess",
        aliases: [],
        description: "Guess a number from 1 to 10",
        execute: guess
    },

    {
        name: "guessnumber",
        aliases: [],
        description: "Guess a number",
        execute: guessNumber
    },

    {
        name: "guesssong",
        aliases: [],
        description: "Guess the song",
        execute: guessSong
    },

    {
        name: "emojigame",
        aliases: [],
        description: "Guess the movie from emojis",
        execute: emojiGame
    },

    {
        name: "riddle",
        aliases: [],
        description: "Solve a random riddle",
        execute: riddle
    },

    {
        name: "quiz",
        aliases: [],
        description: "Answer a random quiz question",
        execute: quiz
    },

    {
        name: "trivia",
        aliases: [],
        description: "Answer a trivia question",
        execute: trivia
    },

    {
        name: "typing",
        aliases: [],
        description: "Play the typing challenge",
        execute: typing
    }
];
