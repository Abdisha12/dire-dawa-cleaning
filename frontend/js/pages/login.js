function renderLogin(){
  const app=document.getElementById("app");
  app.style.display="";
  app.innerHTML=`
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <div style="font-size:3rem">🧹</div>
          <h1>Dire Dawa Cleaning CMS</h1>
          <p>Management System — Staff Login</p>
        </div>
        <!-- Role hierarchy info -->
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:.75rem;margin-bottom:1.25rem;font-size:.78rem;color:#0369a1">
          <div style="font-weight:700;margin-bottom:.35rem">Access Levels</div>
          🔴 Admin → 🔵 Collector → 🟣 Zone Leader → 👁 Viewer
        </div>
        <form id="login-form">
          <div class="form-group" style="margin-bottom:.9rem">
            <label>Username</label>
            <input class="form-control" id="l-user" type="text" placeholder="Enter username" required autocomplete="username">
          </div>
          <div class="form-group" style="margin-bottom:1.25rem">
            <label>Password</label>
            <div style="position:relative">
              <input class="form-control" id="l-pass" type="password" placeholder="Enter password" required autocomplete="current-password" style="padding-right:2.5rem">
              <button type="button" id="toggle-pw" style="position:absolute;right:.6rem;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem">👁</button>
            </div>
          </div>
          <div id="login-error" style="color:var(--red);font-size:.82rem;margin-bottom:.75rem;min-height:1rem"></div>
          <button class="btn btn-primary" id="login-btn" style="width:100%;justify-content:center;padding:.65rem">Sign In</button>
        </form>
      </div>
    </div>`;

  document.getElementById("back-to-landing")?.addEventListener("click",e=>{
    e.preventDefault();navigate("landing");
  });

  document.getElementById("toggle-pw").addEventListener("click",()=>{
    const i=document.getElementById("l-pass");i.type=i.type==="password"?"text":"password";
  });
  document.getElementById("login-form").addEventListener("submit",async e=>{
    e.preventDefault();
    const errEl=document.getElementById("login-error");
    const btn=document.getElementById("login-btn");
    const user=document.getElementById("l-user").value.trim();
    const pass=document.getElementById("l-pass").value;
    if(!user||!pass){errEl.textContent="Please fill all fields";return;}
    btn.disabled=true;btn.innerHTML="<div class=\"spinner\" style=\"width:16px;height:16px;border-width:2px\"></div> Signing in…";
    errEl.textContent="";
    try{
      const data=await API.login(user,pass);
      if(!data) return;
      API.setAuth(data.token,data.user);
      renderShell();navigate("dashboard");
    }catch(err){errEl.textContent=err.message||"Login failed";}
    finally{btn.disabled=false;btn.innerHTML="Sign In";}
  });
}
