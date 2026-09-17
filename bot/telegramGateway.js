const axios = require('axios');
const fs = require('fs');
const path = require('path');

const {
    TELEGRAM_BOT_TOKEN
} = require('./telegramConfig');

const sessionManager =
    require('./sessionManager');

const {
    CREATOR_NUMBERS
} = require('./config');

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

const pendingPairings = new Map();
const pendingGcStatus = new Map();

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
        const data =
            fs.readFileSync(
                PENDING_FILE,
                'utf8'
            );

        if (!data.trim()) {
            return {};
        }

        const parsed =
            JSON.parse(data);

        if (
            !parsed ||
            typeof parsed !== 'object'
        ) {
            return {};
        }

        /*
         * Convert old single-account format:
         *
         * {
         *   "12345": {
         *      whatsappNumber: "...",
         *      sessionId: "..."
         *   }
         * }
         *
         * into new multi-account format:
         *
         * {
         *   "12345": [
         *      {...}
         *   ]
         * }
         */
        for (const chatId of Object.keys(parsed)) {
            if (
                parsed[chatId] &&
                !Array.isArray(parsed[chatId]) &&
                typeof parsed[chatId] === 'object'
            ) {
                parsed[chatId] = [
                    parsed[chatId]
                ];
            }

            if (!Array.isArray(parsed[chatId])) {
                parsed[chatId] = [];
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


function getChatSessions(chatId) {
    const key = String(chatId);

    if (!Array.isArray(telegramSessions[key])) {
        telegramSessions[key] = [];
    }

    return telegramSessions[key];
}


function saveChatSessions(chatId, sessions) {
    const key = String(chatId);

    if (!sessions.length) {
        delete telegramSessions[key];
    } else {
        telegramSessions[key] = sessions;
    }

    saveTelegramSessions();
}


// ============================================================
// TELEGRAM API
// ============================================================

async function telegram(
    method,
    data = {},
    axiosTimeout = 30000
) {
    const response =
        await axios.post(
            `${TELEGRAM_API}/${method}`,
            data,
            {
                timeout: axiosTimeout
            }
        );

    if (
        !response.data ||
        !response.data.ok
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
    callbackQueryId,
    text = ''
) {
    try {
        return await telegram(
            'answerCallbackQuery',
            {
                callback_query_id:
                    callbackQueryId,
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
// PHONE HELPERS
// ============================================================

function cleanPhoneNumber(value) {
    return String(value || '')
        .trim()
        .replace(/[^0-9]/g, '');
}


// ============================================================
// SESSION HELPERS
// ============================================================

function getSessionRecord(sessionId) {
    if (!sessionId) {
        return null;
    }

    const sessions =
        sessionManager.getActiveSessions();

    if (!Array.isArray(sessions)) {
        return null;
    }

    return sessions.find(
        session =>
            session.sessionId === sessionId
    ) || null;
}


function getConnectedSession(sessionId) {
    if (!sessionId) {
        return null;
    }

    const active =
        sessionManager.activeSessions?.get(
            sessionId
        );

    if (!active) {
        return null;
    }

    const connected =
        !!(
            active.sock &&
            active.sock.user
        );

    return {
        sessionId,
        ownerNumber:
            active.ownerNumber,
        isMain:
            active.isMain,
        connected,
        sock:
            active.sock
    };
}


function isConnected(sessionId) {
    const session =
        getConnectedSession(
            sessionId
        );

    return !!(
        session &&
        session.connected
    );
}


function findTelegramSession(
    chatId,
    sessionId
) {
    return getChatSessions(chatId)
        .find(
            session =>
                session.sessionId ===
                sessionId
        ) || null;
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
                !session ||
                !session.connected ||
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


// ============================================================
// TELEGRAM GCSTATUS AUTHORIZATION
// ============================================================

function isCreatorWhatsAppSession(
    session
) {
    if (!session) {
        return false;
    }

    const owner =
        cleanPhoneNumber(
            session.ownerNumber ||
            session.saved?.whatsappNumber ||
            ''
        );

    return CREATOR_NUMBERS
        .map(cleanPhoneNumber)
        .includes(owner);
}


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

    const creator =
        connected.find(
            session =>
                isCreatorWhatsAppSession(
                    session
                )
        );

    if (!creator) {
        return {
            ok: false,
            message:
                '❌ GCSTATUS is restricted to the QUEEN VIDA creator account.'
        };
    }

    return {
        ok: true,
        session: creator
    };
}


// ============================================================
// STALE SESSION CLEANUP
// ============================================================

function cleanupStalePairingSession(
    sessionId
) {
    if (!sessionId) {
        return false;
    }

    try {
        return sessionManager.cleanupStaleSession(
            sessionId,
            false
        );
    } catch (error) {
        console.error(
            `🔥 [TELEGRAM] Stale session cleanup failed for ${sessionId}:`,
            error.message
        );

        return false;
    }
}


// ============================================================
// FORCE CLEAR SESSION
// ============================================================

async function clearWhatsAppSession(
    sessionId
) {
    if (!sessionId) {
        return false;
    }

    try {
        if (
            typeof sessionManager.removeSession ===
            'function'
        ) {
            await sessionManager.removeSession(
                sessionId,
                {
                    removeAuth: true,
                    removeRegistry: true
                }
            );

            return true;
        }

        cleanupStalePairingSession(
            sessionId
        );

        return false;
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
    const cleanNumber =
        cleanPhoneNumber(number);

    const sessions =
        sessionManager.getActiveSessions();

    if (!Array.isArray(sessions)) {
        return false;
    }

    return sessions.some(
        session => {
            const owner =
                cleanPhoneNumber(
                    session.ownerNumber ||
                    session.phoneNumber ||
                    session.number ||
                    ''
                );

            return (
                owner === cleanNumber &&
                session.connected === true
            );
        }
    );
}


// ============================================================
// REMOVE OLD DISCONNECTED MAPPINGS
// ============================================================

function removeDisconnectedMappingsForNumber(
    chatId,
    number
) {
    const cleanNumber =
        cleanPhoneNumber(number);

    const sessions =
        getChatSessions(chatId);

    const remaining =
        sessions.filter(
            saved => {
                if (
                    cleanPhoneNumber(
                        saved.whatsappNumber
                    ) !== cleanNumber
                ) {
                    return true;
                }

                return isConnected(
                    saved.sessionId
                );
            }
        );

    saveChatSessions(
        chatId,
        remaining
    );

    return remaining;
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

    if (!cleanNumber) {
        await sendMessage(
            chatId,
            '❌ Invalid phone number.\n\nSend your WhatsApp number using country code.\nExample: 2348012345678'
        );

        return;
    }

    if (
        cleanNumber.length < 10 ||
        cleanNumber.length > 15
    ) {
        await sendMessage(
            chatId,
            '❌ Invalid phone number length.\n\nSend the number with country code.\nExample: 2348012345678'
        );

        return;
    }

    if (pendingPairings.has(chatId)) {
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

    /*
     * Remove only stale Telegram mappings
     * for this same number.
     */
    removeDisconnectedMappingsForNumber(
        chatId,
        cleanNumber
    );

    const sessionId =
        `tg-${cleanNumber}-${Date.now()}`;

    console.log(
        `📱 [TELEGRAM] Starting fresh pairing session: ${sessionId}`
    );

    pendingPairings.set(
        chatId,
        {
            number:
                cleanNumber,
            sessionId,
            startedAt:
                Date.now(),
            waitingForCode:
                false
        }
    );

    await sendMessage(
        chatId,
        `⏳ Starting WhatsApp pairing for +${cleanNumber}...\n\nPlease wait while QUEEN VIDA generates your pairing code.`
    );

    let codeSent = false;
    let connectionWatcher = null;
    let completed = false;

    const finishPairing =
        () => {
            if (connectionWatcher) {
                clearInterval(
                    connectionWatcher
                );

                connectionWatcher = null;
            }

            pendingPairings.delete(
                chatId
            );
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
                    const pending =
                        pendingPairings.get(
                            chatId
                        );

                    if (
                        !pending ||
                        completed
                    ) {
                        return;
                    }

                    if (!code) {
                        finishPairing();

                        await sendMessage(
                            chatId,
                            `❌ Pairing failed.\n\n${errorMessage || 'Unknown pairing error.'}\n\nUse /pair to try again.`
                        );

                        return;
                    }

                    codeSent = true;

                    pending.waitingForCode =
                        true;

                    pendingPairings.set(
                        chatId,
                        pending
                    );

                    await sendMessage(
                        chatId,
                        `🔐 *QUEEN VIDA PAIRING CODE*\n\n*${code}*\n\nOpen WhatsApp on the number you entered and use:\n\n*Linked Devices → Link a Device → Link with phone number*\n\n⏳ Enter the code now.`,
                        {
                            parse_mode:
                                'Markdown'
                        }
                    );

                    let checks = 0;

                    connectionWatcher =
                        setInterval(
                            async () => {
                                checks++;

                                if (completed) {
                                    clearInterval(
                                        connectionWatcher
                                    );

                                    connectionWatcher =
                                        null;

                                    return;
                                }

                                const session =
                                    getConnectedSession(
                                        sessionId
                                    );

                                if (
                                    session &&
                                    session.connected
                                ) {
                                    completed =
                                        true;

                                    clearInterval(
                                        connectionWatcher
                                    );

                                    connectionWatcher =
                                        null;

                                    const sessions =
                                        getChatSessions(
                                            chatId
                                        );

                                    /*
                                     * Do not duplicate
                                     * the same session.
                                     */
                                    const alreadySaved =
                                        sessions.some(
                                            saved =>
                                                saved.sessionId ===
                                                sessionId
                                        );

                                    if (!alreadySaved) {
                                        sessions.push({
                                            whatsappNumber:
                                                cleanNumber,

                                            sessionId,

                                            pairedAt:
                                                Date.now()
                                        });
                                    }

                                    saveChatSessions(
                                        chatId,
                                        sessions
                                    );

                                    pendingPairings.delete(
                                        chatId
                                    );

                                    await sendMessage(
                                        chatId,
                                        `✅ *PAIRING SUCCESSFUL!*\n\nWhatsApp: +${cleanNumber}\n\n👑 QUEEN VIDA is now connected and active.\n\nYou can link another number anytime with /pair.\n\nUse /status to view all linked accounts.`,
                                        {
                                            parse_mode:
                                                'Markdown'
                                        }
                                    );

                                    return;
                                }

                                if (
                                    checks >= 36
                                ) {
                                    clearInterval(
                                        connectionWatcher
                                    );

                                    connectionWatcher =
                                        null;

                                    if (
                                        pendingPairings.has(
                                            chatId
                                        )
                                    ) {
                                        pendingPairings.delete(
                                            chatId
                                        );

                                        cleanupStalePairingSession(
                                            sessionId
                                        );

                                        await sendMessage(
                                            chatId,
                                            '⌛ Pairing expired.\n\nThe incomplete session has been cleaned automatically.\n\nUse /pair to try again.'
                                        );
                                    }
                                }
                            },
                            5000
                        );
                }
        });
    } catch (error) {
        finishPairing();

        cleanupStalePairingSession(
            sessionId
        );

        await sendMessage(
            chatId,
            `❌ Failed to start pairing.\n\n${error.message || 'Unknown error.'}\n\nThe incomplete session was cleaned. You can use /pair again.`
        );

        return;
    }

    setTimeout(
        async () => {
            const pending =
                pendingPairings.get(
                    chatId
                );

            if (
                !pending ||
                completed
            ) {
                return;
            }

            if (!codeSent) {
                finishPairing();

                cleanupStalePairingSession(
                    sessionId
                );

                await sendMessage(
                    chatId,
                    '⌛ No pairing code was generated.\n\nThe incomplete session was cleaned automatically.\n\nUse /pair to try again.'
                );
            }
        },
        45000
    );
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
// GROUP STATUS GROUP LIST
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
// SHOW GROUP PICKER
// ============================================================

async function showGcStatusGroups(
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

    try {
        const groups =
            await getWhatsAppGroups(
                auth.session.sock
            );

        if (!groups.length) {
            await sendMessage(
                chatId,
                '❌ No WhatsApp groups were found on this account.'
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

        await sendMessage(
            chatId,
            `📢 *GCSTATUS*\n\nSelect the WhatsApp group where you want to post the status:\n\n${groups.length > 40 ? '⚠️ Showing the first 40 groups.' : ''}`,
            {
                parse_mode:
                    'Markdown',

                reply_markup:
                {
                    inline_keyboard:
                        keyboard
                }
            }
        );
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
// HANDLE GROUP SELECTION
// ============================================================

async function handleGcStatusGroupSelection(
    callbackQuery
) {
    const callbackId =
        callbackQuery.id;

    const data =
        String(
            callbackQuery.data || ''
        );

    const chatId =
        callbackQuery.message?.chat?.id;

    if (
        !chatId ||
        !data.startsWith(
            'gcsgrp:'
        )
    ) {
        await answerCallbackQuery(
            callbackId
        );

        return;
    }

    const groupJid =
        data.slice(
            'gcsgrp:'.length
        );

    const auth =
        getAuthorizedGcStatusSession(
            chatId
        );

    if (!auth.ok) {
        await answerCallbackQuery(
            callbackId,
            'WhatsApp session is not connected.'
        );

        await sendMessage(
            chatId,
            auth.message
        );

        return;
    }

    try {
        const groups =
            await getWhatsAppGroups(
                auth.session.sock
            );

        const selected =
            groups.find(
                group =>
                    group.jid ===
                    groupJid
            );

        if (!selected) {
            await answerCallbackQuery(
                callbackId,
                'Group is no longer available.'
            );

            return;
        }

        pendingGcStatus.set(
            chatId,
            {
                sessionId:
                    auth.session.sessionId,

                groupJid:
                    selected.jid,

                groupName:
                    selected.subject,

                createdAt:
                    Date.now()
            }
        );

        await answerCallbackQuery(
            callbackId,
            'Group selected.'
        );

        if (
            callbackQuery.message?.message_id
        ) {
            await editMessageText(
                chatId,
                callbackQuery.message.message_id,
                `✅ *Group selected:*\n${selected.subject}\n\nNow send me:\n\n📝 Text/link\n🖼️ Image\n🎥 Video\n\nFor media, you can include a caption.`,
                {
                    parse_mode:
                        'Markdown'
                }
            );
        } else {
            await sendMessage(
                chatId,
                `✅ *Group selected:*\n${selected.subject}\n\nNow send me text, an image, or a video.`,
                {
                    parse_mode:
                        'Markdown'
                }
            );
        }
    } catch (error) {
        await answerCallbackQuery(
            callbackId,
            'Failed to select group.'
        );

        await sendMessage(
            chatId,
            `❌ Could not select that group.\n\n${error.message || 'Unknown error.'}`
        );
    }
}


// ============================================================
// SEND TELEGRAM GCSTATUS
// ============================================================

async function processTelegramGcStatus(
    chatId,
    message
) {
    const pending =
        pendingGcStatus.get(
            chatId
        );

    if (!pending) {
        return false;
    }

    const auth =
        getAuthorizedGcStatusSession(
            chatId
        );

    if (!auth.ok) {
        pendingGcStatus.delete(
            chatId
        );

        await sendMessage(
            chatId,
            auth.message
        );

        return true;
    }

    if (
        auth.session.sessionId !==
        pending.sessionId
    ) {
        pendingGcStatus.delete(
            chatId
        );

        await sendMessage(
            chatId,
            '⚠️ Your WhatsApp session changed. Use /gcstatus again.'
        );

        return true;
    }

    const sock =
        auth.session.sock;

    try {
        if (
            typeof message.text ===
            'string' &&
            message.text.trim()
        ) {
            const text =
                message.text.trim();

            await sendMessage(
                chatId,
                '⏳ Posting text to Group Status...'
            );

            await gcstatus.sendTelegramTextStatus(
                sock,
                pending.groupJid,
                text
            );

            pendingGcStatus.delete(
                chatId
            );

            await sendMessage(
                chatId,
                `✅ Text posted to Group Status.\n\n📢 ${pending.groupName}`
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
                sock,
                pending.groupJid,
                buffer,
                caption
            );

            pendingGcStatus.delete(
                chatId
            );

            await sendMessage(
                chatId,
                `✅ Image posted to Group Status.\n\n📢 ${pending.groupName}`
            );

            return true;
        }

        if (message.video?.file_id) {
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
                sock,
                pending.groupJid,
                buffer,
                caption
            );

            pendingGcStatus.delete(
                chatId
            );

            await sendMessage(
                chatId,
                `✅ Video posted to Group Status.\n\n📢 ${pending.groupName}`
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
            `❌ Group Status failed.\n\nError: ${error?.message || 'Unknown error'}\n\nYou can try sending it again.`
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
        getChatSessions(chatId);

    if (!sessions.length) {
        await sendMessage(
            chatId,
            'ℹ️ No WhatsApp accounts are linked to this Telegram account.\n\nUse /pair to link one.'
        );

        return;
    }

    let text =
        '📱 *YOUR LINKED WHATSAPP ACCOUNTS*\n\n';

    const cleaned = [];

    for (
        let i = 0;
        i < sessions.length;
        i++
    ) {
        const saved =
            sessions[i];

        const connected =
            isConnected(
                saved.sessionId
            );

        if (!connected) {
            text +=
                `${i + 1}. 🔴 +${saved.whatsappNumber} — Disconnected\n`;
        } else {
            text +=
                `${i + 1}. 🟢 +${saved.whatsappNumber} — Connected\n`;
        }

        cleaned.push({
            ...saved,
            connected
        });
    }

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
// SHOW CLEAR ACCOUNT PICKER
// ============================================================

async function showClearPicker(
    chatId
) {
    const sessions =
        getChatSessions(chatId);

    if (!sessions.length) {
        await sendMessage(
            chatId,
            'ℹ️ You have no linked WhatsApp accounts to clear.'
        );

        return;
    }

    const keyboard =
        sessions.map(
            (saved, index) => [
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
        '🗑️ *CLEAR WHATSAPP SESSION*\n\nSelect the WhatsApp account you want to remove.\n\nThis will delete its saved WhatsApp login so the number can be paired again.',
        {
            parse_mode:
                'Markdown',

            reply_markup:
            {
                inline_keyboard:
                    keyboard
            }
        }
    );
}


// ============================================================
// CLEAR SELECTED ACCOUNT
// ============================================================

async function handleClearSelection(
    callbackQuery
) {
    const callbackId =
        callbackQuery.id;

    const data =
        String(
            callbackQuery.data || ''
        );

    const chatId =
        callbackQuery.message?.chat?.id;

    if (
        !chatId ||
        !data.startsWith(
            'tgclear:'
        )
    ) {
        await answerCallbackQuery(
            callbackId
        );

        return;
    }

    const index =
        Number(
            data.slice(
                'tgclear:'.length
            )
        );

    if (
        !Number.isInteger(index) ||
        index < 0
    ) {
        await answerCallbackQuery(
            callbackId,
            'Invalid selection.'
        );

        return;
    }

    const sessions =
        getChatSessions(chatId);

    const selected =
        sessions[index];

    if (!selected) {
        await answerCallbackQuery(
            callbackId,
            'Account not found.'
        );

        return;
    }

    await answerCallbackQuery(
        callbackId,
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

    const remaining =
        sessions.filter(
            (_, i) =>
                i !== index
        );

    saveChatSessions(
        chatId,
        remaining
    );

    pendingGcStatus.delete(
        chatId
    );

    if (removed) {
        await sendMessage(
            chatId,
            `✅ *Session cleared successfully.*\n\nWhatsApp: +${selected.whatsappNumber}\n\nThe number can now be paired again using /pair.`,
            {
                parse_mode:
                    'Markdown'
            }
        );
    } else {
        await sendMessage(
            chatId,
            `⚠️ The Telegram link was removed for +${selected.whatsappNumber}, but the WhatsApp session could not be fully removed.\n\nTry /pair again or restart the bot.`
        );
    }
}


// ============================================================
// CLEAR ALL ACCOUNTS
// ============================================================

async function clearAllSessions(
    chatId
) {
    const sessions =
        getChatSessions(chatId);

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
        const result =
            await clearWhatsAppSession(
                saved.sessionId
            );

        if (result) {
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
    // ========================================================
    // CALLBACK QUERY
    // ========================================================

    if (update?.callback_query) {
        const callbackData =
            String(
                update.callback_query.data ||
                ''
            );

        if (
            callbackData.startsWith(
                'tgclear:'
            )
        ) {
            await handleClearSelection(
                update.callback_query
            );

            return;
        }

        if (
            callbackData.startsWith(
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
    // GCSTATUS STATE
    // ========================================================

    if (
        pendingGcStatus.has(
            chatId
        )
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

    const text =
        String(
            message.text || ''
        ).trim();

    // ========================================================
    // /start
    // ========================================================

    if (text === '/start') {
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
    // /help
    // ========================================================

    if (text === '/help') {
        await sendMessage(
            chatId,
            `👑 *QUEEN VIDA-V3 HELP*\n\n/pair\nLink a new WhatsApp number. You can link multiple numbers to the same Telegram account.\n\n/status\nShow all linked WhatsApp accounts.\n\n/clear\nChoose one WhatsApp session to remove. The number can then be paired again.\n\n/clearall\nRemove all WhatsApp sessions linked to this Telegram account.\n\n/gcstatus\nChoose a WhatsApp group and post text, image or video to Group Status.\n\n/cancel\nCancel a pending pairing.\n\n/help\nShow this help message.`,
            {
                parse_mode:
                    'Markdown'
            }
        );

        return;
    }

    // ========================================================
    // /gcstatus
    // ========================================================

    if (
        text === '/gcstatus' ||
        text === '/gcstatus@' ||
        text.startsWith('/gcstatus ')
    ) {
        pendingGcStatus.delete(
            chatId
        );

        await showGcStatusGroups(
            chatId
        );

        return;
    }

    // ========================================================
    // /pair
    // ========================================================

    if (text === '/pair') {
        if (pendingPairings.has(chatId)) {
            await sendMessage(
                chatId,
                '⏳ You already have a pairing request running.\n\nUse /cancel first if you want to cancel it.'
            );

            return;
        }

        pendingPairings.set(
            chatId,
            {
                waitingForNumber:
                    true,

                startedAt:
                    Date.now()
            }
        );

        const count =
            getChatSessions(chatId).length;

        await sendMessage(
            chatId,
            `📱 Send the WhatsApp number you want to link with country code.\n\nExample:\n2348012345678\n\n${count ? `You currently have ${count} linked account${count === 1 ? '' : 's'}. You can add another one.` : ''}`
        );

        return;
    }

    // ========================================================
    // /status
    // ========================================================

    if (text === '/status') {
        await showAccounts(
            chatId
        );

        return;
    }

    // ========================================================
    // /clear
    // ========================================================

    if (text === '/clear') {
        await showClearPicker(
            chatId
        );

        return;
    }

    // ========================================================
    // /clearall
    // ========================================================

    if (text === '/clearall') {
        await clearAllSessions(
            chatId
        );

        return;
    }

    // ========================================================
    // /cancel
    // ========================================================

    if (text === '/cancel') {
        const pending =
            pendingPairings.get(
                chatId
            );

        if (pending) {
            pendingPairings.delete(
                chatId
            );

            if (pending.sessionId) {
                cleanupStalePairingSession(
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
        pending &&
        pending.waitingForNumber
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
                        update.update_id + 1;

                    try {
                        await handleUpdate(
                            update,
                            commandsMap
                        );
                    } catch (
                        handlerError
                    ) {
                        console.error(
                            '🔥 [TELEGRAM] Update handler error:',
                            handlerError
                        );
                    }
                }
            } catch (
                pollingError
            ) {
                console.error(
                    '🔥 [TELEGRAM] Polling error:',
                    pollingError.message
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
    } catch (
        startupError
    ) {
        console.error(
            '🔥 [TELEGRAM] Gateway startup failed:',
            startupError.message
        );
    }
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
    startTelegramGateway
};
