// frontend/js/pages/landing.js — Public landing page (no auth required)

async function renderLanding(){
  document.getElementById("app").innerHTML="";
  const app=document.getElementById("app");
  app.style.display="block";
  app.innerHTML=`
    <div class="landing">
      <!-- ── Top Nav ──────────────────────────────────────── -->
      <nav class="landing-nav">
        <div class="landing-nav-inner">
          <div class="landing-logo">🧹 <span>Dire Dawa Cleaning CMS</span></div>
          <div class="landing-nav-links">
            <a href="#features-section" class="lnk">Features</a>
            <a href="#about-section" class="lnk">About</a>
            <a href="#demo-section" class="lnk">Demo</a>
            <a href="#contact-section" class="lnk">Contact</a>
            <button class="btn btn-primary" id="nav-login-btn">Login</button>
          </div>
          <button class="hamburger" id="landing-hamburger">☰</button>
        </div>
      </nav>

      <!-- ── Hero ─────────────────────────────────────────── -->
      <header class="hero">
        <div class="hero-content">
          <div class="hero-badge">🏙️ Official Municipal System — Dire Dawa Administration</div>
          <h1>Dire Dawa Cleaning<br>Management System</h1>
          <p class="hero-sub">
            A complete digital platform for managing sanitation operations across
            9 kebeles and 108 safer zones — covering business fee collection,
            daily inspections, worker attendance, equipment tracking, and
            zone-level reporting from leaders all the way up to administration.
          </p>
          <div class="hero-actions">
            <button class="btn btn-primary btn-lg" id="hero-login-btn">🔐 Staff Login</button>
            <a href="#about-section" class="btn btn-outline btn-lg">📖 Learn More</a>
          </div>
          <div class="hero-hierarchy">
            <span class="node">🔴 Admin</span><span class="arrow">→</span>
            <span class="node">🔵 Collector</span><span class="arrow">→</span>
            <span class="node">🟣 Zone Leader</span><span class="arrow">→</span>
            <span class="node">👷 Workers</span>
          </div>
        </div>
        <div class="hero-visual">
          <div class="mock-browser">
            <div class="mock-browser-bar"><span></span><span></span><span></span></div>
            <div class="mock-browser-body">
              <div class="mock-sidebar">
                <div class="mock-logo">🧹 CMS</div>
                <div class="mock-nav-item active">📊 Dashboard</div>
                <div class="mock-nav-item">🏪 Businesses</div>
                <div class="mock-nav-item">🔍 Inspections</div>
                <div class="mock-nav-item">👷 Workers</div>
                <div class="mock-nav-item">💳 Payments</div>
              </div>
              <div class="mock-main">
                <div class="mock-stats">
                  <div class="mock-stat green"><div class="mock-stat-label">Collected</div><div class="mock-stat-value">ETB 84,500</div></div>
                  <div class="mock-stat orange"><div class="mock-stat-label">Pending</div><div class="mock-stat-value">ETB 12,300</div></div>
                  <div class="mock-stat blue"><div class="mock-stat-label">Target</div><div class="mock-stat-value">ETB 96,800</div></div>
                </div>
                <div class="mock-chart">
                  <div class="mock-bar" style="height:40%"></div>
                  <div class="mock-bar" style="height:65%"></div>
                  <div class="mock-bar" style="height:50%"></div>
                  <div class="mock-bar" style="height:80%"></div>
                  <div class="mock-bar active" style="height:95%"></div>
                  <div class="mock-bar" style="height:60%"></div>
                  <div class="mock-bar" style="height:70%"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- ── Live Stats ───────────────────────────────────── -->
      <section class="stats-section">
        <div class="section-inner">
          <h2>System at a Glance</h2>
          <p class="section-sub">Live numbers from across Dire Dawa's sanitation network</p>
          <div class="public-stats-grid" id="public-stats-grid">
            ${spinnerHTML}
          </div>
        </div>
      </section>

      <!-- ── Features ─────────────────────────────────────── -->
      <section class="features-section" id="features-section">
        <div class="section-inner">
          <h2>Key Features</h2>
          <p class="section-sub">Everything needed to run a city-wide cleaning operation digitally</p>
          <div class="features-grid">
            <div class="feature-card">
              <div class="feature-icon">🏪</div>
              <h3>Business Fee Management</h3>
              <p>Track monthly cleaning fee targets, record payments, auto-generate receipts, and monitor paid/pending/overdue status for every shop, hotel, cafe, and market in each zone.</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">🔍</div>
              <h3>Daily Inspections</h3>
              <p>Zone leaders log daily inspections with status (active/warning/danger), notes, and photo evidence — giving collectors and admins real-time visibility into ground conditions.</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">👷</div>
              <h3>Worker & Attendance Management</h3>
              <p>Maintain worker profiles per zone, record daily attendance with bonuses, and automatically calculate gross wages for payroll processing.</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">🔧</div>
              <h3>Tools & Equipment Tracking</h3>
              <p>Each zone manages its own inventory of vehicles, equipment, uniforms, and chemicals — with condition status (good/fair/poor/broken) for maintenance planning.</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">📝</div>
              <h3>Zone Reports Workflow</h3>
              <p>Leaders submit structured monthly reports (workers present/absent, collections, issues, actions taken) which flow up to collectors for review and approval.</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">📊</div>
              <h3>Dashboards & Analytics</h3>
              <p>Real-time charts showing collection progress vs. targets, monthly trends, and per-kebele breakdowns — scoped automatically to each user's role and zone.</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">👥</div>
              <h3>Role-Based Access Control</h3>
              <p>Four-tier hierarchy (Admin → Collector → Zone Leader → Worker) ensures every user sees and edits only what's relevant to their responsibility.</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">📋</div>
              <h3>Reports & CSV Export</h3>
              <p>Generate monthly/yearly payment reports, worker payroll summaries, and inspection logs — export to CSV for offline records or further analysis.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ── About ────────────────────────────────────────── -->
      <section class="about-section" id="about-section">
        <div class="section-inner">
          <h2>About the System</h2>
          <div class="about-grid">
            <div class="about-card">
              <h3>🎯 Mission</h3>
              <p>To digitize and streamline Dire Dawa's urban sanitation management —
              replacing paper-based fee collection and inspection logs with a transparent,
              auditable, real-time system that improves accountability at every level
              of the cleaning administration.</p>
            </div>
            <div class="about-card">
              <h3>👤 Who Uses It</h3>
              <p><strong>Admins</strong> oversee the entire city, manage user accounts and
              assign collectors/leaders. <strong>Collectors</strong> manage one of 9 kebeles,
              reviewing reports from their zone leaders. <strong>Zone Leaders</strong> run
              day-to-day operations in their assigned safer zone — managing workers, tools,
              inspections, and business payments. <strong>Viewers</strong> get read-only
              access to dashboards and reports for oversight and planning.</p>
            </div>
            <div class="about-card">
              <h3>🔄 Workflow</h3>
              <p>Each of the 9 kebeles is divided into 12 safer zones (108 total). A
              Zone Leader collects business fees, logs daily inspections, tracks worker
              attendance and zone tools, then submits a monthly Zone Report. The
              Collector reviews and approves these reports for their kebele, while the
              Admin maintains overall system configuration, user accounts, and
              kebele/zone assignments.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Demo / Walkthrough ───────────────────────────── -->
      <section class="demo-section" id="demo-section">
        <div class="section-inner">
          <h2>Demo & Walkthrough</h2>
          <p class="section-sub">For stakeholders, supervisors, and training purposes</p>
          <div class="demo-grid">
            <div class="demo-video-wrap">
              <div class="demo-video-placeholder">
                <div class="play-button">▶</div>
                <p>System Walkthrough Video</p>
                <span>Coming soon — request a live walkthrough below</span>
              </div>
            </div>
            <div class="demo-info">
              <h3>Want a Live Demo?</h3>
              <p>We offer guided walkthroughs for kebele administrators, collectors, and
              new zone leaders covering:</p>
              <ul class="demo-list">
                <li>✅ Logging in and navigating your role-specific dashboard</li>
                <li>✅ Recording business payments and printing receipts</li>
                <li>✅ Submitting daily inspections with photos</li>
                <li>✅ Managing worker attendance and salary payments</li>
                <li>✅ Submitting and reviewing zone reports</li>
              </ul>
              <button class="btn btn-primary" id="demo-contact-btn">📅 Request a Walkthrough</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Contact / Support ───────────────────────────── -->
      <section class="contact-section" id="contact-section">
        <div class="section-inner">
          <h2>Contact & Support</h2>
          <p class="section-sub">Need help with your account or have a technical issue?</p>
          <div class="contact-grid">
            <div class="contact-card">
              <div class="contact-icon">🛟</div>
              <h3>Technical Support</h3>
              <p>Email: <a href="mailto:support@diredawa-cleaning.gov.et">support@diredawa-cleaning.gov.et</a></p>
              <p>Phone: <a href="tel:+251911000000">+251 91 100 0000</a></p>
              <p>Hours: Mon–Fri, 8:30 AM – 5:30 PM EAT</p>
            </div>
            <div class="contact-card">
              <div class="contact-icon">🏛️</div>
              <h3>System Administration</h3>
              <p>For account creation, role changes, or zone/leader reassignment,
              contact your System Administrator.</p>
              <p>Admin Office: Dire Dawa City Administration — Sanitation Department</p>
            </div>
            <div class="contact-card">
              <div class="contact-icon">🔑</div>
              <h3>Already Have an Account?</h3>
              <p>Use the credentials provided by your administrator to sign in.</p>
              <button class="btn btn-primary" style="margin-top:.5rem" id="contact-login-btn">Go to Login →</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Footer ───────────────────────────────────────── -->
      <footer class="landing-footer">
        <div class="section-inner footer-inner">
          <div>🧹 <strong>Dire Dawa Cleaning Management System</strong></div>
          <div class="footer-meta">© ${new Date().getFullYear()} Dire Dawa City Administration · Sanitation Department</div>
          <div class="footer-links">
            <a href="#about-section">About</a>
            <a href="#contact-section">Contact</a>
            <button class="btn btn-sm btn-outline" id="footer-login-btn">Staff Login</button>
          </div>
        </div>
      </footer>
    </div>`;

  // Wire up login buttons
  ["nav-login-btn","hero-login-btn","contact-login-btn","footer-login-btn"].forEach(id=>{
    document.getElementById(id)?.addEventListener("click",()=>navigate("login"));
  });

  document.getElementById("demo-contact-btn")?.addEventListener("click",()=>{
    document.getElementById("contact-section").scrollIntoView({behavior:"smooth"});
  });

  document.getElementById("landing-hamburger")?.addEventListener("click",()=>{
    document.querySelector(".landing-nav-links")?.classList.toggle("open");
  });

  // Smooth scroll for in-page anchors
  document.querySelectorAll('.landing-nav-links a[href^="#"]').forEach(a=>{
    a.addEventListener("click",e=>{
      e.preventDefault();
      document.querySelector(a.getAttribute("href"))?.scrollIntoView({behavior:"smooth"});
      document.querySelector(".landing-nav-links")?.classList.remove("open");
    });
  });

  // Load live stats
  try{
    const stats=await API.getPublicStats();
    const grid=document.getElementById("public-stats-grid");
    grid.innerHTML=`
      <div class="pub-stat"><div class="pub-stat-value">${stats.kebeles}</div><div class="pub-stat-label">Kebeles</div></div>
      <div class="pub-stat"><div class="pub-stat-value">${stats.zones}</div><div class="pub-stat-label">Safer Zones</div></div>
      <div class="pub-stat"><div class="pub-stat-value">${stats.leadersAssigned}</div><div class="pub-stat-label">Zone Leaders Assigned</div></div>
      <div class="pub-stat"><div class="pub-stat-value">${stats.businesses}</div><div class="pub-stat-label">Registered Businesses</div></div>
      <div class="pub-stat"><div class="pub-stat-value">${stats.workers}</div><div class="pub-stat-label">Active Workers</div></div>
      <div class="pub-stat"><div class="pub-stat-value">${stats.inspectionsLast30Days}</div><div class="pub-stat-label">Inspections (30 days)</div></div>
      <div class="pub-stat"><div class="pub-stat-value">${fmtETB(stats.collectedThisMonth)}</div><div class="pub-stat-label">Collected This Month</div></div>
      <div class="pub-stat"><div class="pub-stat-value">${stats.approvedReports}</div><div class="pub-stat-label">Approved Zone Reports</div></div>
    `;
  }catch(err){
    document.getElementById("public-stats-grid").innerHTML=
      `<p style="text-align:center;color:var(--gray-500);grid-column:1/-1">Stats unavailable — backend may be offline</p>`;
  }
}
