const mongoose = require('mongoose');

// A constituent institute of the university (e.g. CSPIT). Students pick one once; the admin
// manages the list.
const instituteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Institute name is required'],
      trim: true,
      minlength: [2, 'Institute name must be at least 2 characters'],
      maxlength: [120, 'Institute name cannot exceed 120 characters'],
    },
    // Lower-cased copy so "CSPIT" and "cspit" can't both exist
    nameKey: { type: String, required: true, unique: true, select: false },
    // Archived institutes stay on the students who chose them but can't be chosen anew
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

instituteSchema.pre('validate', function () {
  if (this.name) this.nameKey = this.name.trim().toLowerCase();
});

module.exports = mongoose.model('Institute', instituteSchema);
