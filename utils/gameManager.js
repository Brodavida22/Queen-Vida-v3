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

const gameManagerCore = require('./gameManagerCore');

const riddleGame = require('../commands/riddle');
const wordGames = require('../commands/wordgames');


/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function getText(m) {
    return (
        m?.message?.conversation ||
        m?.message?.extendedTextMessage?.text ||
        m?.message?.imageMessage?.caption ||
        m?.message?.videoMessage?.caption ||
        m?.message?.documentMessage?.caption ||
        ''
    ).trim();
}


function isCommand(text) {
    const value = String(text || '').trim();

    return (
        value.startsWith('.') ||
        value.startsWith('!') ||
        value.startsWith('/') ||
        value.startsWith('#')
    );
}


/*
 * ============================================================
 * RIDDLE ANSWERS
 * ============================================================
 */

async function handleRiddle(
    sock,
    m,
    from,
    text
) {
    if (
        !riddleGame ||
        typeof riddleGame.isActive !== 'function'
    ) {
        return false;
    }

    if (!riddleGame.isActive(from)) {
        return false;
    }

    /*
     * Don't consume normal bot commands as answers.
     */
    if (isCommand(text)) {
        return false;
    }

    if (
        typeof riddleGame.handleMessage !== 'function'
    ) {
        return false;
    }

    await riddleGame.handleMessage(
        sock,
        m,
        from,
        text
    );

    return true;
}


/*
 * ============================================================
 * STARTING / ENDING ANSWERS
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
     * Never consume commands while a game is active.
     */
    if (isCommand(text)) {
        return false;
    }

    /*
     * Preferred handler.
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
     * Fallback handler if wordgames.js
     * exports handleMessage instead.
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

    return false;
}


/*
 * ============================================================
 * EXISTING GAME MANAGER
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

    /*
     * Most versions use handleGameMessage.
     */
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


    /*
     * Some versions use handleMessage.
     */
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
    body
) {
    try {

        /*
         * Always get the actual message text.
         */
        const text =
            String(
                body || getText(m) || ''
            ).trim();

        if (!text) {
            return false;
        }


        /*
         * ----------------------------------------------------
         * 1. RIDDLE
         * ----------------------------------------------------
         *
         * If this group has an active riddle,
         * the member's message is treated as the answer.
         */

        if (
            riddleGame &&
            typeof riddleGame.isActive === 'function' &&
            riddleGame.isActive(from)
        ) {

            /*
             * Commands are allowed to pass through
             * to the normal command handler.
             */
            if (!isCommand(text)) {

                const handled =
                    await handleRiddle(
                        sock,
                        m,
                        from,
                        text
                    );

                if (handled) {
                    return true;
                }
            }
        }


        /*
         * ----------------------------------------------------
         * 2. WORD STARTING / WORD ENDING
         * ----------------------------------------------------
         */

        if (!isCommand(text)) {

            const handled =
                await handleWordGames(
                    sock,
                    m,
                    from,
                    text
                );

            if (handled) {
                return true;
            }
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
 * EXPORT EVERYTHING FROM ORIGINAL GAME MANAGER
 * PLUS OUR NEW ROUTER
 * ============================================================
 */

module.exports = {
    ...gameManagerCore,

    handleGameMessage,

    handleRiddle,
    handleWordGames
};
