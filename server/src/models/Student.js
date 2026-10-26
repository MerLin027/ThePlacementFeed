const mongoose = require('mongoose');
const { optionalHttpsUrl } = require('../lib/urls');
// Defence in depth: a stored branch must be a known code even if a route forgot to check
const catalog = require('../features/catalog/cache');

// Fields a student must fill in before applying to an in-app drive
const REQUIRED_PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'instituteId',
  'branch',
  'cgpa',
  'graduationYear',
  'phone',
  'resumeUrl',
];

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
    // Legacy: held the university ('CHARUSAT') before institutes existed. Kept, still written at
    // signup, until the site-upgrade release is settled so the previous code can be rolled back to.
    institute: { type: String, default: 'CHARUSAT' },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    // --- Academic / eligibility profile ---
    firstName: { type: String, trim: true, maxlength: 100 },
    lastName: { type: String, trim: true, maxlength: 100 },
    // Chosen once by the student; only the admin can clear it (lock enforced in features/students)
    instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institute' },
    instituteSetAt: { type: Date },
    branch: {
      type: String,
      validate: {
        validator: (v) => !v || catalog.isBranchCode(v),
        message: '{VALUE} is not a valid branch',
      },
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
      validate: { validator: optionalHttpsUrl, message: 'Resume URL must be a valid HTTPS URL' },
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

studentSchema.index({ rollNumber: 1 }, { unique: true });
studentSchema.index({ instituteId: 1 });
studentSchema.index({ branch: 1, graduationYear: 1 });
studentSchema.index({ createdAt: -1 });

// Required profile fields that are still empty (works on documents and lean objects)
const missingProfileFields = (student) =>
  REQUIRED_PROFILE_FIELDS.filter((field) => {
    const value = student[field];
    return value === undefined || value === null || value === '';
  });

studentSchema.methods.getMissingFields = function () {
  return missingProfileFields(this);
};

module.exports = mongoose.model('Student', studentSchema);
Object.assign(module.exports, { REQUIRED_PROFILE_FIELDS, missingProfileFields });
