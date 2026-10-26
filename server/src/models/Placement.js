const mongoose = require('mongoose');
const { optionalHttpsUrl } = require('../lib/urls');

// The single source for these lists: validators and routes import them from here
const DRIVE_TYPES = ['Full-Time', 'Internship', '6M Intern + FTE'];
const DRIVE_STATUSES = ['Upcoming', 'Ongoing', 'Completed'];
const APPLICATION_MODES = ['external', 'in_app', 'both'];
const CHANGE_TYPES = ['new', 'statusChange', 'postponed', 'unpostponed', 'edit', 'automationReset'];
// The change log feeds student notifications; only the latest entries are kept
const MAX_RECENT_CHANGES = 10;
const MAX_CUSTOM_PROMPTS = 5;

const placementSchema = new mongoose.Schema(
  {
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [200, 'Company name cannot exceed 200 characters'],
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true,
      maxlength: [200, 'Role cannot exceed 200 characters'],
    },
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: {
        values: DRIVE_TYPES,
        message: '{VALUE} is not a valid placement type',
      },
    },
    ctc: {
      type: Number,
      required: [true, 'CTC is required'],
      min: [0, 'CTC cannot be negative'],
    },
    eligibility: {
      branches: {
        type: [String],
        default: [],
      },
      cgpa: {
        type: Number,
        min: [0, 'CGPA cannot be negative'],
        max: [10, 'CGPA cannot exceed 10'],
      },
      backlog: {
        type: Number,
        min: [0, 'Backlog count cannot be negative'],
      },
    },
    driveDate: {
      type: Date,
    },
    deadline: {
      type: Date,
    },
    status: {
      type: String,
      enum: {
        values: DRIVE_STATUSES,
        message: '{VALUE} is not a valid status',
      },
      default: 'Upcoming',
    },
    isPostponed: {
      type: Boolean,
      default: false,
    },
    statusManuallySet: {
      type: Boolean,
      default: false,
    },
    jdDescription: {
      type: String,
      maxlength: [10000, 'JD description cannot exceed 10000 characters'],
    },
    selectionRounds: [{
      roundName: {
        type: String,
        required: [true, 'Round name is required'],
        trim: true,
        maxlength: [200, 'Round name cannot exceed 200 characters'],
      },
      roundDescription: {
        type: String,
        trim: true,
        maxlength: [1000, 'Round description cannot exceed 1000 characters'],
      },
    }],
    tags: {
      type: [String],
      default: [],
    },
    formUrl: {
      type: String,
      trim: true,
      maxlength: [500, 'Form URL cannot exceed 500 characters'],
      validate: { validator: optionalHttpsUrl, message: 'Form URL must be a valid HTTPS URL' },
    },
    // How students apply: the external formUrl, the in-app form, or both.
    // Defaults to 'external' so drives created before in-app applications behave as before.
    applicationMode: {
      type: String,
      enum: {
        values: APPLICATION_MODES,
        message: '{VALUE} is not a valid application mode',
      },
      default: 'external',
    },
    // Extra questions shown on the in-app application form
    customPrompts: {
      type: [{
        question: {
          type: String,
          required: [true, 'Question text is required'],
          trim: true,
          maxlength: [500, 'Question cannot exceed 500 characters'],
        },
        required: {
          type: Boolean,
          default: false,
        },
      }],
      validate: {
        validator: (v) => !v || v.length <= MAX_CUSTOM_PROMPTS,
        message: `A drive can have at most ${MAX_CUSTOM_PROMPTS} custom questions`,
      },
    },
    recentChanges: [{
      type: {
        type: String,
        enum: CHANGE_TYPES,
      },
      // Status after this change (lets notifications say "now Ongoing")
      status: {
        type: String,
        enum: DRIVE_STATUSES,
      },
      changedAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook for deadline <= driveDate
// (Mongoose 9 hooks take no `next` callback; a synchronous hook simply returns.)
placementSchema.pre('validate', function() {
  if (this.driveDate && this.deadline && this.deadline > this.driveDate) {
    this.invalidate('deadline', 'Deadline cannot be after the drive date');
  }
});

// Index for common queries
placementSchema.index({ 'recentChanges.changedAt': -1 });
placementSchema.index({ status: 1 });
placementSchema.index({ driveDate: -1 });

module.exports = mongoose.model('Placement', placementSchema);
Object.assign(module.exports, { DRIVE_TYPES, DRIVE_STATUSES, APPLICATION_MODES, CHANGE_TYPES, MAX_RECENT_CHANGES, MAX_CUSTOM_PROMPTS });
