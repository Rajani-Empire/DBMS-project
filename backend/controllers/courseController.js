const db = require('../config/db');

/**
 * Fetch all available course sections along with course details and faculty names
 * GET /api/courses/available
 */
exports.getAllAvailableSections = async (req, res) => {
  try {
    const query = `
      SELECT 
        s.id AS section_id, 
        c.course_code, 
        c.title AS course_title, 
        c.credits, 
        u.name AS faculty_name, 
        s.room_number, 
        s.day_of_week, 
        s.time_slot,
        s.semester_code,
        s.capacity,
        (SELECT COUNT(*) FROM enrollments WHERE section_id = s.id) AS enrolled_count
      FROM sections s
      JOIN courses c ON s.course_id = c.id
      JOIN users u ON s.faculty_id = u.id
      ORDER BY s.day_of_week, s.time_slot;
    `;

    const [sections] = await db.query(query);
    return res.status(200).json(sections);
  } catch (error) {
    console.error('Error fetching sections:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch course schedules.', 
      error: error.message 
    });
  }
};

/**
 * Enroll a student into a specific course section
 * POST /api/courses/enroll
 */
exports.enrollInSection = async (req, res) => {
  const { student_id, section_id } = req.body;

  // 1. Input Validation
  if (!student_id || !section_id) {
    return res.status(400).json({ 
      message: 'Missing required fields: student_id and section_id.' 
    });
  }

  try {
    // 2. Verify if the section actually exists
    const [sectionExists] = await db.query(
      'SELECT course_id, faculty_id, room_number, day_of_week, time_slot, semester_code, capacity FROM sections WHERE id = ?', 
      [section_id]
    );
    if (sectionExists.length === 0) {
      return res.status(404).json({ message: 'The selected class section does not exist.' });
    }
    const { course_id, day_of_week, time_slot, semester_code, capacity } = sectionExists[0];

    // 3. Check if the student is already registered for this exact section
    const checkQuery = 'SELECT id FROM enrollments WHERE student_id = ? AND section_id = ?';
    const [existing] = await db.query(checkQuery, [student_id, section_id]);
    if (existing.length > 0) {
      return res.status(400).json({ 
        message: 'You are already registered for this specific class section.' 
      });
    }

    // 4. CAPACITY CONSTRAINT CHECK
    const [enrollmentCountQuery] = await db.query(
      'SELECT COUNT(*) AS count FROM enrollments WHERE section_id = ?', 
      [section_id]
    );
    const currentCount = enrollmentCountQuery[0].count;
    if (currentCount >= (capacity || 40)) {
      return res.status(400).json({ 
        message: 'Enrollment failed: This class section is fully booked (capacity limit reached).' 
      });
    }

    // 5. PREREQUISITE REQUIREMENT CHECK
    const [courseQuery] = await db.query(
      'SELECT prerequisite_id FROM courses WHERE id = ?', 
      [course_id]
    );
    const prerequisiteId = courseQuery[0].prerequisite_id;
    if (prerequisiteId) {
      const checkPrereqQuery = `
        SELECT e.id 
        FROM enrollments e
        JOIN sections s ON e.section_id = s.id
        WHERE e.student_id = ? 
          AND s.course_id = ? 
          AND e.letter_grade != 'F'
      `;
      const [prereqCompleted] = await db.query(checkPrereqQuery, [student_id, prerequisiteId]);
      if (prereqCompleted.length === 0) {
        const [prereqDetails] = await db.query('SELECT course_code, title FROM courses WHERE id = ?', [prerequisiteId]);
        const code = prereqDetails[0].course_code;
        const title = prereqDetails[0].title;
        return res.status(400).json({ 
          message: `Prerequisite unsatisfied: You must pass "${code} - ${title}" before enrolling in this course.` 
        });
      }
    }

    // 6. SCHEDULE OVERLAP/CONFLICT CHECK
    const checkConflictQuery = `
      SELECT s.id, c.course_code 
      FROM enrollments e
      JOIN sections s ON e.section_id = s.id
      JOIN courses c ON s.course_id = c.id
      WHERE e.student_id = ? 
        AND s.semester_code = ? 
        AND s.day_of_week = ? 
        AND s.time_slot = ?
    `;
    const [conflicts] = await db.query(checkConflictQuery, [student_id, semester_code, day_of_week, time_slot]);
    if (conflicts.length > 0) {
      return res.status(400).json({ 
        message: `Schedule conflict: You are already registered for "${conflicts[0].course_code}" at the same day (${day_of_week}) and time slot (${time_slot}).` 
      });
    }

    // 7. Insert the enrollment record into the junction table
    const insertQuery = 'INSERT INTO enrollments (student_id, section_id) VALUES (?, ?)';
    await db.query(insertQuery, [student_id, section_id]);

    return res.status(201).json({ 
      message: 'Course registration completed successfully.' 
    });

  } catch (error) {
    console.error('Enrollment operation failed:', error);
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ 
        message: 'Database Integrity Violation: Invalid student or section ID.' 
      });
    }
    return res.status(500).json({ 
      message: 'An internal error occurred during course registration.',
      error: error.message 
    });
  }
};

// Drop a course enrollment
exports.dropSection = async (req, res) => {
  const { student_id, section_id } = req.body;
  if (!student_id || !section_id) {
    return res.status(400).json({ message: 'Missing required student_id and section_id.' });
  }

  try {
    await db.query('DELETE FROM enrollments WHERE student_id = ? AND section_id = ?', [student_id, section_id]);
    return res.status(200).json({ message: 'Successfully deregistered and dropped class section.' });
  } catch (error) {
    console.error('Failed to drop section:', error);
    return res.status(500).json({ message: 'Failed to drop class section.', error: error.message });
  }
};

// Get personal schedule weekly routine for student
exports.getStudentSchedule = async (req, res) => {
  const { student_id } = req.params;
  try {
    const query = `
      SELECT s.id AS section_id, c.course_code, c.title AS course_title, c.credits,
             u.name AS faculty_name, s.room_number, s.day_of_week, s.time_slot, s.semester_code
      FROM enrollments e
      JOIN sections s ON e.section_id = s.id
      JOIN courses c ON s.course_id = c.id
      JOIN users u ON s.faculty_id = u.id
      WHERE e.student_id = ?
      ORDER BY s.day_of_week, s.time_slot
    `;
    const [schedule] = await db.query(query, [student_id]);
    return res.status(200).json(schedule);
  } catch (error) {
    console.error('Error fetching student schedule:', error);
    return res.status(500).json({ message: 'Failed to fetch weekly schedule routine.', error: error.message });
  }
};

// Get academic history / transcript for student
exports.getStudentTranscript = async (req, res) => {
  const { student_id } = req.params;
  try {
    const query = `
      SELECT e.id AS enrollment_id, c.course_code, c.title AS course_title, c.credits,
             e.mid_marks, e.final_marks, e.letter_grade, s.semester_code
      FROM enrollments e
      JOIN sections s ON e.section_id = s.id
      JOIN courses c ON s.course_id = c.id
      WHERE e.student_id = ?
      ORDER BY s.semester_code ASC
    `;
    const [grades] = await db.query(query, [student_id]);

    let totalCredits = 0;
    let totalGradePoints = 0;

    const gradePoints = {
      'A': 4.0,
      'B': 3.0,
      'C': 2.0,
      'F': 0.0
    };

    grades.forEach(row => {
      const credits = parseFloat(row.credits);
      if (row.letter_grade && gradePoints[row.letter_grade] !== undefined) {
        totalCredits += credits;
        totalGradePoints += (gradePoints[row.letter_grade] * credits);
      }
    });

    const gpa = totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : '0.00';

    return res.status(200).json({
      records: grades,
      cgpa: gpa,
      completedCredits: totalCredits
    });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return res.status(500).json({ message: 'Failed to compile academic transcript.', error: error.message });
  }
};

// Get all sections taught by a specific faculty member
exports.getFacultySections = async (req, res) => {
  const { faculty_id } = req.params;
  try {
    const query = `
      SELECT s.id AS section_id, c.course_code, c.title, s.room_number, s.day_of_week, s.time_slot 
      FROM sections s
      JOIN courses c ON s.course_id = c.id
      WHERE s.faculty_id = ?
    `;
    const [sections] = await db.query(query, [faculty_id]);
    res.json(sections);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching faculty sections', error });
  }
};

// Get all enrolled students and their grades for a specific section
exports.getSectionRoster = async (req, res) => {
  const { section_id } = req.params;
  try {
    const query = `
      SELECT e.id AS enrollment_id, e.student_id, u.name AS student_name, e.mid_marks, e.final_marks, e.letter_grade
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      WHERE e.section_id = ?
    `;
    const [roster] = await db.query(query, [section_id]);
    res.json(roster);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching roster', error });
  }
};

// Update grades for a student enrollment record
exports.updateGrates = async (req, res) => {
  const { enrollment_id, mid_marks, final_marks } = req.body;
  
  const total = parseFloat(mid_marks || 0) + parseFloat(final_marks || 0);
  let grade = 'F';
  if (total >= 80) grade = 'A';
  else if (total >= 60) grade = 'B';
  else if (total >= 40) grade = 'C';

  try {
    await db.query(
      'UPDATE enrollments SET mid_marks = ?, final_marks = ?, letter_grade = ? WHERE id = ?',
      [mid_marks, final_marks, grade, enrollment_id]
    );
    res.json({ message: 'Grades updated successfully', grade });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update grades', error });
  }
};

// Record/Submit attendance checklist for a section
exports.submitAttendance = async (req, res) => {
  const { section_id, date, records } = req.body;
  if (!section_id || !date || !records || !Array.isArray(records)) {
    return res.status(400).json({ message: 'Missing required fields: section_id, date, and records array.' });
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    for (const rec of records) {
      await conn.query(
        `INSERT INTO attendance (student_id, section_id, attendance_date, status)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = ?`,
        [rec.student_id, section_id, date, rec.status, rec.status]
      );
    }
    await conn.commit();
    return res.status(200).json({ message: 'Attendance registered successfully!' });
  } catch (error) {
    await conn.rollback();
    console.error('Error saving attendance:', error);
    return res.status(500).json({ message: 'Failed to record attendance.', error: error.message });
  } finally {
    conn.release();
  }
};

// Fetch section attendance records summarized per student
exports.getAttendanceReport = async (req, res) => {
  const { section_id } = req.params;
  try {
    const [sessionsQuery] = await db.query(
      'SELECT COUNT(DISTINCT attendance_date) AS total FROM attendance WHERE section_id = ?',
      [section_id]
    );
    const totalSessions = sessionsQuery[0].total;

    const query = `
      SELECT u.id AS student_id, u.name AS student_name,
             COUNT(CASE WHEN a.status = 'Present' THEN 1 END) AS present_count
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      LEFT JOIN attendance a ON e.student_id = a.student_id AND a.section_id = e.section_id
      WHERE e.section_id = ?
      GROUP BY u.id, u.name
    `;
    const [report] = await db.query(query, [section_id]);
    return res.status(200).json({
      totalSessions,
      records: report
    });
  } catch (error) {
    console.error('Error fetching attendance report:', error);
    return res.status(500).json({ message: 'Failed to fetch attendance report.', error: error.message });
  }
};

// Fetch class marks averages, high/low limits, and grade frequencies
exports.getSectionAnalytics = async (req, res) => {
  const { section_id } = req.params;
  try {
    const statsQuery = `
      SELECT 
        IFNULL(ROUND(AVG(mid_marks + final_marks), 2), 0.00) AS class_average,
        IFNULL(MAX(mid_marks + final_marks), 0.00) AS class_high,
        IFNULL(MIN(mid_marks + final_marks), 0.00) AS class_low,
        COUNT(id) AS enrolled_count
      FROM enrollments
      WHERE section_id = ?
    `;

    const gradeCountsQuery = `
      SELECT letter_grade, COUNT(*) AS count
      FROM enrollments
      WHERE section_id = ?
      GROUP BY letter_grade
    `;

    const [stats] = await db.query(statsQuery, [section_id]);
    const [grades] = await db.query(gradeCountsQuery, [section_id]);

    const distribution = { A: 0, B: 0, C: 0, F: 0 };
    grades.forEach(row => {
      if (distribution[row.letter_grade] !== undefined) {
        distribution[row.letter_grade] = row.count;
      }
    });

    return res.status(200).json({
      metrics: stats[0],
      distribution
    });
  } catch (error) {
    console.error('Error compiling section analytics:', error);
    return res.status(500).json({ message: 'Failed to compute performance analytics.', error: error.message });
  }
};