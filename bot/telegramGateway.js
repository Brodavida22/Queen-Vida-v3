const axios = require('axios');
const fs = require('fs');
const path = require('path');

const {
    TELEGRAM_BOT_TOKEN
} = require('./telegramConfig');

const sessionManager =
    require('./sessionManager');

const gcstatus =
    require('../commands/gcstatus');

const TELEGRAM_API =
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const TELEGRAM_FILE_API =
    `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}`;

const PENDING_FILE =
    path.join(
        __dirname,
        '..',
        'telegram_sessions.json'
    );

const PAIRING_CODE_TIMEOUT =
    4 * 60 * 1000;

const PAIRING_ENTRY_TIMEOUT =
    10 * 60 * 1000;

const PAIRING_WATCH_INTERVAL =
    2000;

const GCSTATUS_TIMEOUT =
    10 * 60 * 1000;

const pendingPairings =
    new Map();

const pendingGcStatus =
    new Map();

const telegramSessions =
    loadTelegramSessions();


// ============================================================
// TELEGRAM SESSION STORAGE
// ============================================================

function loadTelegramSessions() {
    if (!fs.existsSync(PENDING_FILE)) {
        return {};
    }

    try {
        const parsed =
            JSON.parse(
                fs.readFileSync(
                    PENDING_FILE,
                    'utf8'
                ) || '{}'
            );

        if (
            !parsed ||
            typeof parsed !== 'object'
        ) {
            return {};
        }

        for (
            const key of Object.keys(parsed)
        ) {
            if (
                parsed[key] &&
                !Array.isArray(parsed[key]) &&
                typeof parsed[key] === 'object'
            ) {
                parsed[key] = [
                    parsed[key]
                ];
            }

            if (
                !Array.isArray(
                    parsed[key]
                )
            ) {
                parsed[key] = [];
            }
        }

        return parsed;

    } catch (error) {
        console.error(
            '⚠️ [TELEGRAM] Invalid telegram_sessions.json. Starting empty.'
        );

        return {};
    }
}


function saveTelegramSessions() {
    try {
        fs.writeFileSync(
            PENDING_FILE,
            JSON.stringify(
                telegramSessions,
                null,
                2
            )
        );

    } catch (error) {
        console.error(
            '🔥 [TELEGRAM] Failed to save sessions:',
            error.message
        );
    }
}


function getChatSessions(
    chatId
) {
    const key =
        String(chatId);

    if (
        !Array.isArray(
            telegramSessions[key]
        )
    ) {
        telegramSessions[key] = [];
    }

    return telegramSessions[key];
}


function saveChatSessions(
    chatId,
    sessions
) {
    const key =
        String(chatId);

    if (sessions.length) {
        telegramSessions[key] =
            sessions;
    } else {
        delete telegramSessions[key];
    }

    saveTelegramSessions();
}


// ============================================================
// TELEGRAM API
// ============================================================

async function telegram(
    method,
    data = {},
    timeout = 30000
) {
    const response =
        await axios.post(
            `${TELEGRAM_API}/${method}`,
            data,
            {
                timeout
            }
        );

    if (
        !response.data?.ok
    ) {
        throw new Error(
            response.data?.description ||
            `Telegram API error: ${method}`
        );
    }

    return response.data.result;
}


async function sendMessage(
    chatId,
    text,
    extra = {}
) {
    try {
        return await telegram(
            'sendMessage',
            {
                chat_id: chatId,
                text,
                ...extra
            }
        );

    } catch (error) {
        console.error(
            '🔥 [TELEGRAM] Failed to send message:',
            error.message
        );

        return null;
    }
}


async function answerCallbackQuery(
    id,
    text = ''
) {
    try {
        return await telegram(
            'answerCallbackQuery',
            {
                callback_query_id:
                    id,
                text
            }
        );

    } catch (error) {
        console.error(
            '🔥 [TELEGRAM] Callback error:',
            error.message
        );

        return null;
    }
}


async function editMessageText(
    chatId,
    messageId,
    text,
    extra = {}
) {
    try {
        return await telegram(
            'editMessageText',
            {
                chat_id: chatId,
                message_id: messageId,
                text,
                ...extra
            }
        );

    } catch (error) {
        console.error(
            '🔥 [TELEGRAM] Edit message error:',
            error.message
        );

        return null;
    }
}


// ============================================================
// PHONE
// ============================================================

function cleanPhoneNumber(
    value
) {
    return String(value || '')
        .trim()
        .replace(/[^0-9]/g, '');
}


// ============================================================
// WHATSAPP SESSION HELPERS
// ============================================================

function getConnectedSession(
    sessionId
) {
    if (!sessionId) {
        return null;
    }

    const active =
        sessionManager
            .activeSessions
            ?.get(sessionId);

    if (!active) {
        return null;
    }

    return {
        sessionId,

        ownerNumber:
            active.ownerNumber,

        isMain:
            active.isMain,

        connected:
            !!(
                active.sock &&
                active.sock.user
            ),

        sock:
            active.sock
    };
}


function isConnected(
    sessionId
) {
    return !!(
        getConnectedSession(
            sessionId
        )?.connected
    );
}


function getConnectedTelegramSessions(
    chatId
) {
    return getChatSessions(chatId)
        .map(saved => {
            const session =
                getConnectedSession(
                    saved.sessionId
                );

            if (
                !session?.connected ||
                !session.sock
            ) {
                return null;
            }

            return {
                ...session,
                saved
            };
        })
        .filter(Boolean);
}


function getTelegramGcStatusSession(
    chatId,
    sessionId
) {
    return getConnectedTelegramSessions(
        chatId
    ).find(
        session =>
            session.sessionId ===
            sessionId
    ) || null;
}


// ============================================================
// GCSTATUS ACCESS
// ============================================================

function getAuthorizedGcStatusSession(
    chatId
) {
    const connected =
        getConnectedTelegramSessions(
            chatId
        );

    if (!connected.length) {
        return {
            ok: false,

            message:
                '🔴 No WhatsApp session is currently connected.\n\nUse /pair to link WhatsApp first.'
        };
    }

    if (
        connected.length === 1
    ) {
        return {
            ok: true,
            session:
                connected[0]
        };
    }

    return {
        ok: true,
        multiple: true,
        sessions:
            connected
    };
}


// ============================================================
// CLEAR WHATSAPP SESSION
// ============================================================

async function clearWhatsAppSession(
    sessionId
) {
    if (!sessionId) {
        return false;
    }

    try {
        await sessionManager.removeSession(
            sessionId,
            {
                removeAuth: true,
                removeRegistry: true
            }
        );

        return true;

    } catch (error) {
        console.error(
            `🔥 [TELEGRAM] Failed to clear session ${sessionId}:`,
            error.message
        );

        return false;
    }
}


// ============================================================
// ACTIVE NUMBER CHECK
// ============================================================

function hasActiveSessionForNumber(
    number
) {
    const clean =
        cleanPhoneNumber(number);

    return sessionManager
        .getActiveSessions()
        .some(session => {
            const owner =
                cleanPhoneNumber(
                    session.ownerNumber ||
                    session.phoneNumber ||
                    session.number ||
                    ''
                );

            return (
                owner === clean &&
                session.connected === true
            );
        });
}


// ============================================================
// REMOVE OLD DISCONNECTED MAPPINGS
// ============================================================

function removeDisconnectedMappingsForNumber(
    chatId,
    number
) {
    const clean =
        cleanPhoneNumber(number);

    const remaining =
        getChatSessions(chatId)
            .filter(saved => {
                if (
                    cleanPhoneNumber(
                        saved.whatsappNumber
                    ) !== clean
                ) {
                    return true;
                }

                return isConnected(
                    saved.sessionId
                );
            });

    saveChatSessions(
        chatId,
        remaining
    );

    return remaining;
}


// ============================================================
// PAIRING TIMER CLEANUP
// ============================================================

function clearPairingTimers(
    pending
) {
    if (!pending) {
        return;
    }

    if (pending.generationTimer) {
        clearTimeout(
            pending.generationTimer
        );
    }

    if (pending.entryTimer) {
        clearTimeout(
            pending.entryTimer
        );
    }

    if (pending.watcher) {
        clearInterval(
            pending.watcher
        );
    }

    pending.generationTimer =
        null;

    pending.entryTimer =
        null;

    pending.watcher =
        null;
}


// ============================================================
// ABORT PAIRING
// ============================================================

async function abortPairing(
    chatId,
    sessionId,
    message
) {
    const pending =
        pendingPairings.get(
            chatId
        );

    if (pending) {
        clearPairingTimers(
            pending
        );
    }

    pendingPairings.delete(
        chatId
    );

    if (sessionId) {
        await clearWhatsAppSession(
            sessionId
        );
    }

    if (message) {
        await sendMessage(
            chatId,
            message
        );
    }
}


// ============================================================
// START PAIRING
// ============================================================

async function startPairing(
    chatId,
    number,
    commandsMap
) {
    const cleanNumber =
        cleanPhoneNumber(number);

    if (
        !cleanNumber ||
        cleanNumber.length < 10 ||
        cleanNumber.length > 15
    ) {
        await sendMessage(
            chatId,
            '❌ Invalid phone number.\n\nSend the number with country code.\nExample: 2348012345678'
        );

        return;
    }

    if (
        pendingPairings.has(
            chatId
        )
    ) {
        await sendMessage(
            chatId,
            '⏳ You already have a pairing request running.\n\nUse /cancel first if you want to cancel it.'
        );

        return;
    }

    if (
        hasActiveSessionForNumber(
            cleanNumber
        )
    ) {
        await sendMessage(
            chatId,
            `✅ +${cleanNumber} is already connected to QUEEN VIDA.`
        );

        return;
    }

    removeDisconnectedMappingsForNumber(
        chatId,
        cleanNumber
    );

    const sessionId =
        `tg-${cleanNumber}-${Date.now()}`;

    const pending = {
        number:
            cleanNumber,

        sessionId,

        startedAt:
            Date.now(),

        waitingForNumber:
            false,

        waitingForCode:
            false,

        codeSent:
            false,

        completed:
            false,

        generationTimer:
            null,

        entryTimer:
            null,

        watcher:
            null
    };

    pendingPairings.set(
        chatId,
        pending
    );

    await sendMessage(
        chatId,
        `⏳ Starting WhatsApp pairing for +${cleanNumber}...\n\nPlease wait. Your pairing code can take a little time to generate.`
    );

    const finish =
        () => {
            const current =
                pendingPairings.get(
                    chatId
                );

            if (current) {
                clearPairingTimers(
                    current
                );
            }

            pendingPairings.delete(
                chatId
            );
        };

    const markConnected =
        async () => {
            const current =
                pendingPairings.get(
                    chatId
                );

            if (
                !current ||
                current.completed
            ) {
                return false;
            }

            const session =
                getConnectedSession(
                    sessionId
                );

            if (
                !session?.connected
            ) {
                return false;
            }

            current.completed =
                true;

            finish();

            const sessions =
                getChatSessions(
                    chatId
                );

            if (
                !sessions.some(
                    s =>
                        s.sessionId ===
                        sessionId
                )
            ) {
                sessions.push({
                    whatsappNumber:
                        cleanNumber,

                    sessionId,

                    pairedAt:
                        Date.now()
                });

                saveChatSessions(
                    chatId,
                    sessions
                );
            }

            await sendMessage(
                chatId,
                `✅ *PAIRING SUCCESSFUL!*\n\nWhatsApp: +${cleanNumber}\n\n👑 QUEEN VIDA is now connected and active.\n\nYou can link another number anytime with /pair.\nUse /status to view all linked accounts.`,
                {
                    parse_mode:
                        'Markdown'
                }
            );

            return true;
        };

    try {
        await sessionManager.startSession({
            sessionId,

            ownerNumber:
                cleanNumber,

            isMain:
                false,

            commandsMap,

            onPairingCode:
                async (
                    code,
                    errorMessage
                ) => {
                    const current =
                        pendingPairings.get(
                            chatId
                        );

                    if (
                        !current ||
                        current.completed
                    ) {
                        return;
                    }

                    if (!code) {
                        await abortPairing(
                            chatId,
                            sessionId,
                            `❌ Pairing failed.\n\n${errorMessage || 'Unknown pairing error.'}\n\nUse /pair to try again.`
                        );

                        return;
                    }

                    current.codeSent =
                        true;

                    current.waitingForCode =
                        true;

                    if (
                        current.generationTimer
                    ) {
                        clearTimeout(
                            current.generationTimer
                        );

                        current.generationTimer =
                            null;
                    }

                    await sendMessage(
                        chatId,
                        `🔐 *QUEEN VIDA PAIRING CODE*\n\n*${code}*\n\nOpen WhatsApp on the number you entered:\n\n*Linked Devices → Link a Device → Link with phone number*\n\n⏳ Enter the code now.`,
                        {
                            parse_mode:
                                'Markdown'
                        }
                    );

                    current.watcher =
                        setInterval(
                            async () => {
                                try {
                                    const stillPending =
                                        pendingPairings.get(
                                            chatId
                                        );

                                    if (
                                        !stillPending ||
                                        stillPending.completed
                                    ) {
                                        return;
                                    }

                                    await markConnected();

                                } catch (error) {
                                    console.error(
                                        '🔥 [TELEGRAM] Pairing watcher error:',
                                        error.message
                                    );
                                }
                            },
                            PAIRING_WATCH_INTERVAL
                        );

                    current.entryTimer =
                        setTimeout(
                            async () => {
                                const stillPending =
                                    pendingPairings.get(
                                        chatId
                                    );

                                if (
                                    !stillPending ||
                                    stillPending.completed
                                ) {
                                    return;
                                }

                                await abortPairing(
                                    chatId,
                                    sessionId,
                                    '⌛ Pairing timed out.\n\nThe incomplete session has been cleaned automatically.\n\nUse /pair to try again.'
                                );
                            },
                            PAIRING_ENTRY_TIMEOUT
                        );
                }
        });

        const current =
            pendingPairings.get(
                chatId
            );

        if (!current) {
            return;
        }

        /*
         * IMPORTANT:
         * This timer is now 4 minutes.
         * It only handles failure to generate
         * the code. It does NOT control the
         * 10-minute code-entry period.
         */
        current.generationTimer =
            setTimeout(
                async () => {
                    const stillPending =
                        pendingPairings.get(
                            chatId
                        );

                    if (
                        !stillPending ||
                        stillPending.completed ||
                        stillPending.codeSent
                    ) {
                        return;
                    }

                    await abortPairing(
                        chatId,
                        sessionId,
                        '⌛ No pairing code was generated within the allowed time.\n\nThe incomplete session has been cleaned automatically.\n\nUse /pair to try again.'
                    );
                },
                PAIRING_CODE_TIMEOUT
            );

    } catch (error) {
        await abortPairing(
            chatId,
            sessionId,
            `❌ Failed to start pairing.\n\n${error.message || 'Unknown error.'}\n\nUse /pair to try again.`
        );
    }
}


// ============================================================
// TELEGRAM FILE DOWNLOAD
// ============================================================

async function downloadTelegramFile(
    fileId
) {
    if (!fileId) {
        throw new Error(
            'Telegram file ID is missing.'
        );
    }

    const file =
        await telegram(
            'getFile',
            {
                file_id:
                    fileId
            }
        );

    if (!file?.file_path) {
        throw new Error(
            'Telegram did not return a file path.'
        );
    }

    const response =
        await axios.get(
            `${TELEGRAM_FILE_API}/${file.file_path}`,
            {
                responseType:
                    'arraybuffer',

                timeout:
                    120000,

                maxContentLength:
                    100 * 1024 * 1024,

                maxBodyLength:
                    100 * 1024 * 1024
            }
        );

    return Buffer.from(
        response.data
    );
}


// ============================================================
// WHATSAPP GROUPS
// ============================================================

async function getWhatsAppGroups(
    sock
) {
    if (
        !sock ||
        typeof sock.groupFetchAllParticipating !==
            'function'
    ) {
        throw new Error(
            'WhatsApp group information is unavailable.'
        );
    }

    const groups =
        await sock.groupFetchAllParticipating();

    return Object.entries(
        groups || {}
    )
        .map(
            ([jid, metadata]) => ({
                jid,

                subject:
                    metadata?.subject ||
                    'Unnamed Group'
            })
        )
        .sort(
            (a, b) =>
                a.subject.localeCompare(
                    b.subject
                )
        );
}


// ============================================================
// GCSTATUS ACCOUNT PICKER
// ============================================================

async function showGcStatusAccountPicker(
    chatId
) {
    const auth =
        getAuthorizedGcStatusSession(
            chatId
        );

    if (!auth.ok) {
        await sendMessage(
            chatId,
            auth.message
        );

        return;
    }

    if (!auth.multiple) {
        await showGcStatusGroupsForSession(
            chatId,
            auth.session.sessionId
        );

        return;
    }

    const keyboard =
        auth.sessions.map(
            session => [
                {
                    text:
                        `📱 +${session.saved.whatsappNumber}`,

                    callback_data:
                        `gcsacct:${session.sessionId}`
                }
            ]
        );

    await sendMessage(
        chatId,
        '📱 *SELECT WHATSAPP ACCOUNT*\n\nChoose the WhatsApp account whose groups you want to use for GCSTATUS.',
        {
            parse_mode:
                'Markdown',

            reply_markup: {
                inline_keyboard:
                    keyboard
            }
        }
    );
}


// ============================================================
// GCSTATUS GROUP PICKER
// ============================================================

async function showGcStatusGroupsForSession(
    chatId,
    sessionId
) {
    const auth =
        getTelegramGcStatusSession(
            chatId,
            sessionId
        );

    if (!auth) {
        await sendMessage(
            chatId,
            '🔴 That WhatsApp account is no longer connected.\n\nUse /status to check your accounts.'
        );

        return;
    }

    try {
        const groups =
            await getWhatsAppGroups(
                auth.sock
            );

        if (!groups.length) {
            await sendMessage(
                chatId,
                `❌ No WhatsApp groups were found for +${auth.saved.whatsappNumber}.`
            );

            return;
        }

        const limited =
            groups.slice(0, 40);

        const keyboard =
            limited.map(
                group => [
                    {
                        text:
                            `📢 ${group.subject}`
                                .slice(0, 60),

                        callback_data:
                            `gcsgrp:${group.jid}`
                    }
                ]
            );

        pendingGcStatus.set(
            chatId,
            {
                sessionId:
                    auth.sessionId,

                accountNumber:
                    auth.saved.whatsappNumber,

                groupJid:
                    null,

                groupName:
                    null,

                createdAt:
                    Date.now()
            }
        );

        await sendMessage(
            chatId,
            `📢 *GCSTATUS*\n\nWhatsApp: +${auth.saved.whatsappNumber}\n\nSelect the WhatsApp group where you want to post the status:\n\n${groups.length > 40 ? '⚠️ Showing the first 40 groups.' : ''}`,
            {
                parse_mode:
                    'Markdown',

                reply_markup: {
                    inline_keyboard:
                        keyboard
                }
            }
        );

        const pending =
            pendingGcStatus.get(
                chatId
            );

        if (pending) {
            pending.expireTimer =
                setTimeout(
                    () => {
                        if (
                            pendingGcStatus.get(
                                chatId
                            ) === pending
                        ) {
                            pendingGcStatus.delete(
                                chatId
                            );
                        }
                    },
                    GCSTATUS_TIMEOUT
                );
        }

    } catch (error) {
        console.error(
            '🔥 [TELEGRAM GCSTATUS GROUP LIST ERROR]:',
            error
        );

        await sendMessage(
            chatId,
            `❌ Could not load your WhatsApp groups.\n\n${error.message || 'Unknown error.'}`
        );
    }
}


// ============================================================
// GCSTATUS ACCOUNT SELECTION
// ============================================================

async function handleGcStatusAccountSelection(
    callbackQuery
) {
    const chatId =
        callbackQuery
            .message
            ?.chat
            ?.id;

    const data =
        String(
            callbackQuery.data || ''
        );

    if (
        !chatId ||
        !data.startsWith(
            'gcsacct:'
        )
    ) {
        await answerCallbackQuery(
            callbackQuery.id
        );

        return;
    }

    const sessionId =
        data.slice(
            'gcsacct:'.length
        );

    if (
        !getTelegramGcStatusSession(
            chatId,
            sessionId
        )
    ) {
        await answerCallbackQuery(
            callbackQuery.id,
            'WhatsApp account is no longer connected.'
        );

        return;
    }

    await answerCallbackQuery(
        callbackQuery.id,
        'Account selected.'
    );

    await showGcStatusGroupsForSession(
        chatId,
        sessionId
    );
}


// ============================================================
// GCSTATUS GROUP SELECTION
// ============================================================

async function handleGcStatusGroupSelection(
    callbackQuery
) {
    const chatId =
        callbackQuery
            .message
            ?.chat
            ?.id;

    const data =
        String(
            callbackQuery.data || ''
        );

    if (
        !chatId ||
        !data.startsWith(
            'gcsgrp:'
        )
    ) {
        await answerCallbackQuery(
            callbackQuery.id
        );

        return;
    }

    const groupJid =
        data.slice(
            'gcsgrp:'.length
        );

    const pending =
        pendingGcStatus.get(
            chatId
        );

    if (
        !pending ||
        !pending.sessionId
    ) {
        await answerCallbackQuery(
            callbackQuery.id,
            'GCSTATUS selection expired.'
        );

        return;
    }

    const auth =
        getTelegramGcStatusSession(
            chatId,
            pending.sessionId
        );

    if (!auth) {
        pendingGcStatus.delete(
            chatId
        );

        await answerCallbackQuery(
            callbackQuery.id,
            'WhatsApp account is not connected.'
        );

        await sendMessage(
            chatId,
            '🔴 The selected WhatsApp account is no longer connected.\n\nUse /gcstatus again.'
        );

        return;
    }

    try {
        const groups =
            await getWhatsAppGroups(
                auth.sock
            );

        const selected =
            groups.find(
                group =>
                    group.jid ===
                    groupJid
            );

        if (!selected) {
            await answerCallbackQuery(
                callbackQuery.id,
                'Group is no longer available.'
            );

            return;
        }

        if (
            pending.expireTimer
        ) {
            clearTimeout(
                pending.expireTimer
            );
        }

        pendingGcStatus.set(
            chatId,
            {
                ...pending,

                groupJid:
                    selected.jid,

                groupName:
                    selected.subject,

                createdAt:
                    Date.now()
            }
        );

        await answerCallbackQuery(
            callbackQuery.id,
            'Group selected.'
        );

        await editMessageText(
            chatId,
            callbackQuery
                .message
                .message_id,

            `✅ *Group selected:*\n${selected.subject}\n\n📱 WhatsApp: +${auth.saved.whatsappNumber}\n\nNow send me:\n\n📝 Text/link\n🖼️ Image\n🎥 Video\n\nFor media, you can include a caption.`,

            {
                parse_mode:
                    'Markdown'
            }
        );

    } catch (error) {
        await answerCallbackQuery(
            callbackQuery.id,
            'Failed to select group.'
        );

        await sendMessage(
            chatId,
            `❌ Could not select that group.\n\n${error.message || 'Unknown error.'}`
        );
    }
}


// ============================================================
// PROCESS TELEGRAM GCSTATUS
// ============================================================

async function processTelegramGcStatus(
    chatId,
    message
) {
    const pending =
        pendingGcStatus.get(
            chatId
        );

    if (
        !pending ||
        !pending.groupJid
    ) {
        return false;
    }

    const auth =
        getTelegramGcStatusSession(
            chatId,
            pending.sessionId
        );

    if (!auth) {
        pendingGcStatus.delete(
            chatId
        );

        await sendMessage(
            chatId,
            '🔴 The selected WhatsApp account is no longer connected.\n\nUse /gcstatus again.'
        );

        return true;
    }

    try {
        if (
            message.text?.trim()
        ) {
            await sendMessage(
                chatId,
                '⏳ Posting text to Group Status...'
            );

            await gcstatus.sendTelegramTextStatus(
                auth.sock,
                pending.groupJid,
                message.text.trim()
            );

            pendingGcStatus.delete(
                chatId
            );

            await sendMessage(
                chatId,
                `✅ Text posted to Group Status.\n\n📱 +${pending.accountNumber}\n📢 ${pending.groupName}`
            );

            return true;
        }

        if (
            Array.isArray(
                message.photo
            ) &&
            message.photo.length
        ) {
            const photo =
                message.photo[
                    message.photo.length - 1
                ];

            const buffer =
                await downloadTelegramFile(
                    photo.file_id
                );

            const caption =
                String(
                    message.caption ||
                    ''
                ).trim();

            await sendMessage(
                chatId,
                '⏳ Uploading image to Group Status...'
            );

            await gcstatus.sendTelegramImageStatus(
                auth.sock,
                pending.groupJid,
                buffer,
                caption
            );

            pendingGcStatus.delete(
                chatId
            );

            await sendMessage(
                chatId,
                `✅ Image posted to Group Status.\n\n📱 +${pending.accountNumber}\n📢 ${pending.groupName}`
            );

            return true;
        }

        if (
            message.video?.file_id
        ) {
            const buffer =
                await downloadTelegramFile(
                    message.video.file_id
                );

            const caption =
                String(
                    message.caption ||
                    ''
                ).trim();

            await sendMessage(
                chatId,
                '⏳ Uploading video to Group Status...'
            );

            await gcstatus.sendTelegramVideoStatus(
                auth.sock,
                pending.groupJid,
                buffer,
                caption
            );

            pendingGcStatus.delete(
                chatId
            );

            await sendMessage(
                chatId,
                `✅ Video posted to Group Status.\n\n📱 +${pending.accountNumber}\n📢 ${pending.groupName}`
            );

            return true;
        }

        await sendMessage(
            chatId,
            '⚠️ Send a text message, image, or video for GCSTATUS.'
        );

        return true;

    } catch (error) {
        console.error(
            '🔥 [TELEGRAM GCSTATUS ERROR]:',
            error
        );

        await sendMessage(
            chatId,
            `❌ Group Status failed.\n\nError: ${error.message || 'Unknown error'}\n\nYou can try again.`
        );

        return true;
    }
}


// ============================================================
// SHOW ACCOUNTS
// ============================================================

async function showAccounts(
    chatId
) {
    const sessions =
        getChatSessions(
            chatId
        );

    if (!sessions.length) {
        await sendMessage(
            chatId,
            'ℹ️ No WhatsApp accounts are linked to this Telegram account.\n\nUse /pair to link one.'
        );

        return;
    }

    let text =
        '📱 *YOUR LINKED WHATSAPP ACCOUNTS*\n\n';

    sessions.forEach(
        (
            saved,
            index
        ) => {
            const connected =
                isConnected(
                    saved.sessionId
                );

            text +=
                `${index + 1}. ${connected ? '🟢' : '🔴'} +${saved.whatsappNumber} — ${connected ? 'Connected' : 'Disconnected'}\n`;
        }
    );

    text +=
        '\nUse /pair to link another number.\nUse /clear to remove an account.';

    await sendMessage(
        chatId,
        text,
        {
            parse_mode:
                'Markdown'
        }
    );
}


// ============================================================
// CLEAR PICKER
// ============================================================

async function showClearPicker(
    chatId
) {
    const sessions =
        getChatSessions(
            chatId
        );

    if (!sessions.length) {
        await sendMessage(
            chatId,
            'ℹ️ You have no linked WhatsApp accounts to clear.'
        );

        return;
    }

    const keyboard =
        sessions.map(
            (
                saved,
                index
            ) => [
                {
                    text:
                        `${isConnected(saved.sessionId) ? '🟢' : '🔴'} +${saved.whatsappNumber}`,

                    callback_data:
                        `tgclear:${index}`
                }
            ]
        );

    await sendMessage(
        chatId,
        '🗑️ *CLEAR WHATSAPP SESSION*\n\nSelect the WhatsApp account you want to remove.\n\nThis deletes its saved WhatsApp login so the number can be paired again.',

        {
            parse_mode:
                'Markdown',

            reply_markup: {
                inline_keyboard:
                    keyboard
            }
        }
    );
}


// ============================================================
// CLEAR SELECTED
// ============================================================

async function handleClearSelection(
    callbackQuery
) {
    const chatId =
        callbackQuery
            .message
            ?.chat
            ?.id;

    const data =
        String(
            callbackQuery.data || ''
        );

    if (
        !chatId ||
        !data.startsWith(
            'tgclear:'
        )
    ) {
        await answerCallbackQuery(
            callbackQuery.id
        );

        return;
    }

    const index =
        Number(
            data.slice(
                'tgclear:'.length
            )
        );

    const sessions =
        getChatSessions(
            chatId
        );

    const selected =
        sessions[index];

    if (
        !Number.isInteger(index) ||
        index < 0 ||
        !selected
    ) {
        await answerCallbackQuery(
            callbackQuery.id,
            'Account not found.'
        );

        return;
    }

    await answerCallbackQuery(
        callbackQuery.id,
        'Clearing session...'
    );

    await sendMessage(
        chatId,
        `🗑️ Clearing +${selected.whatsappNumber}...`
    );

    const removed =
        await clearWhatsAppSession(
            selected.sessionId
        );

    saveChatSessions(
        chatId,
        sessions.filter(
            (_, i) =>
                i !== index
        )
    );

    pendingGcStatus.delete(
        chatId
    );

    await sendMessage(
        chatId,

        removed
            ? `✅ *Session cleared successfully.*\n\nWhatsApp: +${selected.whatsappNumber}\n\nThe number can now be paired again using /pair.`

            : `⚠️ The Telegram link was removed for +${selected.whatsappNumber}, but the WhatsApp session could not be fully removed.`,

        removed
            ? {
                parse_mode:
                    'Markdown'
            }
            : {}
    );
}


// ============================================================
// CLEAR ALL
// ============================================================

async function clearAllSessions(
    chatId
) {
    const sessions =
        getChatSessions(
            chatId
        );

    if (!sessions.length) {
        await sendMessage(
            chatId,
            'ℹ️ You have no linked WhatsApp accounts.'
        );

        return;
    }

    await sendMessage(
        chatId,
        `🗑️ Clearing ${sessions.length} WhatsApp session(s)...`
    );

    let cleared = 0;

    for (
        const saved of sessions
    ) {
        if (
            await clearWhatsAppSession(
                saved.sessionId
            )
        ) {
            cleared++;
        }
    }

    delete telegramSessions[
        String(chatId)
    ];

    saveTelegramSessions();

    pendingGcStatus.delete(
        chatId
    );

    await sendMessage(
        chatId,
        `✅ *CLEAR COMPLETE*\n\nRemoved: ${cleared}/${sessions.length} session(s).\n\nYou can now use /pair to link WhatsApp again.`,
        {
            parse_mode:
                'Markdown'
        }
    );
}


// ============================================================
// UPDATE HANDLER
// ============================================================

async function handleUpdate(
    update,
    commandsMap
) {
    if (
        update?.callback_query
    ) {
        const data =
            String(
                update.callback_query
                    .data ||
                ''
            );

        if (
            data.startsWith(
                'tgclear:'
            )
        ) {
            await handleClearSelection(
                update.callback_query
            );

            return;
        }

        if (
            data.startsWith(
                'gcsacct:'
            )
        ) {
            await handleGcStatusAccountSelection(
                update.callback_query
            );

            return;
        }

        if (
            data.startsWith(
                'gcsgrp:'
            )
        ) {
            await handleGcStatusGroupSelection(
                update.callback_query
            );

            return;
        }

        await answerCallbackQuery(
            update.callback_query.id
        );

        return;
    }

    if (!update?.message) {
        return;
    }

    const message =
        update.message;

    const chatId =
        message.chat?.id;

    if (!chatId) {
        return;
    }


    // ========================================================
    // GCSTATUS
    // ========================================================

    if (
        pendingGcStatus.has(
            chatId
        )
    ) {
        const pending =
            pendingGcStatus.get(
                chatId
            );

        if (
            pending?.groupJid
        ) {
            const handled =
                await processTelegramGcStatus(
                    chatId,
                    message
                );

            if (handled) {
                return;
            }
        }
    }


    const text =
        String(
            message.text || ''
        ).trim();


    // ========================================================
    // START
    // ========================================================

    if (
        text === '/start'
    ) {
        await sendMessage(
            chatId,
            `👑 *QUEEN VIDA-V3*\n\nWhatsApp Pairing Gateway\n\nCommands:\n/pair - Pair WhatsApp\n/status - Check all connections\n/clear - Clear a WhatsApp session\n/clearall - Clear all your sessions\n/gcstatus - Post to WhatsApp Group Status\n/cancel - Cancel pairing\n/help - Show help`,

            {
                parse_mode:
                    'Markdown'
            }
        );

        return;
    }


    // ========================================================
    // HELP
    // ========================================================

    if (
        text === '/help'
    ) {
        await sendMessage(
            chatId,
            `👑 *QUEEN VIDA-V3 HELP*\n\n/pair\nLink a new WhatsApp number. You can link multiple numbers.\n\n/status\nShow all linked WhatsApp accounts.\n\n/clear\nRemove one WhatsApp session.\n\n/clearall\nRemove all your WhatsApp sessions.\n\n/gcstatus\nChoose a linked WhatsApp account, then a group, and post text, image or video to Group Status.\n\n/cancel\nCancel pairing or GCSTATUS selection.`,

            {
                parse_mode:
                    'Markdown'
            }
        );

        return;
    }


    // ========================================================
    // GCSTATUS
    // ========================================================

    if (
        text === '/gcstatus' ||
        text.startsWith(
            '/gcstatus '
        )
    ) {
        pendingGcStatus.delete(
            chatId
        );

        await showGcStatusAccountPicker(
            chatId
        );

        return;
    }


    // ========================================================
    // PAIR
    // ========================================================

    if (
        text === '/pair'
    ) {
        if (
            pendingPairings.has(
                chatId
            )
        ) {
            await sendMessage(
                chatId,
                '⏳ You already have a pairing request running.\n\nUse /cancel first if you want to cancel it.'
            );

            return;
        }

        const count =
            getChatSessions(
                chatId
            ).length;

        pendingPairings.set(
            chatId,
            {
                waitingForNumber:
                    true,

                startedAt:
                    Date.now()
            }
        );

        await sendMessage(
            chatId,
            `📱 Send the WhatsApp number you want to link with country code.\n\nExample:\n2348012345678\n\n${count ? `You currently have ${count} linked account${count === 1 ? '' : 's'}. You can add another one.` : ''}`
        );

        return;
    }


    // ========================================================
    // STATUS
    // ========================================================

    if (
        text === '/status'
    ) {
        await showAccounts(
            chatId
        );

        return;
    }


    // ========================================================
    // CLEAR
    // ========================================================

    if (
        text === '/clear'
    ) {
        await showClearPicker(
            chatId
        );

        return;
    }


    // ========================================================
    // CLEAR ALL
    // ========================================================

    if (
        text === '/clearall'
    ) {
        await clearAllSessions(
            chatId
        );

        return;
    }


    // ========================================================
    // CANCEL
    // ========================================================

    if (
        text === '/cancel'
    ) {
        const pending =
            pendingPairings.get(
                chatId
            );

        if (pending) {
            clearPairingTimers(
                pending
            );

            pendingPairings.delete(
                chatId
            );

            if (
                pending.sessionId
            ) {
                await clearWhatsAppSession(
                    pending.sessionId
                );
            }

            await sendMessage(
                chatId,
                '🛑 Pairing request cancelled.'
            );

            return;
        }

        pendingGcStatus.delete(
            chatId
        );

        await sendMessage(
            chatId,
            '🛑 GCSTATUS selection cancelled.'
        );

        return;
    }


    // ========================================================
    // WAITING FOR PHONE NUMBER
    // ========================================================

    const pending =
        pendingPairings.get(
            chatId
        );

    if (
        pending?.waitingForNumber
    ) {
        pendingPairings.delete(
            chatId
        );

        await startPairing(
            chatId,
            text,
            commandsMap
        );

        return;
    }


    // ========================================================
    // UNKNOWN COMMAND
    // ========================================================

    if (
        text.startsWith('/')
    ) {
        await sendMessage(
            chatId,
            '👑 I did not understand that command.\n\nUse /help to see available commands.'
        );
    }
}


// ============================================================
// START TELEGRAM GATEWAY
// ============================================================

async function startTelegramGateway(
    commandsMap
) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error(
            '❌ [TELEGRAM] TELEGRAM_BOT_TOKEN is missing.'
        );

        return;
    }

    try {
        await telegram(
            'deleteWebhook',
            {
                drop_pending_updates:
                    false
            }
        );

        const me =
            await telegram(
                'getMe'
            );

        console.log(
            `🤖 [TELEGRAM] Gateway connected as @${me.username || me.first_name}`
        );

        let offset = 0;

        while (true) {
            try {
                const updates =
                    await telegram(
                        'getUpdates',
                        {
                            offset,

                            timeout:
                                30,

                            allowed_updates: [
                                'message',
                                'callback_query'
                            ]
                        },

                        40000
                    );

                for (
                    const update of updates
                ) {
                    offset =
                        update.update_id +
                        1;

                    try {
                        await handleUpdate(
                            update,
                            commandsMap
                        );

                    } catch (error) {
                        console.error(
                            '🔥 [TELEGRAM] Update handler error:',
                            error
                        );
                    }
                }

            } catch (error) {
                console.error(
                    '🔥 [TELEGRAM] Polling error:',
                    error.message
                );

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            5000
                        )
                );
            }
        }

    } catch (error) {
        console.error(
            '🔥 [TELEGRAM] Gateway startup failed:',
            error.message
        );
    }
}


module.exports = {
    startTelegramGateway
};
