const mongoose = require('mongoose');

// Codes are what students and drives store and match on, so a code never changes once created
// (only its display name does). Commas are excluded: the public drive list splits ?branch= on them.
const BRANCH_CODE_PATTERN = /^[A-Z0-9][A-Z0-9/&.-]{0,11}$/;

const branchSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Branch code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      immutable: true,
      match: [BRANCH_CODE_PATTERN, 'Branch code must be 1–12 letters, digits or / & . -'],
    },
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      trim: true,
      minlength: [2, 'Branch name must be at least 2 characters'],
      maxlength: [120, 'Branch name cannot exceed 120 characters'],
    },
    // Archived branches stay valid for existing students and drives but can't be chosen anew
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Branch', branchSchema);
module.exports.BRANCH_CODE_PATTERN = BRANCH_CODE_PATTERN;
