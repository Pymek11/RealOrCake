import express, { json } from "express";
import path from "path";
import { readdirSync, appendFileSync, mkdirSync } from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(json());

// Serve a list of videos from the ./videos directory
app.get("/api/videos", (req, res) => {
  try {
    const videosDir = path.resolve("./videos");

    // recursively walk the videos directory and collect files
    function walkDir(dir) {
      let results = [];
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          results = results.concat(walkDir(full));
        } else if (ent.isFile()) {
          // accept common video extensions
          if (/\.(mp4|webm|ogg|mov)$/i.test(ent.name)) {
            // return path relative to videosDir, use forward slashes for client
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
      // if videos directory doesn't exist or is empty, return empty list
      console.error("Error walking videos directory:", err);
      return res.json([]);
    }

    // shuffle files so clients get a random order without repeats
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

// Receive rating for a video and append to data/rating.log
app.post("/api/rate", (req, res) => {
  // Accept rating submissions that may also include a certainty (1-5) and a userId
  const { videoId, rating, certainty, userId } = req.body;
  if (!videoId || typeof rating === "undefined") {
    return res.status(400).json({ message: "Missing data" });
  }

  try {
    mkdirSync("./data", { recursive: true });
    // Build a flexible log line so we can record certainty and optionally userId
    const parts = [`${new Date().toISOString()}`, `Video: ${videoId}`, `Rating: ${rating}`];
    if (typeof certainty !== 'undefined') parts.push(`Certainty: ${certainty}`);
    if (userId) parts.push(`User: ${userId}`);
    const logLine = parts.join(' | ') + '\n';
    appendFileSync("./data/rating.log", logLine);
    res.json({ message: "Rating saved" });
  } catch (err) {
    console.error("Error saving rating:", err);
    res.status(500).json({ message: "Unable to save rating" });
  }
});

// Serve static files (index.html, css, js, videos)
app.use(express.static(path.resolve(".")));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
