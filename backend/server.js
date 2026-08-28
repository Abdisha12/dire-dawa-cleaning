require("dotenv").config();

// ── Validate required secrets ──────────────────────────────────
// Fail fast with a clear message instead of running with insecure defaults.
const REQUIRED_ENV = {
  DB_PASSWORD: "Database password (set DB_PASSWORD in .env)",
  SESSION_SECRET: "Session signing secret (set SESSION_SECRET in .env, min 32 chars)",
  PAYMENT_WEBHOOK_SECRET: "Payment webhook secret (set PAYMENT_WEBHOOK_SECRET in .env)",
};
for (const [key, desc] of Object.entries(REQUIRED_ENV)) {
  if (!process.env[key]) {
    console.error(`\n❌  FATAL: Missing required environment variable: ${key}`);
    console.error(`   → ${desc}`);
    console.error(`   → Copy backend/.env.example to backend/.env and fill in real values.\n`);
    process.exit(1);
  }
}
if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
  console.error("\n❌  FATAL: SESSION_SECRET must be at least 32 characters long.\n");
  process.exit(1);
}

const express=require("express");
const cors=require("cors");
const helmet=require("helmet");
const morgan=require("morgan");
const rateLimit=require("express-rate-limit");
const path=require("path");
const fs=require("fs");
const logger=require("./config/logger");
const errorHandler=require("./middleware/errorHandler");

// ── CORS origin allowlist ─────────────────────────────────────
// Comma-separated list of allowed origins in CORS_ORIGINS env var.
// In production behind nginx, frontend and backend share an origin,
// so this list is typically empty (same-origin = no CORS headers needed).
// For local development, add http://localhost:3000 or similar.
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

function corsOriginCallback(req, cb) {
  // Allow requests with no Origin header (same-origin, curl, server-to-server)
  const origin = req.header("Origin");
  if (!origin) return cb(null, true);

  // In production behind nginx reverse proxy, the frontend is served on
  // the same origin — no cross-origin requests should arrive.
  // If CORS_ORIGINS is empty, reject all cross-origin requests.
  if (allowedOrigins.length === 0) {
    logger.warn(`CORS blocked origin: ${origin} (no CORS_ORIGINS configured)`);
    return cb(null, false);
  }

  if (allowedOrigins.includes(origin)) {
    return cb(null, true);
  }

  logger.warn(`CORS blocked unauthorized origin: ${origin}`);
  return cb(null, false);
}

const authRoutes=require("./routes/auth");
const userRoutes=require("./routes/users");
const locationRoutes=require("./routes/locations");
const paymentRoutes=require("./routes/payments");
const inspectionRoutes=require("./routes/inspections");
const workerRoutes=require("./routes/workers");
const toolsRoutes=require("./routes/tools");
const reportsRoutes=require("./routes/reports");
const zoneReportsRoutes=require("./routes/zoneReports");
const publicRoutes=require("./routes/public");
const sandboxRoutes=require("./routes/sandbox");
const auditLogRoutes=require("./routes/auditLog");
const notificationRoutes=require("./routes/notifications");
const analyticsRoutes=require("./routes/analytics");
const documentRoutes=require("./routes/documents");
const notifService=require("./services/notificationService");

const app=express();
app.set("trust proxy",1);   // behind Nginx — needed for express-rate-limit
const PORT=parseInt(process.env.PORT)||5000;

fs.mkdirSync(path.join(__dirname,"uploads/inspections"),{recursive:true});
fs.mkdirSync(path.join(__dirname,"uploads/documents"),{recursive:true});
fs.mkdirSync(path.join(__dirname,"logs"),{recursive:true});

app.use(helmet({
  crossOriginResourcePolicy:{policy:"cross-origin"},
  contentSecurityPolicy:{
    directives:{
      defaultSrc:["'self'"],
      scriptSrc:["'self'","https://cdnjs.cloudflare.com"],
      styleSrc:["'self'","'unsafe-inline'"],
      imgSrc:["'self'","data:","https://api.qrserver.com"],
      connectSrc:["'self'"],
      fontSrc:["'self'"],
      objectSrc:["'none'"],
      frameAncestors:["'self'"],
      baseUri:["'self'"],
      formAction:["'self'"],
    },
  },
  crossOriginEmbedderPolicy:false,
  referrerPolicy:{policy:"strict-origin-when-cross-origin"},
}));
app.use(cors({
  origin: corsOriginCallback,
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","x-session-token"],
  credentials: true
}));
app.use("/api/auth/login",rateLimit({windowMs:15*60*1000,max:10,message:{error:"Too many login attempts. Please try again later."},standardHeaders:true,legacyHeaders:false}));
app.use("/api/auth/",rateLimit({windowMs:15*60*1000,max:30,message:{error:"Too many auth requests"}}));
app.use("/api/",rateLimit({windowMs:60*1000,max:500,message:{error:"Rate limit exceeded"}}));
app.use(express.json({limit:"10mb"}));
app.use(express.urlencoded({extended:true,limit:"10mb"}));
app.use(morgan("combined",{stream:{write:msg=>logger.info(msg.trim())}}));
app.use("/uploads",express.static(path.join(__dirname,"uploads")));

app.get("/api/health",(req,res)=>res.json({status:"ok",ts:new Date()}));

app.use("/api/public",publicRoutes);
app.use("/api/public",sandboxRoutes);
app.use("/api/auth",authRoutes);
app.use("/api/users",userRoutes);
app.use("/api/payments",paymentRoutes);
app.use("/api/inspections",inspectionRoutes);
app.use("/api/workers",workerRoutes);
app.use("/api/tools",toolsRoutes);
app.use("/api/reports",reportsRoutes);
app.use("/api/zone-reports",zoneReportsRoutes);
app.use("/api/audit-log",auditLogRoutes);
app.use("/api/notifications",notificationRoutes);
app.use("/api/analytics",analyticsRoutes);
app.use("/api/documents",documentRoutes);
app.use("/api",locationRoutes);

app.use((req,res)=>res.status(404).json({error:`Not found: ${req.method} ${req.url}`}));
app.use(errorHandler);

app.listen(PORT,()=>{
  logger.info(`🚀  Server running on http://localhost:${PORT}`);
  logger.info(`🌍  Env: ${process.env.NODE_ENV||"development"}`);

  // Schedule periodic background alert scanner (every 6 hours)
  setInterval(() => {
    logger.info("⏰ Running automated alert scanner...");
    notifService.generateOverdueAlerts().catch(() => {});
    notifService.generatePendingReportAlerts().catch(() => {});
    notifService.generateAbsentWorkerAlerts().catch(() => {});
  }, 6 * 60 * 60 * 1000);
});
module.exports=app;
