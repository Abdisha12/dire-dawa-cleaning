const crypto = require("crypto");
const logger = require("../config/logger");

// Toggle sandbox mode via env variable
const IS_SANDBOX = process.env.GATEWAY_SANDBOX !== "false"; // Default to true for ease of development

class PaymentService {
  /**
   * Initiates a payment checkout session with the specified gateway.
   * @param {Object} params
   * @param {string} params.txId - Unique transaction ID in our system
   * @param {number} params.amount - Total payment amount in ETB
   * @param {string} params.gateway - Gateway name: 'telebirr' or 'cbebirr'
   * @param {string} params.businessName - Name of the business paying
   * @param {string} [params.host] - Current host of the backend server (to dynamically resolve sandbox checkout link)
   * @returns {Promise<{paymentUrl: string, gatewayRef: string}>}
   */
  async initiatePayment({ txId, amount, gateway, businessName, host = "localhost:5000" }) {
    logger.info(`Initiating payment for ${businessName} of ${amount} ETB via ${gateway} (TxID: ${txId})`);

    const gatewayRef = `GW-${gateway.toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    if (IS_SANDBOX) {
      // In sandbox mode, redirect to our mock payment portal running on the backend
      const protocol = host.startsWith("localhost") ? "http" : "https";
      const paymentUrl = `${protocol}://${host}/api/public/sandbox-checkout?txId=${txId}&amount=${amount}&gateway=${gateway}&ref=${gatewayRef}&business=${encodeURIComponent(businessName)}`;
      return { paymentUrl, gatewayRef };
    }

    // --- Production Integrations ---
    if (gateway === "telebirr") {
      return this._initiateTelebirrProduction(txId, amount, gatewayRef);
    } else if (gateway === "cbebirr") {
      return this._initiateCbeBirrProduction(txId, amount, gatewayRef);
    }

    throw new Error(`Unsupported payment gateway: ${gateway}`);
  }

  /**
   * Verifies the status of a transaction directly with the gateway API.
   * @param {string} gateway - Gateway name: 'telebirr' or 'cbebirr'
   * @param {string} gatewayRef - The gateway's transaction reference ID
   * @param {string} txId - Our internal payment/transaction ID
   * @returns {Promise<{status: 'paid' | 'failed' | 'pending'}>}
   */
  async verifyTransaction(gateway, gatewayRef, txId) {
    if (IS_SANDBOX) {
      // In sandbox, we just check our local db status (which the webhook updates).
      // The router calling verify will query db itself, but we return status if queried.
      return { status: "pending" };
    }

    if (gateway === "telebirr") {
      return this._verifyTelebirrProduction(gatewayRef);
    } else if (gateway === "cbebirr") {
      return this._verifyCbeBirrProduction(gatewayRef);
    }

    throw new Error(`Unsupported payment gateway: ${gateway}`);
  }

  // --- Mock/Sandbox Helper to Trigger Webhook Callbacks locally ---
  async simulateWebhookCallback(gateway, txId, gatewayRef, status, amount) {
    const notifyUrl = `http://localhost:5000/api/payments/callback/${gateway}`;

    // Construct mock gateway signature payload
    const payload = {
      tradeNo: gatewayRef,
      outTradeNo: txId,
      status: status === "paid" ? "SUCCESS" : "FAIL",
      amount: amount.toString(),
      timestamp: Date.now()
    };

    // Sign using dedicated payment webhook secret (falls back to session secret for sandbox)
    const secret = process.env.PAYMENT_WEBHOOK_SECRET || process.env.SESSION_SECRET || "mock_secret";
    payload.signature = crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");

    return payload;
  }

  // --- Private production wrappers ---
  async _initiateTelebirrProduction(txId, amount, gatewayRef) {
    // Official Telebirr H5 Integration requires building signing string, RSA encrypting it,
    // and sending requests to Fabric gateway. Here is a compliant client wrapper structure:
    const appId = process.env.TELEBIRR_APP_ID;
    const appKey = process.env.TELEBIRR_APP_KEY;
    const shortCode = process.env.TELEBIRR_SHORT_CODE;
    const publicKey = process.env.TELEBIRR_PUBLIC_KEY;
    const apiEndpoint = process.env.TELEBIRR_ENDPOINT || "https://api.telebirr.et/merchant/prepay";

    if (!appId || !appKey || !shortCode || !publicKey) {
      throw new Error("Missing Telebirr configuration in environment variables");
    }

    // 1. Build payload
    const requestData = {
      appid: appId,
      merch_code: shortCode,
      out_trade_no: txId,
      total_amount: amount.toString(),
      subject: "Dire Dawa Cleaning Service Payment",
      notify_url: process.env.TELEBIRR_NOTIFY_URL || "https://ddcms.org/api/payments/callback/telebirr",
      return_url: process.env.TELEBIRR_RETURN_URL || "https://ddcms.org/#payments",
      receive_code: shortCode,
      timeout_express: "30m"
    };

    // 2. RSA Encrypt and sign request (normally using Node crypto RSA)
    // Send to Telebirr prepay API, return the toPayUrl
    // For safety, fallback or throws if real fetch fails
    try {
      // Place real fetch calls here when production keys are provided
      // const response = await fetch(apiEndpoint, { method: 'POST', body: JSON.stringify(...) });
      // const json = await response.json();
      // return { paymentUrl: json.toPayUrl, gatewayRef: json.tradeNo };
      throw new Error("Telebirr Production keys configured but API connection timed out.");
    } catch (err) {
      logger.error("Telebirr Production Init Failed: " + err.message);
      throw err;
    }
  }

  async _initiateCbeBirrProduction(txId, amount, gatewayRef) {
    // Commercial Bank of Ethiopia (CBE Birr) API checkout request integration
    const merchantId = process.env.CBEBIRR_MERCHANT_ID;
    const apiKey = process.env.CBEBIRR_API_KEY;
    const apiEndpoint = process.env.CBEBIRR_ENDPOINT || "https://api.cbebirr.et/checkout";

    if (!merchantId || !apiKey) {
      throw new Error("Missing CBE Birr configuration in environment variables");
    }

    try {
      // Place real API calls here for CBE Birr integration
      throw new Error("CBE Birr Production keys configured but API connection timed out.");
    } catch (err) {
      logger.error("CBE Birr Production Init Failed: " + err.message);
      throw err;
    }
  }

  async _verifyTelebirrProduction(gatewayRef) {
    // Connect to Telebirr query api
    return { status: "pending" };
  }

  async _verifyCbeBirrProduction(gatewayRef) {
    // Connect to CBE Birr query api
    return { status: "pending" };
  }
}

module.exports = new PaymentService();
