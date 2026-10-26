// Escape regex special characters so user search text is matched literally (prevents ReDoS/injection)
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Case-insensitive "contains" matcher for a search box
const containsRegex = (text) => new RegExp(escapeRegex(text), 'i');

module.exports = { escapeRegex, containsRegex };
