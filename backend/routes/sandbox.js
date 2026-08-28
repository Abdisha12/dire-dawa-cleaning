const express = require("express");
const paymentService = require("../services/paymentService");
const logger = require("../config/logger");
const router = express.Router();

router.get("/sandbox-checkout", async (req, res) => {
  const { txId, amount, gateway, ref, business } = req.query;

  // Render a premium mockup checkout page for Telebirr / CBE Birr
  const isTelebirr = gateway === "telebirr";
  const gatewayTitle = isTelebirr ? "Telebirr Sandbox Portal" : "CBE Birr Sandbox Portal";
  const brandColor = isTelebirr ? "#d9383a" : "#1a5fb4"; // Telebirr red vs CBE blue
  const logo = isTelebirr ? "📱" : "🏦";

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${gatewayTitle}</title>
      <style>
        :root {
          --brand-color: ${brandColor};
          --bg-grad: linear-gradient(135deg, #1e1e2f 0%, #111119 100%);
        }
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: var(--bg-grad);
          color: #ffffff;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .container {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 2.5rem;
          width: 420px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          text-align: center;
          box-sizing: border-box;
        }
        .logo-area {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }
        h2 {
          margin: 0 0 1.5rem 0;
          font-size: 1.6rem;
          color: #ffffff;
          font-weight: 700;
          text-transform: capitalize;
        }
        .badge {
          display: inline-block;
          background: rgba(255, 255, 255, 0.1);
          color: #a0aec0;
          font-size: 0.75rem;
          padding: 0.25rem 0.75rem;
          border-radius: 50px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .info-card {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 2rem;
          text-align: left;
          border: 1px solid rgba(255, 255, 255, 0.04);
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 0.6rem 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 0.9rem;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .label {
          color: #a0aec0;
        }
        .value {
          font-weight: 600;
        }
        .price {
          font-size: 1.5rem;
          color: #48bb78;
          font-weight: 700;
        }
        .btn {
          width: 100%;
          padding: 0.9rem;
          border-radius: 10px;
          border: none;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 0.75rem;
        }
        .btn-success {
          background: var(--brand-color);
          color: #ffffff;
        }
        .btn-success:hover {
          filter: brightness(1.15);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        .btn-danger {
          background: transparent;
          color: #e53e3e;
          border: 1px solid rgba(229, 62, 62, 0.3);
        }
        .btn-danger:hover {
          background: rgba(229, 62, 62, 0.1);
        }
        .status-msg {
          margin-top: 1rem;
          font-size: 0.9rem;
          color: #a0aec0;
        }
      </style>
    </head>
    <body>
      <div class="container" id="portal">
        <div class="logo-area">${logo}</div>
        <h2>${gatewayTitle}</h2>
        <div class="badge">Development Mock Mode</div>

        <div class="info-card">
          <div class="info-row">
            <span class="label">Business</span>
            <span class="value">${decodeURIComponent(business || "Dire Dawa Business")}</span>
          </div>
          <div class="info-row">
            <span class="label">Tx ID</span>
            <span class="value">${txId}</span>
          </div>
          <div class="info-row">
            <span class="label">Reference</span>
            <span class="value">${ref}</span>
          </div>
          <div class="info-row" style="padding-top: 1rem;">
            <span class="label" style="align-self: center;">Amount due</span>
            <span class="value price">${parseFloat(amount).toFixed(2)} ETB</span>
          </div>
        </div>

        <button class="btn btn-success" id="btn-approve">Approve Mock Payment</button>
        <button class="btn btn-danger" id="btn-decline">Decline / Cancel</button>
        
        <div class="status-msg" id="status-text">Click to simulate payment callback.</div>
      </div>

      <script>
        const txId = "${txId}";
        const amount = "${amount}";
        const gateway = "${gateway}";
        const ref = "${ref}";

        async function triggerCallback(status) {
          const btnApprove = document.getElementById("btn-approve");
          const btnDecline = document.getElementById("btn-decline");
          const statusText = document.getElementById("status-text");

          btnApprove.disabled = true;
          btnDecline.disabled = true;
          statusText.textContent = "Processing callback notification...";

          try {
            const response = await fetch("/api/public/sandbox-callback-trigger", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ gateway, txId, ref, status, amount })
            });

            const resData = await response.json();
            if (response.ok) {
              document.getElementById("portal").innerHTML = \`
                <div style="font-size: 4rem; color: #48bb78; margin-bottom: 1rem;">✓</div>
                <h2 style="color: #48bb78;">Payment Simulated!</h2>
                <p style="color: #a0aec0; font-size: 0.95rem; margin-bottom: 2rem;">
                  Mock portal successfully notified the backend with status: <strong>\${status.toUpperCase()}</strong>.
                </p>
                <div class="badge" style="background: rgba(72, 187, 120, 0.15); color: #48bb78;">Transaction Complete</div>
                <p style="color: #718096; font-size: 0.8rem; margin-top: 2rem;">You can now close this tab/window.</p>
              \`;
            } else {
              throw new Error(resData.error || "Failed callback trigger");
            }
          } catch(err) {
            btnApprove.disabled = false;
            btnDecline.disabled = false;
            statusText.style.color = "#e53e3e";
            statusText.textContent = "Error: " + err.message;
          }
        }

        document.getElementById("btn-approve").onclick = () => triggerCallback("paid");
        document.getElementById("btn-decline").onclick = () => triggerCallback("failed");
      </script>
    </body>
    </html>
  `;

  res.send(html);
});

// Endpoint that acts as a secure local simulator agent
router.post("/sandbox-callback-trigger", async (req, res) => {
  const { gateway, txId, ref, status, amount } = req.body;
  const PORT = process.env.PORT || 5000;

  try {
    // 1. Generate the signed payload mock gateway will send
    const callbackPayload = await paymentService.simulateWebhookCallback(gateway, txId, ref, status, amount);

    // 2. Perform server-to-server POST call to the actual public webhook callback route
    const callbackUrl = `http://localhost:${PORT}/api/payments/callback/${gateway}`;
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(callbackPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webhook responded with status ${response.status}: ${errorText}`);
    }

    res.json({ success: true });
  } catch (err) {
    logger.error("Sandbox Callback Trigger Error: " + err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
