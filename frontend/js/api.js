// frontend/js/api.js
const API=(()=>{
  const { protocol, hostname, port } = window.location;
  const isFileProtocol = protocol === "file:";
  const isDefaultWebPort = port === "" || port === "80" || port === "443";
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  // Prefer the current origin when the app is served through a reverse proxy (Docker/Nginx).
  // Fall back to localhost:5000 for direct local development when the backend is running outside the browser's origin.
  const API_ORIGIN = isFileProtocol
    ? "http://127.0.0.1:5000"
    : isDefaultWebPort
      ? ""
      : isLocalHost
        ? "http://127.0.0.1:5000"
        : "";
  const BASE = `${API_ORIGIN}/api`;

  const getToken=()=>localStorage.getItem("ddcms_token");
  const getUser=()=>JSON.parse(localStorage.getItem("ddcms_user")||"null");
  const setAuth=(token,user)=>{localStorage.setItem("ddcms_token",token);localStorage.setItem("ddcms_user",JSON.stringify(user));};
  const clearAuth=()=>{localStorage.removeItem("ddcms_token");localStorage.removeItem("ddcms_user");};

  async function req(method,path,body,isFormData=false){
    const headers={"x-session-token":getToken()||""};
    if(!isFormData) headers["Content-Type"]="application/json";
    const opts={method,headers};
    if(body) opts.body=isFormData?body:JSON.stringify(body);
    let res;
    try {
      res = await fetch(BASE+path,opts);
    } catch (err) {
      throw new Error(`Unable to connect to backend server (${BASE}). Please check if backend is running on port 5000.`);
    }
    if(res.status===401){clearAuth();window.location.hash="#login";return null;}
    const json=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(json.error||`HTTP ${res.status}`);
    return json;
  }

  return {
    getToken,getUser,setAuth,clearAuth,
    getFileUrl:(filePath)=>filePath ? (filePath.startsWith("http") ? filePath : `${API_ORIGIN}${filePath}`) : "",
    isLoggedIn:()=>!!getToken(),
    hasRole:(...roles)=>{const u=getUser();return u&&roles.includes(u.role);},
    getZone:()=>getUser()?.zone||null,

    // Public (no auth)
    getPublicStats:()=>req("GET","/public/stats"),

    // Auth
    login:(u,p)=>req("POST","/auth/login",{username:u,password:p}),
    logout:()=>req("POST","/auth/logout"),
    me:()=>req("GET","/auth/me"),

    // Users
    getUsers:(p={})=>req("GET","/users?"+new URLSearchParams(p)),
    getLeaders:()=>req("GET","/users/leaders"),
    createUser:(d)=>req("POST","/users",d),
    updateUser:(id,d)=>req("PUT",`/users/${id}`,d),
    deleteUser:(id)=>req("DELETE",`/users/${id}`),
    changePassword:(id,p)=>req("PUT",`/users/${id}/password`,{password:p}),

    // Kebeles
    getKebeles:()=>req("GET","/kebeles"),
    updateKebele:(id,d)=>req("PUT",`/kebeles/${id}`,d),

    // Safer Zones
    getSaferZones:(p={})=>req("GET","/safer-zones?"+new URLSearchParams(p)),
    getSaferZone:(id)=>req("GET",`/safer-zones/${id}`),
    createSaferZone:(d)=>req("POST","/safer-zones",d),
    updateSaferZone:(id,d)=>req("PUT",`/safer-zones/${id}`,d),
    deleteSaferZone:(id)=>req("DELETE",`/safer-zones/${id}`),

    // Businesses
    getBusinesses:(p={})=>req("GET","/businesses?"+new URLSearchParams(p)),
    getBusiness:(id)=>req("GET",`/businesses/${id}`),
    createBusiness:(d)=>req("POST","/businesses",d),
    updateBusiness:(id,d)=>req("PUT",`/businesses/${id}`,d),
    deleteBusiness:(id)=>req("DELETE",`/businesses/${id}`),

    // Payments
    getPayments:(p={})=>req("GET","/payments?"+new URLSearchParams(p)),
    createPayment:(d)=>req("POST","/payments",d),
    updatePayment:(id,d)=>req("PUT",`/payments/${id}`,d),
    deletePayment:(id)=>req("DELETE",`/payments/${id}`),
    verifyPayment:(id)=>req("GET",`/payments/${id}/verify`),
    getDashboardSummary:(p={})=>req("GET","/payments/summary/dashboard?"+new URLSearchParams(p)),

    // Inspections
    getInspections:(p={})=>req("GET","/inspections?"+new URLSearchParams(p)),
    getInspection:(id)=>req("GET",`/inspections/${id}`),
    createInspection:(fd)=>req("POST","/inspections",fd,true),
    updateInspection:(id,fd)=>req("PUT",`/inspections/${id}`,fd,true),
    deleteInspection:(id)=>req("DELETE",`/inspections/${id}`),
    deletePhoto:(id)=>req("DELETE",`/inspections/photo/${id}`),

    // Workers
    getWorkers:(p={})=>req("GET","/workers?"+new URLSearchParams(p)),
    createWorker:(d)=>req("POST","/workers",d),
    updateWorker:(id,d)=>req("PUT",`/workers/${id}`,d),
    deleteWorker:(id)=>req("DELETE",`/workers/${id}`),
    getAttendance:(id,p={})=>req("GET",`/workers/${id}/attendance?`+new URLSearchParams(p)),
    bulkAttendance:(d)=>req("POST","/workers/attendance/bulk",d),
    getWorkerSalary:(id)=>req("GET",`/workers/${id}/salary`),
    paySalary:(id,d)=>req("POST",`/workers/${id}/salary`,d),
    getWorkerStats:(p={})=>req("GET","/workers/summary/stats?"+new URLSearchParams(p)),

    // Tools
    getTools:(p={})=>req("GET","/tools?"+new URLSearchParams(p)),
    createTool:(d)=>req("POST","/tools",d),
    updateTool:(id,d)=>req("PUT",`/tools/${id}`,d),
    deleteTool:(id)=>req("DELETE",`/tools/${id}`),

    // Zone Reports
    getZoneReports:(p={})=>req("GET","/zone-reports?"+new URLSearchParams(p)),
    getZoneReport:(id)=>req("GET",`/zone-reports/${id}`),
    createZoneReport:(d)=>req("POST","/zone-reports",d),
    updateZoneReport:(id,d)=>req("PUT",`/zone-reports/${id}`,d),
    reviewZoneReport:(id,d)=>req("PUT",`/zone-reports/${id}/review`,d),
    deleteZoneReport:(id)=>req("DELETE",`/zone-reports/${id}`),

    // Audit Log
    getAuditLog:(p={})=>req("GET","/audit-log?"+new URLSearchParams(p)),

    // Notifications
    getNotifications:(p={})=>req("GET","/notifications?"+new URLSearchParams(p)),
    getUnreadNotifCount:()=>req("GET","/notifications/unread-count"),
    markNotifRead:(id)=>req("PUT",`/notifications/${id}/read`),
    markAllNotifsRead:()=>req("PUT","/notifications/read-all"),
    deleteNotif:(id)=>req("DELETE",`/notifications/${id}`),
    generateAlerts:()=>req("POST","/notifications/generate"),

    // Analytics
    getAttendanceAnalytics:(p={})=>req("GET","/analytics/attendance?"+new URLSearchParams(p)),
    getPaymentAnalytics:(p={})=>req("GET","/analytics/payments?"+new URLSearchParams(p)),
    getInspectionAnalytics:(p={})=>req("GET","/analytics/inspections?"+new URLSearchParams(p)),
    getZoneLeaderboard:(p={})=>req("GET","/analytics/zones?"+new URLSearchParams(p)),
    getAnalyticsTrends:(p={})=>req("GET","/analytics/trends?"+new URLSearchParams(p)),

    // Documents
    getDocuments:(p={})=>req("GET","/documents?"+new URLSearchParams(p)),
    uploadDocument:(fd)=>req("POST","/documents",fd,true),
    updateDocument:(id,d)=>req("PUT",`/documents/${id}`,d),
    deleteDocument:(id)=>req("DELETE",`/documents/${id}`),
    documentDownloadUrl:(id)=>`${BASE}/documents/${id}/download?token=${getToken()}`,

    // Reports/CSV
    getPaymentReport:(p={})=>req("GET","/reports/payments/monthly?"+new URLSearchParams(p)),
    getYearlyReport:(p={})=>req("GET","/reports/payments/yearly?"+new URLSearchParams(p)),
    getWorkerReport:(p={})=>req("GET","/reports/workers/monthly?"+new URLSearchParams(p)),
    getInspectionReport:(p={})=>req("GET","/reports/inspections?"+new URLSearchParams(p)),
    getMonthlySummaryReport:(p={})=>req("GET","/reports/monthly-summary?"+new URLSearchParams(p)),
    csvUrl:(path,params={})=>`${BASE}${path}?${new URLSearchParams({...params,format:"csv"})}&token=${getToken()}`,
    pdfUrl:(path,params={})=>`${BASE}${path}?${new URLSearchParams({...params,format:"pdf"})}&token=${getToken()}`,
    xlsxUrl:(path,params={})=>`${BASE}${path}?${new URLSearchParams({...params,format:"xlsx"})}&token=${getToken()}`,
  };
})();
