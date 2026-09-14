// ============================================================
// QUEEN VIDA-V3 — FUN GAMES
// Commands:
// .wyr
// .neverhaveiever
// .thisorthat
// .8ball
// .coinflip
// .dice
// ============================================================


// ============================================================
// WOULD YOU RATHER
// ============================================================

const wyrQuestions = [
    "Would you rather be rich but lonely or poor but surrounded by people you love?",
    "Would you rather know your future or be able to change your past?",
    "Would you rather never use social media again or never watch movies again?",
    "Would you rather be famous or completely anonymous?",
    "Would you rather have unlimited money or unlimited free time?",
    "Would you rather read minds or become invisible?",
    "Would you rather lose your phone or lose your money?",
    "Would you rather always be late or always be too early?",
    "Would you rather live without music or without movies?",
    "Would you rather be extremely attractive or extremely intelligent?",
    "Would you rather have your crush confess first or your best friend confess a secret?",
    "Would you rather date someone rich or someone who truly loves you?",
    "Would you rather have one true love or many exciting relationships?",
    "Would you rather be able to fly or become invisible?",
    "Would you rather live in a mansion alone or a small house with your favorite people?",
    "Would you rather have unlimited food or unlimited data?",
    "Would you rather lose Instagram or WhatsApp?",
    "Would you rather never sleep again or never eat again?",
    "Would you rather be the funniest person or the smartest person in the group?",
    "Would you rather know everyone's secrets or have nobody know yours?",
    "Would you rather get $1 million today or $10,000 every month for life?",
    "Would you rather marry your crush or become famous?",
    "Would you rather have perfect looks or perfect personality?",
    "Would you rather always tell the truth or always get away with lying?",
    "Would you rather have your phone at 1% forever or slow internet forever?",
    "Would you rather be stuck in a boring relationship or stay single forever?",
    "Would you rather have your best friend read your chats or your parents?",
    "Would you rather be loved by everyone or feared by everyone?",
    "Would you rather go back 10 years or forward 10 years?",
    "Would you rather have unlimited money but no love or unlimited love but no money?",
    "Would you rather lose your phone for a week or your wallet for a month?",
    "Would you rather be able to teleport or time travel?",
    "Would you rather have your crush see your gallery or your search history?",
    "Would you rather be single and rich or married and comfortable?",
    "Would you rather spend a week without your phone or a month without your favorite food?"
];


// ============================================================
// NEVER HAVE I EVER
// ============================================================

const neverHaveIEverQuestions = [
    "Never have I ever lied to get out of trouble.",
    "Never have I ever stalked someone's profile.",
    "Never have I ever sent a message to the wrong person.",
    "Never have I ever pretended to be busy to avoid someone.",
    "Never have I ever had a crush on a friend's friend.",
    "Never have I ever deleted a message because I regretted sending it.",
    "Never have I ever laughed at the wrong moment.",
    "Never have I ever fallen asleep while chatting.",
    "Never have I ever checked someone's last seen repeatedly.",
    "Never have I ever had a secret crush.",
    "Never have I ever lied about my age.",
    "Never have I ever screenshotted someone's chat.",
    "Never have I ever deleted a chat so nobody would see it.",
    "Never have I ever sent a message and immediately regretted it.",
    "Never have I ever pretended not to see someone's message.",
    "Never have I ever had a crush on someone in this group.",
    "Never have I ever flirted with someone just for fun.",
    "Never have I ever stayed awake all night chatting.",
    "Never have I ever blocked someone and later unblocked them.",
    "Never have I ever called someone by the wrong name.",
    "Never have I ever lied to my parents about where I was.",
    "Never have I ever secretly read someone's messages.",
    "Never have I ever had feelings for a friend's crush.",
    "Never have I ever sent a risky message to the wrong person.",
    "Never have I ever pretended to be asleep to avoid a call.",
    "Never have I ever deleted a social media post because nobody liked it.",
    "Never have I ever refreshed someone's profile hoping for an update.",
    "Never have I ever been caught stalking someone online.",
    "Never have I ever had a crush on someone I shouldn't.",
    "Never have I ever lied about being single.",
    "Never have I ever had two crushes at the same time.",
    "Never have I ever ghosted someone.",
    "Never have I ever been ghosted.",
    "Never have I ever flirted with someone online.",
    "Never have I ever regretted breaking up with someone."
];


// ============================================================
// THIS OR THAT
// ============================================================

const thisOrThatQuestions = [
    ["Love ❤️", "Money 💰"],
    ["Beach 🏖️", "Mountain 🏔️"],
    ["Night 🌙", "Day ☀️"],
    ["WhatsApp 📱", "TikTok 🎵"],
    ["Food 🍕", "Sleep 😴"],
    ["Relationship ❤️", "Single life 😎"],
    ["Call 📞", "Chat 💬"],
    ["Movies 🎬", "Music 🎶"],
    ["Rich 💰", "Famous ⭐"],
    ["Android 🤖", "iPhone 🍎"],
    ["Pizza 🍕", "Burger 🍔"],
    ["Party 🎉", "Netflix 🍿"],
    ["Money 💵", "Love ❤️"],
    ["City 🌆", "Village 🌴"],
    ["Morning ☀️", "Night 🌙"],
    ["Sweet 🍫", "Spicy 🌶️"],
    ["Football ⚽", "Basketball 🏀"],
    ["Beach 🌊", "Pool 🏊"],
    ["Texting 💬", "Calling 📞"],
    ["Instagram 📸", "TikTok 🎵"],
    ["Dating ❤️", "Friendship 🤝"],
    ["Chocolate 🍫", "Ice Cream 🍦"],
    ["Comedy 😂", "Horror 👻"],
    ["Car 🚗", "Bike 🏍️"],
    ["Travel ✈️", "Stay Home 🏠"],
    ["Luxury 💎", "Adventure 🔥"],
    ["Fame ⭐", "Privacy 🔒"],
    ["Brains 🧠", "Beauty 😍"],
    ["Tall Partner 🧍", "Short Partner 🧍‍♀️"],
    ["Rich Partner 💰", "Loving Partner ❤️"],
    ["Kiss 💋", "Hug 🤗"],
    ["Crush 😍", "Bestie 🫂"],
    ["Money 💰", "Power 👑"],
    ["Freedom 🕊️", "Security 🔐"],
    ["New Phone 📱", "New Clothes 👕"],
    ["Gaming 🎮", "Sleeping 😴"],
    ["Music 🎶", "Movies 🎬"],
    ["Fast Internet 🚀", "Unlimited Data 📶"],
    ["Big Wedding 💍", "Private Wedding 💒"],
    ["First Love ❤️", "Last Love 💕"]
];


// ============================================================
// MAGIC 8 BALL
// ============================================================

const eightBallAnswers = [
    "🎱 Yes, definitely!",
    "🎱 Absolutely!",
    "🎱 Most likely.",
    "🎱 The signs say yes.",
    "🎱 You can count on it.",
    "🎱 Without a doubt.",
    "🎱 100% yes.",
    "🎱 Definitely!",
    "🎱 It is looking good.",
    "🎱 The future looks bright.",
    "🎱 Probably yes.",
    "🎱 Maybe...",
    "🎱 Ask again later.",
    "🎱 I'm not sure.",
    "🎱 The answer is unclear.",
    "🎱 Only time will tell.",
    "🎱 Don't count on it.",
    "🎱 Probably not.",
    "🎱 My answer is no.",
    "🎱 Definitely not.",
    "🎱 Not looking good.",
    "🎱 The signs say no.",
    "🎱 Better luck next time.",
    "🎱 I wouldn't bet on it.",
    "🎱 Absolutely not!"
];


// ============================================================
// RANDOM HELPER
// ============================================================

function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}


// ============================================================
// CLEAN QUESTION
// ============================================================

function cleanQuestion(args) {
    return Array.isArray(args)
        ? args.join(" ").trim()
        : "";
}


// ============================================================
// WOULD YOU RATHER
// ============================================================

async function wyr(sock, message, chatId) {
    const question = randomItem(wyrQuestions);

    await sock.sendMessage(
        chatId,
        {
            text:
                `🤔 *WOULD YOU RATHER?*\n\n` +
                `❓ ${question}\n\n` +
                `👉 Reply with your choice!`
        },
        { quoted: message }
    );
}


// ============================================================
// NEVER HAVE I EVER
// ============================================================

async function neverHaveIEver(sock, message, chatId) {
    const question = randomItem(neverHaveIEverQuestions);

    await sock.sendMessage(
        chatId,
        {
            text:
                `🙈 *NEVER HAVE I EVER*\n\n` +
                `👉 ${question}\n\n` +
                `😂 Be honest!`
        },
        { quoted: message }
    );
}


// ============================================================
// THIS OR THAT
// ============================================================

async function thisOrThat(sock, message, chatId) {
    const choice = randomItem(thisOrThatQuestions);

    await sock.sendMessage(
        chatId,
        {
            text:
                `⚡ *THIS OR THAT?*\n\n` +
                `1️⃣ ${choice[0]}\n` +
                `2️⃣ ${choice[1]}\n\n` +
                `👇 Pick one!`
        },
        { quoted: message }
    );
}


// ============================================================
// MAGIC 8 BALL
// ============================================================

async function eightBall(sock, message, chatId, args) {
    const question = cleanQuestion(args);

    if (!question) {
        return await sock.sendMessage(
            chatId,
            {
                text:
                    `🎱 *MAGIC 8 BALL*\n\n` +
                    `Ask me a question.\n\n` +
                    `Example:\n` +
                    `.8ball Will I get married this year?`
            },
            { quoted: message }
        );
    }

    const answer = randomItem(eightBallAnswers);

    await sock.sendMessage(
        chatId,
        {
            text:
                `🎱 *MAGIC 8 BALL*\n\n` +
                `❓ ${question}\n\n` +
                `🔮 ${answer}`
        },
        { quoted: message }
    );
}


// ============================================================
// COIN FLIP
// ============================================================

async function coinFlip(sock, message, chatId) {
    const result = Math.random() < 0.5
        ? "HEADS 🪙"
        : "TAILS 🪙";

    await sock.sendMessage(
        chatId,
        {
            text:
                `🪙 *COIN FLIP*\n\n` +
                `The coin landed on:\n\n` +
                `👉 *${result}*`
        },
        { quoted: message }
    );
}


// ============================================================
// DICE
// ============================================================

async function dice(sock, message, chatId, args) {
    let sides = parseInt(args?.[0], 10);

    if (!Number.isFinite(sides)) {
        sides = 6;
    }

    if (sides < 2) {
        sides = 2;
    }

    if (sides > 100) {
        sides = 100;
    }

    const result = Math.floor(Math.random() * sides) + 1;

    let reaction = "";

    if (sides === 6) {
        if (result === 6) {
            reaction = "🔥 JACKPOT!";
        } else if (result === 1) {
            reaction = "💀 Ouch! You rolled a 1!";
        } else if (result >= 4) {
            reaction = "😎 Nice roll!";
        } else {
            reaction = "😂 Try again!";
        }
    } else {
        reaction = result >= sides * 0.8
            ? "🔥 That's a big roll!"
            : result <= sides * 0.2
                ? "💀 That's unlucky!"
                : "😎 Not bad!";
    }

    await sock.sendMessage(
        chatId,
        {
            text:
                `🎲 *DICE ROLL*\n\n` +
                `🎯 Sides: *${sides}*\n` +
                `🎲 Result: *${result}*\n\n` +
                `${reaction}`
        },
        { quoted: message }
    );
}


// ============================================================
// EXPORT COMMANDS
// ============================================================

module.exports = [
    {
        name: "wyr",
        aliases: ["wouldyourather"],
        description: "Play Would You Rather",
        execute: wyr
    },

    {
        name: "neverhaveiever",
        aliases: ["nhie", "neverhavei"],
        description: "Play Never Have I Ever",
        execute: neverHaveIEver
    },

    {
        name: "thisorthat",
        aliases: ["tot"],
        description: "Play This or That",
        execute: thisOrThat
    },

    {
        name: "8ball",
        aliases: ["eightball"],
        description: "Ask the Magic 8 Ball",
        execute: eightBall
    },

    {
        name: "coinflip",
        aliases: ["coin"],
        description: "Flip a coin",
        execute: coinFlip
    },

    {
        name: "dice",
        aliases: ["roll"],
        description: "Roll a dice",
        execute: dice
    }
];
