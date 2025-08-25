let baseUrl;

let client = {
    username: '',
    connected: false,
    ready: false,
    allowPlay: false, // true when server is causing the next video.play()
    allowPause: false, // true when the server is causing the next video.pause()
    check: false // whether to constantly poll the server for the playback data
};

window.onload = onLoad;
window.onbeforeunload = disconnect;

function onLoad() {
    const serverUrlBtn = document.getElementById('server-url-btn');
    serverUrlBtn.addEventListener('click', handleServerUrl);

    const serverUrlInput = document.getElementById('server-url-input');
    serverUrlInput.addEventListener('keydown', (event) => {
        if (event.key == 'Enter') handleServerUrl();
    });

    const usernameBtn = document.getElementById('username-btn');
    usernameBtn.addEventListener('click', handleUsername);

    const usernameInput = document.getElementById('username-input');
    usernameInput.addEventListener('keydown', (event) => {
        if (event.key == 'Enter') handleUsername();
    });

    const chooseVideoBtn = document.getElementById('video-choose-btn');
    chooseVideoBtn.addEventListener('click', handleVideoChoose);
}

function handleServerUrl() {
    const inputElement = document.getElementById('server-url-input');
    const url = inputElement.value.trim();

    // check if url is empty
    if (url == '') {
        const label = document.getElementById('server-url-label');
        label.innerText = 'URL is empty!';
        label.classList.replace('info', 'error');
        return;
    }

    // set global url
    baseUrl = url;

    // hide server url UI
    document.getElementById('server-url-container').classList.add('invisible');

    // show username UI
    document.getElementById('username-container').classList.remove('invisible');
}

function handleUsername() {
    const inputElement = document.getElementById('username-input');
    const name = inputElement.value.trim();

    // empty username
    if (name.length == 0) {
        const label = document.getElementById('username-label');
        label.innerText = 'Username cannot be empty!';
        label.classList.replace('info', 'error');
        return;
    }

    // set global username
    client.username = name;

    // hide elements related to username input
    document.getElementById('username-container').classList.add('invisible');

    // show elements related to choosing the video
    document
        .getElementById('video-choose-container')
        .classList.remove('invisible');
}

async function handleVideoChoose() {
    const inputElement = document.getElementById('video-choose-input');
    const file = inputElement.files[0];

    // not a video file
    if (
        !file.name.endsWith('.mp4') &&
        !file.name.endsWith('.ogg') &&
        !file.name.endsWith('.webm')
    ) {
        const label = document.getElementById('video-choose-label');
        label.innerText = 'Not a supported video format!';
        label.classList.replace('info', 'error');

        return;
    }

    // hide elements related to video input
    document
        .getElementById('video-choose-container')
        .classList.add('invisible');

    // show elements related playing the video and connecting to server
    document.getElementById('playback-container').classList.remove('invisible');

    setupVideo(file);
    await connectToServer();
}

function setupVideo(file) {
    const url = URL.createObjectURL(file);
    const video = document.getElementById('playback');

    var reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        video.src = url;
        video.pause();
    };

    video.addEventListener('play', handleVideoPlay);
    video.addEventListener('pause', handleVideoPause);
}

async function connectToServer() {
    updateConnectStatus('Connecting...');

    const url = new URL(baseUrl + '/join');
    url.searchParams.set('username', client.username);

    const response = await fetch(url);

    if (response.status != 200) {
        // handle failed request
    }

    const json = await response.json();
    client.id = json.id;

    updateConnectStatus('Connected');
    client.connected = true;
}

async function setPauseStatus() {
    if (!client.connected) {
        return;
    }

    const url = new URL(baseUrl + '/pause');
    url.searchParams.set('id', client.id);

    const response = await fetch(url);

    if (response.status != 200) {
        // handle failed request
    }

    client.ready = false;
    client.allowPlay = false;
}

async function setReadyStatus() {
    if (!client.connected) {
        return;
    }

    const video = document.getElementById('playback');
    const videoTime = video.currentTime;

    const url = new URL(baseUrl + '/ready');
    url.searchParams.set('id', client.id);
    url.searchParams.set('videoTime', videoTime);

    const response = await fetch(url);

    if (response.status != 200) {
        // handle failed request
    }

    client.ready = true;
    startCheck();
}

async function handleVideoPlay() {
    if (client.allowPlay) {
        client.allowPlay = false;
        return;
    }

    pauseVideo();
    if (client.ready) {
        return;
    }

    if (!client.allowPlay) {
        await setReadyStatus();
    }
}

async function handleVideoPause() {
    await updateVideoTime();

    // check for server issued pause
    if (client.allowPause) {
        client.allowPause = false;
        return;
    }

    // user issued pause
    await setPauseStatus();
}

async function updateVideoTime() {
    const video = document.getElementById('playback');
    const videoTime = video.currentTime;

    const url = new URL(baseUrl + '/time');

    url.searchParams.set('id', client.id);
    url.searchParams.set('videoTime', videoTime);

    const response = await fetch(url);
    if (response.status != 200) {
        // handle failed request
    }
}

function updateConnectStatus(newStatus) {
    const connectionStatusElement =
        document.getElementById('connection-status');
    connectionStatusElement.innerText = 'Connection status: ' + newStatus;
}

async function startCheck() {
    client.check = true;
    await check();
}

async function check() {
    const url = new URL(baseUrl + '/check');
    const response = await fetch(url);
    const data = await response.json();

    updateUserList(data.clients);

    if (data.playback.status == 'playing') {
        const playTime = data.playback.playTime;
        const now = Date.now();
        const waitTime = playTime - now;
        setTimeout(() => playVideo(data.playback.videoTime), waitTime);
    }

    if (data.playback.status == 'paused') {
        pauseVideo();
    }

    if (!client.check) {
        return;
    }

    setTimeout(check, 3000);
}

function updateUserList(users) {
    const userListElement = document.getElementById('user-list');
    userListElement.innerHTML = ''; // clear all children

    users.forEach((user) => {
        const userInfoElement = document.createElement('div');
        userInfoElement.classList.add('user-info');

        const usernameElement = document.createElement('p');
        usernameElement.classList.add('username');
        usernameElement.innerText = user.username;

        const statusElement = document.createElement('p');
        statusElement.classList.add('status');
        statusElement.innerText = user.status;
        userInfoElement.appendChild(usernameElement);
        userInfoElement.appendChild(statusElement);
        userListElement.appendChild(userInfoElement);
    });
}

function playVideo(videoTime) {
    const video = document.getElementById('playback');

    // video already playing
    if (video.currentTime > 0 && !video.paused && !video.ended) {
        return;
    }

    console.log(`set time to: ${videoTime}`);
    video.currentTime = videoTime;

    client.allowPlay = true;
    video.play();
}

function pauseVideo() {
    const video = document.getElementById('playback');

    // video already paused
    if (video.paused) {
        return;
    }

    client.allowPause = true;
    video.pause();
}

async function disconnect() {
    const url = new URL(baseUrl + '/leave');

    url.searchParams.set('id', client.id);

    const response = await fetch(url);

    if (response.status != 200) {
        // handle bad request
    }
}
