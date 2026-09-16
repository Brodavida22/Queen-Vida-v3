/**
 * ============================================================
 * QUEEN VIDA V3
 * UNIFIED GAME ANSWER MANAGER
 * ============================================================
 *
 * Handles:
 * - Riddle
 * - Words Starting
 * - Words Ending
 * - Existing Queen Vida games
 *
 * Game answers are processed before normal command handling.
 */

const gameManagerCore = require('./gameManagerCore');

const riddleGame = require('../commands/riddle');

let wordGames = null;

try {
    wordGames = require('../commands/wordgames');
} catch (error) {
    console.error(
        '⚠️ [GAME MANAGER] wordgames.js could not be loaded:',
        error.message
    );
}


/*
 * ============================================================
 * HELPERS
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
    try {
        if (
            !riddleGame ||
            typeof riddleGame.isActive !== 'function'
        ) {
            return false;
        }

        if (
            !from ||
            typeof from !== 'string'
        ) {
            return false;
        }

        if (!riddleGame.isActive(from)) {
            return false;
        }

        /*
         * Do not consume commands as answers.
         */
        if (isCommand(text)) {
            return false;
        }

        if (
            typeof riddleGame.handleMessage !==
            'function'
        ) {
            console.error(
                '❌ [RIDDLE] handleMessage() is missing.'
            );

            return false;
        }

        const handled =
            await riddleGame.handleMessage(
                sock,
                m,
                from
            );

        return handled === true;

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
 * WORD STARTING / WORD ENDING
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

        if (
            !from ||
            typeof from !== 'string'
        ) {
            return false;
        }

        /*
         * Commands must continue to the command system.
         */
        if (isCommand(text)) {
            return false;
        }

        /*
         * Current wordgames.js exports:
         *
         * module.exports = [
         *     startingCommand,
         *     endingCommand
         * ];
         *
         * and attaches:
         *
         * module.exports.handleWordGameMessage = ...
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
         * Compatibility fallback.
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
            '❌ [WORDGAME] No answer handler found.'
        );

        return false;

    } catch (error) {
        console.error(
            '🔥 [WORDGAME ANSWER ERROR]:',
            error
        );

        return false;
    }
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
    try {
        if (!gameManagerCore) {
            return false;
        }

        if (
            typeof gameManagerCore.handleGameMessage ===
            'function'
        ) {
            const handled =
                await gameManagerCore.handleGameMessage(
                    sock,
                    m,
                    from,
                    text
                );

            return handled === true;
        }

        if (
            typeof gameManagerCore.handleMessage ===
            'function'
        ) {
            const handled =
                await gameManagerCore.handleMessage(
                    sock,
                    m,
                    from,
                    text
                );

            return handled === true;
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
 * MAIN GAME ROUTER
 * ============================================================
 */

async function handleGameMessage(
    sock,
    m,
    from,
    body = ''
) {
    try {
        if (
            !from ||
            typeof from !== 'string'
        ) {
            return false;
        }

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
         * 1. RIDDLE
         * ====================================================
         */

        if (
            riddleGame &&
            typeof riddleGame.isActive ===
                'function' &&
            riddleGame.isActive(from)
        ) {
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
         * ====================================================
         * 2. WORD STARTING / ENDING
         * ====================================================
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
         * ====================================================
         * 3. EXISTING GAMES
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
