const axios = require('axios');
const fs = require('fs');
const path = require('path');

const { TELEGRAM_BOT_TOKEN } = require('./telegramConfig');
const sessionManager = require('./sessionManager');

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const PENDING_FILE = path.join(__dirname, '..', 'telegram_sessions.json');

const pendingPairings = new Map();
const telegramSessions = loadTelegramSessions();

function loadTelegramSessions() {
    if (!fs.existsSync(PENDING_FILE)) return {};

    try {
        return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveTelegramSessions() {
    try {
        fs.writeFileSync(
            PENDING_FILE,
            JSON.stringify(telegramSessions, null, 2)
        );
    } catch (e) {
        console.error('🔥 [TELEGRAM] Failed to save sessions:', e);
    }
}

async function telegram(method, data = {}) {
    const response = await axios.post(
        `${TELEGRAM_API}/${method}`,
        data,
        {
            timeout: 30000
        }
    );

    if (!response.data || !response.data.ok) {
        throw new Error(
            response.data?.description || `Telegram API error: ${method}`
        );
    }

    return response.data.result;
}

async function sendMessage(chatId, text, extra = {}) {
    try {
        return await telegram('sendMessage', {
            chat_id: chatId,
            text,
            ...extra
        });
    } catch (e) {
        console.error(
            '🔥 [TELEGRAM] Failed to send message:',
            e.message
        );
    }
}

function cleanPhoneNumber(value) {
    return String(value || '')
        .trim()
        .replace(/[^0-9]/g, '');
}

function getSessionId(number) {
    return `tg-${number}`;
}

function getConnectedSession(sessionId) {
    return sessionManager
        .getActiveSessions()
        .find(session => session.sessionId === sessionId);
}

async function startPairing(chatId, number, commandsMap) {
    const cleanNumber = cleanPhoneNumber(number);

    if (!cleanNumber) {
        await sendMessage(
            chatId,
            '❌ Invalid phone number.\n\nSend your WhatsApp number using country code.\nExample: 2348012345678'
        );
        return;
    }

    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
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

    const sessionId = getSessionId(cleanNumber);

    if (sessionManager.sessionExists(sessionId)) {
        const existing = getConnectedSession(sessionId);

        if (existing && existing.connected) {
            await sendMessage(
                chatId,
                '✅ This WhatsApp number is already connected to QUEEN VIDA through Telegram.'
            );
        } else {
            await sendMessage(
                chatId,
                '⏳ A session for this WhatsApp number already exists or is being restored.'
            );
        }

        return;
    }

    // Prevent the same WhatsApp number from being paired
    // through another existing session type.
    if (
        sessionManager.sessionExists(cleanNumber) ||
        sessionManager.sessionExists(`web-${cleanNumber}`)
    ) {
        await sendMessage(
            chatId,
            '⚠️ This WhatsApp number already has a QUEEN VIDA session.\n\nUse the existing session instead of creating another one.'
        );
        return;
    }

    pendingPairings.set(chatId, {
        number: cleanNumber,
        sessionId,
        startedAt: Date.now()
    });

    await sendMessage(
        chatId,
        `⏳ Starting WhatsApp pairing for +${cleanNumber}...\n\nPlease wait while QUEEN VIDA generates your pairing code.`
    );

    let codeSent = false;

    try {
        await sessionManager.startSession({
            sessionId,
            ownerNumber: cleanNumber,
            isMain: false,
            commandsMap,

            onPairingCode: async (code, errorMessage) => {
                if (!pendingPairings.has(chatId)) return;

                if (!code) {
                    pendingPairings.delete(chatId);

                    await sendMessage(
                        chatId,
                        `❌ Pairing failed.\n\n${errorMessage || 'Unknown pairing error.'}`
                    );

                    return;
                }

                codeSent = true;

                await sendMessage(
                    chatId,
                    `🔐 *QUEEN VIDA PAIRING CODE*\n\n*${code}*\n\nOpen WhatsApp on the number you entered and use *Linked Devices → Link a Device → Link with phone number*.\n\n⏳ Complete the pairing now.`,
                    {
                        parse_mode: 'Markdown'
                    }
                );

                // Check connection status for up to 2 minutes.
                let checks = 0;

                const connectionWatcher = setInterval(async () => {
                    checks++;

                    const session = getConnectedSession(sessionId);

                    if (session && session.connected) {
                        clearInterval(connectionWatcher);

                        telegramSessions[String(chatId)] = {
                            whatsappNumber: cleanNumber,
                            sessionId,
                            pairedAt: Date.now()
                        };

                        saveTelegramSessions();

                        pendingPairings.delete(chatId);

                        await sendMessage(
                            chatId,
                            `✅ *PAIRING SUCCESSFUL!*\n\nWhatsApp number: +${cleanNumber}\n\n👑 QUEEN VIDA is now connected and active on your WhatsApp.\n\nType /status anytime to check your connection.`,
                            {
                                parse_mode: 'Markdown'
                            }
                        );

                        return;
                    }

                    if (checks >= 24) {
                        clearInterval(connectionWatcher);

                        if (pendingPairings.has(chatId)) {
                            pendingPairings.delete(chatId);

                            await sendMessage(
                                chatId,
                                '⌛ Pairing window expired.\n\nIf you did not complete the WhatsApp pairing, use /pair to try again.'
                            );
                        }
                    }
                }, 5000);
            }
        });
    } catch (error) {
        pendingPairings.delete(chatId);

        await sendMessage(
            chatId,
            `❌ Failed to start pairing.\n\n${error.message || 'Unknown error.'}`
        );

        return;
    }

    // Safety timeout if no pairing code arrives.
    setTimeout(async () => {
        if (!pendingPairings.has(chatId)) return;

        if (!codeSent) {
            pendingPairings.delete(chatId);

            await sendMessage(
                chatId,
                '⌛ No pairing code was generated in time.\n\nUse /pair to try again.'
            );
        }
    }, 30000);
}

async function handleUpdate(update, commandsMap) {
    if (!update || !update.message) return;

    const message = update.message;
    const chatId = message.chat?.id;

    if (!chatId) return;

    const text = String(message.text || '').trim();

    if (!text) return;

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

    if (text === '/pair') {
        await sendMessage(
            chatId,
            '📱 Send your WhatsApp number with country code.\n\nExample:\n2348012345678'
        );

        pendingPairings.set(chatId, {
            waitingForNumber: true,
            startedAt: Date.now()
        });

        return;
    }

    if (text === '/cancel') {
        if (pendingPairings.has(chatId)) {
            pendingPairings.delete(chatId);

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

    if (text === '/status') {
        const saved = telegramSessions[String(chatId)];

        if (!saved) {
            await sendMessage(
                chatId,
                'ℹ️ No WhatsApp account is currently linked to this Telegram account.'
            );

            return;
        }

        const session = getConnectedSession(saved.sessionId);

        if (session && session.connected) {
            await sendMessage(
                chatId,
                `🟢 *CONNECTED*\n\nWhatsApp: +${saved.whatsappNumber}\n\n👑 QUEEN VIDA is active.`,
                {
                    parse_mode: 'Markdown'
                }
            );
        } else {
            await sendMessage(
                chatId,
                `🔴 *NOT CURRENTLY CONNECTED*\n\nWhatsApp: +${saved.whatsappNumber}\n\nThe session may be reconnecting.`,
                {
                    parse_mode: 'Markdown'
                }
            );
        }

        return;
    }

    const pending = pendingPairings.get(chatId);

    if (pending && pending.waitingForNumber) {
        pendingPairings.delete(chatId);

        await startPairing(
            chatId,
            text,
            commandsMap
        );

        return;
    }

    await sendMessage(
        chatId,
        '👑 I did not understand that command.\n\nUse /pair to connect WhatsApp or /help for available commands.'
    );
}

async function startTelegramGateway(commandsMap) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error(
            '❌ [TELEGRAM] TELEGRAM_BOT_TOKEN is missing.'
        );
        return;
    }

    try {
        await telegram('deleteWebhook', {
            drop_pending_updates: false
        });

        const me = await telegram('getMe');

        console.log(
            `🤖 [TELEGRAM] Gateway connected as @${me.username || me.first_name}`
        );

        let offset = 0;

        while (true) {
            try {
                const updates = await telegram('getUpdates', {
                    offset,
                    timeout: 30,
                    allowed_updates: ['message']
                });

                for (const update of updates) {
                    offset = update.update_id + 1;

                    try {
                        await handleUpdate(update, commandsMap);
                    } catch (handlerError) {
                        console.error(
                            '🔥 [TELEGRAM] Update handler error:',
                            handlerError
                        );
                    }
                }
            } catch (pollError) {
                console.error(
                    '🔥 [TELEGRAM] Polling error:',
                    pollError.message
                );

                await new Promise(resolve =>
                    setTimeout(resolve, 5000)
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
