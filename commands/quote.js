const quotes = [
    "The best way to get started is to quit talking and begin doing. - Walt Disney",
    "The pessimist sees difficulty in every opportunity. The optimist sees opportunity in every difficulty. - Winston Churchill",
    "Don't let yesterday take up too much of today. - Will Rogers",
    "It's not whether you get knocked down, it's whether you get up. - Vince Lombardi",
    "Failure is simply the opportunity to begin again, this time more intelligently. - Henry Ford",
    "Focus on being productive instead of busy. - Tim Ferriss"
];

module.exports = {
    name: 'quote',
    description: 'Fetches a random inspirational quote',
    async execute(sock, m, from) {
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        await sock.sendMessage(from, { text: `💬 *Inspirational Quote:*\n\n"${randomQuote}"` }, { quoted: m });
    }
};
