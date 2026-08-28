const logger=require("../config/logger");
function errorHandler(err,req,res,_next){
  logger.error(err.message,{stack:err.stack,url:req.url});
  res.status(err.status||500).json({error:err.message||"Internal Server Error"});
}
module.exports=errorHandler;
