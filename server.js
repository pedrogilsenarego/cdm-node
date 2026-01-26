const express = require("express");
const cors = require("cors");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json());

// Fetch response from Microcks API
async function fetchFromMicrocks(sessionIdType, sessionId, requestId) {
  return new Promise((resolve, reject) => {
    const url = `https://microcks.devops.ama.lan/rest/ID-Gov-PT-SAML-Runtime/1.0.0/saml/auth_session?sessionIdType=${encodeURIComponent(
      sessionIdType
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
            data.substring(0, 200)
          );

          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (err) {
            console.error(
              `❌ Failed to parse response:`,
              data.substring(0, 500)
            );
            reject(
              new Error(
                `Failed to parse JSON: ${
                  err.message
                }. Response was: ${data.substring(0, 100)}`
              )
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

// Response objects based on sessionId
const responses = {
  1: {
    event: "SESSION_DATA",
    created: new Date().toISOString(),
    response: {
      sessionId: "session-id-123",
      authRequestID: "req-id-123",
      serviceProvider: "Portal de Teste",
      dependentAuthentication: true,
      dependentAuthenticationAttributes: {
        citizenType: "national",
        identifierAttributes: [
          {
            guid: "attribute-guid-identifier-1",
            name: "attribute-identifier-1",
            value: "1234567 Z89",
          },
        ],
        requestedAttributes: [
          {
            guid: "attribute-guid-requested-1",
            name: "attribute-requested-1",
            optional: false,
          },
          {
            guid: "attribute-guid-requested-2",
            name: "attribute-requested-2",
            optional: false,
          },
          {
            guid: "attribute-guid-requested-3",
            name: "attribute-requested-3",
            optional: false,
          },
        ],
      },
      attributes: [
        { guid: "attribute-guid-1", name: "attribute-1", optional: false },
        { guid: "attribute-guid-2", name: "attribute-2", optional: false },
        {
          guid: "attribute-guid-3",
          name: "attribute-3",
          optional: true,
          preSelected: true,
        },
        {
          guid: "attribute-guid-4",
          name: "attribute-4",
          optional: true,
          preSelected: true,
        },
      ],
      presentationPolicies: {
        authenticationTypes: [
          {
            guid: "cmd-guid",
            name: "cmd",
            orderNumber: 1,
            preferential: true,
          },
          {
            guid: "cc-guid",
            name: "cc",
            orderNumber: 2,
            preferential: false,
          },
          // {
          //   guid: "eidas-guid",
          //   name: "eidas",
          //   orderNumber: 3,
          //   preferential: false,
          // },
          // {
          //   guid: "notaries-guid",
          //   name: "notaries",
          //   orderNumber: 4,
          //   preferential: false,
          // },
          // {
          //   guid: "lawyers-guid",
          //   name: "lawyers",
          //   orderNumber: 5,
          //   preferential: false,
          // },
          // {
          //   guid: "solicitors-guid",
          //   name: "solicitors",
          //   orderNumber: 6,
          //   preferential: false,
          // },
          // {
          //   guid: "cd-guid",
          //   name: "cd",
          //   orderNumber: 7,
          //   preferential: false,
          // },
        ],
        authenticationCMDTypes: [
          {
            guid: "app-guid",
            name: "app",
            orderNumber: 1,
            preferential: false,
          },
          {
            guid: "phone-guid",
            name: "phone",
            orderNumber: 2,
            preferential: false,
          },
          {
            guid: "email-guid",
            name: "email",
            orderNumber: 3,
            preferential: false,
          },
          {
            guid: "qrcode-guid",
            name: "qr-code",
            orderNumber: 4,
            preferential: false,
          },
        ],
        citizenType: "national",
      },
      skipConsent: false,
      skipConfirmation: false,
      authenticatedWithSSO: false,
      acceptedNewTermsAndConditions: false,
      forceAuthentication: false,
    },
  },
  2: {
    event: "SESSION_DATA",
    created: new Date().toISOString(),
    response: {
      sessionId: "session-id-456",
      authRequestID: "req-id-456",
      serviceProvider: "Portal CC",
      dependentAuthentication: false,
      attributes: [
        { guid: "attr-cc-1", name: "NomeCompleto", optional: false },
        { guid: "attr-cc-2", name: "DataNascimento", optional: false },
        { guid: "attr-cc-3", name: "NIC", optional: true, preSelected: false },
        { guid: "attr-cc-4", name: "NIF", optional: true, preSelected: false },
      ],
      presentationPolicies: {
        authenticationTypes: [
          {
            guid: "cc-guid",
            name: "cc",
            orderNumber: 1,
            preferential: true,
          },
        ],
        citizenType: "national",
      },
      skipConsent: false,
      skipConfirmation: false,
      authenticatedWithSSO: false,
      acceptedNewTermsAndConditions: false,
      forceAuthentication: false,
    },
  },
  3: {
    event: "SESSION_DATA",
    created: new Date().toISOString(),
    response: {
      sessionId: "session-id-789",
      authRequestID: "req-id-789",
      serviceProvider: "Portal Simples",
      dependentAuthentication: false,
      attributes: [],
      presentationPolicies: {
        authenticationTypes: [
          {
            guid: "lawyers-guid",
            name: "lawyers",
            orderNumber: 1,
            preferential: false,
          },
        ],
        citizenType: "national",
      },
      skipConsent: true,
      skipConfirmation: true,
      authenticatedWithSSO: true,
      acceptedNewTermsAndConditions: false,
      forceAuthentication: false,
    },
  },
};

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
    `🔵 SSE Client connected - SessionId: ${sessionId}, RequestId: ${requestId}, SessionIdType: ${sessionIdType}`
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
      requestId
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/api/stream`);
});
