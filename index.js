const fs = require('fs');
const path = require('path');
require('dotenv').config();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const pino = require('pino');
const express = require('express');

const { getMode } = require('./utils/mode');
const { getPrefix } = require('./utils/prefix');
const { handleGameMessage } = require('./utils/gameManager');

// --- CONDITIONAL CLOUD PORT SERVER CONFIGURATION ---
const PORT = process.env.PORT;
let isExpressRunning = false;

function startExpressServer() {
    if (!PORT) return;
    if (isExpressRunning) return;

    const app = express();

    app.get('/', (req, res) => {
        res.send('Queen Vida-V3 Bot is Running Active!');
    });

    app.listen(PORT, () => {
        isExpressRunning = true;
        console.log(`🌐 Express health-check server listening on port ${PORT}`);
    });
}

// --- HARDCODED CREATOR SIGNATURE & SECURITY ---
const CREATOR_NAME = "QUEEN VIDA";
const DISPLAY_CREATOR_NUMBER = "2348138558590";
const CREATOR_NUMBERS = ["2348138558590"];

const CHANNEL_TEXT_LINK =
    '\n\n📢 *Join QUEEN VIDA Channel:*\nhttps://whatsapp.com/channel/0029Vb8hHHs30LKXQEb4xe38';

function verifyCreatorIntegrity() {
    if (
        !CREATOR_NUMBERS.includes("2348138558590") ||
        CREATOR_NAME !== "QUEEN VIDA"
    ) {
        console.error(
            "❌ CRITICAL ERROR: Creator identity signature has been altered or tampered with!"
        );

        process.exit(1);
    }
}

verifyCreatorIntegrity();

// --- GLOBAL ERROR HANDLERS ---
process.on('uncaughtException', (err) => {
    console.error(
        '🔥 [CRASH REPORT - UNCAUGHT EXCEPTION]:',
        err
    );

    if (err && err.stack) {
        console.error(err.stack);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(
        '🔥 [CRASH REPORT - UNHANDLED REJECTION] At Promise:',
        promise,
        'Reason:',
        reason
    );
});

const spamTracker = {};

// --- GLOBAL SETTINGS ---
function getGlobalSettings() {
    const settingsPath = path.join(__dirname, 'settings.json');

    if (fs.existsSync(settingsPath)) {
        try {
            const data = JSON.parse(
                fs.readFileSync(settingsPath)
            );

            return {
                autoViewStatus:
                    data.autoViewStatus !== undefined
                        ? data.autoViewStatus
                        : 'on',

                autoReaction:
                    data.autoReaction !== undefined
                        ? data.autoReaction
                        : 'on',

                statusReaction:
                    data.statusReaction !== undefined
                        ? data.statusReaction
                        : 'off'
            };
        } catch (e) {
            console.error(
                '🔥 [SETTINGS ERROR] Failed to parse settings.json:',
                e
            );
        }
    }

    return {
        autoViewStatus: 'on',
        autoReaction: 'on',
        statusReaction: 'off'
    };
}

// --- CONTEXT EMOJI ---
function getContextEmoji(text = '') {
    const lower = text.toLowerCase();

    if (
        /(lol|lmao|funny|haha|😂|🤣|giggle|joke|comedy)/i.test(lower)
    ) {
        return '😂';
    }

    if (
        /(congrats|congratulations|welldone|bravo|party|🎉|🎈|win|victory|success)/i.test(
            lower
        )
    ) {
        return '🥳';
    }

    if (
        /(sad|sorry|rip|pain|crying|😭|😢|pity)/i.test(lower)
    ) {
        return '😢';
    }

    if (
        /(love|heart|babe|sweet|❤️|😍|kiss)/i.test(lower)
    ) {
        return '❤️';
    }

    if (
        /(fire|lit|amazing|cool|🔥|awesome|best)/i.test(lower)
    ) {
        return '🔥';
    }

    if (
        /(wow|omg|shock|damn|surprised|😮)/i.test(lower)
    ) {
        return '😮';
    }

    if (
        /(money|cash|rich|wealth|naira|dollar|lagos)/i.test(lower)
    ) {
        return '💰';
    }

    const defaults = [
        '👍',
        '🔥',
        '❤️',
        '👏',
        '🙌',
        '💯'
    ];

    return defaults[
        Math.floor(Math.random() * defaults.length)
    ];
}

// --- START QUEEN VIDA ---
async function startQueenVida() {
    verifyCreatorIntegrity();

    console.log(
        '🔄 Initializing Queen Vida-V3 Socket Connection...'
    );

    const authPath = path.join(__dirname, 'auth_info');
    const credsPath = path.join(authPath, 'creds.json');

    // --- CLEAN INCOMPLETE PAIRING SESSION ---
    if (
        fs.existsSync(authPath) &&
        fs.existsSync(credsPath)
    ) {
        try {
            const creds = JSON.parse(
                fs.readFileSync(credsPath)
            );

            if (!creds.registered) {
                console.log(
                    "⚠️ Detected an incomplete pairing session. Cleaning up auth_info..."
                );

                fs.rmSync(authPath, {
                    recursive: true,
                    force: true
                });
            }
        } catch (e) {
            console.error(
                '🔥 [AUTH ERROR] Failed reading creds.json:',
                e
            );

            fs.rmSync(authPath, {
                recursive: true,
                force: true
            });
        }
    }

    const {
        state,
        saveCreds
    } = await useMultiFileAuthState('auth_info');

    // =====================================================
    // IMPORTANT:
    // Canonical WhatsApp browser identity for pairing.
    // =====================================================
    const sock = makeWASocket({
        logger: pino({
            level: 'silent'
        }),

        auth: state,

        printQRInTerminal: false,

        browser: Browsers.macOS('Chrome'),

        syncFullHistory: false,

        markOnlineOnConnect: true,

        connectTimeoutMs: 60000,

        keepAliveIntervalMs: 25000
    });

    // --- COMMAND LOADER ---
    sock.commands = new Map();

    const commandPath = path.join(
        __dirname,
        'commands'
    );

    if (fs.existsSync(commandPath)) {
        try {
            const commandFiles = fs
                .readdirSync(commandPath)
                .filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                try {
                    const filePath = path.join(
                        commandPath,
                        file
                    );

                    delete require.cache[
                        require.resolve(filePath)
                    ];

                    const required = require(filePath);

                    if (Array.isArray(required)) {
                        for (const cmd of required) {
                            if (cmd.name) {
                                sock.commands.set(
                                    cmd.name,
                                    cmd
                                );
                            }
                        }
                    } else if (
                        required &&
                        required.name
                    ) {
                        sock.commands.set(
                            required.name,
                            required
                        );
                    }
                } catch (cmdLoadErr) {
                    console.error(
                        `🔥 [COMMAND LOAD ERROR] File ${file}:`,
                        cmdLoadErr
                    );
                }
            }

            console.log(
                `📂 Loaded ${sock.commands.size} commands successfully.`
            );
        } catch (dirErr) {
            console.error(
                '🔥 [COMMAND DIR ERROR]:',
                dirErr
            );
        }
    }

    // =====================================================
    // PHONE NUMBER PAIRING
    // =====================================================

    if (!sock.authState.creds.registered) {
        const phoneNumber =
            DISPLAY_CREATOR_NUMBER;

        if (!phoneNumber) {
            console.log(
                "❌ [ERROR]: PHONE_NUMBER environment variable is not set!"
            );

            console.log(
                "👉 Please add 'PHONE_NUMBER' with your full WhatsApp number in your panel's Environment/Startup variables tab."
            );

            return;
        }

        console.log(
            `⏳ Automatically requesting pairing code for ${phoneNumber}...`
        );

        setTimeout(async () => {
            try {
                const cleanNumber =
                    phoneNumber
                        .trim()
                        .replace(/[^0-9]/g, '');

                const code =
                    await sock.requestPairingCode(
                        cleanNumber
                    );

                console.log(
                    `✨ ======================================== ✨`
                );

                console.log(
                    `✨ YOUR WHATSAPP PAIRING CODE: ${code} ✨`
                );

                console.log(
                    `✨ ======================================== ✨`
                );

                console.log(
                    `📱 Open WhatsApp → Linked Devices → Link a Device → Link with phone number instead.`
                );
            } catch (pairErr) {
                console.error(
                    '🔥 [PAIRING ERROR] Failed to generate pairing code:',
                    pairErr
                );
            }
        }, 3000);
    }

    let isStartupBannerSent = false;

    // =====================================================
    // CONNECTION UPDATE
    // =====================================================

    sock.ev.on(
        'connection.update',
        async (update) => {
            const {
                connection,
                lastDisconnect
            } = update;

            if (connection) {
                console.log(
                    `📡 Connection Status Changed: --> ${connection.toUpperCase()} <--`
                );
            }

            // -------------------------------------------------
            // CONNECTED
            // -------------------------------------------------

            if (connection === 'open') {
                console.log(
                    `--- QUEEN VIDA-V3 CONNECTED [Creator: ${CREATOR_NAME}] ---`
                );

                if (!isStartupBannerSent) {
                    isStartupBannerSent = true;

                    try {
                        const botJid =
                            sock.user.id.split(':')[0] +
                            '@s.whatsapp.net';

                        const serverTime =
                            new Date().toLocaleString();

                        const activeBanner =
`┏━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┓
┃ Status: *V3 ONLINE & ACTIVE* ✅
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🤖 *Bot Name:* QUEEN VIDA-V3
┃ ⚙️ *Version:* v3.0.0
┃ 👤 *Creator:* ${CREATOR_NAME}
┃ 👨‍💻 *Developer Contact:* https://wa.me/${DISPLAY_CREATOR_NUMBER}
┃ ⏱️ *Server Time:* ${serverTime}
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛
> _👑 *QUEEN VIDA-V3* 👑 successfully launched_` +
                            CHANNEL_TEXT_LINK;

                        const bannerImagePath =
                            path.join(
                                __dirname,
                                'banner.png'
                            );

                        if (
                            fs.existsSync(
                                bannerImagePath
                            )
                        ) {
                            const imageBuffer =
                                fs.readFileSync(
                                    bannerImagePath
                                );

                            await sock.sendMessage(
                                botJid,
                                {
                                    image: imageBuffer,
                                    caption:
                                        activeBanner
                                }
                            );
                        } else {
                            await sock.sendMessage(
                                botJid,
                                {
                                    text:
                                        activeBanner
                                }
                            );
                        }
                    } catch (bannerErr) {
                        console.error(
                            '🔥 [BANNER ERROR] Failed sending startup banner:',
                            bannerErr
                        );
                    }
                }
            }

            // -------------------------------------------------
            // CONNECTION CLOSED
            // -------------------------------------------------

            else if (connection === 'close') {
                const statusCode =
                    new Boom(
                        lastDisconnect?.error
                    )?.output?.statusCode;

                console.error(
                    `🔥 [CONNECTION CLOSED] Status Code: ${statusCode}`,
                    lastDisconnect?.error ||
                        'Unknown disconnect reason'
                );

                if (
                    statusCode ===
                    DisconnectReason.loggedOut
                ) {
                    console.log(
                        '⚠️ Device logged out from WhatsApp session. Clear auth_info folder and re-link.'
                    );
                } else {
                    console.log(
                        '🔄 Connection closed/dropped, attempting automatic reconnection in 3 seconds...'
                    );

                    setTimeout(
                        () => startQueenVida(),
                        3000
                    );
                }
            }
        }
    );

    // =====================================================
    // SAVE AUTH CREDENTIALS
    // =====================================================

    sock.ev.on(
        'creds.update',
        saveCreds
    );

    // =====================================================
    // MESSAGE HANDLER
    // =====================================================

    sock.ev.on(
        'messages.upsert',
        async ({ messages }) => {
            try {
                const m = messages[0];

                if (!m.message) return;

                const from =
                    m.key.remoteJid;

                const settings =
                    getGlobalSettings();

                // =================================================
                // STATUS HANDLER
                // =================================================

                if (
                    from ===
                    'status@broadcast'
                ) {
                    // =============================================
                    // ANTI-GROUP-MENTION (AGM)
                    // =============================================
                    // Runs independently of autoViewStatus. Checks
                    // if the status text/caption contains the
                    // invite link of any group that has AGM turned
                    // on, and warns/kicks the poster in that group.

                    (async () => {
                        try {
                            const groupSettings =
                                fs.existsSync('settings.json')
                                    ? JSON.parse(
                                          fs.readFileSync('settings.json')
                                      )
                                    : {};

                            const agmGroupIds =
                                groupSettings.agm
                                    ? Object.keys(groupSettings.agm)
                                          .filter(
                                              gid =>
                                                  groupSettings.agm[gid] ===
                                                  'on'
                                          )
                                    : [];

                            if (agmGroupIds.length === 0) {
                                return;
                            }

                            const statusText =
                                m.message
                                    ?.conversation ||
                                m.message
                                    ?.extendedTextMessage
                                    ?.text ||
                                m.message
                                    ?.imageMessage
                                    ?.caption ||
                                m.message
                                    ?.videoMessage
                                    ?.caption ||
                                '';

                            const linkMatches =
                                statusText.match(
                                    /chat\.whatsapp\.com\/([A-Za-z0-9]+)/gi
                                );

                            if (!linkMatches || linkMatches.length === 0) {
                                return;
                            }

                            const posterJid =
                                m.key.participant ||
                                m.participant;

                            if (!posterJid) {
                                return;
                            }

                            const posterNumber =
                                posterJid.replace(/[^0-9]/g, '');

                            if (CREATOR_NUMBERS.includes(posterNumber)) {
                                return;
                            }

                            for (const groupId of agmGroupIds) {
                                let inviteCode;

                                try {
                                    inviteCode =
                                        await sock.groupInviteCode(
                                            groupId
                                        );
                                } catch (e) {
                                    continue;
                                }

                                const isMentioned =
                                    linkMatches.some(link =>
                                        link
                                            .toLowerCase()
                                            .includes(
                                                inviteCode.toLowerCase()
                                            )
                                    );

                                if (!isMentioned) {
                                    continue;
                                }

                                let groupMetadata;

                                try {
                                    groupMetadata =
                                        await sock.groupMetadata(
                                            groupId
                                        );
                                } catch (e) {
                                    continue;
                                }

                                const posterParticipant =
                                    groupMetadata.participants.find(
                                        p => p.id === posterJid
                                    );

                                if (!posterParticipant) {
                                    continue;
                                }

                                const isAdminPoster =
                                    posterParticipant.admin ===
                                        'admin' ||
                                    posterParticipant.admin ===
                                        'superadmin';

                                if (isAdminPoster) {
                                    continue;
                                }

                                if (!groupSettings.agmWarns) {
                                    groupSettings.agmWarns = {};
                                }

                                if (!groupSettings.agmWarns[groupId]) {
                                    groupSettings.agmWarns[groupId] = {};
                                }

                                if (
                                    !groupSettings.agmWarns[groupId][
                                        posterJid
                                    ]
                                ) {
                                    groupSettings.agmWarns[groupId][
                                        posterJid
                                    ] = 0;
                                }

                                groupSettings.agmWarns[groupId][
                                    posterJid
                                ] += 1;

                                const warnCount =
                                    groupSettings.agmWarns[groupId][
                                        posterJid
                                    ];

                                fs.writeFileSync(
                                    'settings.json',
                                    JSON.stringify(
                                        groupSettings,
                                        null,
                                        2
                                    )
                                );

                                if (warnCount < 3) {
                                    await sock.sendMessage(
                                        groupId,
                                        {
                                            text: `🚫 *@${posterNumber}*, mentioning this group in your status isn't allowed by Queen Vida! Warning *(${warnCount}/3)*.`,
                                            mentions: [posterJid]
                                        }
                                    );
                                } else {
                                    groupSettings.agmWarns[groupId][
                                        posterJid
                                    ] = 0;

                                    fs.writeFileSync(
                                        'settings.json',
                                        JSON.stringify(
                                            groupSettings,
                                            null,
                                            2
                                        )
                                    );

                                    await sock.sendMessage(
                                        groupId,
                                        {
                                            text: `🚫 *@${posterNumber}* reached 3 group-mention warnings and has been kicked from the group!`,
                                            mentions: [posterJid]
                                        }
                                    );

                                    try {
                                        await sock.groupParticipantsUpdate(
                                            groupId,
                                            [posterJid],
                                            'remove'
                                        );
                                    } catch (e) {}
                                }
                            }
                        } catch (agmErr) {
                            console.error(
                                '🔥 [AGM ERROR]:',
                                agmErr
                            );
                        }
                    })();

                    if (
                        settings.autoViewStatus ===
                        'on'
                    ) {
                        (async () => {
                            try {
                                if (
                                    m.key &&
                                    m.key.remoteJid
                                ) {
                                    await sock.readMessages(
                                        [m.key]
                                    );
                                }

                                if (
                                    settings.statusReaction ===
                                        'on' &&
                                    m.message
                                ) {
                                    const targetParticipant =
                                        m.key
                                            .participant ||
                                        m.participant;

                                    if (
                                        !targetParticipant ||
                                        !targetParticipant.endsWith(
                                            '@s.whatsapp.net'
                                        )
                                    ) {
                                        return;
                                    }

                                    const statusText =
                                        m.message
                                            .conversation ||
                                        m.message
                                            .extendedTextMessage
                                            ?.text ||
                                        m.message
                                            .imageMessage
                                            ?.caption ||
                                        m.message
                                            .videoMessage
                                            ?.caption ||
                                        '';

                                    const emoji =
                                        getContextEmoji(
                                            statusText
                                        );

                                    try {
                                        await sock.sendMessage(
                                            'status@broadcast',
                                            {
                                                react: {
                                                    text: emoji,
                                                    key: m.key
                                                }
                                            },
                                            {
                                                statusJidList: [
                                                    targetParticipant
                                                ],
                                                broadcast:
                                                    true
                                            }
                                        );
                                    } catch (
                                        statusReactErr
                                    ) {
                                        // Silenced
                                    }
                                }
                            } catch (
                                statusHandlerErr
                            ) {
                                // Silenced
                            }
                        })();
                    }

                    return;
                }

                // =================================================
                // SENDER / OWNER
                // =================================================

                const sender =
                    m.key.participant ||
                    m.key.remoteJid;

                const senderNumber =
                    sender
                        ? sender.replace(
                              /[^0-9]/g,
                              ''
                          )
                        : '';

                const isOwner =
                    CREATOR_NUMBERS.includes(
                        senderNumber
                    ) ||
                    m.key.fromMe;

                // =================================================
                // ACTIVITY TRACKER
                // =================================================

                if (
                    from.endsWith('@g.us') &&
                    sender
                ) {
                    try {
                        let act =
                            fs.existsSync(
                                'activity.json'
                            )
                                ? JSON.parse(
                                      fs.readFileSync(
                                          'activity.json'
                                      )
                                  )
                                : {};

                        if (!act[from]) {
                            act[from] = {};
                        }

                        if (
                            !act[from][sender]
                        ) {
                            act[from][sender] = 0;
                        }

                        act[from][sender] += 1;

                        fs.writeFileSync(
                            'activity.json',
                            JSON.stringify(act)
                        );
                    } catch (actErr) {
                        console.error(
                            '🔥 [ACTIVITY TRACKER ERROR]:',
                            actErr
                        );
                    }
                }

                // =================================================
                // MESSAGE BODY
                // =================================================

                const body =
                    m.message
                        .conversation ||
                    m.message
                        .extendedTextMessage
                        ?.text ||
                    '';

                const isGroup =
                    from.endsWith('@g.us');

                const isChannel =
                    from.endsWith(
                        '@newsletter'
                    );

                // =================================================
                // ANTISTICKER
                // =================================================
                // Stickers have no text body, so this must run
                // BEFORE the "if (!body) return;" check below, or
                // stickers would never reach any handler.

                if (
                    isGroup &&
                    !isOwner &&
                    m.message.stickerMessage
                ) {
                    try {
                        const groupSettings =
                            fs.existsSync('settings.json')
                                ? JSON.parse(
                                      fs.readFileSync('settings.json')
                                  )
                                : {};

                        const isAntiStickerOn =
                            groupSettings.antisticker
                                ?.[from] === 'on';

                        if (isAntiStickerOn) {
                            const groupMetadata =
                                await sock.groupMetadata(from);

                            const senderParticipant =
                                groupMetadata.participants.find(
                                    p => p.id === sender
                                );

                            const isAdminSticker =
                                senderParticipant &&
                                (
                                    senderParticipant.admin === 'admin' ||
                                    senderParticipant.admin === 'superadmin'
                                );

                            if (!isAdminSticker) {
                                try {
                                    await sock.sendMessage(
                                        from,
                                        { delete: m.key }
                                    );
                                } catch (e) {}

                                await sock.sendMessage(
                                    from,
                                    {
                                        text: `🚫 *@${senderNumber}*, stickers aren't allowed by Queen Vida in this group!`,
                                        mentions: [sender]
                                    }
                                );

                                return;
                            }
                        }
                    } catch (antiStickerErr) {
                        console.error(
                            '🔥 [ANTISTICKER ERROR]:',
                            antiStickerErr
                        );
                    }
                }

                // =================================================
                // AUTO REACTION
                // =================================================

                if (
                    settings.autoReaction ===
                        'on' &&
                    !m.key.fromMe &&
                    (isGroup ||
                        isChannel)
                ) {
                    try {
                        const reactionEmoji =
                            getContextEmoji(
                                body
                            );

                        await sock.sendMessage(
                            from,
                            {
                                react: {
                                    text:
                                        reactionEmoji,
                                    key: m.key
                                }
                            }
                        );
                    } catch (
                        autoReactErr
                    ) {
                        console.error(
                            '🔥 [NORMAL AUTO-REACTION ERROR]:',
                            autoReactErr.message
                        );
                    }
                }

                if (!body) return;

                // =================================================
                // GROUP SECURITY
                // =================================================

                if (
                    isGroup &&
                    !isOwner
                ) {
                    try {
                        const groupMetadata =
                            await sock.groupMetadata(
                                from
                            );

                        const participants =
                            groupMetadata
                                .participants;

                        const senderParticipant =
                            participants.find(
                                p =>
                                    p.id ===
                                    sender
                            );

                        const isAdmin =
                            senderParticipant &&
                            (
                                senderParticipant.admin ===
                                    'admin' ||
                                senderParticipant.admin ===
                                    'superadmin'
                            );

                        if (!isAdmin) {
                            let groupSettings =
                                fs.existsSync(
                                    'settings.json'
                                )
                                    ? JSON.parse(
                                          fs.readFileSync(
                                              'settings.json'
                                          )
                                      )
                                    : {};

                            // =====================================
                            // ANTI-SPAM
                            // =====================================

                            const isAntiSpamOn =
                                groupSettings
                                    .antispam
                                    ?.[
                                        from
                                    ] ===
                                'on';

                            if (
                                isAntiSpamOn
                            ) {
                                const now =
                                    Date.now();

                                if (
                                    !spamTracker[
                                        from
                                    ]
                                ) {
                                    spamTracker[
                                        from
                                    ] = {};
                                }

                                if (
                                    !spamTracker[
                                        from
                                    ][sender]
                                ) {
                                    spamTracker[
                                        from
                                    ][sender] = {
                                        count: 0,
                                        lastTime:
                                            now
                                    };
                                }

                                const userSpam =
                                    spamTracker[
                                        from
                                    ][sender];

                                if (
                                    now -
                                        userSpam.lastTime <
                                    3000
                                ) {
                                    userSpam.count +=
                                        1;
                                } else {
                                    userSpam.count =
                                        1;
                                }

                                userSpam.lastTime =
                                    now;

                                if (
                                    userSpam.count >=
                                    5
                                ) {
                                    userSpam.count =
                                        0;

                                    try {
                                        await sock.sendMessage(
                                            from,
                                            {
                                                delete:
                                                    m.key
                                            }
                                        );
                                    } catch (
                                        e
                                    ) {}

                                    if (
                                        !groupSettings.spamWarns
                                    ) {
                                        groupSettings.spamWarns =
                                            {};
                                    }

                                    if (
                                        !groupSettings
                                            .spamWarns[
                                            from
                                        ]
                                    ) {
                                        groupSettings
                                            .spamWarns[
                                            from
                                        ] = {};
                                    }

                                    if (
                                        !groupSettings
                                            .spamWarns[
                                            from
                                        ][sender]
                                    ) {
                                        groupSettings
                                            .spamWarns[
                                            from
                                        ][sender] = 0;
                                    }

                                    groupSettings
                                        .spamWarns[
                                        from
                                    ][sender] +=
                                        1;

                                    const spamWarnCount =
                                        groupSettings
                                            .spamWarns[
                                            from
                                        ][sender];

                                    fs.writeFileSync(
                                        'settings.json',
                                        JSON.stringify(
                                            groupSettings,
                                            null,
                                            2
                                        )
                                    );

                                    if (
                                        spamWarnCount ===
                                        1
                                    ) {
                                        await sock.sendMessage(
                                            from,
                                            {
                                                text: `⚠️ *@${senderNumber}*, stop spamming! This is your 1st warning. Next time you will be kicked.`,
                                                mentions: [
                                                    sender
                                                ]
                                            }
                                        );
                                    } else {
                                        groupSettings
                                            .spamWarns[
                                            from
                                        ][sender] = 0;

                                        fs.writeFileSync(
                                            'settings.json',
                                            JSON.stringify(
                                                groupSettings,
                                                null,
                                                2
                                            )
                                        );

                                        await sock.sendMessage(
                                            from,
                                            {
                                                text: `🚨 *@${senderNumber}* continued spamming after warning and has been kicked!`,
                                                mentions: [
                                                    sender
                                                ]
                                            }
                                        );

                                        try {
                                            await sock.groupParticipantsUpdate(
                                                from,
                                                [
                                                    sender
                                                ],
                                                'remove'
                                            );
                                        } catch (
                                            e
                                        ) {}
                                    }

                                    return;
                                }
                            }

                            // =====================================
                            // BADWORDS
                            // =====================================

                            const badWordsConfig =
                                groupSettings
                                    .badwords
                                    ?.[from];

                            if (
                                badWordsConfig &&
                                badWordsConfig.status ===
                                    'on' &&
                                Array.isArray(
                                    badWordsConfig.list
                                )
                            ) {
                                const lowerBody =
                                    body.toLowerCase();

                                const containsBadWord =
                                    badWordsConfig.list.some(
                                        word =>
                                            lowerBody.includes(
                                                word.toLowerCase()
                                            )
                                    );

                                if (
                                    containsBadWord
                                ) {
                                    try {
                                        await sock.sendMessage(
                                            from,
                                            {
                                                delete:
                                                    m.key
                                            }
                                        );
                                    } catch (
                                        e
                                    ) {}

                                    await sock.sendMessage(
                                        from,
                                        {
                                            text: `⚠️ *@${senderNumber}*, watch your language! Profanity is strictly prohibited in this group.`,
                                            mentions: [
                                                sender
                                            ]
                                        }
                                    );

                                    return;
                                }
                            }

                            // =====================================
                            // ANTILINK
                            // =====================================

                            const antiLinkConfig =
                                groupSettings
                                    .antilink
                                    ?.[from];

                            if (
                                antiLinkConfig &&
                                (
                                    antiLinkConfig.warn ===
                                        'on' ||
                                    antiLinkConfig.instant ===
                                        'on'
                                )
                            ) {
                                const linkRegex =
                                    /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.)+[a-zA-Z]{2,}(\/[^\s]*)?/gi;

                                const messageContent =
                                    body ||
                                    m.message
                                        .extendedTextMessage
                                        ?.text ||
                                    m.message
                                        .imageMessage
                                        ?.caption ||
                                    '';

                                if (
                                    linkRegex.test(
                                        messageContent
                                    )
                                ) {
                                    try {
                                        await sock.sendMessage(
                                            from,
                                            {
                                                delete:
                                                    m.key
                                            }
                                        );
                                    } catch (
                                        e
                                    ) {}

                                    // ---------------------------------
                                    // INSTANT REMOVE
                                    // ---------------------------------

                                    if (
                                        antiLinkConfig.instant ===
                                        'on'
                                    ) {
                                        await sock.sendMessage(
                                            from,
                                            {
                                                text: `🚫 *@${senderNumber}*, links aren't allowed by Queen Vida in this group! You have been removed.`,
                                                mentions: [
                                                    sender
                                                ]
                                            }
                                        );

                                        try {
                                            await sock.groupParticipantsUpdate(
                                                from,
                                                [
                                                    sender
                                                ],
                                                'remove'
                                            );
                                        } catch (
                                            e
                                        ) {}

                                        return;
                                    }

                                    // ---------------------------------
                                    // WARNING SYSTEM
                                    // ---------------------------------

                                    if (
                                        antiLinkConfig.warn ===
                                        'on'
                                    ) {
                                        if (
                                            !groupSettings.linkWarns
                                        ) {
                                            groupSettings.linkWarns =
                                                {};
                                        }

                                        if (
                                            !groupSettings
                                                .linkWarns[
                                                from
                                            ]
                                        ) {
                                            groupSettings
                                                .linkWarns[
                                                from
                                            ] = {};
                                        }

                                        if (
                                            !groupSettings
                                                .linkWarns[
                                                from
                                            ][sender]
                                        ) {
                                            groupSettings
                                                .linkWarns[
                                                from
                                            ][sender] = 0;
                                        }

                                        groupSettings
                                            .linkWarns[
                                            from
                                        ][sender] +=
                                            1;

                                        const warnCount =
                                            groupSettings
                                                .linkWarns[
                                                from
                                            ][sender];

                                        fs.writeFileSync(
                                            'settings.json',
                                            JSON.stringify(
                                                groupSettings,
                                                null,
                                                2
                                            )
                                        );

                                        if (
                                            warnCount <
                                            3
                                        ) {
                                            await sock.sendMessage(
                                                from,
                                                {
                                                    text: `🚫 *@${senderNumber}*, links aren't allowed by Queen Vida here! Warning *(${warnCount}/3)*.`,
                                                    mentions: [
                                                        sender
                                                    ]
                                                }
                                            );
                                        } else {
                                            groupSettings
                                                .linkWarns[
                                                from
                                            ][sender] = 0;

                                            fs.writeFileSync(
                                                'settings.json',
                                                JSON.stringify(
                                                    groupSettings,
                                                    null,
                                                    2
                                                )
                                            );

                                            await sock.sendMessage(
                                                from,
                                                {
                                                    text: `🚨 *@${senderNumber}* reached 3 link warnings and has been kicked from the group!`,
                                                    mentions: [
                                                        sender
                                                    ]
                                                }
                                            );

                                            try {
                                                await sock.groupParticipantsUpdate(
                                                    from,
                                                    [
                                                        sender
                                                    ],
                                                    'remove'
                                                );
                                            } catch (
                                                e
                                            ) {}
                                        }

                                        return;
                                    }
                                }
                            }
                        }
                    } catch (
                        groupSecErr
                    ) {
                        console.error(
                            '🔥 [GROUP SECURITY ERROR]:',
                            groupSecErr
                        );
                    }
                }

                // =================================================
                // GAME MANAGER
                // =================================================

                const isGameHandled =
                    await handleGameMessage(
                        sock,
                        m,
                        from,
                        body
                    );

                if (
                    isGameHandled
                ) {
                    return;
                }

                // =================================================
                // COMMAND SYSTEM
                // =================================================

                const PREFIX = getPrefix();

                if (
                    !body.startsWith(PREFIX)
                ) {
                    return;
                }

                const currentMode =
                    getMode();

                if (
                    currentMode ===
                        'private' &&
                    !isOwner
                ) {
                    return;
                }

                const args =
                    body
                        .slice(PREFIX.length)
                        .trim()
                        .split(/ +/);

                const commandName =
                    args
                        .shift()
                        .toLowerCase();

                const command =
                    sock.commands.get(
                        commandName
                    );

                if (
                    command
                ) {
                    try {
                        await command.execute(
                            sock,
                            m,
                            m.key.remoteJid,
                            args,
                            isOwner
                        );
                    } catch (
                        cmdExecErr
                    ) {
                        console.error(
                            `🔥 [COMMAND EXECUTION CRASH] [!${commandName}]:`,
                            cmdExecErr
                        );

                        await sock
                            .sendMessage(
                                from,
                                {
                                    text: `❌ An error occurred while executing command *!${commandName}*.\n_Details:_ ${cmdExecErr.message}`
                                }
                            )
                            .catch(
                                () => {}
                            );
                    }
                }
            } catch (
                upsertErr
            ) {
                console.error(
                    '🔥 [CRITICAL MESSAGES UPSERT ERROR]:',
                    upsertErr
                );
            }
        }
    );
}

// =====================================================
// START BOT
// =====================================================

startExpressServer();
startQueenVida();
