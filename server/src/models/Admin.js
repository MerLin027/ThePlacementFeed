const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
    required: true,
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
