require("dotenv").config();
const jwt = require("jsonwebtoken");

function generateToken(userId, name) {
  return jwt.sign({ userId, name }, process.env.JWT_SECRET, {
    expiresIn: "5h",
  });
}

// 👇 Generate tokens for testing
console.log("User 1 (server):", generateToken(1, "server"));
console.log("User 2 (gargi):", generateToken(2, "gargi"));
console.log("User 3 (dishant):", generateToken(3, "dishant"));
