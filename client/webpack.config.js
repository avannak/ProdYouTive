const path = require("path");

const isDevelopment = process.env.NODE_ENV !== "production";

module.exports = {
  mode: isDevelopment ? "development" : "production",
  devtool: isDevelopment ? "inline-source-map" : false,
  entry: {
    background: "./src/background.js",
    contentScript: "./src/contentScript.js",
    popup: "./src/popup.js",
    // Add other entry points as needed
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].bundle.js", // This will create separate bundle files
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
      // CSS loader rule
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
};
