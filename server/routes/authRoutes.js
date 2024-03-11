const { authenticateUser } = require("../utils/authentication");
// Redirect users to Google's OAuth 2.0 server
const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

// OAuth Routes
const getAuth = (req, res) => {
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "select_account",
  });
  res.redirect(authUrl);
};

// Handle the OAuth 2.0 server response
const getAuthCallBack = async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Get user information from Google
    const oauth2 = google.oauth2({
      auth: client,
      version: "v2",
    });
    const userInfo = await oauth2.userinfo.get();
    const userId = userInfo.data.id; // or userInfo.data.email

    // Store userId in session
    req.session.userId = userId;

    res.send("Authentication successful! You can now close this window.");
  } catch (error) {
    console.error("Error during OAuth callback:", error);
    res.status(500).send("Authentication failed");
  }
};

const onLogin = async (req, res) => {
  try {
    const { token } = req.body;
    const userInfo = await authenticateUser(token);

    if (userInfo) {
      // Set user information in session
      req.session.userId = userInfo.id; // or any other identifier you prefer
      res.json({ message: "Login successful", userId: userInfo.id });
    } else {
      res.status(401).send({ message: "Authentication failed" });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send({ message: "Internal server error" });
  }
};

const onLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Could not log out, please try again");
    }
    res.redirect("/"); // or to any other route
  });
};

module.exports = {
  getAuth,
  getAuthCallBack,
  onLogin,
  onLogout,
};
