-- Insert Users (Passwords are cryptographically secure hashes)
INSERT INTO users (name, email, password_hash, role) VALUES
('Dr. Alan Turing', 'turing@univ.edu', '$2b$10$4cmqYkhb.ZYee7HQiXTJTulyC/9kBib9JCAYUbQ80rCfHuOAjANHO', 'faculty'),
('Ada Lovelace', 'ada@univ.edu', '$2b$10$4cmqYkhb.ZYee7HQiXTJTulyC/9kBib9JCAYUbQ80rCfHuOAjANHO', 'faculty'),
('John Doe', 'john@student.univ.edu', '$2b$10$P.h7GWk4qMkMCF9J4NEseOMQKqdrtHV0LLZ7NlotsVlYxzRxNXRmG', 'student'),
('Jane Smith', 'jane@student.univ.edu', '$2b$10$P.h7GWk4qMkMCF9J4NEseOMQKqdrtHV0LLZ7NlotsVlYxzRxNXRmG', 'student'),
('Dept Head Admin', 'admin@univ.edu', '$2b$10$YP3QGRxwjB08gW4mhFIwRuBpjDB5WHyouJ3yIYvBr/nn1zFztPRN.', 'admin');

-- Insert Faculty specifics (IDs correspond to users table)
INSERT INTO faculty (faculty_id, designation, office_room) VALUES
(1, 'Professor', 'Room-401'),
(2, 'Associate Professor', 'Room-405');

-- Insert Student specifics (IDs correspond to users table)
INSERT INTO students (student_id, student_reg_no, batch_year, current_semester) VALUES
(3, 'REG-2024-001', 2024, 4),
(4, 'REG-2024-002', 2024, 4);

-- Insert Courses
INSERT INTO courses (course_code, title, credits, prerequisite_id) VALUES
('CSE-101', 'Introduction to Programming', 3.0, NULL),
('CSE-311', 'Database Management Systems', 3.0, 1); -- CSE-101 is prerequisite

-- Create Sections for current semester
INSERT INTO sections (course_id, faculty_id, semester_code, room_number, day_of_week, time_slot) VALUES
(2, 1, 'Summer2026', 'Lab-3', 'Sunday', '09:00-10:30'),
(1, 2, 'Summer2026', 'Room-102', 'Monday', '11:00-12:30');

-- Enroll students into classes
INSERT INTO enrollments (student_id, section_id, mid_marks, final_marks, letter_grade) VALUES
(3, 1, 35.0, 52.0, 'A'),
(4, 1, 22.0, 38.0, 'B');