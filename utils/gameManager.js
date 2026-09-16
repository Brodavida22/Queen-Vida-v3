/**
 * QUEEN VIDA V3
 * Unified Game Manager
 *
 * Handles answers for:
 * - Riddle
 * - Words Starting
 * - Words Ending
 * - Existing Game Suite
 */

const originalGameManager =
    require('./gameManagerCore');

const riddleGame =
    require('../commands/riddle');

let wordGames = null;

try {
    wordGames =
        require('../commands/wordgames');
} catch (error) {
    console.warn(
        '[GAME MANAGER] wordgames.js not found. Starting/Ending answers disabled.'
    );
}


/*
 * ============================================================
 * CHECK WHETHER MESSAGE IS A COMMAND
 * ============================================================
 */

function isCommand(text) {
    const value =
        String(text || '').trim();

    return (
        value.startsWith('.') ||
        value.startsWith('!') ||
        value.startsWith('/') ||
        value.startsWith('#')
    );
}


/*
 * ============================================================
 * HANDLE RIDDLE
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

    if (
        !riddleGame.isActive(from)
    ) {
        return false;
    }

    /*
     * Commands must still be allowed while
     * a game is running.
     */
    if (isCommand(text)) {
        return false;
    }

    if (
        typeof riddleGame.handleMessage !==
        'function'
    ) {
        return false;
    }

    return !!(
        await riddleGame.handleMessage(
            sock,
            m,
            from
        )
    );
}


/*
 * ============================================================
 * HANDLE WORD GAMES
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
     * New wordgames handler.
     */
    if (
        typeof wordGames.handleWordGameMessage ===
        'function'
    ) {
        return !!(
            await wordGames.handleWordGameMessage(
                sock,
                m,
                from,
                text
            )
        );
    }

    /*
     * Alternative export name.
     */
    if (
        typeof wordGames.handleMessage ===
        'function'
    ) {
        return !!(
            await wordGames.handleMessage(
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
 * HANDLE ALL GAME ANSWERS
 * ============================================================
 */

async function handleGameMessage(
    sock,
    m,
    from,
    text
) {
    try {

        /*
         * ----------------------------------------------------
         * RIDDLE
         * ----------------------------------------------------
         */

        const riddleHandled =
            await handleRiddle(
                sock,
                m,
                from,
                text
            );

        if (riddleHandled) {
            return true;
        }


        /*
         * ----------------------------------------------------
         * WORDS STARTING / WORDS ENDING
         * ----------------------------------------------------
         */

        const wordGameHandled =
            await handleWordGames(
                sock,
                m,
                from,
                text
            );

        if (wordGameHandled) {
            return true;
        }


        /*
         * ----------------------------------------------------
         * ORIGINAL GAME SUITE
         * ----------------------------------------------------
         */

        if (
            originalGameManager &&
            typeof originalGameManager.handleGameMessage ===
            'function'
        ) {
            return !!(
                await originalGameManager.handleGameMessage(
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
            '🔥 [GAME MANAGER ERROR]:',
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
    ...originalGameManager,

    handleGameMessage
};
