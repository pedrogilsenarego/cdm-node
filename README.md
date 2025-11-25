# Node.js SSE Demo

This project is a minimal Node.js server using Express, demonstrating Server-Sent Events (SSE) and a POST trigger endpoint. It simulates a flow where POST requests (as if from Quarkus) trigger SSE events to connected clients (as if to a Next.js frontend).

## Features
- SSE endpoint at `/events` for real-time updates
- POST endpoint at `/trigger` to broadcast events
- Simple HTML client at `/` for testing

## Getting Started

1. Install dependencies:

```powershell
cd node-sse-demo
npm install
```

2. Start the server:

```powershell
npm start
```

3. Open [http://localhost:8787](http://localhost:8787) in your browser to test SSE.

4. Send a POST request to `http://localhost:8787/trigger` with JSON data to broadcast to all connected clients. Example:

```powershell
curl -X POST http://localhost:8787/trigger -H "Content-Type: application/json" -d '{"message":"Hello from Quarkus!"}'
```

## Customization
- Modify `server.js` to adapt endpoints or event logic as needed.

---

This project is for experimentation and can be extended to fit your integration needs.
