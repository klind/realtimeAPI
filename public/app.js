let audioContext;
let audioInput;
let processor;
let websocket;

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        audioContext = new AudioContext({
            sampleRate: 16000
        });

        await audioContext.audioWorklet.addModule('audioProcessor.js');
        
        audioInput = audioContext.createMediaStreamSource(stream);
        processor = new AudioWorkletNode(audioContext, 'audio-processor');
        
        processor.port.onmessage = (e) => {
            if (websocket?.readyState === WebSocket.OPEN) {
                if (e.data.type === 'audio') {
                    console.log('Speech detected, sending audio data');
                    //console.log('data type:', typeof e.data.buffer);
                    websocket.send(e.data.buffer);
                }
            }
        };

        audioInput.connect(processor);
        processor.connect(audioContext.destination);

        // Connect to our server's WebSocket
        websocket = new WebSocket(`ws://${window.location.host}`);

        websocket.onopen = () => {
            console.log('Connected to server');
        };

        websocket.onmessage = (event) => {
            try {
                console.log('Received message:', event.data); // Debug log
                const data = JSON.parse(event.data);
                if (data.text) {
                    console.log('Updating summary with:', data.text); // Debug log
                    updateSummary(data.text);
                }
                if (data.error) {
                    console.error('Server error:', data.error);
                    alert(data.error);
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        document.getElementById('startButton').disabled = true;
        document.getElementById('stopButton').disabled = false;
    } catch (error) {
        console.error('Error starting recording:', error);
        alert('Error starting recording: ' + error.message);
    }
}

function stopRecording() {
    fetch('/commit', {
        method: 'POST', // Use POST to send data to your backend
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: 'Recording stopped',  // Optional data to send to backend
            timestamp: new Date().toISOString()  // Optional timestamp or any other relevant data
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Backend response:', data);
    })
    .catch(error => {
        console.error('Error calling commit endpoint:', error);
    });


    // if (websocket) {
    //     websocket.close();
    // }
    // if (audioContext) {
    //     audioContext.close();
    // }
    // if (processor) {
    //     processor.disconnect();
    // }
    // if (audioInput) {
    //     audioInput.disconnect();
    // }

    document.getElementById('startButton').disabled = false;
    document.getElementById('stopButton').disabled = true;
}

function updateSummary(text) {
    const summaryPoints = document.getElementById('summaryPoints');
    // Clear existing points
    while (summaryPoints.firstChild) {
         summaryPoints.removeChild(summaryPoints.firstChild);
    }
    
    // Split text into bullet points and add each one
    const points = text.split('\n');
    points.forEach(point => {
        if (point.trim()) {
            const li = document.createElement('li');
            li.textContent = point.trim();
            summaryPoints.appendChild(li);
        }
    });
}

document.getElementById('startButton').addEventListener('click', startRecording);
document.getElementById('stopButton').addEventListener('click', stopRecording); 