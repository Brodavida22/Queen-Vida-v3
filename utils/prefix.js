const fs = require('fs');
const path = require('path');

const PREFIX_FILE = path.join(__dirname, '..', 'prefix.json');

const VALID_PREFIXES = ['.', '!', '#', '/'];

function getPrefix() {
    try {
        if (fs.existsSync(PREFIX_FILE)) {
            const data = JSON.parse(fs.readFileSync(PREFIX_FILE, 'utf8'));

            if (VALID_PREFIXES.includes(data.prefix)) {
                return data.prefix;
            }
        }
    } catch (error) {
        console.error('❌ Prefix file error:', error.message);
    }

    // Default prefix
    return '!';
}

function setPrefix(prefix) {
    if (!VALID_PREFIXES.includes(prefix)) {
        return false;
    }

    try {
        fs.writeFileSync(
            PREFIX_FILE,
            JSON.stringify(
                {
                    prefix: prefix
                },
                null,
                2
            )
        );

        return true;
    } catch (error) {
        console.error('❌ Failed to save prefix:', error.message);
        return false;
    }
}

function isValidPrefix(prefix) {
    return VALID_PREFIXES.includes(prefix);
}

function getValidPrefixes() {
    return [...VALID_PREFIXES];
}

module.exports = {
    getPrefix,
    setPrefix,
    isValidPrefix,
    getValidPrefixes
};
