const fs = require('fs');
const path = require('path');

const modeFile = path.join(__dirname, '..', 'bot_mode.json');

function getMode() {
    try {
        if (fs.existsSync(modeFile)) {
            const data = JSON.parse(fs.readFileSync(modeFile, 'utf8'));
            return data.mode || 'public'; // default to public
        }
    } catch (e) {
        console.error('Error reading mode file:', e);
    }
    return 'public';
}

function setMode(mode) {
    try {
        fs.writeFileSync(modeFile, JSON.stringify({ mode }), 'utf8');
        return true;
    } catch (e) {
        console.error('Error writing mode file:', e);
        return false;
    }
}

module.exports = { getMode, setMode };
