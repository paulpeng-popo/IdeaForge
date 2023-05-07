let record = document.getElementById('record');
let audio = document.querySelector('audio');
let canvas = document.getElementById('canvas');
let context = canvas.getContext('2d');
let mediaRecorder;
let chunks = [];
let isRecording = false;

record.onclick = function () {
    if (isRecording) {
        mediaRecorder.stop();
        record.textContent = '錄音';
        isRecording = false;
    } else {
        navigator.mediaDevices.getUserMedia({
            audio: true, video: false
        }).then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = e => {
                let blob = new Blob(chunks, {
                    type: 'audio/wav; codecs=MS_PCM'
                });
                chunks = [];
                let audioURL = URL.createObjectURL(blob);
                audio.src = audioURL;
                upload(blob);
            };
            mediaRecorder.start();
            record.textContent = '停止';
            isRecording = true;
        }).catch(console.error);
    }
}

audio.onplay = function () {
    let audioContext = new AudioContext();
    let analyser = audioContext.createAnalyser();
    try {
        let source = audioContext.createMediaElementSource(audio);
        source.connect(analyser);
    } catch (e) {
        // pass
    }
    analyser.connect(audioContext.destination);
    analyser.fftSize = 256;
    let bufferLength = analyser.frequencyBinCount;
    let dataArray = new Uint8Array(bufferLength);
    let WIDTH = canvas.width;
    let HEIGHT = canvas.height;
    let barWidth = (WIDTH / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    function renderFrame() {
        requestAnimationFrame(renderFrame);
        x = 0;
        analyser.getByteFrequencyData(dataArray);
        context.fillStyle = '#000000';
        context.fillRect(0, 0, WIDTH, HEIGHT);
        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i];
            let r = barHeight + (25 * (i / bufferLength));
            let g = 250 * (i / bufferLength);
            let b = 50;
            context.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
            context.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }
    renderFrame();
    // console.log('audio onplay');
}

audio.onpause = function () {
    context.clearRect(0, 0, canvas.width, canvas.height);
    // console.log('audio onpause');
}

audio.onended = function () {
    context.clearRect(0, 0, canvas.width, canvas.height);
    // console.log('audio onended');
}

function upload(blob) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/recog');
    xhr.onload = function () {
        if (xhr.status === 200) {
            // pass
        } else {
            alert('錯誤！請重新錄音');
        }
    };
    xhr.send(blob);
}
