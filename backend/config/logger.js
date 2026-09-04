const {createLogger,format,transports}=require("winston");
const {v4: uuidv4}=require("uuid");
const DRF=require("winston-daily-rotate-file");
const path=require("path");
const logDir=path.join(__dirname,"../logs");
const correlationIdFormat=format.printf(({correlationId,timestamp,level,message,...args})=>`${timestamp} [${level}] corrId=${correlationId} ${message}${Object.keys(args).length?" "+JSON.stringify(args):""}`);

const logger=createLogger({
  level:process.env.NODE_ENV==="production"?"warn":"debug",
  format:format.combine(format.timestamp({format:"YYYY-MM-DD HH:mm:ss"}),format.errors({stack:true}),format.json(), correlationIdFormat),
  transports:[
    new transports.Console({format:format.combine(format.colorize(),format.printf(({timestamp,level,message,correlationId})=>`${timestamp} [${level}] corrId=${correlationId} ${message}`))}),
    new DRF({dirname:logDir,filename:"app-%DATE%.log",datePattern:"YYYY-MM-DD",maxFiles:"30d"}),
    new DRF({dirname:logDir,filename:"error-%DATE%.log",datePattern:"YYYY-MM-DD",level:"error",maxFiles:"90d"}),
  ]
});
module.exports=logger;
