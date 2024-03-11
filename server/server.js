require("dotenv").config({ path: "./config/.env" });
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const { google } = require("googleapis");
const { MongoClient, ServerApiVersion } = require("mongodb");

const authRoutes = require("./routes/authRoutes");
const app = express();

// Parse JSON bodies (as sent by API clients)
app.use(bodyParser.json());

const port = 3000;

// Setup MongoDB client
const uri = process.env.MONGODB_URI;
const mongoClient = new MongoClient(uri);

let connectionAttempts = 0;
const maxAttempts = 5;

// Connect to MongoDB
async function startServer() {
  try {
    // Connect to MongoDB with retry
    await connectWithRetry();
    console.log("Connected successfully to MongoDB");
    const db = mongoClient.db(process.env.MONGODB_DB_NAME); // Replace with your DB name

    // Initialize the YouTube API client
    const youtube = google.youtube({
      version: "v3",
      auth: process.env.YOUTUBE_API_KEY,
    });

    // Use session middleware
    app.use(
      session({
        secret: process.env.SESSION_SECRET || "default-secret", // Use an environment variable for production
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false }, // Set to true if using https
      })
    );

    // Define routes
    app.get("/", (req, res) => {
      res.send("Hello World!");
    });

    // MongoDB Routes

    // Save User Watch Data
    app.post("/save-watch-data", async (req, res) => {
      try {
        const collection = db.collection("ProdYouTiveDB");
        const { userId, watchData } = req.body;

        if (!userId) {
          return res.status(400).send("UserId is missing in the request body");
        }

        // Include the current timestamp as lastUpdated
        const updatedWatchData = {
          ...watchData,
          lastUpdated: new Date().toISOString(),
        };

        // Save or update the watch data for the user
        const result = await collection.updateOne(
          { userId: userId },
          { $set: { watchData: updatedWatchData } },
          { upsert: true }
        );

        console.log("Watch data saved or updated for userId:", userId); // Log the userId
        console.log("Saved or Updated Data:", updatedWatchData); // Log the data being saved or updated
        res.json({ message: "Watch data saved successfully", result: result });
      } catch (error) {
        console.error("Error in /save-watch-data:", error);
        res.status(500).send("Error saving watch data");
      }
    });

    // Get User Watch Data By User ID
    app.get("/get-watch-data/:userId", async (req, res) => {
      try {
        const collection = db.collection("ProdYouTiveDB");
        const userId = req.params.userId;

        const data = await collection.findOne({ userId: userId });
        if (data) {
          res.json(data.watchData);
        } else {
          res.status(404).send("User data not found");
        }
      } catch (error) {
        console.error("Error in /get-watch-data:", error);
        res.status(500).send("Error fetching watch data");
      }
    });

    // Route to get the server's current timestamp
    app.get("/get-server-timestamp/:userId", async (req, res) => {
      try {
        // Check if there's user data and provide appropriate timestamp
        const userId = req.params.userId;
        const userData = await db
          .collection("ProdYouTiveDB")
          .findOne({ userId: userId });

        if (userData && userData.watchData) {
          res.json({ timestamp: userData.watchData.lastUpdated });
        } else {
          res.json({ timestamp: null }); // or a default timestamp
        }
      } catch (error) {
        console.error("Error in /get-server-timestamp:", error);
        res.status(500).send("Error fetching server timestamp");
      }
    });

    // Redirect users to Google's OAuth 2.0 server
    // Use authRoutes
    app.get("/auth", authRoutes.getAuth);
    app.get("/oauth2callback", authRoutes.getAuthCallBack);
    app.post("/login", authRoutes.onLogin);
    app.get("/logout", authRoutes.onLogout);

    // Function to get a list of videos
    async function getVideos(keyword) {
      try {
        const response = youtube.search.list({
          part: "snippet",
          q: keyword,
          maxResults: 10,
        });

        console.log(response); // Log the response here

        return response.data.items.map((item) => {
          // Extract the necessary information from each item
          return {
            title: item.snippet.title,
            description: item.snippet.description,
            // Add other details you need from the item
          };
        });
      } catch (error) {
        console.error("Error making YouTube API request:", error);
        throw error;
      }
    }

    // Route to test getting videos
    app.get("/videos", async (req, res) => {
      try {
        const videos = await getVideos("Node.js");
        res.json(videos);
      } catch (error) {
        res.status(500).send("Error fetching videos");
      }
    });

    // Start the server
    app.listen(port, () => {
      console.log(`Server listening at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1); // Exit the process in case of connection error
  }
}

// Connect to MongoDB with retry logic
async function connectWithRetry() {
  try {
    await mongoClient.connect();
    console.log("Connected successfully to MongoDB after retry");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    connectionAttempts++;
    if (connectionAttempts < maxAttempts) {
      console.log(`Retrying MongoDB connection: Attempt ${connectionAttempts}`);
      setTimeout(connectWithRetry, 5000); // Retry after 5 seconds
    } else {
      console.error("Max MongoDB connection attempts reached. Exiting.");
      throw error;
    }
  }
}

startServer();
