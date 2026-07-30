const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


exports.login = async (req, res) => {
  const { email, password } = req.body;

  // 1. Basic input validation
  if (!email || !password) {
    return res.status(400).json({ 
      message: 'Please provide both email and password.' 
    });
  }

  try {
    // 2. Query the users table for a matching email
    const query = 'SELECT id, name, email, role, password_hash FROM users WHERE email = ?';
    const [users] = await db.query(query, [email]);

    // 3. If no user is found, return a generic 401 unauthorized status
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = users[0];

    // 4. Verify the password (supporting both bcrypt and plain text fallback)
    let isMatch = false;
    if (user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$')) {
      isMatch = await bcrypt.compare(password, user.password_hash);
    } else {
      isMatch = (user.password_hash === password);
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // 5. Build response token and payload based on user role
    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(
      userPayload,
      process.env.JWT_SECRET || 'supersecretkey',
      { expiresIn: '2h' }
    );

    // 6. Return the data to the client
    return res.status(200).json({
      message: 'Login successful',
      token,
      user: userPayload
    });

  } catch (error) {
    console.error('Login error details:', error);
    return res.status(500).json({ 
      message: 'An internal server error occurred during authentication.' 
    });
  }
};