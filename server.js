require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit'); // SECURITY FIX: Added rate limiting
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;

// SECURITY FIX: Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set in environment variables');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set in environment variables');
  process.exit(1);
}

// SECURITY FIX: Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "esm.sh"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.supabase.co"],
      fontSrc: ["'self'", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // SECURITY FIX: JWT_SECRET is now validated at startup
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// GET /api/workouts - fetch user's workouts
app.get('/api/workouts', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM app_e2e1_workouts WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching workouts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/workouts - create new workout
app.post('/api/workouts', authenticateToken, async (req, res) => {
  const { type, duration, intensity, notes } = req.body;

  if (!type || !duration) {
    return res.status(400).json({ error: 'Workout type and duration are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO app_e2e1_workouts (user_id, type, duration, intensity, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, type, duration, intensity, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating workout:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard - get summary stats for dashboard
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const weeklyTotal = await pool.query(`
      SELECT COALESCE(SUM(duration), 0) as total_duration, COUNT(*) as session_count
      FROM app_e2e1_workouts
      WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '7 days'
    `, [req.user.id]);

    const streakResult = await pool.query(`
      WITH daily_workouts AS (
        SELECT DATE(created_at) as workout_date
        FROM app_e2e1_workouts
        WHERE user_id = $1
        GROUP BY DATE(created_at)
      ),
      date_series AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '30 days',
          CURRENT_DATE,
          '1 day'::interval
        )::date as calendar_date
      ),
      full_data AS (
        SELECT ds.calendar_date, dw.workout_date IS NOT NULL as has_workout
        FROM date_series ds
        LEFT JOIN daily_workouts dw ON ds.calendar_date = dw.workout_date
      ),
      ranked_streaks AS (
        SELECT 
          calendar_date,
          has_workout,
          calendar_date - ROW_NUMBER() OVER (ORDER BY calendar_date) * INTERVAL '1 day' AS grp
        FROM full_data
        WHERE has_workout
      ),
      streak_groups AS (
        SELECT 
          MIN(calendar_date) as streak_start,
          MAX(calendar_date) as streak_end,
          COUNT(*) as streak_length
        FROM ranked_streaks
        GROUP BY grp
      )
      SELECT COALESCE(MAX(streak_length), 0) as current_streak
      FROM streak_groups
      WHERE streak_end = CURRENT_DATE;
    `, [req.user.id]);

    res.json({
      ...weeklyTotal.rows[0],
      current_streak: parseInt(streakResult.rows[0].current_streak)
    });
  } catch (err) {
    console.error('Error fetching dashboard:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;