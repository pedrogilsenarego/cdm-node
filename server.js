const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = 8787;

app.use(cors());
app.use(express.json());

app.post("/auth/submit-method", (req, res) => {
  const authMethod = req.body.requestId;
  res.status(200).json({ status: "received" });

  setTimeout(() => {
    if (authMethod === "1") {
      const responseObj = {
        event: "AUTH_METHOD_SELECTED",
        created: new Date().toISOString(),
        response: {
          sessionId: "session-123",
          authRequestId: "auth-456",
          skipConsent: false,
          skipConfirmation: false,
          requiredAttributes: ["attr1", "attr2"],
          authenticatedWithSSO: false,
          optionalAttributes: ["opt1"],
          serviceProvider: "service-789",
          presentationPolicies: {
            authenticationTypes: ["CMD", "CC", "EIDAS", "PROFESSIONAL"],
            authenticationCMDTypes: ["CMD_TYPE_1"],
          },
        },
      };
      console.log("Sending to /api/stream:", responseObj);
      axios
        .post("http://localhost:3000/api/stream", responseObj)
        .then(() => console.log("Sent to /api/stream:", responseObj))
        .catch((err) =>
          console.error("Error sending to /api/stream:", err.message)
        );
    } else if (authMethod === "2") {
      const responseObj = {
        event: "AUTH_METHOD_SELECTED",
        created: new Date().toISOString(),
        response: {
          sessionId: "session-123",
          authRequestId: "auth-456",
          skipConsent: false,
          skipConfirmation: false,
          requiredAttributes: ["attr1", "attr2"],
          authenticatedWithSSO: false,
          optionalAttributes: ["opt1"],
          serviceProvider: "service-789",
          presentationPolicies: {
            authenticationTypes: ["CC"],
            authenticationCMDTypes: ["CMD_TYPE_1"],
          },
        },
      };
      console.log("Sending to /api/stream:", responseObj);
      axios
        .post("http://localhost:3000/api/stream", responseObj)
        .then(() => console.log("Sent to /api/stream:", responseObj))
        .catch((err) =>
          console.error("Error sending to /api/stream:", err.message)
        );
    } else if (authMethod === "3") {
      const errorObj = {
        event: "ERROR",
        created: "2024-01-15T10:32:00",
        response: "Erro ao processar autenticação",
      };
      console.log("Sending to /api/stream:", errorObj);
      axios
        .post("http://localhost:3000/api/stream", errorObj)
        .then(() => console.log("Sent to /api/stream:", errorObj))
        .catch((err) =>
          console.error("Error sending to /api/stream:", err.message)
        );
    } else {
      const invalidObj = { message: "Invalid authMethod" };
      console.log("Sending to /api/stream:", invalidObj);
      axios
        .post("http://localhost:3000/api/stream", invalidObj)
        .then(() => console.log("Sent to /api/stream:", invalidObj))
        .catch((err) =>
          console.error("Error sending to /api/stream:", err.message)
        );
    }
  }, 4000);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
