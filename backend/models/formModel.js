// backend/models/formModel.js
const mongoose = require('mongoose');

// This new schema defines the structure for a conditional rule
const conditionalLogicSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  dependentFieldId: { type: String, default: null },
  operator: { type: String, default: 'is' }, // e.g., 'is', 'isNot'
  value: { type: String, default: null },
}, { _id: false });

const questionSchema = new mongoose.Schema({
  fieldId: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, required: true },
  options: [{ id: String, name: String }],
  conditionalLogic: conditionalLogicSchema,
  isRequired: { type: Boolean, default: false }, 
}, { _id: false });

const formSchema = new mongoose.Schema({
  formName: { type: String, required: true },
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  airtableBaseId: { type: String, required: true },
  airtableTableId: { type: String, required: true },
  questions: [questionSchema],
}, {
  timestamps: true,
});

const Form = mongoose.model('Form', formSchema);

module.exports = Form;