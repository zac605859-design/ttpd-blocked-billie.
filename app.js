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
  ["categories","winnerSeasonOptions","memberGrid","announcements","galleryGrid"].forEach(id => { if ($(id)) $(id).innerHTML = '<p class="muted">Connect Supabase to load this section. See README.md.</p>'; });
  $("votingStatus").textContent = "Setup required";
}
async function loadPublic() {
  if (!db) return unavailable();
  await Promise.all([loadVoting(), loadWinners(), loadMembers(), loadAnnouncements(), loadGallery()]);
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
  const {data: editions, error} = await db.from("award_editions").select("id,title,year").eq("published",true).order("year",{ascending:true}).order("created_at",{ascending:true});
  const options = $("winnerSeasonOptions");
  const results = $("winnerSeasonResults");
  if (error) { options.innerHTML = '<p class="muted">Could not load published seasons.</p>'; return; }
  if (!editions?.length) { options.innerHTML = '<p class="muted">No seasons have been published yet.</p>'; results.innerHTML = ''; return; }
  const ids = editions.map(e=>e.id);
  const {data: winners, error: winnerError} = await db.from("winner_entries").select("edition_id,category_name,nominee_name").in("edition_id",ids);
  if (winnerError) { options.innerHTML = '<p class="muted">Could not load winner records.</p>'; return; }
  options.innerHTML = editions.map((e,i)=>`<button type="button" class="winner-season-button${i===0?' active':''}" data-edition-id="${e.id}"><span>${escapeHtml(e.title)}</span><small>${e.year}</small></button>`).join("");
  const showSeason = id => {
    const edition = editions.find(e=>e.id===id);
    const rows = (winners||[]).filter(w=>w.edition_id===id);
    results.innerHTML = `<div class="winner-season-heading"><div class="eyebrow">${edition.year}</div><h3>${escapeHtml(edition.title)}</h3></div>` + (rows.length ? `<div class="winner-list">${rows.map(w=>`<article class="winner-row"><strong>${escapeHtml(w.category_name)}</strong><span>${escapeHtml(w.nominee_name)}</span></article>`).join("")}</div>` : '<p class="muted">No winners have been added to this season yet.</p>');
    options.querySelectorAll(".winner-season-button").forEach(b=>b.classList.toggle("active",b.dataset.editionId===id));
  };
  options.onclick = e => { const button=e.target.closest("button[data-edition-id]"); if(button) showSeason(button.dataset.editionId); };
  showSeason(editions[0].id);
}

let allPublicMembers = [];
let visibleMemberCount = 5;
const MEMBER_PAGE_SIZE = 5;

function renderMembers() {
  const grid = $("memberGrid");
  const shown = allPublicMembers.slice(0, visibleMemberCount);
  grid.innerHTML = shown.length ? shown.map(m=>`<article class="member-card"><div class="member-top">${m.avatar_url?`<img class="avatar" src="${safeUrl(m.avatar_url)}" alt="">`:`<div class="avatar">${escapeHtml((m.display_name||"?").slice(0,1).toUpperCase())}</div>`}<div><h3>${escapeHtml(m.display_name)}</h3><div class="handle">${escapeHtml(m.handle||"")}</div></div></div><p>${escapeHtml(m.bio||"")}</p></article>`).join("") : '<p class="muted">Member profiles will appear here.</p>';
  const button = $("loadMoreMembers");
  if (button) {
    button.classList.toggle("hidden", visibleMemberCount >= allPublicMembers.length);
    button.textContent = `Show more (${Math.min(MEMBER_PAGE_SIZE, allPublicMembers.length-visibleMemberCount)} more)`;
  }
}

async function loadMembers() {
  const {data,error}=await db.from("members")
    .select("id,display_name,handle,bio,avatar_url,created_at")
    .eq("visible",true)
    .order("created_at", {ascending:true});
  if(error){$("memberGrid").innerHTML='<p class="muted">Could not load member profiles.</p>';return;}
  allPublicMembers = data || [];
  visibleMemberCount = MEMBER_PAGE_SIZE;
  renderMembers();
}

async function loadAdminMembers() {
  const container = $("memberManagementList");
  if (!container || !db) return;
  const {data, error} = await db.from("members")
    .select("id,display_name,handle,bio,avatar_url,visible,created_at")
    .order("created_at", {ascending:true});
  if (error) {
    container.innerHTML = '<p class="muted">Could not load members: ' + escapeHtml(error.message) + '</p>';
    return;
  }
  if (!data?.length) {
    container.innerHTML = '<p class="muted">No member profiles have been added yet.</p>';
    return;
  }
  container.innerHTML = data.map(m => `
    <div class="admin-member-item" data-member-id="${escapeHtml(m.id)}">
      <div class="admin-member-row">
        <div class="admin-member-summary">
          ${m.avatar_url && safeUrl(m.avatar_url)
            ? `<img class="avatar" src="${escapeHtml(safeUrl(m.avatar_url))}" alt="">`
            : `<div class="avatar">${escapeHtml((m.display_name||"?").slice(0,1).toUpperCase())}</div>`}
          <div>
            <h4>${escapeHtml(m.display_name)}</h4>
            <div class="handle">${escapeHtml(m.handle||"")}</div>
            <div class="fine-print">${m.visible ? "Visible in public directory" : "Hidden from public directory"}</div>
          </div>
        </div>
        <div class="admin-member-actions">
          <button type="button" class="button secondary small" data-action="edit">Edit</button>
          <button type="button" class="button secondary small" data-action="delete">Delete</button>
        </div>
      </div>
      <form class="admin-member-edit hidden">
        <label>Display name<input name="display_name" required maxlength="100" value="${escapeHtml(m.display_name||"")}"></label>
        <label>Handle<input name="handle" maxlength="100" value="${escapeHtml(m.handle||"")}"></label>
        <label>Short bio<textarea name="bio" maxlength="500">${escapeHtml(m.bio||"")}</textarea></label>
        <label>Avatar image URL<input name="avatar_url" type="url" placeholder="https://..." value="${escapeHtml(m.avatar_url||"")}"></label>
        <label class="switch-line"><input name="visible" type="checkbox" ${m.visible ? "checked" : ""}> Show in public directory</label>
        <div class="admin-member-edit-actions">
          <button type="submit" class="button primary small">Save changes</button>
          <button type="button" class="button secondary small" data-action="cancel">Cancel</button>
        </div>
      </form>
    </div>`).join("");
}

async function loadAnnouncements() {
  const {data,error}=await db.from("announcements")
    .select("title,body,created_at,is_pinned")
    .eq("published",true)
    .order("created_at",{ascending:false})
    .limit(20);
  if(error){
    $("announcements").innerHTML='<p class="muted">Could not load announcements.</p>';
    $("pinnedNewsTicker").classList.add("hidden");
    return;
  }
  const pinned = (data || []).filter(a => a.is_pinned);
  const ticker = $("pinnedNewsTicker");
  if (pinned.length) {
    ticker.innerHTML = `<div class="pinned-news-label">PINNED</div><div class="pinned-news-track">${[...pinned,...pinned].map(a=>`<span>${escapeHtml(a.title)}</span>`).join("")}</div>`;
    ticker.classList.remove("hidden");
  } else {
    ticker.innerHTML = "";
    ticker.classList.add("hidden");
  }
  $("announcements").innerHTML=data?.length?data.map(a=>`<article class="announcement">${a.is_pinned?'<span class="pinned-tag">PINNED</span> ':''}<time>${new Date(a.created_at).toLocaleDateString()}</time><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.body)}</p></article>`).join(""):'<p class="muted">No announcements yet.</p>';
}
async function loadGallery() {
  const grid = $("galleryGrid");
  if (!grid) return;
  const {data, error} = await db.from("gallery_images").select("id,image_url,caption,created_at").order("created_at",{ascending:false});
  if (error) { grid.innerHTML = '<p class="muted">Could not load gallery. Check that the gallery SQL migration has been run.</p>'; return; }
  grid.innerHTML = data?.length ? data.map(item=>`<figure class="gallery-item"><img src="${escapeHtml(safeUrl(item.image_url))}" alt="${escapeHtml(item.caption||"Community gallery image")}" loading="lazy"><figcaption>${escapeHtml(item.caption||"")}</figcaption></figure>`).join("") : '<p class="muted">No gallery images have been added yet.</p>';
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
  if(isAdmin){const {data}=await db.from("site_settings").select("value").eq("key","voting_open").maybeSingle();$("votingToggle").checked=data?.value===true;await loadAdminMembers();}
  return isAdmin;
}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!db)return;const {error}=await db.auth.signInWithPassword({email:$("adminEmail").value,password:$("adminPassword").value});message("loginMessage",error?error.message:"Signed in.",!!error);await requireAdmin();});
$("signOut").addEventListener("click",async()=>{await db.auth.signOut();await requireAdmin();});
$("votingToggle").addEventListener("change",async e=>{const {error}=await db.from("site_settings").upsert({key:"voting_open",value:e.target.checked},{onConflict:"key"});message("adminMessage",error?.message||"Voting setting updated.",!!error);await loadVoting();});
$("refreshData").addEventListener("click",loadPublic);
$("loadMoreMembers").addEventListener("click",()=>{visibleMemberCount+=MEMBER_PAGE_SIZE;renderMembers();});
$("categoryForm").addEventListener("submit",async e=>{e.preventDefault();const {error}=await db.from("categories").insert({name:$("newCategory").value.trim()});message("adminMessage",error?.message||"Category added.",!!error);e.target.reset();await loadVoting();});
$("nomineeForm").addEventListener("submit",async e=>{e.preventDefault();const {error}=await db.from("nominees").insert({category_id:$("nomineeCategory").value,name:$("newNominee").value.trim()});message("adminMessage",error?.message||"Nominee added.",!!error);e.target.reset();await loadVoting();});
$("memberForm").addEventListener("submit",async e=>{e.preventDefault();const avatar=$("memberAvatar").value.trim();const safeAvatar=avatar?safeUrl(avatar):null;if(avatar&&!safeAvatar){message("adminMessage","Enter a valid http:// or https:// avatar URL.",true);return;}const {error}=await db.from("members").insert({display_name:$("memberName").value.trim(),handle:$("memberHandle").value.trim(),bio:$("memberBio").value.trim(),avatar_url:safeAvatar});message("adminMessage",error?.message||"Member profile added.",!!error);if(!error){e.target.reset();await Promise.all([loadMembers(),loadAdminMembers()]);}});

const memberManagement = $("memberManagementList");
if (memberManagement) {
  memberManagement.addEventListener("click", async e => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;
    const item = button.closest(".admin-member-item");
    if (!item) return;
    const action = button.dataset.action;
    if (action === "edit") {
      item.querySelector(".admin-member-edit").classList.remove("hidden");
      item.querySelector('input[name="display_name"]').focus();
    } else if (action === "cancel") {
      item.querySelector(".admin-member-edit").classList.add("hidden");
    } else if (action === "delete") {
      const displayName = item.querySelector("h4")?.textContent || "this member";
      if (!confirm(`Delete ${displayName}? This cannot be undone.`)) return;
      button.disabled = true;
      const {error} = await db.from("members").delete().eq("id", item.dataset.memberId);
      message("adminMessage", error?.message || "Member deleted.", !!error);
      if (error) button.disabled = false;
      else await Promise.all([loadAdminMembers(), loadMembers()]);
    }
  });

  memberManagement.addEventListener("submit", async e => {
    const form = e.target.closest(".admin-member-edit");
    if (!form) return;
    e.preventDefault();
    const item = form.closest(".admin-member-item");
    const values = new FormData(form);
    const avatarInput = String(values.get("avatar_url") || "").trim();
    const avatar = avatarInput ? safeUrl(avatarInput) : null;
    if (avatarInput && !avatar) {
      message("adminMessage", "Enter a valid http:// or https:// avatar URL.", true);
      return;
    }
    const updates = {
      display_name: String(values.get("display_name") || "").trim(),
      handle: String(values.get("handle") || "").trim(),
      bio: String(values.get("bio") || "").trim(),
      avatar_url: avatar,
      visible: form.elements.visible.checked
    };
    if (!updates.display_name) {
      message("adminMessage", "Display name is required.", true);
      return;
    }
    const saveButton = form.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    const {error} = await db.from("members").update(updates).eq("id", item.dataset.memberId);
    message("adminMessage", error?.message || "Member profile updated.", !!error);
    saveButton.disabled = false;
    if (!error) await Promise.all([loadAdminMembers(), loadMembers()]);
  });
}

$("announcementForm").addEventListener("submit",async e=>{e.preventDefault();const {error}=await db.from("announcements").insert({title:$("announcementTitle").value.trim(),body:$("announcementBody").value.trim(),published:true,is_pinned:$("announcementPinned").checked});message("adminMessage",error?.message||"Announcement published.",!!error);if(!error){e.target.reset();await loadAnnouncements();}});
$("galleryForm").addEventListener("submit",async e=>{e.preventDefault();const imageUrl=safeUrl($("galleryImageUrl").value.trim());if(!imageUrl){message("adminMessage","Enter a valid direct http:// or https:// image URL.",true);return;}const {error}=await db.from("gallery_images").insert({image_url:imageUrl,caption:$("galleryCaption").value.trim()||null});message("adminMessage",error?.message||"Gallery image added.",!!error);if(!error){e.target.reset();await loadGallery();}});
$("editionForm").addEventListener("submit",async e=>{e.preventDefault();const {error}=await db.from("award_editions").insert({title:$("editionTitle").value.trim(),year:Number($("editionYear").value),published:false});message("adminMessage",error?.message||"Draft edition created. Add winner records and publish it using the SQL instructions in README.",!!error);e.target.reset();});
if(db){db.auth.onAuthStateChange(()=>requireAdmin());loadPublic();requireAdmin();}else{unavailable();$("adminLogin").classList.add("hidden");$("adminPanel").classList.remove("hidden");$("adminPanel").innerHTML='<p><strong>Setup required:</strong> add your Supabase URL and anon key in <code>app.js</code>, then refresh.</p>';}
