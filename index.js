// Author Omid Ghotbi (TAO)

// Require necessary modules base on Nodejs 11
// require dotenv library to use environmental variables

require('dotenv').config();
const express = require('express');
const basicAuth = require('express-basic-auth');
const bodyParser = require('body-parser');
//const WebTorrent = require('webtorrent');
const { exec } = require('child_process');
const WebSocket = require('ws');
const https = require('https');
const axios = require('axios');
const path = require('path');
const os = require('os');
const fs = require('fs');
const Promise = require('bluebird');

// Create a new Express app
const app = express();
app.use(bodyParser.json());

// Retrieve authentication information from environmental variables
const UsersLIST = JSON.parse(process.env.userList);
const PassLIST = JSON.parse(process.env.passList);

const usersObj = UsersLIST.reduce((obj, user, index) => {
  obj[user] = PassLIST[index];
  return obj;
}, {});

// Add Basic Authentication middleware to the app
const auth = basicAuth({
  users: usersObj,
  challenge: process.env.Chalenging_Mthod,
  realm: 'Transload.JS'
});

// Serve static files from the /css and /images directories
app.use(express.static(path.join(__dirname, 'css')));
app.use(express.static(path.join(__dirname, 'images')));

// Define the directory where downloads will be saved
const downloadDirectory = process.env.DownloadDirectory;

// Create an HTTPS server with SSL certificate and key you can create SSL certificate using OpenSSL or anyother tools
// A sample certificate is avilable in /ssl directory change it to your own
const server = https.createServer({
  key: fs.readFileSync(process.env.SSl_Key),
  cert: fs.readFileSync(process.env.SSL_Cert)
}, app);

// Start the server and log a message when it's ready
server.listen(process.env.PORT, () => {
  console.log('Server listening on port ' + process.env.PORT);
});

// Create a new WebSocket server using the HTTPS server
const wss = new WebSocket.Server({ server });

// Define routes for the app
app.get('/', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/contact', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/contact.html'));
});

app.get('/main.js', function(req, res) {
  res.setHeader('Content-Type', 'text/javascript');
  res.sendFile(__dirname + '/public/main.js');
});

// Download Handler
app.get('/download', async (req, res) => {
  const urls = req.query.urls.split(',');
  const downloads = urls.map(async (url, index) => {
    let localFilename = path.basename(url);
    localFilename = localFilename.replace(/(\.[^.]+\?)[\d\W]+$/, '$1').replace(/\?$/, ''); // Remove Symbols 
    const downloadLocation = path.join(downloadDirectory, localFilename);

    let size = 0;
    let totalBytes;

    // Check if the file exists before getting its size
    if (fs.existsSync(downloadLocation)) {
      size = fs.statSync(downloadLocation).size;
    }
	
	// Create an empty file if it doesn't exists
	if (!fs.existsSync(downloadLocation)) {
      fs.writeFileSync(downloadLocation, '');
    }

    // Get totalBytes before entering the while loop
    const responseHead = await axios.head(url);
    totalBytes = parseInt(responseHead.headers['content-length'], 10) + size;

    while (size < totalBytes) {
	  let success = false;
	  while (!success) {
		try {
			const writer = fs.createWriteStream(downloadLocation, { flags: 'a' });
			const response = await axios({
			  url,
			  method: 'GET',
			  responseType: 'stream',
			  headers: { range: `bytes=${size}-` },
			  timeout: 86400000, // Set timeout to 1 day for slow connection
			});

			response.data.on('data', (chunk) => {
			  //console.error('size : ', size , '  totalBytes : ',  totalBytes);
			  size += chunk.length;
			  const progress = ((size / totalBytes) * 100).toFixed(1);
			  // Send a progress update to all connected WebSocket clients
			  wss.clients.forEach(client => {
				if (client.readyState === WebSocket.OPEN) {
				  client.send(JSON.stringify({ index, progress }));
				}
			  });
			});
			
			response.data.on('end', () => {
			  if (size < totalBytes) {
				console.error(`Download interrupted at ${size} bytes. Retrying...`);
				// Wait for a second before retrying
				setTimeout(() => {}, 1000);
			  }
			});
			
			response.data.on('error', (error) => {
			  console.error(`Error occurred while downloading: ${error.message}`);
			  writer.end(); // End the write stream
			  // Wait for a second before retrying
              setTimeout(() => {}, 1000);
			});

			response.data.on('close', () => {
			  console.log('Stream closed');
			});

			response.data.pipe(writer);

			await new Promise((resolve, reject) => {
			  writer.on('finish', resolve);
			  writer.on('error', reject);
			});
		
		success = true; // If the download was successful, exit the retry loop
		} catch (error) {
			console.error(`Download interrupted. Retrying...`);
			// Wait for a minute before retrying
			await new Promise(resolve => setTimeout(resolve, 1000));
			continue; // Continue the while loop to retry the download
		}
	  }
    }
  });

  // Wait for all downloads to complete and send the download locations to the client
  Promise.all(downloads).then(downloadLocations => {
    res.send(downloadLocations);
  }).catch(error => {
    console.log(error);
  });
});

// Handle Torrent download if you want to use it consider to update to newer version
function downloadTorrents(magnetURI, wss) {
  return new Promise((resolve, reject) => {
    const torrent = client.add(magnetURI, { path: downloadDirectory }, torrent => {
      const file = torrent.files[0];
      const downloadLocation = path.join(downloadDirectory, file.path);

      let receivedBytes = 0;
      let totalBytes = file.length;
      let lastProgress = -1;

      const intervalId = setInterval(() => {
        const progress = Math.floor((receivedBytes / totalBytes) * 100);
        if (progress !== lastProgress) {
          // Send a progress update to all connected WebSocket clients
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ progress }));
            }
          });
          lastProgress = progress;
        }
      }, 1000);

      // Create Read Stream
      file.createReadStream()
        .on('data', chunk => {
          receivedBytes += chunk.length;
        })
        .pipe(fs.createWriteStream(downloadLocation))
        .on('close', () => {
          clearInterval(intervalId);
          resolve(downloadLocation);
        }).on('error', error => {
          clearInterval(intervalId);
          reject(error);
        });
    });
  });
}

// Handle WebSocket connections
wss.on('connection', ws => {
  ws.on('message', message => {
    console.log(`Received message: ${message}`);
  });
});

// Define a route to delete file from a given name
app.get('/delete-file', (req, res) => {
  const fileName = req.query.fileName;
  if (!fileName) {
    res.status(400).send('Missing fileName parameter');
    return;
  }

  // Get the file path
  const filePath = path.join(downloadDirectory, fileName);

  // Delete the file
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error deleting file');
      return;
    }
    res.send('File deleted successfully');
  });
});

// Define a route to delete multiple files from a given names
app.post('/delete-files', (req, res) => {
  // Get the names from the query parameter
  const files = req.body.files;
  if (!files || !Array.isArray(files)) {
    res.status(400).json({ message: 'Missing or invalid files parameter' });
    return;
  }

  const deletedFiles = [];
  const failedFiles = [];
  
  files.forEach((fileName) => {
	// Get the file path
    const filePath = path.join(downloadDirectory, fileName);
	// Delete the file
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(err);
        failedFiles.push(fileName);
      } else {
        deletedFiles.push(fileName);
      }
    });
  });

  res.json({ deletedFiles, failedFiles });
});

// Define a route to get all file names in a given path
app.get("/files", (req, res) => {
  // Get the path from the query parameter
  let folder_path = downloadDirectory;

  // Check if the path is valid
  if (folder_path) {
    // Resolve the absolute path
    folder_path = path.resolve(folder_path);

    // Read the file names in the folder
    fs.readdir(folder_path, (err, files) => {
      if (err) {
        // Handle error
        res.status(500).send("Server error");
      } else {
        // Send file names as JSON data
        res.json(files);
      }
    });
  } else {
    // Handle missing path
    res.status(400).send("Missing path parameter");
  }
});

app.get('/file-size', (req, res) => {
  // Get the file name from the query parameter
  const fileName = req.query.file;
  if (!fileName) {
    res.status(400).send('Missing file parameter');
    return;
  }

  // Get the path from the query parameter
  const filePath = path.join(downloadDirectory, fileName);

  fs.stat(filePath, (err, stats) => {
  if (err) {
	// Handle error
	console.error(err);
	res.status(500).send('Error getting file size');
	return;
  }
	
  const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  // Send file size in MB as JSON data
  res.send(fileSizeInMB + ' MB');
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
});