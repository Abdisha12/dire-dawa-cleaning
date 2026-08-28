const {createLogger,format,transports}=require("winston");
const DRF=require("winston-daily-rotate-file");
const path=require("path");
const logDir=path.join(__dirname,"../logs");
const logger=createLogger({
  level:process.env.NODE_ENV==="production"?"warn":"debug",
  format:format.combine(format.timestamp({format:"YYYY-MM-DD HH:mm:ss"}),format.errors({stack:true}),format.json()),
  transports:[
    new transports.Console({format:format.combine(format.colorize(),format.printf(({timestamp,level,message})=>`${timestamp} [${level}]: ${message}`))}),
    new DRF({dirname:logDir,filename:"app-%DATE%.log",datePattern:"YYYY-MM-DD",maxFiles:"30d"}),
    new DRF({dirname:logDir,filename:"error-%DATE%.log",datePattern:"YYYY-MM-DD",level:"error",maxFiles:"90d"}),
  ]
});
module.exports=logger;
