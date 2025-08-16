// frontend/src/App.jsx
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import "./App.css"; // Make sure to import the CSS file

// ✅ NEW: React Router + pages
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- Helper Components & Icons ---
const EditIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
  </svg>
);
const Spinner = () => <div className="spinner"></div>;

// ====================================================================
//  ConditionalLogicModal Component
// ====================================================================
const ConditionalLogicModal = ({ question, allQuestions, onSave, onClose }) => {
  const initialLogic = question.conditionalLogic || {
    enabled: false,
    dependentFieldId: "",
    operator: "is",
    value: "",
  };
  const [logic, setLogic] = useState(initialLogic);

  const potentialDependentFields = useMemo(() => {
    const currentIndex = allQuestions.findIndex(
      (q) => q.fieldId === question.fieldId
    );
    return allQuestions
      .slice(0, currentIndex)
      .filter((q) => q.type === "singleSelect");
  }, [question, allQuestions]);

  const dependentFieldOptions = useMemo(() => {
    const field = allQuestions.find(
      (q) => q.fieldId === logic.dependentFieldId
    );
    return field ? field.options : [];
  }, [logic.dependentFieldId, allQuestions]);

  const handleSave = () => {
    onSave(question.fieldId, {
      ...logic,
      enabled: logic.dependentFieldId !== "",
    });
    onClose();
  };

  const handleRemoveLogic = () => {
    onSave(question.fieldId, {
      enabled: false,
      dependentFieldId: "",
      operator: "is",
      value: "",
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Conditional Logic for "{question.label}"</h3>
        <p className="modal-subtitle">Show this question only when...</p>
        <div className="modal-body">
          <div>
            <label>If question...</label>
            <select
              value={logic.dependentFieldId}
              onChange={(e) =>
                setLogic({
                  ...logic,
                  dependentFieldId: e.target.value,
                  value: "",
                })
              }
            >
              <option value="">-- Select a question --</option>
              {potentialDependentFields.map((q) => (
                <option key={q.fieldId} value={q.fieldId}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>

          {logic.dependentFieldId && (
            <>
              <div>
                <label>...is...</label>
                <select
                  value={logic.operator}
                  onChange={(e) =>
                    setLogic({ ...logic, operator: e.target.value })
                  }
                >
                  <option value="is">Is</option>
                  <option value="isNot">Is Not</option>
                </select>
              </div>

              <div>
                <label>...the value...</label>
                <select
                  value={logic.value}
                  onChange={(e) =>
                    setLogic({ ...logic, value: e.target.value })
                  }
                >
                  <option value="">-- Select a value --</option>
                  {dependentFieldOptions.map((opt) => (
                    <option key={opt.id} value={opt.name}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={handleRemoveLogic} className="btn btn-danger">
            Remove Logic
          </button>
          <div>
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleSave} className="btn btn-primary">
              Save Logic
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ====================================================================
//  FormBuilder Component
// ====================================================================
const FormBuilder = ({ user, onFormSaved }) => {
  const SUPPORTED_FIELD_TYPES = [
    "singleLineText",
    "multilineText",
    "singleSelect",
    "multipleSelects",
    "multipleAttachments",
  ];

  const [bases, setBases] = useState([]);
  const [loadingBases, setLoadingBases] = useState(false);
  const [selectedBase, setSelectedBase] = useState("");
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState("");
  const [fields, setFields] = useState([]);
  const [formName, setFormName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [editingLogicFor, setEditingLogicFor] = useState(null);
  const [editingLabelFor, setEditingLabelFor] = useState(null);

  const fetchBases = async () => {
    setLoadingBases(true);
    try {
      const r = await axios.get(
        `${API_BASE_URL}/api/airtable/bases/${user._id}`
      );
      if (r.data && r.data.length > 0) {
        setBases(r.data);
      } else {
        alert("No bases found.");
        setBases([]);
      }
    } catch (e) {
      alert("Could not fetch bases.");
    }
    setLoadingBases(false);
  };

  const fetchTables = async (baseId) => {
    if (!baseId) return;
    setLoadingTables(true);
    setTables([]);
    setFields([]);
    setSelectedTable("");
    setQuestions([]);
    try {
      const r = await axios.get(
        `${API_BASE_URL}/api/airtable/tables/${user._id}/${baseId}`
      );
      setTables(r.data);
    } catch (e) {
      alert("Could not fetch tables.");
    }
    setLoadingTables(false);
  };

  const handleBaseSelect = (e) => {
    const id = e.target.value;
    setSelectedBase(id);
    fetchTables(id);
  };

  const handleTableSelect = (e) => {
    const id = e.target.value;
    setSelectedTable(id);
    if (id) {
      const t = tables.find((t) => t.id === id);
      const sf = t.fields.filter((f) => SUPPORTED_FIELD_TYPES.includes(f.type));
      setFields(sf);
    } else {
      setFields([]);
    }
    setQuestions([]);
  };

  const handleFieldToggle = (field) => {
    setQuestions((prev) => {
      const isSelected = prev.some((q) => q.fieldId === field.id);
      if (isSelected) {
        return prev.filter((q) => q.fieldId !== field.id);
      } else {
        const newQuestion = {
          fieldId: field.id,
          label: field.name,
          type: field.type,
          options: field.type.includes("Select") ? field.options.choices : [],
          conditionalLogic: { enabled: false },
          isRequired: false,
        };
        return [...prev, newQuestion];
      }
    });
  };

  const updateQuestionLabel = (fieldId, newLabel) => {
    setQuestions((prev) =>
      prev.map((q) => (q.fieldId === fieldId ? { ...q, label: newLabel } : q))
    );
  };

  const updateQuestionLogic = (fieldId, logic) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.fieldId === fieldId ? { ...q, conditionalLogic: logic } : q
      )
    );
  };

  const toggleQuestionRequired = (fieldId) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.fieldId === fieldId ? { ...q, isRequired: !q.isRequired } : q
      )
    );
  };

  const handleSaveForm = async () => {
    if (!formName.trim() || questions.length === 0) {
      alert("Please provide a form name and select at least one field.");
      return;
    }
    setIsSaving(true);
    const formData = {
      formName,
      creatorId: user._id,
      airtableBaseId: selectedBase,
      airtableTableId: selectedTable,
      questions,
    };
    try {
      await axios.post(`${API_BASE_URL}/api/forms`, formData);
      alert("Form saved!");
      onFormSaved();
    } catch (error) {
      alert("Failed to save form.");
    }
    setIsSaving(false);
  };

  return (
    <div className="container">
      <h2 className="page-title">Create a New Form</h2>
      <p className="page-subtitle">
        Follow the steps to build and configure your form.
      </p>

      <div className="builder-steps">
        <div className="card">
          <h3>Step 1: Select a Base</h3>
          {!bases.length ? (
            <button
              onClick={fetchBases}
              disabled={loadingBases}
              className="btn btn-primary"
            >
              {loadingBases ? "Loading..." : "Fetch My Airtable Bases"}
            </button>
          ) : (
            <select value={selectedBase} onChange={handleBaseSelect}>
              <option value="">-- Choose a base --</option>
              {bases.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedBase && (
          <div className="card">
            <h3>Step 2: Select a Table</h3>
            {loadingTables ? (
              <p>Loading tables...</p>
            ) : (
              <select value={selectedTable} onChange={handleTableSelect}>
                <option value="">-- Choose a table --</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {selectedTable && (
          <div className="card">
            <h3>Step 3: Build Your Form</h3>
            <div className="builder-columns">
              <div>
                <h4>Available Fields</h4>
                <div className="field-list">
                  {fields.map((field) => (
                    <div key={field.id} className="field-list-item">
                      <input
                        type="checkbox"
                        id={field.id}
                        checked={questions.some((q) => q.fieldId === field.id)}
                        onChange={() => handleFieldToggle(field)}
                      />
                      <label htmlFor={field.id}>
                        {field.name}{" "}
                        <span className="field-type">({field.type})</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4>Form Preview & Logic</h4>
                <div className="preview-list">
                  {questions.length > 0 ? (
                    questions.map((q) => (
                      <div key={q.fieldId} className="preview-card">
                        <div className="preview-card-header">
                          {editingLabelFor === q.fieldId ? (
                            <input
                              type="text"
                              value={q.label}
                              onChange={(e) =>
                                updateQuestionLabel(q.fieldId, e.target.value)
                              }
                              onBlur={() => setEditingLabelFor(null)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && setEditingLabelFor(null)
                              }
                              autoFocus
                            />
                          ) : (
                            <strong>
                              {q.label}
                              {q.isRequired && (
                                <span className="required-asterisk">*</span>
                              )}
                            </strong>
                          )}
                          <button
                            onClick={() => setEditingLabelFor(q.fieldId)}
                            className="btn-icon"
                          >
                            <EditIcon />
                          </button>
                        </div>

                        <div className="preview-card-footer">
                          <button
                            onClick={() => setEditingLogicFor(q)}
                            className="btn-link"
                          >
                            {q.conditionalLogic?.enabled
                              ? "Edit Logic"
                              : "Add Logic"}
                          </button>
                          <label>
                            <input
                              type="checkbox"
                              checked={q.isRequired}
                              onChange={() => toggleQuestionRequired(q.fieldId)}
                            />
                            Required
                          </label>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="empty-text">Add fields from the left.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {questions.length > 0 && (
          <div className="card">
            <h3>Step 4: Name & Save</h3>
            <div className="form-group">
              <label htmlFor="formName">Form Name</label>
              <input
                type="text"
                id="formName"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Job Application Form"
              />
            </div>
            <div className="form-actions">
              <button
                onClick={handleSaveForm}
                disabled={isSaving}
                className="btn btn-primary"
              >
                {isSaving && <Spinner />} {isSaving ? "Saving..." : "Save Form"}
              </button>
            </div>
          </div>
        )}
      </div>

      {editingLogicFor && (
        <ConditionalLogicModal
          question={editingLogicFor}
          allQuestions={questions}
          onSave={updateQuestionLogic}
          onClose={() => setEditingLogicFor(null)}
        />
      )}
    </div>
  );
};

// ====================================================================
//  FormViewer Component
// ====================================================================
const FormViewer = ({ formId, onBack }) => {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const r = await axios.get(`${API_BASE_URL}/api/forms/${formId}`);
        setForm(r.data);
        const ir = {};
        r.data.questions.forEach((q) => {
          ir[q.fieldId] = "";
        });
        setResponses(ir);
      } catch (e) {
        alert("Could not load form.");
      }
      setLoading(false);
    };
    fetchForm();
  }, [formId]);

  const handleInputChange = (fieldId, value) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handlePreview = (e) => {
    e.preventDefault();
    for (const q of form.questions) {
      if (q.isRequired && !responses[q.fieldId]) {
        alert(`Please fill out the required field: "${q.label}"`);
        return;
      }
    }
    setIsPreviewing(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await axios.post(
        `${API_BASE_URL}/api/forms/${formId}/submit`,
        responses
      );
      alert("Response submitted!");
      onBack();
    } catch (e) {
      alert("Submission failed.");
    }
    setIsSubmitting(false);
  };

  const checkCondition = (logic) => {
    if (!logic || !logic.enabled) return true;
    const dependentValue = responses[logic.dependentFieldId];
    if (!dependentValue) return false;
    if (logic.operator === "is") return dependentValue === logic.value;
    if (logic.operator === "isNot") return dependentValue !== logic.value;
    return false;
  };

  if (loading)
    return (
      <div className="loading-screen">
        <div>Loading form...</div>
      </div>
    );
  if (!form) return <div className="loading-screen">Form not found.</div>;

  return (
    <div className="container">
      <div className="form-viewer-card">
        <h2 className="page-title">{form.formName}</h2>
        <h3 className="form-viewer-subtitle">
          {isPreviewing
            ? "Preview Your Answers"
            : "Please fill out the details"}
        </h3>
        <div className="form-viewer-body">
          {form.questions
            .filter((q) => checkCondition(q.conditionalLogic))
            .map((q) => (
              <div key={q.fieldId} className="form-group">
                <label>
                  {q.label}{" "}
                  {q.isRequired && !isPreviewing && (
                    <span className="required-asterisk">*</span>
                  )}
                </label>

                {isPreviewing ? (
                  <p className="preview-answer">
                    {responses[q.fieldId] || (
                      <span className="empty-text">(Not answered)</span>
                    )}
                  </p>
                ) : q.type === "singleSelect" ? (
                  <select
                    value={responses[q.fieldId] || ""}
                    onChange={(e) =>
                      handleInputChange(q.fieldId, e.target.value)
                    }
                    required={q.isRequired}
                  >
                    <option value="">-- Select --</option>
                    {q.options.map((opt) => (
                      <option key={opt.id} value={opt.name}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={responses[q.fieldId] || ""}
                    onChange={(e) =>
                      handleInputChange(q.fieldId, e.target.value)
                    }
                    required={q.isRequired}
                  />
                )}
              </div>
            ))}

          <div className="form-actions">
            {isPreviewing ? (
              <>
                <button
                  onClick={() => setIsPreviewing(false)}
                  className="btn btn-secondary"
                >
                  Edit Answers
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting && <Spinner />}{" "}
                  {isSubmitting ? "Submitting..." : "Confirm & Submit"}
                </button>
              </>
            ) : (
              <button onClick={handlePreview} className="btn btn-primary">
                Preview Answers
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ====================================================================
//  Dashboard Component
// ====================================================================
const Dashboard = ({ user, onLogout, onStartForm, onViewForm }) => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?._id) return;
    const fetchUserForms = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/forms/user/${user._id}`
        );
        setForms(response.data);
      } catch (error) {
        console.error("Failed to fetch user forms", error);
      }
      setLoading(false);
    };
    fetchUserForms();
  }, [user]);

  const copyToClipboard = (formId) => {
    const formUrl = `${window.location.origin}?formId=${formId}`;
    navigator.clipboard
      .writeText(formUrl)
      .then(() => alert("Form link copied to clipboard!"))
      .catch((err) => console.error("Failed to copy link: ", err));
  };

  const handleExportPdf = (formId) => {
    window.open(
      `${API_BASE_URL}/api/forms/${formId}/responses/pdf`,
      "_blank"
    );
  };

  return (
    <div className="container">
      <header className="dashboard-header">
        <h1 className="welcome-message">Welcome, {user.email}!</h1>
        <div className="header-actions">
          <button onClick={onStartForm} className="btn btn-primary">
            + Create New Form
          </button>
          <button onClick={onLogout} className="btn btn-danger">
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <h2>Your Forms</h2>
        <div className="card">
          {loading ? (
            <p>Loading forms...</p>
          ) : forms.length > 0 ? (
            <table className="forms-table">
              <thead>
                <tr>
                  <th>Form Name</th>
                  <th>Created On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {forms.map((form) => (
                  <tr key={form._id}>
                    <td>{form.formName}</td>
                    <td>{new Date(form.createdAt).toLocaleDateString()}</td>
                    <td className="actions-cell">
                      <button
                        onClick={() => onViewForm(form._id)}
                        className="btn-small btn-primary"
                      >
                        View & Fill
                      </button>
                      <button
                        onClick={() => copyToClipboard(form._id)}
                        className="btn-small btn-secondary"
                      >
                        Copy Link
                      </button>
                      <button
                        onClick={() => handleExportPdf(form._id)}
                        className="btn-small btn-success"
                      >
                        Export PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-text">You haven't created any forms yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ====================================================================
//  LoginPage and Main App Component
// ====================================================================
const LoginPage = () => {
  const handleLogin = () => {
    console.log("API_BASE_URL", API_BASE_URL);
    window.location.href = `${API_BASE_URL}/api/auth/airtable`;
  };
  return (
    <div className="loading-screen">
      <div className="login-card">
        <h2 className="page-title">Form Builder for Airtable</h2>
        <p className="page-subtitle">
          Connect your Airtable account to create custom forms in seconds.
        </p>
        <button onClick={handleLogin} className="btn btn-primary btn-large">
          Log in with Airtable
        </button>
      </div>
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [currentFormId, setCurrentFormId] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const formIdFromUrl = urlParams.get("formId");
      if (formIdFromUrl) {
        setCurrentFormId(formIdFromUrl);
        setPage("viewer");
        setLoading(false);
        return;
      }

      const storedUserId = localStorage.getItem("airtableFormBuilderUserId");
      if (storedUserId) {
        try {
          const response = await axios.get(
            `${API_BASE_URL}/api/users/${storedUserId}`
          );
          setUser(response.data);
        } catch (error) {
          localStorage.removeItem("airtableFormBuilderUserId");
        }
      } else {
        const userIdFromRedirect = urlParams.get("userId");
        if (userIdFromRedirect) {
          try {
            const response = await axios.get(
              `${API_BASE_URL}/api/users/${userIdFromRedirect}`
            );
            setUser(response.data);
            localStorage.setItem(
              "airtableFormBuilderUserId",
              response.data._id
            );
            window.history.replaceState(null, "", window.location.pathname);
          } catch (error) {
            console.error("Error fetching user:", error);
          }
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("airtableFormBuilderUserId");
    setUser(null);
    setPage("dashboard");
  };
  const handleViewForm = (formId) => {
    setCurrentFormId(formId);
    setPage("viewer");
  };
  const handleStartForm = () => {
    setPage("builder");
  };
  const handleFormSaved = () => {
    setPage("dashboard");
  };
  const handleBackToDashboard = () => {
    setPage("dashboard");
  };

  const renderContent = () => {
    if (page === "viewer")
      return (
        <FormViewer formId={currentFormId} onBack={handleBackToDashboard} />
      );
    if (page === "builder")
      return <FormBuilder user={user} onFormSaved={handleFormSaved} />;
    return (
      <Dashboard
        user={user}
        onLogout={handleLogout}
        onStartForm={handleStartForm}
        onViewForm={handleViewForm}
      />
    );
  };

  // ✅ NEW: Router wrapper with two extra routes; everything else stays the same
  return (
    <Router>
      <Routes>
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route
          path="/*"
          element={
            <div className="app-container">
              {loading ? (
                <div className="loading-screen">
                  <div>Loading Application...</div>
                </div>
              ) : user ? (
                renderContent()
              ) : (
                <LoginPage />
              )}
            </div>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
