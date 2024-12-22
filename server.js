import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static("public"));
app.use(express.json());

// Create HTTP server separately
import { createServer } from "http";
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Store active connections
const connections = new Map();
var openaiWs;
const generateUuid = () => {
  return uuidv4(); // Generates a random UUID (v4)
};

// Handle WebSocket connections
wss.on("connection", function connection(ws, req) {
  const id = Date.now();
  connections.set(id, ws);

  openaiWs = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
    {
      headers: {
        Authorization: "Bearer " + process.env.OPENAI_API_KEY,
        "Content-Type": "application/json",
        "openai-beta": "realtime=v1",
      },
      data: {
        modalities: ["audio", "text"],
        instructions: "You are a friendly assistant.",
        turn_detection: "server_vad"
      },
    }
  );

  openaiWs.on("open", () => {
    console.log("Connected to OpenAI");
    // Initialize session with speech recognition mode
    openaiWs.send(
      JSON.stringify({
        type: "session.update",
        data: {
          mode: "speech_recognition",
        },
      })
    );
  });

  let sessionId = null;

  openaiWs.on("message", (data) => {
    try {
      console.log("\nReceived from OpenAI:", data.toString());

      const response = JSON.parse(data.toString());
      console.log("\nresponse type ", response.type);

      if (response.type === "session.created") {
        sessionId = response.session.id;
        console.log("\nSession ID:", sessionId);
      }

      if (response.type === "speech.final") {
        const formattedText = `• ${response.text}`;
        console.log("\nSending to client:", formattedText);
        ws.send(JSON.stringify({ text: formattedText }));
      } else {
        const formattedText = `• ${response.text}`;
        console.log("\nSending to client:", formattedText);
        ws.send(JSON.stringify({ text: formattedText }));
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  ws.on("message", (data) => {
    // console.log("data.data ", data.data);
    // console.log("data.Buffer ", data.buffer.type);
    // console.log("data ", data);
    // console.log([...data]); // Logs the raw byte data as an array of numbers (each byte as a value)
    // console.log(data.toString("hex"));
    let byteArray = [...data]; // Convert the buffer to an array of bytes
    const bufferData = Buffer.from(byteArray);
    const base64AudioData = bufferData.toString("base64");
    //console.log(byteArray);     // Logs the array

    if (openaiWs.readyState === WebSocket.OPEN && sessionId) {
      //console.log("\nReceived data type:", typeof data);
      //console.log("\nData buffer type:", data.buffer instanceof ArrayBuffer);
      //const base64Audio = arrayBufferToBase64(data.buffer);
      //const base64Audio = arrayBufferToBase64(data);

      //if (typeof data.data !== "undefined") {
      // Convert audio array into a Buffer of PCM16 data (little-endian format)
      //const buffer = Buffer.alloc(data.data.length * 2); // 2 bytes per sample (16-bit)

      // Fill the buffer with audio samples
      // audioArray.forEach((sample, index) => {
      //   // Convert to signed 16-bit (little-endian) and store in the buffer
      //   buffer.writeInt16LE(sample, index * 2);
      // });

      const uuid = generateUuid();
      //console.log("\nUUID " + uuid);
      const json = JSON.stringify({
        type: "input_audio_buffer.append",
        audio: base64AudioData,
        event_id: uuid,
      });

      console.log("\nSending data to api ", json);
      openaiWs.send(json);

      const responseCreate = JSON.stringify({
        type: "response.create",
        event_id: uuid,
      });

     openaiWs.send(responseCreate);

      //}
    }
  });

  ws.on("close", () => {
    openaiWs.close();
    connections.delete(id);
  });


  openaiWs.on("error", (error) => {
    console.error("OpenAI WebSocket error:", error);
    ws.send(JSON.stringify({ error: "OpenAI connection error" }));
  });
});

app.post('/commit', (req, res) => {
    const commit = JSON.stringify({
        type: "input_audio_buffer.commit",
        event_id: "",
      });
     openaiWs.send(commit);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});
