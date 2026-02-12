const express = require("express");
const cors = require("cors");
const https = require("https");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json());

// Fetch response from Microcks API
async function fetchFromMicrocks(sessionIdType, sessionId, requestId) {
  return new Promise((resolve, reject) => {
    const url = `https://microcks.devops.ama.lan/rest/ID-Gov-PT-SAML-Runtime/1.0.0/saml/auth_session?sessionIdType=${encodeURIComponent(
      sessionIdType,
    )}`;

    const options = {
      method: "GET",
      headers: {
        Accept: "application/json",
        SessionId: sessionId,
        "X-RequestID": requestId,
      },
      rejectUnauthorized: false, // Equivalent to --insecure
    };

    https
      .get(url, options, (res) => {
        let data = "";

        console.log(`📥 Response status: ${res.statusCode}`);
        console.log(`📥 Response headers:`, res.headers);

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          console.log(
            `📥 Raw response (first 200 chars):`,
            data.substring(0, 200),
          );

          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (err) {
            console.error(
              `❌ Failed to parse response:`,
              data.substring(0, 500),
            );
            reject(
              new Error(
                `Failed to parse JSON: ${
                  err.message
                }. Response was: ${data.substring(0, 100)}`,
              ),
            );
          }
        });
      })
      .on("error", (err) => {
        console.error(`❌ HTTPS request error:`, err);
        reject(err);
      });
  });
}

async function fetchSamlAttributes(authMethodGuid, sessionId, requestId) {
  return new Promise((resolve, reject) => {
    const url = `https://microcks.devops.ama.lan/rest/ID-Gov-PT-SAML-Runtime/1.0.0/saml/attributes?authMethodGuid=${encodeURIComponent(
      authMethodGuid,
    )}`;

    const options = {
      method: "GET",
      headers: {
        Accept: "application/json",
        SessionId: sessionId,
        "X-RequestID": requestId,
      },
      rejectUnauthorized: false, // Equivalent to --insecure
    };

    https
      .get(url, options, (res) => {
        let data = "";

        console.log(`📥 Attributes status: ${res.statusCode}`);
        console.log(`📥 Attributes headers:`, res.headers);

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          console.log(
            `📥 Attributes raw (first 200 chars):`,
            data.substring(0, 200),
          );

          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (err) {
            console.error(
              `❌ Failed to parse attributes response:`,
              data.substring(0, 500),
            );
            reject(
              new Error(
                `Failed to parse JSON: ${
                  err.message
                }. Response was: ${data.substring(0, 100)}`,
              ),
            );
          }
        });
      })
      .on("error", (err) => {
        console.error(`❌ HTTPS request error:`, err);
        reject(err);
      });
  });
}

// SSE endpoint - receives X-RequestID and SessionId headers, fetches from Microcks
app.get("/api/stream", async (req, res) => {
  const sessionId = req.headers.sessionid || req.query.sessionId;
  const requestId = req.headers["x-requestid"];
  const sessionIdType = req.query.sessionIdType || sessionId; // Use sessionId as sessionIdType if not provided

  if (!sessionId) {
    res.setHeader("Content-Type", "text/event-stream");
    const errorEvent = {
      event: "ERROR",
      created: new Date().toISOString(),
      data: { error: "SessionId is required" },
    };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    res.end();
    return;
  }

  console.log(
    `🔵 SSE Client connected - SessionId: ${sessionId}, RequestId: ${requestId}, SessionIdType: ${sessionIdType}`,
  );

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    // Fetch from Microcks API
    console.log(`🌐 Fetching from Microcks...`);
    const microcksResponse = await fetchFromMicrocks(
      sessionIdType,
      sessionId,
      requestId,
    );

    // Microcks already returns the full structure with event, created, and response
    // So we just send it directly without wrapping again
    res.write(`data: ${JSON.stringify(microcksResponse)}\n\n`);

    setTimeout(() => {
      const completeEvent = {
        event: "SESSION_COMPLETE",
        created: new Date().toISOString(),
      };
      res.write(`data: ${JSON.stringify(completeEvent)}\n\n`);
      res.end();
      console.log(`✅ SSE Client disconnected - SessionId: ${sessionId}`);
    }, 500);
  } catch (err) {
    console.error(`❌ Error fetching from Microcks:`, err.message);
    const errorEvent = {
      event: "ERROR",
      created: new Date().toISOString(),
      data: { error: err.message },
    };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    res.end();
  }

  req.on("close", () => {
    console.log(`🔴 SSE Client disconnected - SessionId: ${sessionId}`);
    res.end();
  });
});

app.get("/saml/attributes", async (req, res) => {
  const authMethodGuid = req.query.authMethodGuid;
  const sessionId = req.headers.sessionid || req.query.sessionId;
  const requestId = req.headers["x-requestid"] || req.query.requestId;

  if (!authMethodGuid) {
    res.status(400).json({ error: "authMethodGuid is required" });
    return;
  }

  try {
    const microcksResponse = await fetchSamlAttributes(
      authMethodGuid,
      sessionId,
      requestId,
    );
    res.json(microcksResponse);
  } catch (err) {
    res
      .status(502)
      .json({ error: "Failed to fetch attributes", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/api/stream`);
});
