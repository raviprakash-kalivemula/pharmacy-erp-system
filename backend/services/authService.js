const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_me';
const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || '24h';

// Hash password
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

// Generate JWT token
function generateToken(userId, role, username) {
  return jwt.sign(
    { userId, role, username },
    JWT_SECRET,
    { 
      algorithm: process.env.JWT_ALGORITHM || 'HS256',
      expiresIn: TOKEN_EXPIRY 
    }
  );
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Decode token (without verification)
function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  decodeToken
};
