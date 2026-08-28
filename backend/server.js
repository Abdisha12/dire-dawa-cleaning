require("dotenv").config();
const express=require("express");
const cors=require("cors");
const helmet=require("helmet");
const morgan=require("morgan");
const rateLimit=require("express-rate-limit");
const path=require("path");
const fs=require("fs");
const logger=require("./config/logger");
const errorHandler=require("./middleware/errorHandler");

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

app.use(helmet({crossOriginResourcePolicy:{policy:"cross-origin"}}));
app.use(cors({origin:"*",methods:["GET","POST","PUT","DELETE","OPTIONS"],allowedHeaders:["Content-Type","Authorization","x-session-token"]}));
app.use("/api/auth/login",rateLimit({windowMs:15*60*1000,max:20,message:{error:"Too many login attempts"}}));
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
