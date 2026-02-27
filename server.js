const express = require("express");
const cors = require("cors");
const https = require("https");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8787;
const sseClients = new Map();

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

async function fetchSamlSupportAuth(sessionId, requestId, apiKey, dispatchHints = {}) {
  return new Promise((resolve, reject) => {
    const baseUrl =
      "https://microcks.devops.ama.lan/rest/ID-Gov-PT-SAML-Runtime/1.0.0/saml/support-auth";

    const queryParams = new URLSearchParams();
    [
      "unauthenticated",
      "errors",
      "authenticated",
      "wait2factor",
      "temporaryPin",
    ].forEach((key) => {
      const value = dispatchHints[key];
      if (value !== undefined && value !== null && value !== "") {
        queryParams.append(key, String(value));
      }
    });

    const queryString = queryParams.toString();
    const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;

    const options = {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        SessionId: sessionId,
        "X-RequestID": requestId,
        ...(apiKey ? { "X-API-KEY": apiKey } : {}),
        ...(dispatchHints.microcksLabels
          ? { "x-microcks-labels": String(dispatchHints.microcksLabels) }
          : {}),
      },
      rejectUnauthorized: false, // Equivalent to --insecure
    };

    console.log("🌐 support-auth outbound request:", {
      url,
      hasSessionId: !!sessionId,
      hasRequestId: !!requestId,
      hasApiKey: !!apiKey,
      microcksLabels: dispatchHints.microcksLabels || null,
      uriParams: {
        unauthenticated: dispatchHints.unauthenticated ?? null,
        errors: dispatchHints.errors ?? null,
        authenticated: dispatchHints.authenticated ?? null,
        wait2factor: dispatchHints.wait2factor ?? null,
        temporaryPin: dispatchHints.temporaryPin ?? null,
      },
    });

    https
      .get(url, options, (res) => {
        let data = "";

        console.log(`📥 Support auth status: ${res.statusCode}`);
        console.log(`📥 Support auth headers:`, res.headers);

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          console.log(
            `📥 Support auth raw (first 200 chars):`,
            data.substring(0, 200),
          );

          if (!data || data.trim().length === 0) {
            resolve({});
            return;
          }

          const statusCode = res.statusCode || 500;

          try {
            const jsonData = JSON.parse(data);
            if (statusCode >= 400) {
              console.error("❌ support-auth upstream non-2xx response", {
                statusCode,
                hint:
                  "Check X-API-KEY, Content-Type, x-microcks-labels, and URI params used by Microcks dispatcher",
              });
              reject(
                new Error(
                  `Support auth upstream error (${statusCode}): ${data.substring(0, 200)}`,
                ),
              );
              return;
            }
            resolve(jsonData);
          } catch (err) {
            if (statusCode >= 400) {
              console.error("❌ support-auth upstream non-JSON error body", {
                statusCode,
                hint:
                  "Likely Microcks dispatch mismatch. Verify expected URI params/labels for an existing mock response.",
              });
              reject(
                new Error(
                  `Support auth upstream error (${statusCode}): ${data.substring(0, 200)}`,
                ),
              );
              return;
            }

            reject(
              new Error(
                `Failed to parse JSON: ${err.message}. Response was: ${data.substring(0, 100)}`,
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

function buildDispatchHints(rawDispatchHints = {}) {
  return {
    microcksLabels: rawDispatchHints.microcksLabels,
    unauthenticated: rawDispatchHints.unauthenticated,
    errors: rawDispatchHints.errors,
    authenticated: rawDispatchHints.authenticated,
    wait2factor: rawDispatchHints.wait2factor ?? "true",
    temporaryPin: rawDispatchHints.temporaryPin,
  };
}

function registerSseClient(sessionId, res) {
  if (!sseClients.has(sessionId)) {
    sseClients.set(sessionId, new Set());
  }
  sseClients.get(sessionId).add(res);
}

function unregisterSseClient(sessionId, res) {
  const clientsForSession = sseClients.get(sessionId);
  if (!clientsForSession) {
    return;
  }

  clientsForSession.delete(res);
  if (clientsForSession.size === 0) {
    sseClients.delete(sessionId);
  }
}

function sendToSseSession(sessionId, payload) {
  const clientsForSession = sseClients.get(sessionId);
  if (!clientsForSession || clientsForSession.size === 0) {
    console.log(`ℹ️ No active SSE clients for SessionId: ${sessionId}`);
    return;
  }

  const serializedPayload = `data: ${JSON.stringify(payload)}\n\n`;
  clientsForSession.forEach((clientRes) => {
    clientRes.write(serializedPayload);
  });
}

async function postSamlLoginCmd(payload, sessionId, requestId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload || {});

    const options = {
      hostname: "microcks.devops.ama.lan",
      port: 443,
      path: "/rest/ID-Gov-PT-SAML-Runtime/1.0.0/saml/login/cmd",
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        SessionId: sessionId,
        "X-RequestID": requestId,
      },
      rejectUnauthorized: false, // Equivalent to --insecure
    };

    const request = https.request(options, (res) => {
      let data = "";

      console.log(`📥 Login CMD status: ${res.statusCode}`);
      console.log(`📥 Login CMD headers:`, res.headers);

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        console.log(
          `📥 Login CMD raw (first 200 chars):`,
          data.substring(0, 200),
        );

        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (err) {
          console.error(
            `❌ Failed to parse login CMD response:`,
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
    });

    request.on("error", (err) => {
      console.error(`❌ HTTPS request error:`, err);
      reject(err);
    });

    request.write(body);
    request.end();
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
  registerSseClient(sessionId, res);

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
    unregisterSseClient(sessionId, res);
    console.log(`🔴 SSE Client disconnected - SessionId: ${sessionId}`);
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

app.get("/saml/support-auth", async (req, res) => {
  const sessionId = req.headers.sessionid || req.query.sessionId;
  const requestId = req.headers["x-requestid"] || req.query.requestId;
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;
  const rawDispatchHints = {
    microcksLabels:
      req.headers["x-microcks-labels"] ||
      req.query["x-microcks-labels"] ||
      req.query.microcksLabels,
    unauthenticated: req.query.unauthenticated,
    errors: req.query.errors,
    authenticated: req.query.authenticated,
    wait2factor: req.query.wait2factor,
    temporaryPin: req.query.temporaryPin,
  };
  const dispatchHints = buildDispatchHints(rawDispatchHints);

  try {
    const microcksResponse = await fetchSamlSupportAuth(
      sessionId,
      requestId,
      apiKey,
      dispatchHints,
    );
    res.json(microcksResponse);
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch support auth",
      details: err.message,
    });
  }
});

app.post("/saml/login/cmd", async (req, res) => {
  const sessionId = req.headers.sessionid || req.query.sessionId;
  const requestId = req.headers["x-requestid"] || req.query.requestId;
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;
  const rawDispatchHints = {
    microcksLabels:
      req.headers["x-microcks-labels"] ||
      req.query["x-microcks-labels"] ||
      req.query.microcksLabels,
    unauthenticated: req.query.unauthenticated,
    errors: req.query.errors,
    authenticated: req.query.authenticated,
    wait2factor: req.query.wait2factor,
    temporaryPin: req.query.temporaryPin,
  };
  const dispatchHints = buildDispatchHints(rawDispatchHints);

  try {
    const microcksResponse = await postSamlLoginCmd(
      req.body,
      sessionId,
      requestId,
    );
    res.json(microcksResponse);

    setTimeout(async () => {
      try {
        const supportAuthResponse = await fetchSamlSupportAuth(
          sessionId,
          requestId,
          apiKey,
          dispatchHints,
        );
        sendToSseSession(sessionId, supportAuthResponse);
      } catch (err) {
        const errorEvent = {
          event: "ERROR",
          created: new Date().toISOString(),
          data: { error: `Failed to fetch support auth: ${err.message}` },
        };
        sendToSseSession(sessionId, errorEvent);
      }
    }, 1000);
  } catch (err) {
    res.status(502).json({
      error: "Failed to execute CMD login",
      details: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/api/stream`);
});
