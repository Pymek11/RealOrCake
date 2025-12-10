import express, { json } from "express";
import path from "path";
import fs from "fs"; 
import { readdirSync } from "fs";
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(json());

// MySQL Connection Pool
const poolConfig = {
  host: process.env.DBHOST,
  user: process.env.DBUSER,
  password: process.env.DBPASS,
  database: process.env.DBNAME,
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    ca: fs.readFileSync(path.join(__dirname, './cert/DigiCertGlobalRootG2.crt.pem'))
    
  }
};

const pool = mysql.createPool(poolConfig);

console.log(`Connecting to MySQL: ${process.env.DBHOST}/${process.env.DBNAME}`);

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
        uuid VARCHAR(255),
        resolution VARCHAR(50)
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

// Get list of videos from /videos directory
app.get("/api/videos", (req, res) => {
  try {
    const videoDir = path.resolve("./videos");
    const files = readdirSync(videoDir).filter(f => 
      f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mov')
    );
    res.json(files);
  } catch (err) {
    console.error("Error reading videos:", err);
    res.status(500).json({ message: "Unable to read videos" });
  }
});

// Get list of practice videos from /video_test directory
app.get("/api/practice-videos", (req, res) => {
  try {
    const videoDir = path.resolve("./video_test");
    const files = readdirSync(videoDir).filter(f => 
      f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mov')
    );
    res.json(files);
  } catch (err) {
    console.error("Error reading practice videos:", err);
    res.status(500).json({ message: "Unable to read practice videos" });
  }
});

app.get("/api/stream/:dir/:videoPath(*)", (req, res) => {
  try {
    const dir = req.params.dir; // 'videos' lub 'video_test' lub 'video_last_test'
    const videoPath = path.resolve(`./${dir}`, req.params.videoPath);
    
    // Security check - prevent directory traversal
    if (!videoPath.startsWith(path.resolve(`./${dir}`))) {
      return res.status(403).json({ message: "Access denied" });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Nagłówki zabezpieczające
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": chunksize,
        "Content-Type": "video/mp4",
        "Content-Security-Policy": "default-src 'none'"
      });
      fs.createReadStream(videoPath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
        "Content-Security-Policy": "default-src 'none'"
      });
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (err) {
    console.error("Error streaming video:", err);
    res.status(404).json({ message: "Video not found" });
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
    const { videoId, rating, uuid, resolution } = req.body;

    if (!videoId || typeof rating === "undefined" || !uuid) {
      return res.status(400).json({ message: "Missing data" });
    }

    const ts = new Date().toISOString();
    const connection = await pool.getConnection();

    // Insert rating
    await connection.execute(
      'INSERT INTO ratings (timestamp, videoId, rating, uuid, resolution) VALUES (?, ?, ?, ?, ?)',
      [ts, videoId, Number(rating), uuid, resolution || null]
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
app.use(express.static(path.resolve("./public")));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Using MySQL database');
});

