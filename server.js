import express, { json } from "express";
import path from "path";
import { readdirSync } from "fs";
import crypto from 'crypto';
import { randomUUID } from 'crypto';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(json());

// MySQL Connection Pool
const poolConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Add SSL only for Azure (when using mysql.database.azure.com)
if (process.env.DB_HOST && process.env.DB_HOST.includes('azure')) {
  poolConfig.ssl = 'Amazon';
}

const pool = mysql.createPool(poolConfig);

console.log(`Connecting to MySQL: ${process.env.DB_HOST}/${process.env.DB_NAME}`);

// Initialize database tables
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    
    // Create ratings table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp VARCHAR(255),
        videoId VARCHAR(255),
        rating INT,
        uuid VARCHAR(255)
      )
    `);

    connection.release();
    console.log('Database tables initialized successfully');
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }
}

// Initialize on startup
initializeDatabase();

// Serve a list of videos from the ./videos directory
app.get("/api/videos", (req, res) => {
  try {
    const videosDir = path.resolve("./videos");

    function walkDir(dir) {
      let results = [];
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          results = results.concat(walkDir(full));
        } else if (ent.isFile()) {
          if (/\.(mp4|webm|ogg|mov)$/i.test(ent.name)) {
            results.push(path.relative(videosDir, full).split(path.sep).join('/'));
          }
        }
      }
      return results;
    }

    let files = [];
    try {
      files = walkDir(videosDir);
    } catch (err) {
      console.error("Error walking videos directory:", err);
      return res.json([]);
    }

    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }
    shuffle(files);

    res.json(files);
  } catch (err) {
    console.error("Error reading videos directory:", err);
    res.status(500).json({ message: "Unable to read videos" });
  }
});

// Serve practice videos from ./video_test directory
app.get("/api/practice-videos", (req, res) => {
  try {
    const videosDir = path.resolve("./video_test");

    function walkDir(dir) {
      let results = [];
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          results = results.concat(walkDir(full));
        } else if (ent.isFile()) {
          if (/\.(mp4|webm|ogg|mov)$/i.test(ent.name)) {
            results.push(path.relative(videosDir, full).split(path.sep).join('/'));
          }
        }
      }
      return results;
    }

    let files = [];
    try {
      files = walkDir(videosDir);
    } catch (err) {
      console.error("Error walking video_test directory:", err);
      return res.json([]);
    }

    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }
    shuffle(files);

    res.json(files);
  } catch (err) {
    console.error("Error reading video_test directory:", err);
    res.status(500).json({ message: "Unable to read practice videos" });
  }
});

// Generate or return UUID (no database write)
app.post('/api/user', async (req, res) => {
  try {
    const uuid = req?.body?.uuid ? String(req.body.uuid) : randomUUID();
    console.log(`Using UUID: ${uuid}`);
    res.json({ uuid });
  } catch (err) {
    console.error('Failed to process UUID:', err);
    res.status(500).json({ message: 'Unable to process UUID' });
  }
});

// Save rating
app.post("/api/rate", async (req, res) => {
  try {
    const { videoId, rating, uuid } = req.body;

    if (!videoId || typeof rating === "undefined" || !uuid) {
      return res.status(400).json({ message: "Missing data" });
    }

    const ts = new Date().toISOString();
    const connection = await pool.getConnection();

    // Insert rating
    await connection.execute(
      'INSERT INTO ratings (timestamp, videoId, rating, uuid) VALUES (?, ?, ?, ?)',
      [ts, videoId, Number(rating), uuid]
    );

    connection.release();
    console.log(`Rating saved: ${videoId} = ${rating} (uuid: ${uuid})`);
    res.json({ message: "Rating saved" });
  } catch (err) {
    console.error("Error saving rating:", err);
    res.status(500).json({ message: "Unable to save rating" });
  }
});

// Serve static files
app.use(express.static(path.resolve(".")));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Using MySQL database');
});

