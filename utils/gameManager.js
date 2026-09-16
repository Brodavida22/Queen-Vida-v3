/**
 * QUEEN VIDA V3
 * Game Manager Bridge
 *
 * Handles:
 * - Riddle
 * - Words Starting
 * - Words Ending
 * - Existing Queen Vida games
 */

const originalGameManager =
    require('./gameManagerCore');

const riddleGame =
    require('../commands/riddle');

const wordGames =
    require('../commands/wordgames');


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

            return false;
        }


        /*
         * ====================================================
         * WORD GAMES
         * ====================================================
         */

        if (
            wordGames.isWordGameActive(from)
        ) {

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
                await wordGames.handleWordGameMessage(
                    sock,
                    m,
                    from,
                    text
                );

            if (handled) {
                return true;
            }

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


module.exports = {
    ...originalGameManager,

    handleGameMessage
};
