# 📋 Dynamic Airtable-Connected Form Builder

A **full-stack MERN** application built as a technical assignment that lets users:

- 🔐 Log in securely with their Airtable account
- 🛠 Build custom web forms from Airtable bases
- ⚙️ Apply conditional visibility logic to questions
- 📥 Collect responses directly back into Airtable

---

## 🚀 Live Demo
**Frontend:** [Deployed Here](#)  
**Backend:** [Deployed Here](#)  

> Replace these with your Vercel/Render deployment links after going live.

---

## ✅ Features

### Core
- **Secure Airtable OAuth 2.0 Login**  
  - Implements **PKCE** extension for security  
  - Tokens stored securely in MongoDB and auto-refreshed  

- **Dynamic Form Builder**  
  - Select any authorized **Airtable Base** and **Table**  
  - Choose fields as questions and rename labels for better UX  
  - Supports **Short Text**, **Long Text**, **Single Select**, and **Multi-Select**  

- **Conditional Logic Engine**  
  - Show/hide questions based on answers to earlier **Single Select** questions  

- **Live Form Viewer**  
  - Each form gets a **unique, shareable URL**  
  - Responses go directly into Airtable  

### Bonus
- Mark questions as **Required** (validated in live form)  
- **Dashboard** with all forms, creation dates, and quick actions  
- **One-click Share Links** for forms  
- **Form Preview** before submission  
- **PDF Export** of responses with special character support  

---

## 🛠 Tech Stack

**Frontend:** React, Vite, Axios, Tailwind CSS  
**Backend:** Node.js, Express  
**Database:** MongoDB (Mongoose)  
**Auth:** Airtable OAuth 2.0 (PKCE)  
**PDF Generation:** pdf-lib  

---

## 📦 Setup Guide

### 1️⃣ Create Airtable OAuth App
1. Go to the [Airtable Developer Hub](https://airtable.com/developers)  
2. Click **"Create a new OAuth integration"**  
3. Fill out:
   - **Name:** e.g. `My Form Builder`
   - **Redirect URL:** `http://localhost:5001/api/auth/airtable/callback`
4. Under **Scopes**, grant:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`
   - `user.email:read`
5. Copy the **Client ID** and **Client Secret** (for `.env` file)

---

### 2️⃣ Backend Setup
```bash
cd backend
npm install

# Create .env file
AIRTABLE_CLIENT_ID=your_client_id
AIRTABLE_CLIENT_SECRET=your_client_secret
MONGO_URI=your_mongodb_connection
PORT=5001

npm start
````

---

### 3️⃣ Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ Conditional Logic

**Trigger Question:**

* Must be a **Single Select** field for predictable answer sets

**Dependency:**

* A question can only depend on another above it in the form order (avoids circular logic)

**Flow:**

1. When saving a form, rules are stored as `conditionalLogic` objects in MongoDB.
2. In `FormViewer`, each question runs through `checkCondition()`.
3. Based on current answers:

   * ✅ Condition met → question is shown
   * ❌ Condition not met → question is hidden
4. Runs in **real time** with every answer change for a dynamic form experience.

---

## 📜 License

MIT License — feel free to modify and use.

