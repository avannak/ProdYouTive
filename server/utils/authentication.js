const fs = require("fs");
const { google } = require("googleapis");
// Google OAuth2 client setup
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const credentials = JSON.parse(fs.readFileSync(credentialsPath)).installed;
const client = new google.auth.OAuth2(
  credentials.client_id,
  "", // Client secret isn't used for Chrome Extension OAuth
  process.env.REDIRECT_URI // Replace with actual redirect URI
);

// Authenticate User function
async function authenticateUser(token) {
  try {
    // Set the credentials for your OAuth2 client
    client.setCredentials({ access_token: token });

    // Get user information from Google
    const oauth2 = google.oauth2({
      auth: client,
      version: "v2",
    });
    const userInfo = await oauth2.userinfo.get();

    if (userInfo && userInfo.data) {
      // Here userInfo.data will contain user details
      return userInfo.data;
    } else {
      throw new Error("Failed to fetch user information");
    }
  } catch (error) {
    console.error("Error during authentication:", error);
    throw error;
  }
}

module.exports = { authenticateUser };
