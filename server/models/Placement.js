const mongoose = require('mongoose');

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
        values: ['Full-Time', 'Internship', '6M Intern + FTE'],
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
        values: ['Upcoming', 'Ongoing', 'Completed'],
        message: '{VALUE} is not a valid status',
      },
      default: 'Upcoming',
    },
    jdDescription: {
      type: String,
      maxlength: [50000, 'JD description cannot exceed 50000 characters'],
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Index for common queries
placementSchema.index({ status: 1 });
placementSchema.index({ company: 'text', role: 'text' });
placementSchema.index({ driveDate: -1 });

module.exports = mongoose.model('Placement', placementSchema);
