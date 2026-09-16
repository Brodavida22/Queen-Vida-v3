/**
 * QUEEN VIDA V3
 * Game Manager Bridge
 *
 * This file connects the new RIDDLE game to the
 * existing gameManager without modifying the
 * existing game logic.
 */

const originalGameManager = require('./gameManagerCore');
const riddleGame = require('../commands/riddle');

/**
 * Handle incoming game messages.
 *
 * Riddle gets checked first.
 * If there is no active riddle, the message is
 * passed to the original game manager.
 */
async function handleGameMessage(
    sock,
    m,
    from,
    text
) {
    try {
        /*
         * ====================================================
         * RIDDLE GAME
         * ====================================================
         */

        if (riddleGame.isActive(from)) {

            /*
             * Don't treat normal bot commands as riddle
             * answers.
             */
            const messageText =
                String(text || '').trim();

            if (
                messageText.startsWith('.') ||
                messageText.startsWith('!') ||
                messageText.startsWith('/') ||
                messageText.startsWith('#')
            ) {
                return false;
            }

            const handled =
                await riddleGame.handleMessage(
                    sock,
                    m,
                    from
                );

            if (handled) {
                return true;
            }

            /*
             * If a riddle is active, don't allow the same
             * message to accidentally become an answer in
             * another game.
             */
            return false;
        }

        /*
         * ====================================================
         * EXISTING QUEEN VIDA GAMES
         * ====================================================
         */

        return originalGameManager.handleGameMessage(
            sock,
            m,
            from,
            text
        );

    } catch (error) {
        console.error(
            '[GAME MANAGER] Error handling game message:',
            error
        );

        return false;
    }
}


/**
 * Export the original game manager functions,
 * while replacing only handleGameMessage with our
 * riddle-aware version.
 */
module.exports = {
    ...originalGameManager,

    handleGameMessage
};
