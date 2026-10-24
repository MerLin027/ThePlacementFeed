const mongoose = require('mongoose');

const APPLICATION_STATUSES = ['Applied', 'Shortlisted', 'Interviewing', 'Offered', 'Rejected'];

const isHttpsUrl = (v) => {
  if (!v) return true; // optional field
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

const applicationSchema = new mongoose.Schema(
  {
    driveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Placement',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },

    // Copy of the student's profile at submission time — later profile edits
    // don't rewrite what the student declared when they applied
    snapshot: {
      firstName: String,
      lastName: String,
      email: String,
      rollNumber: String,
      university: String,
      // Constituent institute name (before the site upgrade this held the university)
      institute: String,
      branch: String,
      cgpa: Number,
      activeBacklogs: Number,
      graduationYear: Number,
      phone: String,
    },

    // --- Drive-specific inputs ---
    resumeUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      validate: { validator: isHttpsUrl, message: 'Resume link must be a valid HTTPS URL' },
    },
    coverNote: { type: String, trim: true, maxlength: 2000 },
    // Question text is copied so edits to the drive's prompts don't change past answers
    customAnswers: [{
      question: { type: String, maxlength: 500 },
      answer: { type: String, trim: true, maxlength: 2000 },
    }],
    consentGiven: {
      type: Boolean,
      required: true,
      validate: { validator: (v) => v === true, message: 'Consent is required' },
    },

    // --- Admin-managed pipeline ---
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: 'Applied',
    },
    adminNote: { type: String, trim: true, maxlength: 1000 },

    // Set when the admin deleted the account but kept its applications (personal details scrubbed)
    studentDeleted: { type: Boolean, default: false },
    studentDeletedAt: { type: Date },
  },
  { timestamps: true }
);

// One application per student per drive
applicationSchema.index({ driveId: 1, studentId: 1 }, { unique: true });
applicationSchema.index({ driveId: 1, status: 1, createdAt: -1 });
applicationSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model('Application', applicationSchema);
module.exports.APPLICATION_STATUSES = APPLICATION_STATUSES;
