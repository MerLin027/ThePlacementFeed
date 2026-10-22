// Escape regex special characters so user search text is matched literally (prevents ReDoS/injection)
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
