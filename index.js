// Require necessary modules base on Nodejs 11
const express = require('express');
const request = require('request');
const disk = require('diskusage');
//const { exec } = require('child_process');
const WebSocket = require('ws');
const https = require('https');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Create a new Express app
const app = express();

// Add Basic Authentication middleware to the app
app.use(basicAuth({
  users: { 'userName1': 'password1', // Define user userName1 with password password1
            'userName2': 'password2' }, // Define user userName2 with password password2
  challenge: true // Enable authentication challenge
}));

// Serve static files from the /css directory
app.use(express.static(path.join(__dirname, 'css')));

// Define the directory where downloads will be saved
const downloadDirectory = '/downloads/';

// Create an HTTPS server with SSL certificate and key you can create SSL certificate using OpenSSL or anyother tools
const server = https.createServer({
  key: fs.readFileSync('ssl/server.key'),
  cert: fs.readFileSync('ssl/server.cert')
}, app);

// Start the server and log a message when it's ready
server.listen(53014, () => {
  console.log('Server listening on port 53014');
});

// Create a new WebSocket server using the HTTPS server
const wss = new WebSocket.Server({ server });

// Define routes for the app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});


// Define routes for the actual download process
app.get('/download', (req, res) => {
  const urls = req.query.urls.split(',');
  const downloads = urls.map((url, index) => {
    const localFilename = path.basename(url);
    const downloadLocation = path.join(downloadDirectory, localFilename);
    let receivedBytes = 0;
    let totalBytes = 0;
    return new Promise((resolve, reject) => {
      request(url)
        .on('response', response => {
          totalBytes = parseInt(response.headers['content-length'], 10);
        })
        .on('data', chunk => {
          receivedBytes += chunk.length;
          const progress = (receivedBytes / totalBytes) * 100;
		  
		  // Send a progress update to all connected WebSocket clients
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ index, progress }));
            }
          });
        })
        .pipe(fs.createWriteStream(downloadLocation))
        .on('close', () => {
          resolve(downloadLocation);
        });
    });
  });
  // Wait for all downloads to complete and send the download locations to the client
  Promise.all(downloads).then(downloadLocations => {
    res.send(downloadLocations);
  });
});

// Handle WebSocket connections
wss.on('connection', ws => {
  ws.on('message', message => {
    console.log(`Received message: ${message}`);
  });
});

// Route to get remaining free memory in MB
app.get('/remaining-mem', (req, res) => {
  const freeSpace = os.freemem() / (1024 * 1024);
  const roundedFreeMem = Math.round(freeSpace);
  res.send({ roundedFreeMem });
});

// Route to get remaining free disk space in MB
app.get('/remaining-space', (req, res) => {
  const drive = path.parse(process.cwd()).root;
  disk.check(drive, (err, info) => {
    if (err) {
      console.error(err);
      res.status(500).send({ error: 'Error getting disk usage' });
    } else {
      const freeSpace = info.free / (1024 * 1024);
      const roundedFreeSpace = Math.round(freeSpace);
      res.send({ roundedFreeSpace });
    }
  });
});

/*app.get('/remaining-space', (req, res) => {
	exec('df -h /', (error, stdout, stderr) => {
    if (error) {
      console.error(error);
      res.status(500).send({ error: 'Error getting disk usage' });
    } else {
		const lines = stdout.split('\n');
		const fields = lines[1].split(/\s+/);
      const freeSpace = fields[3];
	  const persent = fields[4];
      res.send({ freeSpace, persent });
    }
  });
});*/