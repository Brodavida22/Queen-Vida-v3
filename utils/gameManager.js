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
 * GET MESSAGE TEXT
 * ============================================================
 */

function getText(m, body = '') {
    return String(
        body ||
        m?.message?.conversation ||
        m?.message?.extendedTextMessage?.text ||
        m?.message?.imageMessage?.caption ||
        m?.message?.videoMessage?.caption ||
        m?.message?.documentMessage?.caption ||
        ''
    ).trim();
}


/*
 * ============================================================
 * CHECK COMMAND
 * ============================================================
 */

function isCommand(text) {
    return /^[.!/#]/.test(
        String(text || '').trim()
    );
}


/*
 * ============================================================
 * RIDDLE
 * ============================================================
 */

async function handleRiddle(
    sock,
    m,
    from,
    text
) {
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
     * Let normal bot commands pass through.
     */
    if (isCommand(text)) {
        return false;
    }

    if (
        typeof riddleGame.handleMessage !==
        'function'
    ) {
        console.error(
            '[GAME MANAGER] riddleGame.handleMessage is missing'
        );

        return false;
    }

    const handled =
        await riddleGame.handleMessage(
            sock,
            m,
            from,
            text
        );

    return handled === true;
}


/*
 * ============================================================
 * STARTING / ENDING
 * ============================================================
 */

async function handleWordGames(
    sock,
    m,
    from,
    text
) {
    if (!wordGames) {
        return false;
    }

    /*
     * Never treat commands as game answers.
     */
    if (isCommand(text)) {
        return false;
    }

    /*
     * Make sure a word game is actually active.
     */
    if (
        typeof wordGames.isActive ===
        'function'
    ) {
        if (
            !wordGames.isActive(from)
        ) {
            return false;
        }
    }

    /*
     * Main handler.
     */
    if (
        typeof wordGames.handleWordGameMessage ===
        'function'
    ) {
        const handled =
            await wordGames.handleWordGameMessage(
                sock,
                m,
                from,
                text
            );

        return handled === true;
    }

    /*
     * Fallback for older wordgames.js.
     */
    if (
        typeof wordGames.handleMessage ===
        'function'
    ) {
        const handled =
            await wordGames.handleMessage(
                sock,
                m,
                from,
                text
            );

        return handled === true;
    }

    console.error(
        '[GAME MANAGER] No word game answer handler found'
    );

    return false;
}


/*
 * ============================================================
 * ORIGINAL GAME MANAGER
 * ============================================================
 */

async function handleOriginalGames(
    sock,
    m,
    from,
    text
) {
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
}


/*
 * ============================================================
 * MAIN GAME MESSAGE ROUTER
 * ============================================================
 */

async function handleGameMessage(
    sock,
    m,
    from,
    body = ''
) {
    try {
        const text =
            getText(
                m,
                body
            );

        if (!text) {
            return false;
        }


        /*
         * ----------------------------------------------------
         * 1. RIDDLE
         * ----------------------------------------------------
         */

        if (
            riddleGame &&
            typeof riddleGame.isActive ===
                'function' &&
            riddleGame.isActive(from)
        ) {
            /*
             * Commands must continue to the
             * normal command processor.
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
             * If the riddle handler processed
             * the answer, stop here.
             */
            if (handled) {
                return true;
            }

            /*
             * Do NOT send the same message into
             * another game while a riddle is active.
             */
            return true;
        }


        /*
         * ----------------------------------------------------
         * 2. WORD STARTING / WORD ENDING
         * ----------------------------------------------------
         */

        if (
            wordGames &&
            typeof wordGames.isActive ===
                'function' &&
            wordGames.isActive(from)
        ) {
            /*
             * Commands must continue to the
             * normal command processor.
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
             * Correct answer was processed.
             */
            if (handled) {
                return true;
            }

            /*
             * The game is active, so this message
             * belongs to the current game even if
             * the answer is wrong.
             */
            return true;
        }


        /*
         * ----------------------------------------------------
         * 3. ORIGINAL GAMES
         * ----------------------------------------------------
         */

        return await handleOriginalGames(
            sock,
            m,
            from,
            text
        );

    } catch (error) {
        console.error(
            '🔥 [GAME MESSAGE ROUTER ERROR]',
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
