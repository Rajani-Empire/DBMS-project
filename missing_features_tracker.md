# Department Management System - Feature Gap Tracker

This document tracks the current implementation, identifies the missing features/gaps in the Department Management System, and provides an actionable implementation roadmap to follow.

---

## 1. Current System Capabilities (State of the App)

### Frontend (Vite + React)
- **Login Gateway**: Simple credentials checks based on user roles (`admin`, `faculty`, `student`).
- **Student Dashboard**: Shows available class schedule sections and permits course registration.
- **Faculty Dashboard**: Lists assigned sections, section student rosters, and provides form fields to update student marks (mid/final) with automated grade calculations.
- **Admin Dashboard**: Displays aggregate metrics (totals of students, faculty, courses, and department average score) and recent grading activity feeds.

### Backend (Node.js + Express + MySQL)
- **Authentication**: Single login route checking plain-text passwords.
- **Course & Section Management**: Basic list endpoints for course offerings and rosters.
- **Grades**: Single put endpoint to update student grades (with basic automatic grade mapping).
- **Admin**: Endpoint fetching simple aggregate counts.

---

## 2. Identified Gaps & Missing Features

### 🔐 A. Security & Architecture Gaps
- **Missing Token-Based Auth (JWT)**: API endpoints are completely unprotected. Anyone can make request payloads to update grades or read stats without signing in.
- **Plain-text Passwords**: Passwords are stored and checked as plain-text (`password_hash !== password`), which is a critical security vulnerability.
- **Missing API Request Validation**: Incoming JSON requests lack schema validation (e.g. invalid emails, out-of-range marks, etc.).

### ⚙️ B. Administrative Control Gaps (CRUD Operations)
Currently, the Admin dashboard has **no actual management features**. The Admin role cannot:
- **Manage Users**: No screens to add, edit, or delete student profiles, faculty members, or administrative staff.
- **Manage Courses**: Cannot add new courses, configure prerequisite criteria, or assign course credits.
- **Manage Class Routines (Sections)**: No ability to build and schedule new class sections, assign instructors, allocate rooms, or define day/time slots.

### 🎓 C. Student Portal Gaps
- **Personal Schedule / Timetable**: Students cannot view their weekly class schedule calendar.
- **Academic History / Transcript**: Students have no view to check their grades, registered GPA, or credit completion summary.
- **Prerequisite Validation Check**: Students can register for courses even if they haven't passed the prerequisite course (the backend doesn't validate `prerequisite_id`).
- **Drop / Deregister Courses**: Once registered, students cannot drop a class section.

### 🍎 D. Faculty Portal Gaps
- **Performance Analytics**: Faculty cannot view average grade distribution, passing rates, or performance charts for their sections.
- **Attendance Tracking**: No mechanism to log or monitor class attendance statistics.

### 🗄️ E. Database Constraints & Rules
- **Section Capacity Limits**: Class sections have no maximum capacity limits (unlimited registrations allowed).
- **Student Schedule Conflict Validation**: The system does not check if a student is registering for two sections that occupy the same day and time slot.

---

## 3. Implementation Roadmap & Progress Tracker

Use this checklist to track the development progress as features are built out.

### Phase 1: Security & Foundation Setup
- [ ] Implement password hashing (using `bcrypt` or similar).
- [ ] Implement JWT (JSON Web Tokens) for authentication.
- [ ] Create middleware to authenticate routes and authorize specific roles (Admin/Faculty/Student).
- [ ] Add input validators (e.g. using `express-validator` or custom schemas).

### Phase 2: Administrative Panel (Full CRUD)
- [ ] **Student Administration**
  - [ ] Add API endpoints for creating, reading, updating, and deleting students.
  - [ ] Build administrative UI for managing students in the frontend.
- [ ] **Faculty Administration**
  - [ ] Add API endpoints for managing faculty members (CRUD).
  - [ ] Build administrative UI for managing faculty in the frontend.
- [ ] **Course Catalog Administration**
  - [ ] Add CRUD API for courses (handling prerequisite configurations).
  - [ ] Build course catalog manager UI.
- [ ] **Schedule & Section Management**
  - [ ] Add API to schedule sections with conflict detection (room & teacher availability).
  - [ ] Build scheduling dashboard UI for Admins.

### Phase 3: Student Experience Enhancements
- [ ] **Academic Transcript & Grades**
  - [ ] Add endpoint to fetch enrolled courses with letter grades and compute Semester GPA.
  - [ ] Build "My Report Card" tab on the Student Dashboard.
- [ ] **Class Schedule Calendar**
  - [ ] Add personal weekly timetable view on the Student Dashboard.
- [ ] **Registration Safeguards**
  - [ ] Implement backend validation for course prerequisites.
  - [ ] Implement backend validation preventing student schedule overlaps.
  - [ ] Implement backend validation for section capacity limits.
- [ ] **Drop Course Utility**
  - [ ] Add API and UI button to allow dropping an enrolled section.

### Phase 4: Faculty Experience Enhancements
- [ ] **Grade Distribution Metrics**
  - [ ] Add API/view summarizing class metrics (Average, High/Low score, Grade distribution graph).
- [ ] **Attendance Tracking**
  - [ ] Design attendance schema (Attendance table).
  - [ ] Create API and UI spreadsheet for faculty to take daily attendance.
