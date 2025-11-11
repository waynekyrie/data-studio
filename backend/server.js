import express from "express";
import cors from "cors";
import { Client } from "ssh2";
import fs from "fs";
import 'dotenv/config'

const app = express();
app.use(cors());

const SSH_CONFIG = {
  host: process.env.SSH_HOST,
  port: 22,
  username: process.env.SSH_USER,
  password: process.env.SSH_PASS, // ⚠️ use env var in real deployment
};

app.get(/^\/data\/lego\/(.*)$/, async (req, res) => {

  const remotePath = `/data/lego/${req.params[0]}`;

  console.log(`Fetching ${remotePath} via SSH...`);

  const conn = new Client();
  let sftp;

  conn
    .on("ready", () => {
      conn.sftp((err, sftpClient) => {
        if (err) {
          res.status(500).json({ error: "SFTP connection failed", details: err.message });
          conn.end();
          return;
        }

        sftp = sftpClient;

        // Check if file exists
        sftp.stat(remotePath, (err, stats) => {
          if (err) {
            res.status(404).json({ error: "File not found", details: err.message });
            conn.end();
            return;
          }

          if (!stats.isFile()) {
            res.status(400).json({ error: "Path is not a file" });
            conn.end();
            return;
          }

          // Stream the file
          const stream = sftp.createReadStream(remotePath);

          // Handle stream errors
          stream.on("error", (err) => {
            if (!res.headersSent) {
              res.status(500).json({ error: "Stream error", details: err.message });
            }
            conn.end();
          });

          // When finished, close the SSH connection
          stream.on("end", () => {
            conn.end();
          });

          // Pipe to client
          stream.pipe(res);
        });
      });
    })
    .on("error", (err) => {
      console.error("SSH connection error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "SSH connection failed", details: err.message });
      }
    })
    .connect(SSH_CONFIG);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));