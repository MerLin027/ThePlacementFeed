const mongoose = require('mongoose');
const { BRANCHES } = require('../constants/branches');
const { INSTITUTES } = require('../constants/auth');

// Fields a student must fill in before applying to an in-app drive
const REQUIRED_PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'branch',
  'cgpa',
  'graduationYear',
  'phone',
  'resumeUrl',
];

const isHttpsUrl = (v) => {
  if (!v) return true; // optional field
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

const studentSchema = new mongoose.Schema(
  {
    // --- Identity (immutable after signup) ---
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, 'Email cannot exceed 254 characters'],
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Roll number cannot exceed 20 characters'],
    },
    institute: {
      type: String,
      required: [true, 'Institute is required'],
      enum: { values: INSTITUTES, message: '{VALUE} is not a supported institute' },
      default: 'CHARUSAT',
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    // --- Academic / eligibility profile ---
    firstName: { type: String, trim: true, maxlength: 100 },
    lastName: { type: String, trim: true, maxlength: 100 },
    branch: {
      type: String,
      enum: { values: BRANCHES, message: '{VALUE} is not a valid branch' },
    },
    cgpa: { type: Number, min: 0, max: 10 },
    activeBacklogs: { type: Number, min: 0, default: 0 },
    graduationYear: { type: Number, min: 2020, max: 2040 },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[0-9]{10,15}$/, 'Phone number must be 10–15 digits'],
    },
    resumeUrl: {
      type: String,
      trim: true,
      maxlength: [500, 'Resume URL cannot exceed 500 characters'],
      validate: { validator: isHttpsUrl, message: 'Resume URL must be a valid HTTPS URL' },
    },

    // --- Auth lifecycle (server-managed only) ---
    mustChangePassword: { type: Boolean, default: false },
    tempPasswordExpiresAt: { type: Date },
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.passwordHash;
        delete ret.tokenVersion;
        delete ret.__v;
        return ret;
      },
    },
  }
);

studentSchema.index({ institute: 1, rollNumber: 1 }, { unique: true });
studentSchema.index({ createdAt: -1 });

studentSchema.methods.getMissingFields = function () {
  return REQUIRED_PROFILE_FIELDS.filter((field) => {
    const value = this[field];
    return value === undefined || value === null || value === '';
  });
};

// Profile shape returned to the student themself — never includes auth internals
studentSchema.methods.toProfileDTO = function () {
  return {
    id: this._id.toString(),
    email: this.email,
    rollNumber: this.rollNumber,
    institute: this.institute,
    firstName: this.firstName ?? '',
    lastName: this.lastName ?? '',
    branch: this.branch ?? '',
    cgpa: this.cgpa ?? null,
    activeBacklogs: this.activeBacklogs ?? 0,
    graduationYear: this.graduationYear ?? null,
    phone: this.phone ?? '',
    resumeUrl: this.resumeUrl ?? '',
    missingFields: this.getMissingFields(),
    mustChangePassword: this.mustChangePassword,
  };
};

module.exports = mongoose.model('Student', studentSchema);
module.exports.REQUIRED_PROFILE_FIELDS = REQUIRED_PROFILE_FIELDS;
