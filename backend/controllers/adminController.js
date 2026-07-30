const db = require('../config/db');
const bcrypt = require('bcryptjs');

/**
 * Compiles comprehensive analytics and metrics for the Admin Dashboard
 * GET /api/admin/stats
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM students) AS total_students,
        (SELECT COUNT(*) FROM faculty) AS total_faculty,
        (SELECT COUNT(*) FROM courses) AS total_courses,
        (SELECT COUNT(*) FROM sections) AS active_sections,
        IFNULL(ROUND(AVG(mid_marks + final_marks), 2), 0.00) AS department_average_score
      FROM enrollments;
    `;

    const activityQuery = `
      SELECT 
        e.id AS enrollment_id,
        u.name AS student_name,
        c.course_code,
        (e.mid_marks + e.final_marks) AS total_score,
        e.letter_grade
      FROM enrollments e
      JOIN students s ON e.student_id = s.student_id
      JOIN users u ON s.student_id = u.id
      JOIN sections sec ON e.section_id = sec.id
      JOIN courses c ON sec.course_id = c.id
      ORDER BY e.id DESC
      LIMIT 5;
    `;

    const [statsResult] = await db.query(statsQuery);
    const [activityResult] = await db.query(activityQuery);

    return res.status(200).json({
      metrics: statsResult[0],
      recentActivity: activityResult
    });
  } catch (error) {
    console.error('Error generating administrative metrics:', error);
    return res.status(500).json({
      message: 'Failed to generate department dashboard metrics.',
      error: error.message
    });
  }
};

// ==========================================
// STUDENT CRUD OPERATIONS
// ==========================================

exports.getStudents = async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.name, u.email, s.student_reg_no, s.batch_year, s.current_semester 
      FROM users u
      JOIN students s ON u.id = s.student_id
      WHERE u.role = 'student'
      ORDER BY u.id DESC
    `;
    const [students] = await db.query(query);
    return res.status(200).json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    return res.status(500).json({ message: 'Error fetching students', error: error.message });
  }
};

exports.createStudent = async (req, res) => {
  const { name, email, password, student_reg_no, batch_year, current_semester } = req.body;
  if (!name || !email || !password || !student_reg_no || !batch_year || !current_semester) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // Check if email already exists
    const [exists] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length > 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "student")',
      [name, email, passwordHash]
    );
    const studentId = userResult.insertId;

    await conn.query(
      'INSERT INTO students (student_id, student_reg_no, batch_year, current_semester) VALUES (?, ?, ?, ?)',
      [studentId, student_reg_no, batch_year, current_semester]
    );

    await conn.commit();
    return res.status(201).json({ message: 'Student created successfully', id: studentId });
  } catch (error) {
    await conn.rollback();
    console.error('Error creating student:', error);
    return res.status(500).json({ message: 'Failed to create student', error: error.message });
  } finally {
    conn.release();
  }
};

exports.updateStudent = async (req, res) => {
  const { id } = req.params;
  const { name, email, student_reg_no, batch_year, current_semester } = req.body;

  if (!name || !email || !student_reg_no || !batch_year || !current_semester) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    await conn.query(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, id]
    );
    await conn.query(
      'UPDATE students SET student_reg_no = ?, batch_year = ?, current_semester = ? WHERE student_id = ?',
      [student_reg_no, batch_year, current_semester, id]
    );
    await conn.commit();
    return res.status(200).json({ message: 'Student updated successfully' });
  } catch (error) {
    await conn.rollback();
    console.error('Error updating student:', error);
    return res.status(500).json({ message: 'Failed to update student', error: error.message });
  } finally {
    conn.release();
  }
};

exports.deleteStudent = async (req, res) => {
  const { id } = req.params;
  try {
    // ON DELETE CASCADE will automatically remove the corresponding entry in students table
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    return res.status(200).json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    return res.status(500).json({ message: 'Failed to delete student', error: error.message });
  }
};

// ==========================================
// FACULTY CRUD OPERATIONS
// ==========================================

exports.getFaculty = async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.name, u.email, f.designation, f.office_room 
      FROM users u
      JOIN faculty f ON u.id = f.faculty_id
      WHERE u.role = 'faculty'
      ORDER BY u.id DESC
    `;
    const [faculty] = await db.query(query);
    return res.status(200).json(faculty);
  } catch (error) {
    console.error('Error fetching faculty:', error);
    return res.status(500).json({ message: 'Error fetching faculty', error: error.message });
  }
};

exports.createFaculty = async (req, res) => {
  const { name, email, password, designation, office_room } = req.body;
  if (!name || !email || !password || !designation || !office_room) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // Check if email already exists
    const [exists] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length > 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "faculty")',
      [name, email, passwordHash]
    );
    const facultyId = userResult.insertId;

    await conn.query(
      'INSERT INTO faculty (faculty_id, designation, office_room) VALUES (?, ?, ?)',
      [facultyId, designation, office_room]
    );

    await conn.commit();
    return res.status(201).json({ message: 'Faculty created successfully', id: facultyId });
  } catch (error) {
    await conn.rollback();
    console.error('Error creating faculty:', error);
    return res.status(500).json({ message: 'Failed to create faculty', error: error.message });
  } finally {
    conn.release();
  }
};

exports.updateFaculty = async (req, res) => {
  const { id } = req.params;
  const { name, email, designation, office_room } = req.body;

  if (!name || !email || !designation || !office_room) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    await conn.query(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, id]
    );
    await conn.query(
      'UPDATE faculty SET designation = ?, office_room = ? WHERE faculty_id = ?',
      [designation, office_room, id]
    );
    await conn.commit();
    return res.status(200).json({ message: 'Faculty updated successfully' });
  } catch (error) {
    await conn.rollback();
    console.error('Error updating faculty:', error);
    return res.status(500).json({ message: 'Failed to update faculty', error: error.message });
  } finally {
    conn.release();
  }
};

exports.deleteFaculty = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    return res.status(200).json({ message: 'Faculty deleted successfully' });
  } catch (error) {
    console.error('Error deleting faculty:', error);
    return res.status(500).json({ message: 'Failed to delete faculty', error: error.message });
  }
};

// ==========================================
// COURSE CRUD OPERATIONS
// ==========================================

exports.getCourses = async (req, res) => {
  try {
    const query = `
      SELECT c.id, c.course_code, c.title, c.credits, c.prerequisite_id, p.title AS prerequisite_title 
      FROM courses c
      LEFT JOIN courses p ON c.prerequisite_id = p.id
      ORDER BY c.course_code ASC
    `;
    const [courses] = await db.query(query);
    return res.status(200).json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    return res.status(500).json({ message: 'Error fetching courses', error: error.message });
  }
};

exports.createCourse = async (req, res) => {
  const { course_code, title, credits, prerequisite_id } = req.body;
  if (!course_code || !title || !credits) {
    return res.status(400).json({ message: 'Course code, title and credits are required' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO courses (course_code, title, credits, prerequisite_id) VALUES (?, ?, ?, ?)',
      [course_code, title, credits, prerequisite_id || null]
    );
    return res.status(201).json({ message: 'Course created successfully', id: result.insertId });
  } catch (error) {
    console.error('Error creating course:', error);
    return res.status(500).json({ message: 'Failed to create course', error: error.message });
  }
};

exports.updateCourse = async (req, res) => {
  const { id } = req.params;
  const { course_code, title, credits, prerequisite_id } = req.body;

  if (!course_code || !title || !credits) {
    return res.status(400).json({ message: 'Course code, title and credits are required' });
  }

  try {
    await db.query(
      'UPDATE courses SET course_code = ?, title = ?, credits = ?, prerequisite_id = ? WHERE id = ?',
      [course_code, title, credits, prerequisite_id || null, id]
    );
    return res.status(200).json({ message: 'Course updated successfully' });
  } catch (error) {
    console.error('Error updating course:', error);
    return res.status(500).json({ message: 'Failed to update course', error: error.message });
  }
};

exports.deleteCourse = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM courses WHERE id = ?', [id]);
    return res.status(200).json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);
    return res.status(500).json({ message: 'Failed to delete course', error: error.message });
  }
};

// ==========================================
// ROUTINE/SECTION CRUD OPERATIONS
// ==========================================

exports.getSections = async (req, res) => {
  try {
    const query = `
      SELECT s.id, s.course_id, s.faculty_id, s.semester_code, s.room_number, s.day_of_week, s.time_slot,
             c.course_code, c.title AS course_title, u.name AS faculty_name
      FROM sections s
      JOIN courses c ON s.course_id = c.id
      JOIN users u ON s.faculty_id = u.id
      ORDER BY s.id DESC
    `;
    const [sections] = await db.query(query);
    return res.status(200).json(sections);
  } catch (error) {
    console.error('Error fetching sections:', error);
    return res.status(500).json({ message: 'Error fetching sections', error: error.message });
  }
};

exports.createSection = async (req, res) => {
  const { course_id, faculty_id, semester_code, room_number, day_of_week, time_slot } = req.body;
  if (!course_id || !faculty_id || !semester_code || !room_number || !day_of_week || !time_slot) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // 1. Conflict detection: Check room availability
    const [roomConflict] = await db.query(
      'SELECT id FROM sections WHERE room_number = ? AND day_of_week = ? AND time_slot = ? AND semester_code = ?',
      [room_number, day_of_week, time_slot, semester_code]
    );
    if (roomConflict.length > 0) {
      return res.status(400).json({ message: 'Schedule conflict: This room is already booked at the specified day and time slot.' });
    }

    // 2. Conflict detection: Check instructor availability
    const [facultyConflict] = await db.query(
      'SELECT id FROM sections WHERE faculty_id = ? AND day_of_week = ? AND time_slot = ? AND semester_code = ?',
      [faculty_id, day_of_week, time_slot, semester_code]
    );
    if (facultyConflict.length > 0) {
      return res.status(400).json({ message: 'Schedule conflict: The selected faculty advisor is already teaching another section at this day and time slot.' });
    }

    // 3. Insert section
    const [result] = await db.query(
      'INSERT INTO sections (course_id, faculty_id, semester_code, room_number, day_of_week, time_slot) VALUES (?, ?, ?, ?, ?, ?)',
      [course_id, faculty_id, semester_code, room_number, day_of_week, time_slot]
    );
    return res.status(201).json({ message: 'Class section scheduled successfully', id: result.insertId });
  } catch (error) {
    console.error('Error creating section:', error);
    return res.status(500).json({ message: 'Failed to schedule class section', error: error.message });
  }
};

exports.updateSection = async (req, res) => {
  const { id } = req.params;
  const { course_id, faculty_id, semester_code, room_number, day_of_week, time_slot } = req.body;

  if (!course_id || !faculty_id || !semester_code || !room_number || !day_of_week || !time_slot) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // 1. Check room conflict (excluding current section)
    const [roomConflict] = await db.query(
      'SELECT id FROM sections WHERE room_number = ? AND day_of_week = ? AND time_slot = ? AND semester_code = ? AND id != ?',
      [room_number, day_of_week, time_slot, semester_code, id]
    );
    if (roomConflict.length > 0) {
      return res.status(400).json({ message: 'Schedule conflict: This room is already booked at the specified day and time slot.' });
    }

    // 2. Check instructor conflict (excluding current section)
    const [facultyConflict] = await db.query(
      'SELECT id FROM sections WHERE faculty_id = ? AND day_of_week = ? AND time_slot = ? AND semester_code = ? AND id != ?',
      [faculty_id, day_of_week, time_slot, semester_code, id]
    );
    if (facultyConflict.length > 0) {
      return res.status(400).json({ message: 'Schedule conflict: The selected faculty advisor is already teaching another section at this day and time slot.' });
    }

    // 3. Update section
    await db.query(
      'UPDATE sections SET course_id = ?, faculty_id = ?, semester_code = ?, room_number = ?, day_of_week = ?, time_slot = ? WHERE id = ?',
      [course_id, faculty_id, semester_code, room_number, day_of_week, time_slot, id]
    );
    return res.status(200).json({ message: 'Class section updated successfully' });
  } catch (error) {
    console.error('Error updating section:', error);
    return res.status(500).json({ message: 'Failed to update class section', error: error.message });
  }
};

exports.deleteSection = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM sections WHERE id = ?', [id]);
    return res.status(200).json({ message: 'Class section deleted successfully' });
  } catch (error) {
    console.error('Error deleting section:', error);
    return res.status(500).json({ message: 'Failed to delete class section', error: error.message });
  }
};