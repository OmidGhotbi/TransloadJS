// Create a new WebSocket connection to the current host using the wss protocol
const ws = new WebSocket(`wss://${location.host}`);

// When a message is received on the WebSocket connection
ws.onmessage = event => {
	const data = JSON.parse(event.data);
	//console.log(data);
	if (data.index !== undefined && data.progress) {
		document.getElementById(`progress-bar-${data.index}`).style.width = data.progress + '%';
	}
};
  
const lastUpdatedTime = []; // array to keep track of the last time progress bar was updated
document.getElementById('download-form').addEventListener('submit', function(event) {
	event.preventDefault();
	var urls = document.getElementById('urls').value.split('\n');
	urls = urls.filter(url => url.trim() !== '');

	// Create progress bars immediately after form is submitted
	const progressBarsContainer = document.getElementById('progress-bars');
	progressBarsContainer.innerHTML = '';
	urls.forEach((url, index) => {
		const progressBarContainer = document.createElement('div');
		progressBarContainer.className = 'progress-bar-container';
		const progressBar = document.createElement('div');
		progressBar.className = 'progress-bar';
		progressBar.id = `progress-bar-${index}`;
		progressBar.style.width = '0%';
		progressBarContainer.appendChild(progressBar);
		progressBarsContainer.appendChild(progressBarContainer);
		lastUpdatedTime[index] = Date.now();
	});
  
	document.querySelector('.torrent-button').addEventListener('click', function() {
		console.log('-------------------------');
		var urls = document.getElementById('urls').value.split('\n');
		urls = urls.filter(url => url.trim() !== '');
		// Call a function to handle torrent download
		const progressBarsContainer = document.getElementById('progress-bars');
		progressBarsContainer.innerHTML = '';
		const progressBarContainer = document.createElement('div');
		progressBarContainer.className = 'progress-bar-container';
		const progressBar = document.createElement('div');
		progressBar.className = 'progress-bar';
		progressBar.style.width = '0%';
		progressBar.id = `progress-bar-1`;
		progressBarContainer.appendChild(progressBar);
		progressBarsContainer.appendChild(progressBarContainer);
		downloadTorrents(urls);
	});

  fetch('/download?urls=' + encodeURIComponent(urls.join(',')))
  .then(response => response.json())
  .then(downloadLocations => {
	// Display download locations after files have been downloaded
	const downloadLocationsContainer = document.createElement('div');
	downloadLocationsContainer.innerHTML = '<h2>New Downloads:</h2>';
	downloadLocations.forEach(downloadLocation => {
		const downloadLocationElement = document.createElement('a');
		downloadLocation = downloadLocation.replace('/home/dirin/public_html/TAOPHP/files/', '');
		downloadLocationElement.textContent = downloadLocation;
		downloadLocationElement.href = 'https://46.224.2.247/TAOPHP/files/' + downloadLocation;
		downloadLocationElement.download = ''; // Add the download attribute
		downloadLocationsContainer.appendChild(downloadLocationElement);
		// Add delete button
		const deleteButton = document.createElement('button');
		deleteButton.textContent = 'Delete';
		deleteButton.style.marginLeft = '10px';
		deleteButton.addEventListener('click', () => {
		// and 'fileName' with the name of the file to delete
			fetch('/delete-file?fileName=' + encodeURIComponent(downloadLocation))
			.then(response => {
				if (response.ok) {
				deleteButton.textContent = 'Removed';
				} else {
				deleteButton.textContent = 'Error';
				}
			});
		});
		downloadLocationsContainer.appendChild(deleteButton);
		// Add a line break after each a element
		const lineBreak = document.createElement('br');
		downloadLocationsContainer.appendChild(lineBreak);
	});
	progressBarsContainer.appendChild(downloadLocationsContainer);

	// Update remain Disk space
	fetch('/remaining-space')
	.then(response => response.json())
	.then(data => {
		const freeSpace = data.freeSpace;
		const persent = data.persent;
		document.getElementById(`freeSpaceLabel`).innerHTML = `Avilable Disk Space: <b>${freeSpace}</b>b ~ <b>${persent}</b> has been used`;
		const persntage = persent.replace('%', '');
		updateProgressBar(persntage);
	});

	// Update remain memory
	fetch('/remaining-mem')
	.then(response => response.json())
	.then(data => {
	  const freeMem = data.roundedFreeMem;
	  document.getElementById(`freeMemLabel`).innerHTML = `Avilable Memory: <b>${freeMem}</b> Mb`;
	});

  });
});

// Update remain Disk space
fetch('/remaining-space')
.then(response => response.json())
.then(data => {
	const freeSpace = data.freeSpace;
	const persent = data.persent;
	const freeSpaceLabel = document.createElement('div');
	freeSpaceLabel.id = `freeSpaceLabel`;
	freeSpaceLabel.innerHTML = `Avilable Disk Space: <b>${freeSpace}</b>b ~ <b>${persent}</b> has been used`;
	freeSpaceLabel.style.textAlign = 'center';
	freeSpaceLabel.style.marginBottom = '10px';
	document.body.appendChild(freeSpaceLabel);
  
	// Add progress bar container after freeSpaceLabel
	const spaceProgressBarContainer = document.createElement('div');
	spaceProgressBarContainer.id = 'spaceProgressBarContainer';
	spaceProgressBarContainer.innerHTML = '<div id="spaceProgressBar"></div>';
	document.body.appendChild(spaceProgressBarContainer);

	const persntage = persent.replace('%', '');
	updateProgressBar(persntage);
});

// Update remain memory
fetch('/remaining-mem')
.then(response => response.json())
.then(data => {
	const freeMem = data.roundedFreeMem;
	const freeSpaceLabel = document.createElement('div');
	freeSpaceLabel.id = `freeMemLabel`;
	freeSpaceLabel.innerHTML = `Avilable Memory: <b>${freeMem}</b> Mb`;
	freeSpaceLabel.style.textAlign = 'center';
	freeSpaceLabel.style.marginBottom = '10px';
	document.body.appendChild(freeSpaceLabel);
});

// Update ProgressBars
function updateProgressBar(percentage) {
	const progressBar = document.getElementById('spaceProgressBar');
	progressBar.style.width = percentage + '%';


	// Update ProgressBars color base on percentage
	if (percentage > 90) {
	progressBar.style.backgroundColor = 'red';
	} else if (percentage > 70) {
	progressBar.style.backgroundColor = 'yellow';
	} else {
	progressBar.style.backgroundColor = 'green';
	}
}

// Update ProgressBars
function updateTorrentProgress(progress) {
	const progressBar = document.getElementById('progress-bar-1');
	progressBar.style.width = `${progress}%`;
}

// Fetch And Display Files
fetchAndDisplayFiles();

// Define a function to fetch and display file names from a given path
function fetchAndDisplayFiles() {
	const filesList = document.getElementById("files");
	// Clear the previous file names
	filesList.innerHTML = '<h2>Exist Files:</h2>';

	// Fetch file names from the server with path as query parameter
	fetch(`/files`)
	.then((res) => res.json()) // Parse JSON data
	.then((files) => {
		// Loop through each file name
		files.forEach((file) => {
		if (file != '.htaccess') {
		// Create a list item element for each file name
		const item = document.createElement("li");
		// Create a link element for each file name
		const link = document.createElement("a");
		// Set the href attribute to point to the file URL
		link.href = `https://46.224.2.247/TAOPHP/files/${file}`;
		// Set the text content to show the file name
		link.textContent = file;
		// Append the link to the list item
		item.appendChild(link);
		// Append the item to the list
		filesList.appendChild(item);
		}
		});
	})
	.catch((err) => {
		// Handle error
		console.error(err);
	});
}