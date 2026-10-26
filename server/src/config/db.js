const mongoose = require('mongoose');

// Connects once at startup; a failure is thrown to index.js, which stops the process
const connectDB = async (uri) => {
  const conn = await mongoose.connect(uri);
  console.log(`MongoDB connected: ${conn.connection.host}`);
  return conn;
};

const disconnectDB = () => mongoose.connection.close();

module.exports = { connectDB, disconnectDB };
