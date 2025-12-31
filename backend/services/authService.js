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

// Verify Google ID Token
async function verifyGoogleToken(googleToken) {
  try {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    const ticket = await client.verifyIdToken({
      idToken: googleToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      email_verified: payload.email_verified
    };
  } catch (error) {
    throw new Error('Google token verification failed: ' + error.message);
  }
}

// Generate JWT for authenticated users
function generateJWT(userData) {
  return jwt.sign({
    id: userData.id,
    username: userData.username,
    email: userData.email,
    role: userData.role
  }, JWT_SECRET, {
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
    expiresIn: TOKEN_EXPIRY
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  decodeToken,
  verifyGoogleToken,
  generateJWT
};
