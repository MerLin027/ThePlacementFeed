const mongoose = require('mongoose');

// Site-wide values the admin can change, one document per key (e.g. 'university')
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
