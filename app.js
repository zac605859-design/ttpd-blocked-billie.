// Configure these two values in Supabase project settings before publishing.
const SUPABASE_URL = "https://shmwwirfrbnbxymprgqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_9glptDeHOUtju4g6mBJYLw_ryhIzAZx";
const configured = !SUPABASE_URL.startsWith("YOUR_") && !SUPABASE_ANON_KEY.startsWith("YOUR_");
const db = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (id) => document.getElementById(id);
const browserId = (() => {
  let id = localStorage.getItem("tbb_browser_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("tbb_browser_id", id); }
  return id;
})();
let categoryCache = [];

function message(id, text, error=false) {
  const el = $(id); if (el) { el.textContent = text; el.style.color = error ? "#a12d43" : "#42664c"; }
}
function unavailable() {
  ["categories","winnerEvents","memberGrid","announcements"].forEach(id => { if ($(id)) $(id).innerHTML = '<p class="muted">Connect Supabase to load this section. See README.md.</p>'; });
  $("votingStatus").textContent = "Setup required";
}
async function loadPublic() {
  if (!db) return unavailable();
  await Promise.all([loadVoting(), loadWinners(), loadMembers(), loadAnnouncements()]);
}
async function loadVoting() {
  const {data: setting} = await db.from("site_settings").select("value").eq("key","voting_open").maybeSingle();
  const isOpen = setting?.value === true;
  $("votingStatus").textContent = isOpen ? "VOTING OPEN" : "VOTING CLOSED";
  $("votingClosed").classList.toggle("hidden", isOpen);
  $("ballotForm").classList.toggle("hidden", !isOpen);
  const {data, error} = await db.from("categories").select("id,name,nominees(id,name)").eq("active",true).order("sort_order").order("name");
  if (error) { $("categories").innerHTML = '<p class="muted">Could not load categories.</p>'; return; }
  categoryCache = data || [];
  $("categories").innerHTML = categoryCache.length ? categoryCache.map(c => `<article class="category-card"><h3>${escapeHtml(c.name)}</h3>${(c.nominees||[]).map(n=>`<label class="nominee"><input type="radio" name="category-${c.id}" value="${n.id}" required><span>${escapeHtml(n.name)}</span></label>`).join("") || '<p class="muted">No nominees added yet.</p>'}</article>`).join("") : '<p class="muted">No active categories yet.</p>';
  $("nomineeCategory").innerHTML = categoryCache.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}
async function loadWinners() {
  const {data: editions, error} = await db.from("award_editions").select("id,title,year").eq("published",true).order("year",{ascending:false});
  if (error) { $("winnerEvents").innerHTML = '<p class="muted">Could not load published editions.</p>'; return; }
  if (!editions?.length) { $("winnerEvents").innerHTML = '<p class="muted">No editions have been published yet.</p>'; return; }
  const ids = editions.map(e=>e.id);
  const {data: winners, error: winnerError} = await db.from("winner_entries").select("edition_id,category_name,nominee_name").in("edition_id",ids);
  if (winnerError) { $("winnerEvents").innerHTML = '<p class="muted">Could not load winner records.</p>'; return; }
  $("winnerEvents").innerHTML = editions.map(e=>`<article class="event-card"><div class="eyebrow">${e.year}</div><h3>${escapeHtml(e.title)}</h3><ul>${(winners||[]).filter(w=>w.edition_id===e.id).map(w=>`<li><strong>${escapeHtml(w.category_name)}</strong><br>${escapeHtml(w.nominee_name)}</li>`).join("")}</ul></article>`).join("");
}
async function loadMembers() {
  const {data,error}=await db.from("members").select("display_name,handle,bio,avatar_url").eq("visible",true).order("display_name");
  if(error){$("memberGrid").innerHTML='<p class="muted">Could not load member profiles.</p>';return;}
  $("memberGrid").innerHTML=data?.length?data.map(m=>`<article class="member-card"><div class="member-top">${m.avatar_url?`<img class="avatar" src="${safeUrl(m.avatar_url)}" alt="">`:`<div class="avatar">${escapeHtml((m.display_name||"?").slice(0,1).toUpperCase())}</div>`}<div><h3>${escapeHtml(m.display_name)}</h3><div class="handle">${escapeHtml(m.handle||"")}</div></div></div><p>${escapeHtml(m.bio||"")}</p></article>`).join(""):'<p class="muted">Member profiles will appear here.</p>';
}
async function loadAnnouncements() {
  const {data,error}=await db.from("announcements").select("title,body,created_at").eq("published",true).order("created_at",{ascending:false}).limit(20);
  if(error){$("announcements").innerHTML='<p class="muted">Could not load announcements.</p>';return;}
  $("announcements").innerHTML=data?.length?data.map(a=>`<article class="announcement"><time>${new Date(a.created_at).toLocaleDateString()}</time><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.body)}</p></article>`).join(""):'<p class="muted">No announcements yet.</p>';
}
function escapeHtml(value) { return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function safeUrl(value) { try { const u=new URL(value); return ["https:","http:"].includes(u.protocol)?u.href:""; } catch { return ""; } }

$("menuToggle").addEventListener("click",()=>$("mainNav").classList.toggle("open"));
document.querySelectorAll("#mainNav a").forEach(a=>a.addEventListener("click",()=>$("mainNav").classList.remove("open")));
$("ballotForm").addEventListener("submit",async e=>{
  e.preventDefault(); if(!db)return;
  const choices=categoryCache.map(c=>({category_id:c.id,nominee_id:$(`ballotForm input[name="category-${c.id}"]:checked`)?.value})).filter(x=>x.nominee_id);
  if(choices.length!==categoryCache.length){message("voteMessage","Choose one nominee in every active category.",true);return;}
  const {error}=await db.rpc("submit_community_ballot",{p_browser_id:browserId,p_choices:choices});
  message("voteMessage",error?(error.message.includes("duplicate")?"A ballot has already been submitted from this browser.":error.message):"Ballot submitted.",!!error);
  if(!error)$("submitBallot").disabled=true;
});

async function requireAdmin() {
  const {data:{session}}=await db.auth.getSession();
  const isAdmin=session?.user?.app_metadata?.role==="admin";
  $("adminLogin").classList.toggle("hidden",!!isAdmin);
  $("adminPanel").classList.toggle("hidden",!isAdmin);
  if(isAdmin){const {data}=await db.from("site_settings").select("value").eq("key","voting_open").maybeSingle();$("votingToggle").checked=data?.value===true;}
  return isAdmin;
}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!db)return;const {error}=await db.auth.signInWithPassword({email:$("adminEmail").value,password:$("adminPassword").value});message("loginMessage",error?error.message:"Signed in.",!!error);await requireAdmin();});
$("signOut").addEventListener("click",async()=>{await db.auth.signOut();await requireAdmin();});
$("votingToggle").addEventListener("change",async e=>{const {error}=await db.from("site_settings").upsert({key:"voting_open",value:e.target.checked},{onConflict:"key"});message("adminMessage",error?.message||"Voting setting updated.",!!error);await loadVoting();});
$("refreshData").addEventListener("click",loadPublic);
$("categoryForm").addEventListener("submit",async e=>{e.preventDefault();const {error}=await db.from("categories").insert({name:$("newCategory").value.trim()});message("adminMessage",error?.message||"Category added.",!!error);e.target.reset();await loadVoting();});
$("nomineeForm").addEventListener("submit",async e=>{e.preventDefault();const {error}=await db.from("nominees").insert({category_id:$("nomineeCategory").value,name:$("newNominee").value.trim()});message("adminMessage",error?.message||"Nominee added.",!!error);e.target.reset();await loadVoting();});
$("memberForm").addEventListener("submit",async e=>{e.preventDefault();const avatar=$("memberAvatar").value.trim();const {error}=await db.from("members").insert({display_name:$("memberName").value.trim(),handle:$("memberHandle").value.trim(),bio:$("memberBio").value.trim(),avatar_url:avatar?safeUrl(avatar):null});message("adminMessage",error?.message||"Member profile added.",!!error);e.target.reset();await loadMembers();});
$("announcementForm").addEventListener("submit",async e=>{e.preventDefault();const {error}=await db.from("announcements").insert({title:$("announcementTitle").value.trim(),body:$("announcementBody").value.trim(),published:true});message("adminMessage",error?.message||"Announcement published.",!!error);e.target.reset();await loadAnnouncements();});
$("editionForm").addEventListener("submit",async e=>{e.preventDefault();const {error}=await db.from("award_editions").insert({title:$("editionTitle").value.trim(),year:Number($("editionYear").value),published:false});message("adminMessage",error?.message||"Draft edition created. Add winner records and publish it using the SQL instructions in README.",!!error);e.target.reset();});
if(db){db.auth.onAuthStateChange(()=>requireAdmin());loadPublic();requireAdmin();}else{unavailable();$("adminLogin").classList.add("hidden");$("adminPanel").classList.remove("hidden");$("adminPanel").innerHTML='<p><strong>Setup required:</strong> add your Supabase URL and anon key in <code>app.js</code>, then refresh.</p>';}
