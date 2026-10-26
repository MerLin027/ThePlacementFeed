const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  // Never loaded unless a query asks for it (.select('+passwordHash'))
  passwordHash: {
    type: String,
    required: true,
    select: false,
  },
  // Bumped on a password change; sessions signed with an older value stop working
  tokenVersion: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  toJSON: {
    transform: function (doc, ret) {
      delete ret.passwordHash;
      delete ret.__v;
      return ret;
    }
  }
});

module.exports = mongoose.model('Admin', adminSchema);
