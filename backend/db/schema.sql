-- 1. BASE USERS TABLE (Handles Authentication & Shared Info)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'faculty', 'student')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. STUDENT DETAILS TABLE (1:1 Relationship with Users)
CREATE TABLE students (
    student_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    student_reg_no VARCHAR(20) UNIQUE NOT NULL,
    batch_year INT NOT NULL,
    current_semester INT NOT NULL CHECK (current_semester BETWEEN 1 AND 8)
);

-- 3. FACULTY DETAILS TABLE (1:1 Relationship with Users)
CREATE TABLE faculty (
    faculty_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    designation VARCHAR(50) NOT NULL, -- e.g., Lecturer, Assistant Professor
    office_room VARCHAR(20) NOT NULL
);

-- 4. COURSE CATALOG TABLE
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    course_code VARCHAR(10) UNIQUE NOT NULL, -- e.g., CSE-311
    title VARCHAR(150) NOT NULL,
    credits NUMERIC(2, 1) NOT NULL CHECK (credits IN (1.0, 1.5, 3.0, 4.0)),
    prerequisite_id INT REFERENCES courses(id) ON DELETE SET NULL
);

-- 5. SECTIONS / CLASS ROUTINE TABLE
CREATE TABLE sections (
    id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    faculty_id INT NOT NULL REFERENCES faculty(faculty_id) ON DELETE RESTRICT,
    semester_code VARCHAR(10) NOT NULL, -- e.g., 'Spring2026', 'Fall2026'
    room_number VARCHAR(20) NOT NULL,
    day_of_week VARCHAR(15) NOT NULL CHECK (day_of_week IN ('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')),
    time_slot VARCHAR(20) NOT NULL, -- e.g., '09:00-10:30'
    -- Constraint to prevent a room being double-booked at the same day/time
    CONSTRAINT unique_room_schedule UNIQUE (room_number, day_of_week, time_slot),
    -- Constraint to prevent a teacher from being in two places at once
    CONSTRAINT unique_faculty_schedule UNIQUE (faculty_id, day_of_week, time_slot)
);

-- 6. ENROLLMENTS & GRADES JUNCTION TABLE (Many-to-Many)
CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    mid_marks NUMERIC(5, 2) DEFAULT 0.0 CHECK (mid_marks BETWEEN 0.0 AND 40.0),
    final_marks NUMERIC(5, 2) DEFAULT 0.0 CHECK (final_marks BETWEEN 0.0 AND 60.0),
    letter_grade VARCHAR(2) DEFAULT 'F',
    -- Prevent a student from enrolling in the exact same section twice
    CONSTRAINT unique_student_enrollment UNIQUE (student_id, section_id)
);