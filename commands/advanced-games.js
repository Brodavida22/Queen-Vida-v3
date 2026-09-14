const { startGame } = require('../utils/gameManager');

module.exports = [
    {
        name: 'guess',
        aliases: ['guessnumber', 'numberguess'],
        description: 'Start an interactive number guessing game',

        async execute(sock, m, from, args) {
            if (!from.endsWith('@g.us')) {
                return sock.sendMessage(
                    from,
                    {
                        text: '❌ This game can only be played inside a group.'
                    },
                    { quoted: m }
                );
            }

            return startGame(
                sock,
                from,
                'guess',
                5
            );
        }
    },

    {
        name: 'guessnumber',
        aliases: ['numberguess'],
        description: 'Start an interactive number guessing game',

        async execute(sock, m, from, args) {
            if (!from.endsWith('@g.us')) {
                return sock.sendMessage(
                    from,
                    {
                        text: '❌ This game can only be played inside a group.'
                    },
                    { quoted: m }
                );
            }

            return startGame(
                sock,
                from,
                'guess',
                5
            );
        }
    },

    {
        name: 'guesssong',
        aliases: ['songguess', 'song'],
        description: 'Guess the song from clues',

        async execute(sock, m, from, args) {
            if (!from.endsWith('@g.us')) {
                return sock.sendMessage(
                    from,
                    {
                        text: '❌ This game can only be played inside a group.'
                    },
                    { quoted: m }
                );
            }

            return startGame(
                sock,
                from,
                'guesssong',
                5
            );
        }
    },

    {
        name: 'emojigame',
        aliases: ['emoji', 'emojiguess'],
        description: 'Guess movies from emojis',

        async execute(sock, m, from, args) {
            if (!from.endsWith('@g.us')) {
                return sock.sendMessage(
                    from,
                    {
                        text: '❌ This game can only be played inside a group.'
                    },
                    { quoted: m }
                );
            }

            return startGame(
                sock,
                from,
                'emojigame',
                5
            );
        }
    },

    {
        name: 'riddle',
        aliases: ['riddles', 'brain'],
        description: 'Start an interactive riddle game',

        async execute(sock, m, from, args) {
            if (!from.endsWith('@g.us')) {
                return sock.sendMessage(
                    from,
                    {
                        text: '❌ This game can only be played inside a group.'
                    },
                    { quoted: m }
                );
            }

            return startGame(
                sock,
                from,
                'riddle',
                5
            );
        }
    },

    {
        name: 'quiz',
        aliases: ['quizgame'],
        description: 'Start an interactive general knowledge quiz',

        async execute(sock, m, from, args) {
            if (!from.endsWith('@g.us')) {
                return sock.sendMessage(
                    from,
                    {
                        text: '❌ This game can only be played inside a group.'
                    },
                    { quoted: m }
                );
            }

            return startGame(
                sock,
                from,
                'quiz',
                5
            );
        }
    },

    {
        name: 'trivia',
        aliases: ['triviagame'],
        description: 'Start an interactive trivia game',

        async execute(sock, m, from, args) {
            if (!from.endsWith('@g.us')) {
                return sock.sendMessage(
                    from,
                    {
                        text: '❌ This game can only be played inside a group.'
                    },
                    { quoted: m }
                );
            }

            return startGame(
                sock,
                from,
                'trivia',
                5
            );
        }
    },

    {
        name: 'typing',
        aliases: ['typingrace', 'typerace'],
        description: 'Start an interactive typing race',

        async execute(sock, m, from, args) {
            if (!from.endsWith('@g.us')) {
                return sock.sendMessage(
                    from,
                    {
                        text: '❌ This game can only be played inside a group.'
                    },
                    { quoted: m }
                );
            }

            return startGame(
                sock,
                from,
                'typing',
                5
            );
        }
    }
];
