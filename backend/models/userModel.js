// backend/models/userModel.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  airtableUserId: {
    type: String,
    required: true,
    unique: true, // Each Airtable user can only have one account
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  accessToken: {
    type: String,
    required: true,
  },
  refreshToken: {
    type: String,
    required: true,
  },
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt fields
});

const User = mongoose.model('User', userSchema);

module.exports = User;