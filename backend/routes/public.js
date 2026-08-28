const express=require("express");
const db=require("../config/db");
const router=express.Router();

// Public stats - no auth required, shown on landing page
router.get("/stats",async(req,res,next)=>{
  try{
    const now=new Date();
    const y=now.getFullYear(),m=now.getMonth()+1;

    const [[kebeles]]=await db.execute("SELECT COUNT(*) AS c FROM kebeles");
    const [[zones]]=await db.execute("SELECT COUNT(*) AS c FROM safer_zones");
    const [[businesses]]=await db.execute("SELECT COUNT(*) AS c FROM businesses WHERE is_active=1");
    const [[workers]]=await db.execute("SELECT COUNT(*) AS c FROM workers WHERE is_active=1");
    const [[leaders]]=await db.execute("SELECT COUNT(*) AS c FROM safer_zones WHERE leader_id IS NOT NULL");
    const [[inspections]]=await db.execute("SELECT COUNT(*) AS c FROM inspections WHERE date>=DATE_SUB(NOW(),INTERVAL 30 DAY)");
    const [[collected]]=await db.execute("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status=\"paid\" AND month=? AND year=?",[m,y]);
    const [[reports]]=await db.execute("SELECT COUNT(*) AS c FROM zone_reports WHERE status=\"approved\"");

    res.json({
      kebeles:kebeles.c,
      zones:zones.c,
      businesses:businesses.c,
      workers:workers.c,
      leadersAssigned:leaders.c,
      inspectionsLast30Days:inspections.c,
      collectedThisMonth:collected.total,
      approvedReports:reports.c,
    });
  }catch(err){next(err);}
});

module.exports=router;
