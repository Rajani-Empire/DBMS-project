const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Available routines catalog is open to all authenticated accounts
router.get('/available', authenticateToken, courseController.getAllAvailableSections);

// Enrollment actions are restricted to Student role
router.post('/enroll', authenticateToken, authorizeRoles('student'), courseController.enrollInSection);
router.post('/drop', authenticateToken, authorizeRoles('student'), courseController.dropSection);

// Timetable schedule & academic transcript/grades views
router.get('/schedule/:student_id', authenticateToken, authorizeRoles('student', 'admin'), courseController.getStudentSchedule);
router.get('/transcript/:student_id', authenticateToken, authorizeRoles('student', 'admin'), courseController.getStudentTranscript);

// Faculty routes (Teaching schedule, section roster, grade uploads)
router.get('/faculty/:faculty_id', authenticateToken, authorizeRoles('faculty', 'admin'), courseController.getFacultySections);
router.get('/roster/:section_id', authenticateToken, authorizeRoles('faculty', 'admin'), courseController.getSectionRoster);
router.put('/grade', authenticateToken, authorizeRoles('faculty'), courseController.updateGrates);

// Faculty Attendance & Analytics
router.post('/attendance', authenticateToken, authorizeRoles('faculty'), courseController.submitAttendance);
router.get('/attendance/:section_id', authenticateToken, authorizeRoles('faculty', 'admin'), courseController.getAttendanceReport);
router.get('/analytics/:section_id', authenticateToken, authorizeRoles('faculty', 'admin'), courseController.getSectionAnalytics);

module.exports = router;