const axios = require('axios');
const fs = require('fs');
const path = require('path');

const {
    TELEGRAM_BOT_TOKEN
} = require('./telegramConfig');

const sessionManager =
    require('./sessionManager');

const TELEGRAM_API =
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const PENDING_FILE =
    path.join(
        __dirname,
        '..',
        'telegram_sessions.json'
    );

const pendingPairings =
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

        return parsed &&
            typeof parsed === 'object'
            ? parsed
            : {};
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

function getConnectedSession(sessionId) {
    return sessionManager
        .getActiveSessions()
        .find(
            session =>
                session.sessionId === sessionId
        );
}

function isConnected(sessionId) {
    const session =
        getConnectedSession(sessionId);

    return !!(
        session &&
        session.connected
    );
}


// ============================================================
// STALE SESSION CLEANUP
// ============================================================

function cleanupStalePairingSession(sessionId) {
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
// CHECK WHETHER A SESSION IS ACTUALLY CONNECTED
// ============================================================

function hasActiveSessionForNumber(number) {
    const cleanNumber =
        cleanPhoneNumber(number);

    const sessions =
        sessionManager.getActiveSessions();

    if (!Array.isArray(sessions)) {
        return false;
    }

    return sessions.some(session => {
        if (!session) {
            return false;
        }

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
    });
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

    // --------------------------------------------------------
    // Validate number
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Existing Telegram pairing
    // --------------------------------------------------------

    if (pendingPairings.has(chatId)) {
        await sendMessage(
            chatId,
            '⏳ You already have a pairing request running.\n\nUse /cancel first if you want to cancel it.'
        );

        return;
    }

    // --------------------------------------------------------
    // Check whether this number is REALLY connected
    // --------------------------------------------------------

    if (hasActiveSessionForNumber(cleanNumber)) {
        await sendMessage(
            chatId,
            '✅ This WhatsApp number is already connected to QUEEN VIDA.'
        );

        return;
    }

    /*
     * IMPORTANT:
     *
     * We deliberately do NOT block pairing just because
     * sessionManager.sessionExists(number) or
     * sessionManager.sessionExists(tg-number) returns true.
     *
     * Those checks can find an old saved authentication folder
     * even after the WhatsApp device has been unlinked.
     *
     * A saved folder is NOT proof that the WhatsApp account is
     * still connected.
     */

    // --------------------------------------------------------
    // Generate a fresh session ID
    // --------------------------------------------------------

    const sessionId =
        `tg-${cleanNumber}-${Date.now()}`;

    console.log(
        `📱 [TELEGRAM] Starting fresh pairing session: ${sessionId}`
    );

    // --------------------------------------------------------
    // Mark pairing as pending
    // --------------------------------------------------------

    pendingPairings.set(
        chatId,
        {
            number: cleanNumber,
            sessionId,
            startedAt: Date.now(),
            waitingForCode: false
        }
    );

    await sendMessage(
        chatId,
        `⏳ Starting WhatsApp pairing for +${cleanNumber}...\n\nPlease wait while QUEEN VIDA generates your pairing code.`
    );

    let codeSent = false;

    let connectionWatcher = null;

    let completed = false;

    const finishPairing = () => {
        if (connectionWatcher) {
            clearInterval(
                connectionWatcher
            );

            connectionWatcher = null;
        }

        pendingPairings.delete(chatId);
    };

    try {
        await sessionManager.startSession({
            sessionId,
            ownerNumber: cleanNumber,
            isMain: false,
            commandsMap,

            // =================================================
            // PAIRING CODE
            // =================================================

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

                    pending.waitingForCode = true;

                    pendingPairings.set(
                        chatId,
                        pending
                    );

                    await sendMessage(
                        chatId,
                        `🔐 *QUEEN VIDA PAIRING CODE*\n\n*${code}*\n\nOpen WhatsApp on the number you entered and use:\n\n*Linked Devices → Link a Device → Link with phone number*\n\n⏳ Enter the code now.`,
                        {
                            parse_mode: 'Markdown'
                        }
                    );

                    // =================================================
                    // CONNECTION WATCHER
                    // =================================================

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
                                    completed = true;

                                    clearInterval(
                                        connectionWatcher
                                    );

                                    connectionWatcher =
                                        null;

                                    telegramSessions[
                                        String(chatId)
                                    ] = {
                                        whatsappNumber:
                                            cleanNumber,

                                        sessionId,

                                        pairedAt:
                                            Date.now()
                                    };

                                    saveTelegramSessions();

                                    pendingPairings.delete(
                                        chatId
                                    );

                                    await sendMessage(
                                        chatId,
                                        `✅ *PAIRING SUCCESSFUL!*\n\nWhatsApp: +${cleanNumber}\n\n👑 QUEEN VIDA is now connected and active.\n\nUse /status anytime to check your connection.`,
                                        {
                                            parse_mode:
                                                'Markdown'
                                        }
                                    );

                                    return;
                                }

                                /*
                                 * 3 minutes.
                                 */
                                if (checks >= 36) {
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

    // --------------------------------------------------------
    // Safety timeout for pairing code
    // --------------------------------------------------------

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
// UPDATE HANDLER
// ============================================================

async function handleUpdate(
    update,
    commandsMap
) {
    if (
        !update ||
        !update.message
    ) {
        return;
    }

    const message =
        update.message;

    const chatId =
        message.chat?.id;

    if (!chatId) {
        return;
    }

    const text =
        String(
            message.text || ''
        ).trim();

    if (!text) {
        return;
    }

    // ========================================================
    // /start
    // ========================================================

    if (text === '/start') {
        await sendMessage(
            chatId,
            `👑 *QUEEN VIDA-V3*\n\nWhatsApp Pairing Gateway\n\nUse /pair to connect your WhatsApp number to QUEEN VIDA.\n\nCommands:\n/pair - Pair WhatsApp\n/status - Check your connection\n/cancel - Cancel a pending pairing\n/help - Show help`,
            {
                parse_mode: 'Markdown'
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
            `👑 *QUEEN VIDA-V3 HELP*\n\n/pair\nStart WhatsApp pairing.\n\n/status\nCheck your Telegram/WhatsApp connection.\n\n/cancel\nCancel a pending pairing.\n\n/help\nShow this help message.`,
            {
                parse_mode: 'Markdown'
            }
        );

        return;
    }

    // ========================================================
    // /pair
    // ========================================================

    if (text === '/pair') {
        const existing =
            telegramSessions[
                String(chatId)
            ];

        /*
         * Existing Telegram mapping.
         */
        if (
            existing &&
            existing.sessionId
        ) {
            if (
                isConnected(
                    existing.sessionId
                )
            ) {
                await sendMessage(
                    chatId,
                    `✅ Your WhatsApp is already connected.\n\nWhatsApp: +${existing.whatsappNumber}\n\nUse /status to check the connection.`
                );

                return;
            }

            /*
             * The Telegram mapping exists but the
             * corresponding session is no longer active.
             *
             * Remove the stale Telegram mapping.
             */
            delete telegramSessions[
                String(chatId)
            ];

            saveTelegramSessions();
        }

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
                waitingForNumber: true,
                startedAt: Date.now()
            }
        );

        await sendMessage(
            chatId,
            '📱 Send your WhatsApp number with country code.\n\nExample:\n2348012345678'
        );

        return;
    }

    // ========================================================
    // /cancel
    // ========================================================

    if (text === '/cancel') {
        const pending =
            pendingPairings.get(chatId);

        if (pending) {
            pendingPairings.delete(chatId);

            if (pending.sessionId) {
                cleanupStalePairingSession(
                    pending.sessionId
                );
            }

            await sendMessage(
                chatId,
                '🛑 Pairing request cancelled.'
            );
        } else {
            await sendMessage(
                chatId,
                'ℹ️ You do not have a pending pairing request.'
            );
        }

        return;
    }

    // ========================================================
    // /status
    // ========================================================

    if (text === '/status') {
        const saved =
            telegramSessions[
                String(chatId)
            ];

        if (!saved) {
            await sendMessage(
                chatId,
                'ℹ️ No WhatsApp account is currently linked to this Telegram account.'
            );

            return;
        }

        const session =
            getConnectedSession(
                saved.sessionId
            );

        if (
            session &&
            session.connected
        ) {
            await sendMessage(
                chatId,
                `🟢 *CONNECTED*\n\nWhatsApp: +${saved.whatsappNumber}\n\n👑 QUEEN VIDA is active.`,
                {
                    parse_mode: 'Markdown'
                }
            );
        } else {
            /*
             * Remove stale Telegram mapping.
             */
            delete telegramSessions[
                String(chatId)
            ];

            saveTelegramSessions();

            await sendMessage(
                chatId,
                `🔴 *DISCONNECTED*\n\nWhatsApp: +${saved.whatsappNumber}\n\nThe old connection is no longer active.\n\nUse /pair to link WhatsApp again.`,
                {
                    parse_mode: 'Markdown'
                }
            );
        }

        return;
    }

    // ========================================================
    // WAITING FOR PHONE NUMBER
    // ========================================================

    const pending =
        pendingPairings.get(chatId);

    if (
        pending &&
        pending.waitingForNumber
    ) {
        pendingPairings.delete(chatId);

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

    await sendMessage(
        chatId,
        '👑 I did not understand that command.\n\nUse /pair to connect WhatsApp or /help for available commands.'
    );
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
                drop_pending_updates: false
            }
        );

        const me =
            await telegram('getMe');

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
                            timeout: 30,
                            allowed_updates: [
                                'message'
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
