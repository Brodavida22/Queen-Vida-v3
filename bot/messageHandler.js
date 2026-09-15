const fs = require('fs');
const { getMode } = require('../utils/mode');
const { getPrefix } = require('../utils/prefix');
const { handleGameMessage } = require('../utils/gameManager');
const { CREATOR_NUMBERS } = require('./config');

// Per-session in-memory spam tracker, keyed by sessionId so two
// sessions never bleed into each other's anti-spam counters.
const spamTrackerBySession = {};

// --- CONTEXT EMOJI ---
function getContextEmoji(text = '') {
    const lower = text.toLowerCase();

    if (/(lol|lmao|funny|haha|😂|🤣|giggle|joke|comedy)/i.test(lower)) {
        return '😂';
    }

    if (
        /(congrats|congratulations|welldone|bravo|party|🎉|🎈|win|victory|success)/i.test(
            lower
        )
    ) {
        return '🥳';
    }

    if (/(sad|sorry|rip|pain|crying|😭|😢|pity)/i.test(lower)) {
        return '😢';
    }

    if (/(love|heart|babe|sweet|❤️|😍|kiss)/i.test(lower)) {
        return '❤️';
    }

    if (/(fire|lit|amazing|cool|🔥|awesome|best)/i.test(lower)) {
        return '🔥';
    }

    if (/(wow|omg|shock|damn|surprised|😮)/i.test(lower)) {
        return '😮';
    }

    if (/(money|cash|rich|wealth|naira|dollar|lagos)/i.test(lower)) {
        return '💰';
    }

    const defaults = ['👍', '🔥', '❤️', '👏', '🙌', '💯'];

    return defaults[Math.floor(Math.random() * defaults.length)];
}

function getGlobalSettings(settingsFile) {
    if (fs.existsSync(settingsFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(settingsFile));

            return {
                autoViewStatus:
                    data.autoViewStatus !== undefined
                        ? data.autoViewStatus
                        : 'on',

                // AUTO-REACTION DEFAULT IS NOW OFF
                autoReaction:
                    data.autoReaction !== undefined
                        ? data.autoReaction
                        : 'off',

                statusReaction:
                    data.statusReaction !== undefined
                        ? data.statusReaction
                        : 'off'
            };
        } catch (e) {
            console.error(
                '🔥 [SETTINGS ERROR] Failed to parse',
                settingsFile,
                e
            );
        }
    }

    return {
        autoViewStatus: 'on',
        autoReaction: 'off',
        statusReaction: 'off'
    };
}

/**
 * Builds the messages.upsert handler for ONE session.
 *
 * @param {object} sock - the Baileys socket for this session
 * @param {object} opts
 * @param {string} opts.sessionId - unique id for this session (usually the owner's number)
 * @param {string} opts.ownerNumber - the WhatsApp number that owns THIS session
 * @param {boolean} opts.isMain - true for the original/main bot session
 */
function createMessageHandler(sock, { sessionId, ownerNumber, isMain }) {
    const SETTINGS_FILE = isMain
        ? 'settings.json'
        : `settings_${sessionId}.json`;

    const ACTIVITY_FILE = isMain
        ? 'activity.json'
        : `activity_${sessionId}.json`;

    if (!spamTrackerBySession[sessionId]) {
        spamTrackerBySession[sessionId] = {};
    }

    const spamTracker = spamTrackerBySession[sessionId];

    const SESSION_OWNER_NUMBERS = [
        ...CREATOR_NUMBERS,
        ...(ownerNumber ? [ownerNumber.replace(/[^0-9]/g, '')] : [])
    ];

    return async ({ messages }) => {
        try {
            const m = messages[0];

            if (!m.message) return;

            const from = m.key.remoteJid;

            const settings = getGlobalSettings(SETTINGS_FILE);

            // =================================================
            // STATUS HANDLER
            // =================================================

            if (from === 'status@broadcast') {
                // =============================================
                // ANTI-GROUP-MENTION (AGM)
                // =============================================

                (async () => {
                    try {
                        const groupSettings = fs.existsSync(SETTINGS_FILE)
                            ? JSON.parse(fs.readFileSync(SETTINGS_FILE))
                            : {};

                        const agmGroupIds = groupSettings.agm
                            ? Object.keys(groupSettings.agm).filter(
                                  gid => groupSettings.agm[gid] === 'on'
                              )
                            : [];

                        if (agmGroupIds.length === 0) return;

                        const statusText =
                            m.message?.conversation ||
                            m.message?.extendedTextMessage?.text ||
                            m.message?.imageMessage?.caption ||
                            m.message?.videoMessage?.caption ||
                            '';

                        const linkMatches = statusText.match(
                            /chat\.whatsapp\.com\/([A-Za-z0-9]+)/gi
                        );

                        if (!linkMatches || linkMatches.length === 0) return;

                        const posterJid =
                            m.key.participant || m.participant;

                        if (!posterJid) return;

                        const posterNumber = posterJid.replace(
                            /[^0-9]/g,
                            ''
                        );

                        if (SESSION_OWNER_NUMBERS.includes(posterNumber)) {
                            return;
                        }

                        for (const groupId of agmGroupIds) {
                            let inviteCode;

                            try {
                                inviteCode = await sock.groupInviteCode(
                                    groupId
                                );
                            } catch (e) {
                                continue;
                            }

                            const isMentioned = linkMatches.some(link =>
                                link
                                    .toLowerCase()
                                    .includes(inviteCode.toLowerCase())
                            );

                            if (!isMentioned) continue;

                            let groupMetadata;

                            try {
                                groupMetadata = await sock.groupMetadata(
                                    groupId
                                );
                            } catch (e) {
                                continue;
                            }

                            const posterParticipant =
                                groupMetadata.participants.find(
                                    p => p.id === posterJid
                                );

                            if (!posterParticipant) continue;

                            const isAdminPoster =
                                posterParticipant.admin === 'admin' ||
                                posterParticipant.admin === 'superadmin';

                            if (isAdminPoster) continue;

                            if (!groupSettings.agmWarns) {
                                groupSettings.agmWarns = {};
                            }

                            if (!groupSettings.agmWarns[groupId]) {
                                groupSettings.agmWarns[groupId] = {};
                            }

                            if (!groupSettings.agmWarns[groupId][posterJid]) {
                                groupSettings.agmWarns[groupId][posterJid] = 0;
                            }

                            groupSettings.agmWarns[groupId][posterJid] += 1;

                            const warnCount =
                                groupSettings.agmWarns[groupId][posterJid];

                            fs.writeFileSync(
                                SETTINGS_FILE,
                                JSON.stringify(groupSettings, null, 2)
                            );

                            if (warnCount < 3) {
                                await sock.sendMessage(groupId, {
                                    text: `🚫 *@${posterNumber}*, mentioning this group in your status isn't allowed by Queen Vida! Warning *(${warnCount}/3)*.`,
                                    mentions: [posterJid]
                                });
                            } else {
                                groupSettings.agmWarns[groupId][posterJid] = 0;

                                fs.writeFileSync(
                                    SETTINGS_FILE,
                                    JSON.stringify(groupSettings, null, 2)
                                );

                                await sock.sendMessage(groupId, {
                                    text: `🚫 *@${posterNumber}* reached 3 group-mention warnings and has been kicked from the group!`,
                                    mentions: [posterJid]
                                });

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
                        console.error('🔥 [AGM ERROR]:', agmErr);
                    }
                })();

                if (settings.autoViewStatus === 'on') {
                    (async () => {
                        try {
                            if (m.key && m.key.remoteJid) {
                                await sock.readMessages([m.key]);
                            }

                            if (settings.statusReaction === 'on' && m.message) {
                                const targetParticipant =
                                    m.key.participant || m.participant;

                                if (
                                    !targetParticipant ||
                                    !targetParticipant.endsWith(
                                        '@s.whatsapp.net'
                                    )
                                ) {
                                    return;
                                }

                                const statusText =
                                    m.message.conversation ||
                                    m.message.extendedTextMessage?.text ||
                                    m.message.imageMessage?.caption ||
                                    m.message.videoMessage?.caption ||
                                    '';

                                const emoji = getContextEmoji(statusText);

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
                                            broadcast: true
                                        }
                                    );
                                } catch (statusReactErr) {
                                    // Silenced
                                }
                            }
                        } catch (statusHandlerErr) {
                            // Silenced
                        }
                    })();
                }

                return;
            }

            // =================================================
            // SENDER / OWNER
            // =================================================

            const sender = m.key.participant || m.key.remoteJid;

            const senderNumber = sender
                ? sender.replace(/[^0-9]/g, '')
                : '';

            const isOwner =
                SESSION_OWNER_NUMBERS.includes(senderNumber) ||
                m.key.fromMe;

            // =================================================
            // ACTIVITY TRACKER
            // =================================================
            // Tracks messages + the last time the bot saw each
            // member active in each group.

            if (from.endsWith('@g.us') && sender) {
                try {
                    let act = fs.existsSync(ACTIVITY_FILE)
                        ? JSON.parse(
                              fs.readFileSync(
                                  ACTIVITY_FILE,
                                  'utf8'
                              )
                          )
                        : {};

                    if (!act || typeof act !== 'object') {
                        act = {};
                    }

                    if (!act[from] || typeof act[from] !== 'object') {
                        act[from] = {};
                    }

                    const existing = act[from][sender];

                    // Support the old activity format where the value
                    // was simply a number.
                    if (typeof existing === 'number') {
                        act[from][sender] = {
                            messages: existing,
                            lastActive: Date.now()
                        };
                    } else if (
                        !existing ||
                        typeof existing !== 'object'
                    ) {
                        act[from][sender] = {
                            messages: 0,
                            lastActive: Date.now()
                        };
                    }

                    act[from][sender].messages =
                        Number(act[from][sender].messages || 0) + 1;

                    act[from][sender].lastActive = Date.now();

                    fs.writeFileSync(
                        ACTIVITY_FILE,
                        JSON.stringify(act, null, 2)
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
                m.message.conversation ||
                m.message.extendedTextMessage?.text ||
                '';

            const isGroup = from.endsWith('@g.us');
            const isChannel = from.endsWith('@newsletter');

            // =================================================
            // ANTISTICKER
            // =================================================

            if (isGroup && !isOwner && m.message.stickerMessage) {
                try {
                    const groupSettings = fs.existsSync(SETTINGS_FILE)
                        ? JSON.parse(
                              fs.readFileSync(
                                  SETTINGS_FILE
                              )
                          )
                        : {};

                    const isAntiStickerOn =
                        groupSettings.antisticker?.[from] === 'on';

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
                                await sock.sendMessage(from, {
                                    delete: m.key
                                });
                            } catch (e) {}

                            await sock.sendMessage(from, {
                                text: `🚫 *@${senderNumber}*, stickers aren't allowed by Queen Vida in this group!`,
                                mentions: [sender]
                            });

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

            // DEFAULT: OFF
            // Auto-reaction only runs when settings explicitly
            // contain autoReaction: "on".

            if (
                settings.autoReaction === 'on' &&
                !m.key.fromMe &&
                (isGroup || isChannel)
            ) {
                try {
                    const reactionEmoji = getContextEmoji(body);

                    await sock.sendMessage(from, {
                        react: {
                            text: reactionEmoji,
                            key: m.key
                        }
                    });
                } catch (autoReactErr) {
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

            if (isGroup && !isOwner) {
                try {
                    const groupMetadata =
                        await sock.groupMetadata(from);

                    const participants =
                        groupMetadata.participants;

                    const senderParticipant =
                        participants.find(
                            p => p.id === sender
                        );

                    const isAdmin =
                        senderParticipant &&
                        (
                            senderParticipant.admin === 'admin' ||
                            senderParticipant.admin === 'superadmin'
                        );

                    if (!isAdmin) {
                        let groupSettings =
                            fs.existsSync(SETTINGS_FILE)
                                ? JSON.parse(
                                      fs.readFileSync(
                                          SETTINGS_FILE
                                      )
                                  )
                                : {};

                        // =====================================
                        // ANTI-SPAM
                        // =====================================

                        const isAntiSpamOn =
                            groupSettings.antispam?.[from] === 'on';

                        if (isAntiSpamOn) {
                            const now = Date.now();

                            if (!spamTracker[from]) {
                                spamTracker[from] = {};
                            }

                            if (!spamTracker[from][sender]) {
                                spamTracker[from][sender] = {
                                    count: 0,
                                    lastTime: now
                                };
                            }

                            const userSpam =
                                spamTracker[from][sender];

                            if (now - userSpam.lastTime < 3000) {
                                userSpam.count += 1;
                            } else {
                                userSpam.count = 1;
                            }

                            userSpam.lastTime = now;

                            if (userSpam.count >= 5) {
                                userSpam.count = 0;

                                try {
                                    await sock.sendMessage(from, {
                                        delete: m.key
                                    });
                                } catch (e) {}

                                if (!groupSettings.spamWarns) {
                                    groupSettings.spamWarns = {};
                                }

                                if (!groupSettings.spamWarns[from]) {
                                    groupSettings.spamWarns[from] = {};
                                }

                                if (!groupSettings.spamWarns[from][sender]) {
                                    groupSettings.spamWarns[from][sender] = 0;
                                }

                                groupSettings.spamWarns[from][sender] += 1;

                                const spamWarnCount =
                                    groupSettings.spamWarns[from][sender];

                                fs.writeFileSync(
                                    SETTINGS_FILE,
                                    JSON.stringify(
                                        groupSettings,
                                        null,
                                        2
                                    )
                                );

                                if (spamWarnCount === 1) {
                                    await sock.sendMessage(from, {
                                        text: `⚠️ *@${senderNumber}*, stop spamming! This is your 1st warning. Next time you will be kicked.`,
                                        mentions: [sender]
                                    });
                                } else {
                                    groupSettings.spamWarns[from][sender] = 0;

                                    fs.writeFileSync(
                                        SETTINGS_FILE,
                                        JSON.stringify(
                                            groupSettings,
                                            null,
                                            2
                                        )
                                    );

                                    await sock.sendMessage(from, {
                                        text: `🚨 *@${senderNumber}* continued spamming after warning and has been kicked!`,
                                        mentions: [sender]
                                    });

                                    try {
                                        await sock.groupParticipantsUpdate(
                                            from,
                                            [sender],
                                            'remove'
                                        );
                                    } catch (e) {}

                                    return;
                                }
                            }
                        }

                        // =====================================
                        // BADWORDS
                        // =====================================

                        const badWordsConfig =
                            groupSettings.badwords?.[from];

                        if (
                            badWordsConfig &&
                            badWordsConfig.status === 'on' &&
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

                            if (containsBadWord) {
                                try {
                                    await sock.sendMessage(from, {
                                        delete: m.key
                                    });
                                } catch (e) {}

                                await sock.sendMessage(from, {
                                    text: `⚠️ *@${senderNumber}*, watch your language! Profanity is strictly prohibited in this group.`,
                                    mentions: [sender]
                                });

                                return;
                            }
                        }

                        // =====================================
                        // ANTILINK
                        // =====================================

                        const antiLinkConfig =
                            groupSettings.antilink?.[from];

                        if (
                            antiLinkConfig &&
                            (
                                antiLinkConfig.warn === 'on' ||
                                antiLinkConfig.instant === 'on'
                            )
                        ) {
                            const linkRegex =
                                /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.)+[a-zA-Z]{2,}(\/[^\s]*)?/gi;

                            const messageContent =
                                body ||
                                m.message.extendedTextMessage?.text ||
                                m.message.imageMessage?.caption ||
                                '';

                            if (linkRegex.test(messageContent)) {
                                try {
                                    await sock.sendMessage(from, {
                                        delete: m.key
                                    });
                                } catch (e) {}

                                if (antiLinkConfig.instant === 'on') {
                                    await sock.sendMessage(from, {
                                        text: `🚫 *@${senderNumber}*, links aren't allowed by Queen Vida in this group! You have been removed.`,
                                        mentions: [sender]
                                    });

                                    try {
                                        await sock.groupParticipantsUpdate(
                                            from,
                                            [sender],
                                            'remove'
                                        );
                                    } catch (e) {}

                                    return;
                                }

                                if (antiLinkConfig.warn === 'on') {
                                    if (!groupSettings.linkWarns) {
                                        groupSettings.linkWarns = {};
                                    }

                                    if (!groupSettings.linkWarns[from]) {
                                        groupSettings.linkWarns[from] = {};
                                    }

                                    if (
                                        !groupSettings.linkWarns[from][sender]
                                    ) {
                                        groupSettings.linkWarns[from][
                                            sender
                                        ] = 0;
                                    }

                                    groupSettings.linkWarns[from][sender] += 1;

                                    const warnCount =
                                        groupSettings.linkWarns[from][sender];

                                    fs.writeFileSync(
                                        SETTINGS_FILE,
                                        JSON.stringify(
                                            groupSettings,
                                            null,
                                            2
                                        )
                                    );

                                    if (warnCount < 3) {
                                        await sock.sendMessage(from, {
                                            text: `🚫 *@${senderNumber}*, links aren't allowed by Queen Vida here! Warning *(${warnCount}/3)*.`,
                                            mentions: [sender]
                                        });
                                    } else {
                                        groupSettings.linkWarns[from][
                                            sender
                                        ] = 0;

                                        fs.writeFileSync(
                                            SETTINGS_FILE,
                                            JSON.stringify(
                                                groupSettings,
                                                null,
                                                2
                                            )
                                        );

                                        await sock.sendMessage(from, {
                                            text: `🚨 *@${senderNumber}* reached 3 link warnings and has been kicked from the group!`,
                                            mentions: [sender]
                                        });

                                        try {
                                            await sock.groupParticipantsUpdate(
                                                from,
                                                [sender],
                                                'remove'
                                            );
                                        } catch (e) {}

                                        return;
                                    }
                                }
                            }
                        }
                    }
                } catch (groupSecErr) {
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

            if (isGameHandled) return;

            // =================================================
            // COMMAND SYSTEM
            // =================================================

            const PREFIX = getPrefix();

            if (!body.startsWith(PREFIX)) return;

            const currentMode = getMode();

            if (currentMode === 'private' && !isOwner) return;

            const args = body
                .slice(PREFIX.length)
                .trim()
                .split(/ +/);

            const commandName =
                args.shift().toLowerCase();

            const command =
                sock.commands.get(commandName);

            if (command) {
                try {
                    await command.execute(
                        sock,
                        m,
                        m.key.remoteJid,
                        args,
                        isOwner,
                        {
                            sessionId,
                            ownerNumber,
                            isMain,
                            settingsFile: SETTINGS_FILE
                        }
                    );
                } catch (cmdExecErr) {
                    console.error(
                        `🔥 [COMMAND EXECUTION CRASH] [${PREFIX}${commandName}]:`,
                        cmdExecErr
                    );

                    await sock
                        .sendMessage(from, {
                            text:
                                `❌ An error occurred while executing command *${PREFIX}${commandName}*.\n` +
                                `_Details:_ ${cmdExecErr.message}`
                        })
                        .catch(() => {});
                }
            }
        } catch (upsertErr) {
            console.error(
                '🔥 [CRITICAL MESSAGES UPSERT ERROR]:',
                upsertErr
            );
        }
    };
}

module.exports = {
    createMessageHandler,
    getGlobalSettings,
    getContextEmoji
};
