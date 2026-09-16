/**
 * QUEEN VIDA V3
 * Unified Game Answer Manager
 *
 * Handles:
 * - Riddle
 * - Words Starting
 * - Words Ending
 * - Existing gameManagerCore games
 */

const gameManagerCore =
    require('./gameManagerCore');

const riddleGame =
    require('../commands/riddle');

const wordGames =
    require('../commands/wordgames');


/*
 * ============================================================
 * MESSAGE TEXT
 * ============================================================
 */

function getText(m, body = '') {
    const message =
        m?.message || {};

    /*
     * Normal WhatsApp text
     */
    const directText =
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        message.documentMessage?.caption ||
        message.buttonsResponseMessage?.selectedButtonId ||
        message.listResponseMessage?.singleSelectReply
            ?.selectedRowId ||
        '';

    if (
        typeof directText === 'string' &&
        directText.trim()
    ) {
        return directText.trim();
    }

    /*
     * Fallback to body supplied by messageHandler.
     *
     * IMPORTANT:
     * Never String() an object here.
     */
    if (
        typeof body === 'string' &&
        body.trim()
    ) {
        return body.trim();
    }

    return '';
}


/*
 * ============================================================
 * COMMAND CHECK
 * ============================================================
 */

function isCommand(text) {
    return /^[.!/#]/.test(
        String(text || '').trim()
    );
}


/*
 * ============================================================
 * RIDDLE HANDLER
 * ============================================================
 */

async function handleRiddle(
    sock,
    m,
    from,
    text
) {
    try {
        if (!riddleGame) {
            return false;
        }

        if (
            typeof riddleGame.isActive !==
            'function'
        ) {
            return false;
        }

        if (
            !riddleGame.isActive(from)
        ) {
            return false;
        }

        /*
         * Commands are NOT game answers.
         */
        if (isCommand(text)) {
            return false;
        }

        if (
            typeof riddleGame.handleMessage !==
            'function'
        ) {
            console.error(
                '❌ [RIDDLE] handleMessage() is missing'
            );

            return false;
        }

        /*
         * Pass the actual answer text.
         */
        const result =
            await riddleGame.handleMessage(
                sock,
                m,
                from,
                text
            );

        return result === true;

    } catch (error) {
        console.error(
            '🔥 [RIDDLE ANSWER ERROR]:',
            error
        );

        return false;
    }
}


/*
 * ============================================================
 * STARTING / ENDING HANDLER
 * ============================================================
 */

async function handleWordGames(
    sock,
    m,
    from,
    text
) {
    try {
        if (!wordGames) {
            return false;
        }

        /*
         * Commands are handled by the command system.
         */
        if (isCommand(text)) {
            return false;
        }

        /*
         * IMPORTANT:
         * Check whether a word game is active
         * BEFORE trying to process the answer.
         */
        if (
            typeof wordGames.isActive ===
            'function'
        ) {
            const active =
                wordGames.isActive(from);

            if (!active) {
                return false;
            }
        }

        /*
         * Current wordgames.js handler.
         */
        if (
            typeof wordGames.handleWordGameMessage ===
            'function'
        ) {
            const result =
                await wordGames.handleWordGameMessage(
                    sock,
                    m,
                    from,
                    text
                );

            return result === true;
        }

        /*
         * Compatibility fallback.
         */
        if (
            typeof wordGames.handleMessage ===
            'function'
        ) {
            const result =
                await wordGames.handleMessage(
                    sock,
                    m,
                    from,
                    text
                );

            return result === true;
        }

        console.error(
            '❌ [WORD GAME] No answer handler found'
        );

        return false;

    } catch (error) {
        console.error(
            '🔥 [WORD GAME ANSWER ERROR]:',
            error
        );

        return false;
    }
}


/*
 * ============================================================
 * ORIGINAL GAMES
 * ============================================================
 */

async function handleOriginalGames(
    sock,
    m,
    from,
    text
) {
    try {
        if (!gameManagerCore) {
            return false;
        }

        if (
            typeof gameManagerCore.handleGameMessage ===
            'function'
        ) {
            return !!(
                await gameManagerCore.handleGameMessage(
                    sock,
                    m,
                    from,
                    text
                )
            );
        }

        if (
            typeof gameManagerCore.handleMessage ===
            'function'
        ) {
            return !!(
                await gameManagerCore.handleMessage(
                    sock,
                    m,
                    from,
                    text
                )
            );
        }

        return false;

    } catch (error) {
        console.error(
            '🔥 [ORIGINAL GAME ERROR]:',
            error
        );

        return false;
    }
}


/*
 * ============================================================
 * MAIN ROUTER
 * ============================================================
 */

async function handleGameMessage(
    sock,
    m,
    from,
    body = ''
) {
    try {
        if (!from) {
            return false;
        }

        /*
         * Get the REAL WhatsApp message text.
         */
        const text =
            getText(
                m,
                body
            );

        if (!text) {
            return false;
        }

        /*
         * ====================================================
         * RIDDLE HAS PRIORITY
         * ====================================================
         */

        if (
            riddleGame &&
            typeof riddleGame.isActive ===
                'function' &&
            riddleGame.isActive(from)
        ) {
            /*
             * Let commands through.
             */
            if (isCommand(text)) {
                return false;
            }

            const handled =
                await handleRiddle(
                    sock,
                    m,
                    from,
                    text
                );

            /*
             * Whether correct or incorrect,
             * this message belongs to the
             * active riddle.
             */
            return handled || true;
        }


        /*
         * ====================================================
         * WORD STARTING / ENDING HAS PRIORITY
         * ====================================================
         */

        if (
            wordGames &&
            typeof wordGames.isActive ===
                'function' &&
            wordGames.isActive(from)
        ) {
            /*
             * Commands go to normal command handler.
             */
            if (isCommand(text)) {
                return false;
            }

            const handled =
                await handleWordGames(
                    sock,
                    m,
                    from,
                    text
                );

            /*
             * Consume the message because a
             * word game is active.
             */
            return handled || true;
        }


        /*
         * ====================================================
         * EXISTING QUEEN VIDA GAMES
         * ====================================================
         */

        return await handleOriginalGames(
            sock,
            m,
            from,
            text
        );

    } catch (error) {
        console.error(
            '🔥 [GAME MESSAGE ROUTER ERROR]:',
            error
        );

        return false;
    }
}


/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    ...gameManagerCore,

    handleGameMessage,

    handleRiddle,

    handleWordGames
};
