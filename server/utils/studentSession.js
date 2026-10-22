const jwt = require('jsonwebtoken');
const { getCookieOptions } = require('./cookies');
const { STUDENT_COOKIE, STUDENT_SESSION_MS, JWT_ALGORITHM } = require('../constants/auth');

// Signs a student JWT bound to the current tokenVersion and sets it as the session cookie.
// Bumping tokenVersion in the DB revokes every token issued before it.
const issueStudentSession = (res, student) => {
  const token = jwt.sign(
    { sub: student._id.toString(), role: 'student', tv: student.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: '7d', algorithm: JWT_ALGORITHM }
  );
  res.cookie(STUDENT_COOKIE, token, getCookieOptions(STUDENT_SESSION_MS));
};

module.exports = { issueStudentSession };
