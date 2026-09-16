const fs = require('fs');
const path = require('path');
const { getMode } = require('../utils/mode');
const { getPrefix } = require('../utils/prefix');

/*
 * ============================================================
 * QUEEN VIDA-V3
 * PREMIUM COMMAND MENU
 * ============================================================
 */

const TELEGRAM_PAIRING_URL = 'https://t.me/Vidas_bot';
const GITHUB_REPO_URL = 'https://github.com/Brodavida22/Queen-Vida-v3';

function commandLine(prefix, command) {
    return `│ ⟡ ${prefix}${command}\n`;
}

function section(title, emoji, prefix, commands) {
    let block =
        `╭─〔 ${emoji} ${title} 〕\n`;

    for (const command of commands) {
        block += commandLine(prefix, command);
    }

    block +=
        `╰────────────────────────\n\n`;

    return block;
}

/*
 * ============================================================
 * GAME COMMANDS
 * ============================================================
 */

const GAME_COMMANDS = [
    'game',

    'trivia',
    'quiz',
    'scramble',
    'guess',
    'truthordare',

    'emoji',
    'movemoji',
    'findemoji',
    'lyrics',
    'rhyme',
    'taboo',
    '2truth1lie',
    'memewar',

    'wyr',
    'neverhaveiever',
    'thisorthat',
    '8ball',
    'coinflip',
    'dice'
];

/*
 * ============================================================
 * MENU CATEGORIES
 * ============================================================
 */

const SECTIONS = [
    {
        title: '𝗦𝗬𝗦𝗧𝗘𝗠',
        emoji: '⚙️',
        commands: [
            'menu',
            'ping',
            'runtime',
            'botcreator',
            'owner',
            'repo',
            'pair',
            'prefix',
            'mode',
            'individual',
            'profile',
            'deploy'
        ]
    },

    {
        title: '𝗚𝗥𝗢𝗨𝗣 𝗣𝗢𝗪𝗘𝗥',
        emoji: '👥',
        commands: [
            'add',
            'kick',
            'promote',
            'demote',
            'tagall',
            'hidetag',
            'tagadmins',
            'mute',
            'unmute',
            'groupinfo',
            'gcstatus',
            'del',
            'poll',
            'vcf',
            'admins',
            'approve',
            'requests',
            'revoke',
            'rules',
            'link',
            'members',
            'groupstats',
            'afk',
            'setpp',
            'getpp',
            'setgroupname',
            'setgroupdesc',
            'active',
            'topmembers',
            'welcome',
            'setwelcome',
            'goodbye',
            'setgoodbye'
        ]
    },

    {
        title: '𝗦𝗘𝗖𝗨𝗥𝗜𝗧𝗬',
        emoji: '🛡️',
        commands: [
            'antilink',
            'antispam',
            'antisticker',
            'badwords',
            'agm',
            'warn',
            'warnings',
            'clearwarnings'
        ]
    },

    {
        title: '𝗔𝗜 & 𝗧𝗢𝗢𝗟𝗦',
        emoji: '🤖',
        commands: [
            'ai',
            'calc',
            'weather',
            'define',
            'quote',
            'tts'
        ]
    },

    {
        title: '𝗠𝗘𝗗𝗜𝗔',
        emoji: '🎵',
        commands: [
            'music',
            'tik',
            'lyrics',
            'sticker',
            'save',
            'viewstatus',
            'vv',
            'vv2'
        ]
    },

    {
        title: '𝗚𝗔𝗠𝗘𝗦',
        emoji: '🎮',
        commands: GAME_COMMANDS
    },

    {
        title: '𝗙𝗨𝗡',
        emoji: '😂',
        commands: [
            'reaction',
            'hug',
            'kiss',
            'slap',
            'ship',
            'match',
            'roast',
            'rate',
            'compliment',
            'flirt',
            'truth',
            'dare'
        ]
    },

    {
        title: '𝗢𝗪𝗡𝗘𝗥 𝗭𝗢𝗡𝗘',
        emoji: '👑',
        commands: [
            'block',
            'unblock',
            'broadcast',
            'changename',
            'changebio',
            'changeprofile',
            'creategroup',
            'join',
            'leave',
            'update',
            'statusreactions',
            'sessions'
        ]
    }
];

/*
 * ============================================================
 * BUILD LIST OF COMMANDS ALREADY DISPLAYED
 * ============================================================
 */

const LISTED_COMMANDS = new Set(
    SECTIONS.flatMap(section => section.commands)
);

/*
 * ============================================================
 * AUTOMATIC JSON GAMES
 * ============================================================
 */

function getJsonGames() {
    const gamesDirectory =
        path.join(__dirname, '../games');

    if (!fs.existsSync(gamesDirectory)) {
        return [];
    }

    try {
        return fs.readdirSync(gamesDirectory)
            .filter(file =>
                file.toLowerCase().endsWith('.json')
            )
            .map(file =>
                path.basename(file, '.json')
            )
            .filter(name =>
                ![
                    'starting',
                    'ending',
                    'couples'
                ].includes(name.toLowerCase())
            )
            .sort();
    } catch (error) {
        console.error(
            'Error reading games directory:',
            error
        );

        return [];
    }
}

/*
 * ============================================================
 * MENU COMMAND
 * ============================================================
 */

module.exports = {
    name: 'menu',

    description:
        'Displays the QUEEN VIDA-V3 command menu and bot information',

    async execute(sock, m, from) {

        const PREFIX = getPrefix();

        const mode = String(
            getMode() || 'public'
        ).toUpperCase();

        const commandCount =
            (sock.commands && sock.commands.size) || 0;

        let menuText = '';

        /*
         * ========================================================
         * HEADER
         * ========================================================
         */

        menuText +=
`╭━━━〔 👑 𝑸𝑼𝑬𝑬𝑵 𝑽𝑰𝑫𝑨-𝑽𝟑 〕━━━╮
┃
┃  🟢 𝗦𝗧𝗔𝗧𝗨𝗦  : 𝗢𝗡𝗟𝗜𝗡𝗘
┃  🔐 𝗠𝗢𝗗𝗘    : ${mode}
┃  ⚡ 𝗩𝗘𝗥𝗦𝗜𝗢𝗡 : 𝟯.𝟬
┃  📦 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦 : ${commandCount}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯

       ✦ 𝑪𝑶𝑴𝑴𝑨𝑵𝑫 𝑪𝑬𝑵𝑻𝑬𝑹 ✦

`;

        /*
         * ========================================================
         * PAIRING + REPOSITORY
         * ========================================================
         */

        menuText +=
`╭━━〔 🔗 𝗤𝗨𝗜𝗖𝗞 𝗟𝗜𝗡𝗞𝗦 〕━━╮
┃
┃ 📱 𝗧𝗘𝗟𝗘𝗚𝗥𝗔𝗠 𝗣𝗔𝗜𝗥𝗜𝗡𝗚
┃ ${TELEGRAM_PAIRING_URL}
┃
┃ 📦 𝗚𝗜𝗧𝗛𝗨𝗕 𝗥𝗘𝗣𝗢𝗦𝗜𝗧𝗢𝗥𝗬
┃ ${GITHUB_REPO_URL}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯

`;

        /*
         * ========================================================
         * MAIN SECTIONS
         * ========================================================
         */

        for (const menuSection of SECTIONS) {
            menuText += section(
                menuSection.title,
                menuSection.emoji,
                PREFIX,
                menuSection.commands
            );
        }

        /*
         * ========================================================
         * AUTOMATIC JSON GAMES
         * ========================================================
         */

        const jsonGames = getJsonGames();

        const listedGames =
            new Set(GAME_COMMANDS);

        const additionalGames =
            jsonGames.filter(
                game => !listedGames.has(game)
            );

        if (additionalGames.length) {
            menuText += section(
                '𝗔𝗗𝗗𝗜𝗧𝗜𝗢𝗡𝗔𝗟 𝗚𝗔𝗠𝗘𝗦',
                '🆕',
                PREFIX,
                additionalGames
            );
        }

        /*
         * ========================================================
         * NEW COMMAND DETECTION
         * ========================================================
         */

        if (
            sock.commands &&
            sock.commands.size
        ) {
            const unlisted =
                [...sock.commands.keys()]
                    .filter(
                        commandName =>
                            !LISTED_COMMANDS.has(commandName) &&
                            !additionalGames.includes(commandName)
                    )
                    .sort();

            if (unlisted.length) {
                menuText += section(
                    '𝗡𝗘𝗪𝗟𝗬 𝗔𝗗𝗗𝗘𝗗',
                    '🆕',
                    PREFIX,
                    unlisted
                );
            }
        }

        /*
         * ========================================================
         * GAME HELP
         * ========================================================
         */

        menuText +=
`╭─〔 🎮 GAME QUICK START 〕
│ ⟡ ${PREFIX}game
│ ⟡ ${PREFIX}game start trivia easy 5
│ ⟡ ${PREFIX}game start quiz medium 5
│ ⟡ ${PREFIX}game start scramble 5
│ ⟡ ${PREFIX}game start guess 5
│ ⟡ ${PREFIX}game start truthordare 5
│ ⟡ ${PREFIX}game start emoji 5
│ ⟡ ${PREFIX}game start movemoji 5
│ ⟡ ${PREFIX}game start findemoji 5
│ ⟡ ${PREFIX}game start lyrics 5
│ ⟡ ${PREFIX}game start rhyme 5
│ ⟡ ${PREFIX}game start taboo 5
│ ⟡ ${PREFIX}game start 2truth1lie 5
│ ⟡ ${PREFIX}game start memewar 5
│ ⟡ ${PREFIX}game stop
╰────────────────────────

`;

        /*
         * ========================================================
         * FOOTER
         * ========================================================
         */

        menuText +=
`╭━━〔 👑 𝑸𝑼𝑬𝑬𝑵 𝑽𝑰𝑫𝑨 〕━━╮
┃
┃  📱 𝗣𝗔𝗜𝗥 : ${TELEGRAM_PAIRING_URL}
┃  📦 𝗥𝗘𝗣𝗢 : ${GITHUB_REPO_URL}
┃
┃  ⚡ 𝗣𝗢𝗪𝗘𝗥 • 𝗦𝗣𝗘𝗘𝗗 • 𝗖𝗢𝗡𝗧𝗥𝗢𝗟
┃  💬 Type ${PREFIX}menu for commands
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        /*
         * ========================================================
         * SEND MENU
         * ========================================================
         */

        const bannerImagePath =
            path.join(
                __dirname,
                '../banner.png'
            );

        if (
            fs.existsSync(
                bannerImagePath
            )
        ) {
            await sock.sendMessage(
                from,
                {
                    image: fs.readFileSync(
                        bannerImagePath
                    ),
                    caption: menuText
                },
                {
                    quoted: m
                }
            );
        } else {
            await sock.sendMessage(
                from,
                {
                    text: menuText
                },
                {
                    quoted: m
                }
            );
        }
    }
};
