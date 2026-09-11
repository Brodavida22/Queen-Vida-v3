module.exports = {
    name: 'calc',
    description: 'Evaluates a mathematical expression',
    async execute(sock, m, from, args) {
        const expression = args.join(' ');
        if (!expression) {
            return sock.sendMessage(from, { text: '❌ Please provide an equation to calculate! Usage: *!calc 50 * 25*' }, { quoted: m });
        }

        try {
            // Strict safe evaluation for math symbols only
            const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
            if (!sanitized) throw new Error('Invalid characters');
            
            // eslint-disable-next-line no-eval
            const result = eval(sanitized);
            await sock.sendMessage(from, { text: `🧮 *Calculation Result:*\n\n\`${expression} = ${result}\`` }, { quoted: m });
        } catch (err) {
            await sock.sendMessage(from, { text: '❌ Invalid mathematical expression!' }, { quoted: m });
        }
    }
};
