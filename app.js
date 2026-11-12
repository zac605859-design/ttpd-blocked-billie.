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
  ["categories","winnerSeasonOptions","adminGrid","memberGrid","announcements","galleryAlbumsGrid"].forEach(id => { if ($(id)) $(id).innerHTML = '<p class="muted">Connect Supabase to load this section. See README.md.</p>'; });
  $("votingStatus").textContent = "Setup required";
}
async function loadPublic() {
  if (!db) return unavailable();

  await Promise.all([
    loadVoting(),
    loadWinners(),
    loadMembers(),
    loadAnnouncements(),
    loadGallery(),
    loadCommunityEvents(),
    loadCommunityScoreboard()
  ]);
}
async function loadVoting() {
  const {data: setting} = await db.from("site_settings").select("value").eq("key","voting_open").maybeSingle();
  const isOpen = setting?.value === true;
  $("votingStatus").textContent = isOpen ? "VOTING OPEN" : "VOTING CLOSED";
  $("votingClosed").classList.toggle("hidden", isOpen);
  $("ballotForm").classList.toggle("hidden", !isOpen);
  const {data, error} = await db.from("categories").select("id,name,nominees(id,name)").eq("active",true).order("sort_order");
  if (error) { $("categories").innerHTML = '<p class="muted">Could not load categories.</p>'; return; }
  categoryCache = data || [];
  $("categories").innerHTML = categoryCache.length ? categoryCache.map(c => `<article class="category-card"><h3>${escapeHtml(c.name)}</h3>${(c.nominees||[]).map(n=>`<label class="nominee"><input type="radio" name="category-${c.id}" value="${n.id}" required><span>${escapeHtml(n.name)}</span></label>`).join("") || '<p class="muted">No nominees added yet.</p>'}</article>`).join("") : '<p class="muted">No active categories yet.</p>';
  // The public ballot uses active categories, but admins must be able to
  // add nominees to any category, including categories not currently active.
  const nomineeCategory = $("nomineeCategory");
  const previousCategory = nomineeCategory.value;
  const { data: allCategories, error: allCategoriesError } = await db
    .from("categories")
    .select("id,name")
    .order("sort_order");

  const nomineeCategories = allCategoriesError ? categoryCache : (allCategories || []);
  nomineeCategory.innerHTML = nomineeCategories.map(c =>
    `<option value="${c.id}">${escapeHtml(c.name)}</option>`
  ).join("");

  if (nomineeCategories.some(c => c.id === previousCategory)) {
    nomineeCategory.value = previousCategory;
  }
}
async function loadWinners() {
  const {data: editions, error} = await db.from("award_editions").select("id,title,month,year").eq("published",true).order("year",{ascending:true}).order("month",{ascending:true}).order("created_at",{ascending:true});
  const options = $("winnerSeasonOptions");
  const results = $("winnerSeasonResults");
  if (error) { options.innerHTML = '<p class="muted">Could not load published seasons.</p>'; return; }
  if (!editions?.length) { options.innerHTML = '<p class="muted">No seasons have been published yet.</p>'; results.innerHTML = ''; return; }
  const ids = editions.map(e=>e.id);
  const {data: winners, error: winnerError} = await db.from("winner_entries").select("edition_id,category_name,nominee_name").in("edition_id",ids);
  if (winnerError) { options.innerHTML = '<p class="muted">Could not load winner records.</p>'; return; }
  options.innerHTML = editions.map((e,i)=>`<button type="button" class="winner-season-button${i===0?' active':''}" data-edition-id="${e.id}"><span>${escapeHtml(e.title)}</span><small>${new Date(Number(e.year), Number(e.month || 1) - 1).toLocaleString("en", {month:"long"})} ${e.year}</small></button>`).join("");
  const showSeason = id => {
    const edition = editions.find(e=>e.id===id);
    const rows = (winners||[]).filter(w=>w.edition_id===id);
    results.innerHTML = `<div class="winner-season-heading"><div class="eyebrow">${new Date(Number(edition.year), Number(edition.month || 1) - 1).toLocaleString("en", {month:"long"})} ${edition.year}</div><h3>${escapeHtml(edition.title)}</h3></div>` + (rows.length ? `<div class="winner-list">${rows.map(w=>`<article class="winner-row"><strong>${escapeHtml(w.category_name)}</strong><span>${escapeHtml(w.nominee_name)}</span></article>`).join("")}</div>` : '<p class="muted">No winners have been added to this season yet.</p>');
    options.querySelectorAll(".winner-season-button").forEach(b=>b.classList.toggle("active",b.dataset.editionId===id));
  };
  options.onclick = e => { const button=e.target.closest("button[data-edition-id]"); if(button) showSeason(button.dataset.editionId); };
  showSeason(editions[0].id);
}

const directoryState = {
  admins: { rows: [], visible: 5, gridId: "adminGrid", moreId: "loadMoreAdmins", managementId: "adminManagementList", table: "admins", label: "admin" },
  members: { rows: [], visible: 5, gridId: "memberGrid", moreId: "loadMoreMembers", managementId: "memberManagementList", table: "members", label: "member" }
};
const DIRECTORY_PAGE_SIZE = 5;
function renderDirectory(key) {
  const state=directoryState[key], grid=$(state.gridId); if(!grid)return;
  const shown=state.rows.slice(0,state.visible);
  grid.innerHTML=shown.length?shown.map(m=>`<article class="member-card"><div class="member-top">${m.avatar_url?`<img class="avatar" src="${safeUrl(m.avatar_url)}" alt="">`:`<div class="avatar">${escapeHtml((m.display_name||"?").slice(0,1).toUpperCase())}</div>`}<div><h3>${escapeHtml(m.display_name)}</h3><div class="handle">${escapeHtml(m.handle||"")}</div></div></div><p>${escapeHtml(m.bio||"")}</p></article>`).join(""):`<p class="muted">${key==="admins"?"Admin":"Member"} profiles will appear here.</p>`;
  const button=$(state.moreId); if(button){button.classList.toggle("hidden",state.visible>=state.rows.length);button.textContent=`Show more (${Math.min(DIRECTORY_PAGE_SIZE,state.rows.length-state.visible)} more)`;}
}
async function loadDirectory(key){const state=directoryState[key],grid=$(state.gridId);const {data,error}=await db.from(state.table).select("id,display_name,handle,bio,avatar_url,created_at").eq("visible",true).order("created_at",{ascending:true});if(error){if(grid)grid.innerHTML=`<p class="muted">Could not load ${state.label} profiles.</p>`;return;}state.rows=data||[];state.visible=DIRECTORY_PAGE_SIZE;renderDirectory(key);}
async function loadDirectoryManagement(key){const state=directoryState[key],container=$(state.managementId);if(!container||!db)return;const {data,error}=await db.from(state.table).select("id,display_name,handle,bio,avatar_url,visible,created_at").order("created_at",{ascending:true});if(error){container.innerHTML=`<p class="muted">Could not load ${state.label}s: ${escapeHtml(error.message)}</p>`;return;}if(!data?.length){container.innerHTML=`<p class="muted">No ${state.label} profiles have been added yet.</p>`;return;}
container.innerHTML=data.map(m=>`<div class="admin-member-item" data-directory-key="${key}" data-member-id="${escapeHtml(m.id)}"><div class="admin-member-row"><div class="admin-member-summary">${m.avatar_url&&safeUrl(m.avatar_url)?`<img class="avatar" src="${escapeHtml(safeUrl(m.avatar_url))}" alt="">`:`<div class="avatar">${escapeHtml((m.display_name||"?").slice(0,1).toUpperCase())}</div>`}<div><h4>${escapeHtml(m.display_name)}</h4><div class="handle">${escapeHtml(m.handle||"")}</div><div class="fine-print">${m.visible?"Visible in public directory":"Hidden from public directory"}</div></div></div><div class="admin-member-actions"><button type="button" class="button secondary small" data-action="edit">Edit</button><button type="button" class="button secondary small" data-action="delete">Delete</button></div></div><form class="admin-member-edit hidden"><label>Display name<input name="display_name" required maxlength="100" value="${escapeHtml(m.display_name||"")}"></label><label>Handle<input name="handle" maxlength="100" value="${escapeHtml(m.handle||"")}"></label><label>Short bio<textarea name="bio" maxlength="500">${escapeHtml(m.bio||"")}</textarea></label><label>Avatar image URL<input name="avatar_url" type="url" placeholder="https://..." value="${escapeHtml(m.avatar_url||"")}"></label><label class="switch-line"><input name="visible" type="checkbox" ${m.visible?"checked":""}> Show in public directory</label><div class="admin-member-edit-actions"><button type="submit" class="button primary small">Save changes</button><button type="button" class="button secondary small" data-action="cancel">Cancel</button></div></form></div>`).join("");}
async function loadMembers() {
  await Promise.all([
    loadDirectory("admins"),
    loadDirectory("members")
  ]);

  const { data, error } = await db.rpc("get_directory_counts");

  if (error || !data?.length) return;

  $("adminCount").textContent = `(${data[0].admin_count})`;
  $("memberCount").textContent = `(${data[0].member_count})`;
}
async function loadAdminMembers(){await Promise.all([loadDirectoryManagement("admins"),loadDirectoryManagement("members")]);}

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
    ticker.innerHTML = `<div class="pinned-news-track">${[...pinned,...pinned].map(a=>`<span>${escapeHtml(a.title)}</span>`).join("")}</div>`;
    ticker.classList.remove("hidden");
  } else {
    ticker.innerHTML = "";
    ticker.classList.add("hidden");
  }
  $("announcements").innerHTML=data?.length?data.map(a=>`<article class="announcement">${a.is_pinned?'<span class="pinned-tag">PINNED</span> ':''}<time>${new Date(a.created_at).toLocaleDateString()}</time><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.body)}</p></article>`).join(""):'<p class="muted">No announcements yet.</p>';
}
let galleryAlbumsCache = [];

async function loadGallery() {
  const grid = $("galleryAlbumsGrid");
  const viewer = $("galleryAlbumViewer");
  if (!grid || !db) return;

  const { data: albums, error } = await db
    .from("gallery_albums")
    .select("id,title,display_order,created_at")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    grid.innerHTML = `<p class="muted">Could not load gallery seasons: ${escapeHtml(error.message)}</p>`;
    return;
  }

  galleryAlbumsCache = albums || [];

  if (!galleryAlbumsCache.length) {
    grid.innerHTML = '<p class="muted">No seasons have been added yet.</p>';
    if (viewer) viewer.classList.add("hidden");
    return;
  }

  const albumIds = galleryAlbumsCache.map(album => album.id);
  const { data: images, error: imageError } = await db
    .from("gallery_album_images")
    .select("id,album_id,image_url,caption,display_order")
    .in("album_id", albumIds)
    .order("display_order", { ascending: true });

  if (imageError) {
    grid.innerHTML = `<p class="muted">Could not load gallery images: ${escapeHtml(imageError.message)}</p>`;
    return;
  }

  const imagesByAlbum = {};
  (images || []).forEach(image => {
    if (!imagesByAlbum[image.album_id]) imagesByAlbum[image.album_id] = [];
    imagesByAlbum[image.album_id].push(image);
  });

  grid.innerHTML = galleryAlbumsCache.map(album => {
    const albumImages = imagesByAlbum[album.id] || [];
    const cover = albumImages[0];

    return `
      <button type="button"
        class="gallery-album-card"
        data-gallery-album-id="${escapeHtml(album.id)}">
        <div class="gallery-album-cover">
          ${cover && safeUrl(cover.image_url)
            ? `<img src="${escapeHtml(safeUrl(cover.image_url))}" alt="${escapeHtml(album.title)}" loading="lazy">`
            : '<div class="gallery-album-placeholder">No cover image</div>'}
        </div>
        <div class="gallery-album-card-info">
          <h3>${escapeHtml(album.title)}</h3>
          <span>${albumImages.length} ${albumImages.length === 1 ? "photo" : "photos"}</span>
        </div>
      </button>`;
  }).join("");

  grid.querySelectorAll("[data-gallery-album-id]").forEach(button => {
    button.addEventListener("click", () => {
      showGalleryAlbum(button.dataset.galleryAlbumId, imagesByAlbum);
    });
  });

  if (viewer) viewer.classList.add("hidden");
}

function showGalleryAlbum(albumId, imagesByAlbum) {
  const album = galleryAlbumsCache.find(item => item.id === albumId);
  if (!album) return;

  const viewer = $("galleryAlbumViewer");
  const title = $("galleryAlbumViewerTitle");
  const content = $("galleryAlbumViewerContent");
  const grid = $("galleryAlbumsGrid");

  if (!viewer || !content || !title) return;

  const images = imagesByAlbum[albumId] || [];

  title.textContent = album.title;
  content.innerHTML = images.length
    ? images.map(image => `
        <figure class="gallery-album-image">
          <img src="${escapeHtml(safeUrl(image.image_url))}"
               alt="${escapeHtml(image.caption || album.title)}"
               loading="lazy">
          ${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ""}
        </figure>
      `).join("")
    : '<p class="muted">No images have been added to this season yet.</p>';

  grid.classList.add("hidden");
  viewer.classList.remove("hidden");
  viewer.scrollIntoView({ behavior: "smooth", block: "start" });
}

$("galleryBackButton")?.addEventListener("click", () => {
  $("galleryAlbumViewer").classList.add("hidden");
  $("galleryAlbumsGrid").classList.remove("hidden");
  $("gallery").scrollIntoView({ behavior: "smooth", block: "start" });
});

async function loadGalleryAdmin() {
  const box = $("galleryAdminManagementList");
  if (!box || !db) return;

  const { data: albums, error } = await db
    .from("gallery_albums")
    .select("id,title,display_order,created_at")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    box.innerHTML = `<p class="muted">Could not load seasons: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!albums?.length) {
    box.innerHTML = '<p class="muted">No gallery seasons yet.</p>';
    return;
  }

  const { data: images, error: imageError } = await db
    .from("gallery_album_images")
    .select("id,album_id,image_url,caption,display_order")
    .in("album_id", albums.map(album => album.id))
    .order("display_order", { ascending: true });

  if (imageError) {
    box.innerHTML = `<p class="muted">Could not load album images: ${escapeHtml(imageError.message)}</p>`;
    return;
  }

  box.innerHTML = albums.map(album => {
    const albumImages = (images || []).filter(image => image.album_id === album.id);

    return `
      <div class="gallery-admin-album" data-album-id="${escapeHtml(album.id)}">
        <div class="gallery-admin-album-heading">
          <div>
            <h4>${escapeHtml(album.title)}</h4>
            <p class="fine-print">${albumImages.length} of 4 images</p>
          </div>
          <div class="admin-management-actions">
            <button type="button" class="button secondary small" data-action="edit-album">Edit season</button>
            <button type="button" class="button secondary small" data-action="delete-album">Delete season</button>
          </div>
        </div>
        <div class="gallery-admin-thumbnails">
          ${albumImages.map(image => `
            <div class="gallery-admin-thumbnail" data-image-id="${escapeHtml(image.id)}">
              <img src="${escapeHtml(safeUrl(image.image_url))}" alt="">
              <span>${escapeHtml(image.caption || `Image ${image.display_order}`)}</span>
              <button type="button" class="button secondary small" data-action="delete-image">Delete image</button>
            </div>
          `).join("")}
        </div>
      </div>`;
  }).join("");
}

function resetGalleryAlbumForm() {
  $("galleryAlbumForm").reset();
  $("galleryAlbumId").value = "";
  $("galleryAlbumSaveButton").textContent = "Create season";
  $("galleryAlbumCancelButton").classList.add("hidden");
}

async function editGalleryAlbum(albumId) {
  const { data: album, error } = await db
    .from("gallery_albums")
    .select("id,title")
    .eq("id", albumId)
    .single();

  if (error) {
    message("adminMessage", error.message, true);
    return;
  }

  const { data: images, error: imageError } = await db
    .from("gallery_album_images")
    .select("image_url,caption,display_order")
    .eq("album_id", albumId)
    .order("display_order", { ascending: true });

  if (imageError) {
    message("adminMessage", imageError.message, true);
    return;
  }

  $("galleryAlbumId").value = album.id;
  $("galleryAlbumTitle").value = album.title;

  for (let slot = 1; slot <= 4; slot++) {
    const image = (images || []).find(item => item.display_order === slot);
    $(`galleryImageUrl${slot}`).value = image?.image_url || "";
    $(`galleryCaption${slot}`).value = image?.caption || "";
  }

  $("galleryAlbumSaveButton").textContent = "Save changes";
  $("galleryAlbumCancelButton").classList.remove("hidden");
  $("galleryAlbumForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

function escapeHtml(value) { return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function safeUrl(value) { try { const u=new URL(value); return ["https:","http:"].includes(u.protocol)?u.href:""; } catch { return ""; } }

$("menuToggle").addEventListener("click",()=>$("mainNav").classList.toggle("open"));
document.querySelectorAll("#mainNav a").forEach(a=>a.addEventListener("click",()=>$("mainNav").classList.remove("open")));
$("ballotForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!db) return;

  const choices = categoryCache.map(c => ({
    category_id: c.id,
    nominee_id: document.querySelector(
      `#ballotForm input[name="category-${c.id}"]:checked`
    )?.value
  }));

  if (choices.some(choice => !choice.nominee_id)) {
    message("voteMessage", "Choose one nominee in every active category.", true);
    return;
  }

 const { error } = await db.rpc("submit_community_ballot", {
  p_browser_id: browserId,
  p_choices: choices
});

const errorText = [
  error?.message,
  error?.details,
  error?.hint
].filter(Boolean).join(" ");

const isDuplicate =
  error?.code === "23505" ||
  /duplicate key|unique constraint|already submitted/i.test(errorText);

if (isDuplicate) {
  message("voteMessage", "You already submitted your ballot.", true);
} else if (error) {
  message("voteMessage", "Submission failed: " + error.message, true);
} else {
  message("voteMessage", "Ballot submitted. Thank you for voting!", false);
  $("submitBallot").disabled = true;
}
async function loadCategoryManagement() {
  const box = $("categoryManagementList");
  if (!box || !db) return;

  const { data, error } = await db
    .from("categories")
    .select("id,name,active,sort_order")
    .order("sort_order");

  if (error) {
    box.innerHTML = `<p class="muted">Could not load categories: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!data?.length) {
    box.innerHTML = '<p class="muted">No categories found.</p>';
    return;
  }

  box.innerHTML = data.map(c => `
    <article class="admin-management-item" data-category-id="${escapeHtml(c.id)}">
      <div class="admin-management-head">
        <div>
          <h4>${escapeHtml(c.name)}</h4>
          <small class="fine-print">${c.active ? "Active" : "Inactive"}</small>
        </div>
        <div class="admin-management-actions">
          <button type="button" class="button secondary small" data-action="edit-category">Edit</button>
          <button type="button" class="button secondary small" data-action="delete-category">Delete</button>
        </div>
      </div>
      <form class="admin-edit-form hidden">
        <input name="name" required maxlength="120" value="${escapeHtml(c.name)}">
        <label class="switch-line">
          <input name="active" type="checkbox" ${c.active ? "checked" : ""}>
          Active for voting
        </label>
        <div class="admin-management-actions">
          <button type="submit" class="button primary small">Save changes</button>
          <button type="button" class="button secondary small" data-action="cancel-edit">Cancel</button>
        </div>
      </form>
    </article>
  `).join("");
}

async function loadNomineeManagement() {
  const box = $("nomineeManagementList");
  if (!box || !db) return;

  const [{ data: nominees, error }, { data: categories, error: categoryError }] =
    await Promise.all([
      db.from("nominees").select("id,name,category_id").order("created_at"),
      db.from("categories").select("id,name").order("sort_order")
    ]);

  if (error || categoryError) {
    box.innerHTML = `<p class="muted">Could not load nominees: ${escapeHtml((error || categoryError).message)}</p>`;
    return;
  }

  if (!nominees?.length) {
    box.innerHTML = '<p class="muted">No nominees found.</p>';
    return;
  }

  const groupedMarkup = categories.map(category => {
    const categoryNominees = nominees.filter(n => n.category_id === category.id);
    if (!categoryNominees.length) return "";

    return `
      <section class="nominee-category-group">
        <h3>${escapeHtml(category.name)}</h3>
        ${categoryNominees.map(n => `
          <article class="admin-management-item" data-nominee-id="${escapeHtml(n.id)}">
            <div class="admin-management-head">
              <div>
                <h4>${escapeHtml(n.name)}</h4>
              </div>
              <div class="admin-management-actions">
                <button type="button" class="button secondary small" data-action="edit-nominee">Edit</button>
                <button type="button" class="button secondary small" data-action="delete-nominee">Delete</button>
              </div>
            </div>
            <form class="admin-edit-form hidden">
              <input name="name" required maxlength="120" value="${escapeHtml(n.name)}">
              <select name="category_id" required>
                ${categories.map(c => `
                  <option value="${escapeHtml(c.id)}" ${c.id === n.category_id ? "selected" : ""}>
                    ${escapeHtml(c.name)}
                  </option>
                `).join("")}
              </select>
              <div class="admin-management-actions">
                <button type="submit" class="button primary small">Save changes</button>
                <button type="button" class="button secondary small" data-action="cancel-edit">Cancel</button>
              </div>
            </form>
          </article>
        `).join("")}
      </section>
    `;
  }).join("");

  const uncategorized = nominees.filter(n => !categories.some(c => c.id === n.category_id));
  const uncategorizedMarkup = uncategorized.length ? `
    <section class="nominee-category-group">
      <h3>Unassigned category</h3>
      ${uncategorized.map(n => `
        <article class="admin-management-item" data-nominee-id="${escapeHtml(n.id)}">
          <div class="admin-management-head">
            <div><h4>${escapeHtml(n.name)}</h4></div>
            <div class="admin-management-actions">
              <button type="button" class="button secondary small" data-action="edit-nominee">Edit</button>
              <button type="button" class="button secondary small" data-action="delete-nominee">Delete</button>
            </div>
          </div>
          <form class="admin-edit-form hidden">
            <input name="name" required maxlength="120" value="${escapeHtml(n.name)}">
            <select name="category_id" required>
              ${categories.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("")}
            </select>
            <div class="admin-management-actions">
              <button type="submit" class="button primary small">Save changes</button>
              <button type="button" class="button secondary small" data-action="cancel-edit">Cancel</button>
            </div>
          </form>
        </article>
      `).join("")}
    </section>
  ` : "";

  box.innerHTML = groupedMarkup + uncategorizedMarkup;
}
async function requireAdmin() {
  const {data:{session}}=await db.auth.getSession();
  const isAdmin=session?.user?.app_metadata?.role==="admin";
  $("adminLogin").classList.toggle("hidden",!!isAdmin);
  $("adminPanel").classList.toggle("hidden",!isAdmin);
  if (isAdmin) {
  const { data } = await db
    .from("site_settings")
    .select("value")
    .eq("key", "voting_open")
    .maybeSingle();

  $("votingToggle").checked = data?.value === true;

  await Promise.all([
    loadAdminMembers(),
    loadGalleryAdmin()
  ]);
}
  return isAdmin;
}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!db)return;const {error}=await db.auth.signInWithPassword({email:$("adminEmail").value,password:$("adminPassword").value});message("loginMessage",error?error.message:"Signed in.",!!error);await requireAdmin();});
$("signOut").addEventListener("click",async()=>{await db.auth.signOut();await requireAdmin();});
$("votingToggle").addEventListener("change",async e=>{const {error}=await db.from("site_settings").upsert({key:"voting_open",value:e.target.checked},{onConflict:"key"});message("adminMessage",error?.message||"Voting setting updated.",!!error);await loadVoting();});
$("refreshData").addEventListener("click",loadPublic);
$("loadMoreAdmins").addEventListener("click",()=>{directoryState.admins.visible+=DIRECTORY_PAGE_SIZE;renderDirectory("admins");});
$("loadMoreMembers").addEventListener("click",()=>{directoryState.members.visible+=DIRECTORY_PAGE_SIZE;renderDirectory("members");});
$("categoryForm").addEventListener("submit", async e => {
  e.preventDefault();

  const name = $("newCategory").value.trim();
  if (!name) {
    message("adminMessage", "Enter a category name.", true);
    return;
  }

  const { error } = await db.from("categories").insert({ name });
  message("adminMessage", error?.message || "Category added.", !!error);

  if (!error) {
    $("newCategory").value = "";
    await Promise.all([
      loadVoting(),
      loadCategoryManagement()
    ]);
  }
});

$("nomineeForm").addEventListener("submit", async e => {
  e.preventDefault();

  const selectedCategory = $("nomineeCategory").value;
  const nomineeName = $("newNominee").value.trim();

  if (!selectedCategory) {
    message("adminMessage", "Select a category first.", true);
    return;
  }
  if (!nomineeName) {
    message("adminMessage", "Enter a nominee name.", true);
    return;
  }

  const { error } = await db.from("nominees").insert({
    category_id: selectedCategory,
    name: nomineeName
  });

  message("adminMessage", error?.message || "Nominee added.", !!error);

  if (!error) {
    $("newNominee").value = "";
    await Promise.all([
      loadVoting(),
      loadNomineeManagement()
    ]);
    $("nomineeCategory").value = selectedCategory;
  }
});
async function addDirectoryEntry(e,key){e.preventDefault();const prefix=key==="admins"?"admin":"member",state=directoryState[key],avatarInput=$(prefix+"Avatar").value.trim(),avatar=avatarInput?safeUrl(avatarInput):null;if(avatarInput&&!avatar){message("adminMessage","Enter a valid http:// or https:// avatar URL.",true);return;}const {error}=await db.from(state.table).insert({display_name:$(prefix+"Name").value.trim(),handle:$(prefix+"Handle").value.trim(),bio:$(prefix+"Bio").value.trim(),avatar_url:avatar});message("adminMessage",error?.message||`${state.label} profile added.`,!!error);if(!error){e.target.reset();await Promise.all([loadMembers(),loadAdminMembers()]);}}
$("adminForm").addEventListener("submit",e=>addDirectoryEntry(e,"admins"));
$("memberForm").addEventListener("submit",e=>addDirectoryEntry(e,"members"));
["adminManagementList","memberManagementList"].forEach(id=>{const box=$(id);if(!box)return;box.addEventListener("click",async e=>{const button=e.target.closest("button[data-action]");if(!button)return;const item=button.closest(".admin-member-item");if(!item)return;const key=item.dataset.directoryKey,state=directoryState[key];if(button.dataset.action==="edit"){item.querySelector(".admin-member-edit").classList.remove("hidden");item.querySelector('input[name="display_name"]').focus();}else if(button.dataset.action==="cancel"){item.querySelector(".admin-member-edit").classList.add("hidden");}else if(button.dataset.action==="delete"){const name=item.querySelector("h4")?.textContent||`this ${state.label}`;if(!confirm(`Delete ${name}? This cannot be undone.`))return;button.disabled=true;const {error}=await db.from(state.table).delete().eq("id",item.dataset.memberId);message("adminMessage",error?.message||`${state.label} deleted.`,!!error);if(error)button.disabled=false;else await Promise.all([loadMembers(),loadAdminMembers()]);}});box.addEventListener("submit",async e=>{const form=e.target.closest(".admin-member-edit");if(!form)return;e.preventDefault();const item=form.closest(".admin-member-item"),key=item.dataset.directoryKey,state=directoryState[key],values=new FormData(form),avatarInput=String(values.get("avatar_url")||"").trim(),avatar=avatarInput?safeUrl(avatarInput):null;if(avatarInput&&!avatar){message("adminMessage","Enter a valid http:// or https:// avatar URL.",true);return;}const updates={display_name:String(values.get("display_name")||"").trim(),handle:String(values.get("handle")||"").trim(),bio:String(values.get("bio")||"").trim(),avatar_url:avatar,visible:form.elements.visible.checked};if(!updates.display_name){message("adminMessage","Display name is required.",true);return;}const save=form.querySelector('button[type="submit"]');save.disabled=true;const {error}=await db.from(state.table).update(updates).eq("id",item.dataset.memberId);message("adminMessage",error?.message||`${state.label} profile updated.`,!!error);save.disabled=false;if(!error)await Promise.all([loadMembers(),loadAdminMembers()]);});});
$("announcementForm").addEventListener("submit",async e=>{e.preventDefault();const {error}=await db.from("announcements").insert({title:$("announcementTitle").value.trim(),body:$("announcementBody").value.trim(),published:true,is_pinned:$("announcementPinned").checked});message("adminMessage",error?.message||"Announcement published.",!!error);if(!error){e.target.reset();await loadAnnouncements();}});
$("galleryAlbumForm").addEventListener("submit", async e => {
  e.preventDefault();

  const albumId = $("galleryAlbumId").value;
  const title = $("galleryAlbumTitle").value.trim();

  const selectedImages = [];

  for (let slot = 1; slot <= 4; slot++) {
    const rawUrl = $(`galleryImageUrl${slot}`).value.trim();
    const caption = $(`galleryCaption${slot}`).value.trim();

    if (!rawUrl) {
      if (caption) {
        message("adminMessage", `Image ${slot} has a caption but no image URL.`, true);
        return;
      }
      continue;
    }

    const imageUrl = safeUrl(rawUrl);

    if (!imageUrl) {
      message("adminMessage", `Image ${slot} needs a valid http:// or https:// URL.`, true);
      return;
    }

    selectedImages.push({
      image_url: imageUrl,
      caption: caption || null,
      display_order: slot
    });
  }

  if (!selectedImages.length) {
    message("adminMessage", "Add at least one image to this season.", true);
    return;
  }

  const saveButton = $("galleryAlbumSaveButton");
  saveButton.disabled = true;

  let savedAlbumId = albumId;

  if (albumId) {
    const { error } = await db
      .from("gallery_albums")
      .update({ title })
      .eq("id", albumId);

    if (error) {
      message("adminMessage", error.message, true);
      saveButton.disabled = false;
      return;
    }
  } else {
    const { data, error } = await db
      .from("gallery_albums")
      .insert({ title })
      .select("id")
      .single();

    if (error) {
      message("adminMessage", error.message, true);
      saveButton.disabled = false;
      return;
    }

    savedAlbumId = data.id;
  }

 // Get the images currently saved for this season
const { data: existingImages, error: existingError } = await db
  .from("gallery_album_images")
  .select("id,display_order")
  .eq("album_id", savedAlbumId);

if (existingError) {
  message("adminMessage", existingError.message, true);
  saveButton.disabled = false;
  return;
}

// Delete images whose slots are no longer being used
const usedSlots = selectedImages.map(image => image.display_order);

const removedIds = (existingImages || [])
  .filter(image => !usedSlots.includes(image.display_order))
  .map(image => image.id);

if (removedIds.length) {
  const { error: deleteError } = await db
    .from("gallery_album_images")
    .delete()
    .in("id", removedIds);

  if (deleteError) {
    message("adminMessage", deleteError.message, true);
    saveButton.disabled = false;
    return;
  }
}

// Update existing images or insert new ones
for (const image of selectedImages) {
  const existing = (existingImages || []).find(
    item => item.display_order === image.display_order
  );

  let result;

  if (existing) {
    result = await db
      .from("gallery_album_images")
      .update({
        image_url: image.image_url,
        caption: image.caption
      })
      .eq("id", existing.id);
  } else {
    result = await db
      .from("gallery_album_images")
      .insert({
        ...image,
        album_id: savedAlbumId
      });
  }

  if (result.error) {
    message("adminMessage", result.error.message, true);
    saveButton.disabled = false;
    return;
  }
}  message("adminMessage", albumId ? "Season updated." : "Season created.");
  resetGalleryAlbumForm();
  saveButton.disabled = false;

  await Promise.all([loadGallery(), loadGalleryAdmin()]);
});

$("galleryAlbumCancelButton").addEventListener("click", resetGalleryAlbumForm);

$("galleryAdminManagementList").addEventListener("click", async e => {
  const button = e.target.closest("button[data-action]");
  if (!button) return;

  const albumRow = button.closest("[data-album-id]");
  if (!albumRow) return;

  const albumId = albumRow.dataset.albumId;

  if (button.dataset.action === "edit-album") {
    await editGalleryAlbum(albumId);
    return;
  }

  if (button.dataset.action === "delete-album") {
    const title = albumRow.querySelector("h4")?.textContent || "this season";

    if (!confirm(`Delete ${title} and all its images? This cannot be undone.`)) return;

    button.disabled = true;

    const { error } = await db
      .from("gallery_albums")
      .delete()
      .eq("id", albumId);

    message("adminMessage", error?.message || "Season and its images deleted.", !!error);

    if (!error) {
      resetGalleryAlbumForm();
      await Promise.all([loadGallery(), loadGalleryAdmin()]);
    } else {
      button.disabled = false;
    }

    return;
  }

  if (button.dataset.action === "delete-image") {
    const imageBox = button.closest("[data-image-id]");
    const imageId = imageBox?.dataset.imageId;

    if (!imageId) return;

    const albumImages = albumRow.querySelectorAll("[data-image-id]");

    if (albumImages.length <= 1) {
      message("adminMessage", "A season must keep at least one image. Delete the season if you no longer need it.", true);
      return;
    }

    if (!confirm("Delete this image?")) return;

    button.disabled = true;

    const { error } = await db
      .from("gallery_album_images")
      .delete()
      .eq("id", imageId);

    message("adminMessage", error?.message || "Image deleted.", !!error);

    if (!error) {
      await Promise.all([loadGallery(), loadGalleryAdmin()]);
    } else {
      button.disabled = false;
    }
  }
});
$("editionForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const payload={title:$("editionTitle").value.trim(),month:Number($("editionMonth").value),year:Number($("editionYear").value),published:false};
  const {error}=await db.from("award_editions").insert(payload);
  message("adminMessage",error?.message||"Draft season created. Add its winners below, then publish it from Manage seasons and winners.",!!error);
  if(!error){e.target.reset();await loadWinnerManagement();}
});
if(db){db.auth.onAuthStateChange(()=>requireAdmin());loadPublic();requireAdmin();}else{unavailable();$("adminLogin").classList.add("hidden");$("adminPanel").classList.remove("hidden");$("adminPanel").innerHTML='<p><strong>Setup required:</strong> add your Supabase URL and anon key in <code>app.js</code>, then refresh.</p>';}

// --- Admin management: announcements, award seasons/winners, and one homepage event ---
let eventCountdownInterval = null;

async function loadAnnouncementManagement() {
  const box = $("announcementManagementList");
  if (!box || !db) return;
  const {data, error} = await db.from("announcements").select("id,title,body,published,is_pinned,created_at").order("created_at", {ascending:false});
  if (error) { box.innerHTML = `<p class="muted">Could not load announcements: ${escapeHtml(error.message)}</p>`; return; }
  if (!data?.length) { box.innerHTML = '<p class="muted">No announcements to manage.</p>'; return; }
  box.innerHTML = data.map(a => `<article class="admin-management-item" data-announcement-id="${a.id}">
    <div class="admin-management-head"><div><h4>${escapeHtml(a.title)} ${a.is_pinned ? '<span class="pinned-tag">PINNED</span>' : ''}</h4><p>${escapeHtml(a.body)}</p><small class="fine-print">${a.published ? 'Published' : 'Unpublished'} · ${new Date(a.created_at).toLocaleString()}</small></div>
    <div class="admin-management-actions"><button type="button" class="button secondary small" data-action="edit">Edit</button><button type="button" class="button secondary small" data-action="pin">${a.is_pinned ? 'Unpin' : 'Pin'}</button><button type="button" class="button secondary small" data-action="delete">Delete</button></div></div>
    <form class="admin-edit-form hidden"><input name="title" required maxlength="160" value="${escapeHtml(a.title)}"><textarea name="body" required>${escapeHtml(a.body)}</textarea><label class="switch-line"><input name="is_pinned" type="checkbox" ${a.is_pinned ? 'checked' : ''}> Pin on homepage</label><label class="switch-line"><input name="published" type="checkbox" ${a.published ? 'checked' : ''}> Published</label><div class="admin-management-actions"><button class="button primary small" type="submit">Save changes</button><button class="button secondary small" type="button" data-action="cancel">Cancel</button></div></form>
  </article>`).join("");
}

async function loadWinnerManagement() {
  const box = $("winnerManagementList");
  if (!box || !db) return;
  const {data: editions, error} = await db.from("award_editions").select("id,title,month,year,published,created_at").order("year", {ascending:true}).order("month", {ascending:true}).order("created_at", {ascending:true});
  if (error) { box.innerHTML = `<p class="muted">Could not load seasons: ${escapeHtml(error.message)}</p>`; return; }
  const seasonSelect = $("winnerEntrySeason");
  seasonSelect.innerHTML = (editions || []).map(e => `<option value="${e.id}">${escapeHtml(e.title)} (${new Date(Number(e.year), Number(e.month || 1) - 1).toLocaleString("en", {month:"long"})} ${e.year})</option>`).join("");
  if (!editions?.length) { box.innerHTML = '<p class="muted">Create a season first.</p>'; return; }
  const ids = editions.map(e => e.id);
  const {data: entries, error: entriesError} = await db.from("winner_entries").select("id,edition_id,category_name,nominee_name").in("edition_id", ids);
  if (entriesError) { box.innerHTML = `<p class="muted">Could not load winner entries: ${escapeHtml(entriesError.message)}</p>`; return; }
  box.innerHTML = editions.map(ed => {
    const rows = (entries || []).filter(w => w.edition_id === ed.id);
    return `<article class="admin-management-item" data-season-id="${ed.id}">
      <div class="admin-management-head"><div><h4>${escapeHtml(ed.title)} (${new Date(Number(ed.year), Number(ed.month || 1) - 1).toLocaleString("en", {month:"long"})} ${ed.year})</h4><small class="fine-print">${ed.published ? 'Published on website' : 'Draft — not visible publicly'} · ${rows.length} winner entries</small></div>
      <div class="admin-management-actions"><button type="button" class="button secondary small" data-action="edit-season">Edit season</button><button type="button" class="button secondary small" data-action="toggle-published">${ed.published ? 'Unpublish' : 'Publish'}</button><button type="button" class="button secondary small" data-action="delete-season">Delete season</button></div></div>
      <form class="admin-edit-form season-edit-form hidden"><input name="title" required value="${escapeHtml(ed.title)}"><select name="month" required>${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${Number(ed.month||1)===i+1?"selected":""}>${new Date(2000,i,1).toLocaleString("en",{month:"long"})}</option>`).join("")}</select><input name="year" type="number" min="2000" max="2100" required value="${ed.year}"><div class="admin-management-actions"><button class="button primary small" type="submit">Save season</button><button type="button" class="button secondary small" data-action="cancel">Cancel</button></div></form>
      <div class="admin-management-list season-winner-list">${rows.length ? rows.map(w => `<div class="admin-management-item" data-winner-id="${w.id}"><div class="admin-management-head"><div><h4>${escapeHtml(w.category_name)}</h4><p>${escapeHtml(w.nominee_name)}</p></div><div class="admin-management-actions"><button type="button" class="button secondary small" data-action="edit-winner">Edit</button><button type="button" class="button secondary small" data-action="delete-winner">Delete</button></div></div><form class="admin-edit-form winner-edit-form hidden"><input name="category_name" required value="${escapeHtml(w.category_name)}"><input name="nominee_name" required value="${escapeHtml(w.nominee_name)}"><div class="admin-management-actions"><button class="button primary small" type="submit">Save winner</button><button type="button" class="button secondary small" data-action="cancel">Cancel</button></div></form></div>`).join("") : '<p class="muted">No category winners added yet.</p>'}</div>
    </article>`;
  }).join("");
}

async function loadEventManagement() {
  const box = $("eventManagement");
  if (!box || !db) return;
  const {data, error} = await db.from("homepage_event").select("id,title,description,event_at").eq("id", true).maybeSingle();
  if (error) { box.innerHTML = `<p class="muted">Could not load event: ${escapeHtml(error.message)}. Run the event countdown SQL migration.</p>`; return; }
  if (!data) { box.innerHTML = '<p class="muted">No event countdown is currently set.</p>'; return; }
  box.innerHTML = `<article class="admin-management-item"><div class="admin-management-head"><div><h4>${escapeHtml(data.title)}</h4><p>${escapeHtml(data.description || '')}</p><small class="fine-print">${new Date(data.event_at).toLocaleString()}</small></div><div class="admin-management-actions"><button type="button" class="button secondary small" id="editEventButton">Edit</button><button type="button" class="button secondary small" id="deleteEventButton">Delete</button></div></div></article>`;
  $("editEventButton").addEventListener("click", () => {
    $("eventTitleInput").value = data.title;
    $("eventDescriptionInput").value = data.description || "";
    const date = new Date(data.event_at);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
    $("eventDateTimeInput").value = local;
    $("eventTitleInput").focus();
  });
  $("deleteEventButton").addEventListener("click", async () => {
    if (!confirm("Delete the homepage event countdown?")) return;
    const {error: deleteError} = await db.from("homepage_event").delete().eq("id", true);
    message("adminMessage", deleteError?.message || "Event countdown deleted.", !!deleteError);
    if (!deleteError) { await loadEventManagement(); await loadHomepageEvent(); }
  });
}
// --- Public community Events and Scoreboard ---

async function loadCommunityEvents() {
  const box = $("eventsGrid");
  if (!box || !db) return;

  const { data: events, error } = await db
    .from("events")
    .select("id,title,description,event_date")
    .eq("published", true)
    .order("event_date", { ascending: false });

  if (error) {
    box.innerHTML = `<p class="muted">Could not load events: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!events?.length) {
    box.innerHTML = '<p class="muted">No community events have been published yet.</p>';
    return;
  }

  const { data: winners, error: winnerError } = await db
    .from("event_winners")
    .select("event_id,category_name,winner_name")
    .in("event_id", events.map(event => event.id));

  if (winnerError) {
    box.innerHTML = `<p class="muted">Could not load event results: ${escapeHtml(winnerError.message)}</p>`;
    return;
  }

  box.innerHTML = events.map(event => {
    const rows = (winners || []).filter(w => w.event_id === event.id);

    return `
      <article class="event-result-card">
        <div class="eyebrow">
          ${event.event_date ? escapeHtml(new Date(event.event_date + "T00:00:00").toLocaleDateString()) : "Community event"}
        </div>
        <h3>${escapeHtml(event.title)}</h3>
        ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
        ${rows.length
          ? `<div class="winner-list">
              ${rows.map(w => `
                <article class="winner-row">
                  <strong>${escapeHtml(w.category_name)}</strong>
                  <span>${escapeHtml(w.winner_name)}</span>
                </article>
              `).join("")}
            </div>`
          : '<p class="muted">Results have not been added yet.</p>'}
      </article>
    `;
  }).join("");
}

async function loadCommunityScoreboard() {
  const box = $("scoreboardGrid");
  if (!box || !db) return;

  const { data: editions, error: editionError } = await db
    .from("award_editions")
    .select("id")
    .eq("published", true);

  if (editionError) {
    box.innerHTML = `<p class="muted">Could not load seasons: ${escapeHtml(editionError.message)}</p>`;
    return;
  }

  if (!editions?.length) {
    box.innerHTML = '<p class="muted">No published winners yet.</p>';
    return;
  }

  const { data, error } = await db
    .from("winner_entries")
    .select("edition_id, nominee_name")
    .in("edition_id", editions.map(e => e.id));

  if (error) {
    box.innerHTML = `<p class="muted">Could not load scoreboard: ${escapeHtml(error.message)}</p>`;
    return;
  }

  const rankings = new Map();

  (data || []).forEach(row => {
    const entry = String(row.nominee_name || "").trim();
    if (!entry) return;

    const parts = entry.split("/");
    const displayName = parts[0].trim();
    const handle = parts.length > 1
      ? parts.slice(1).join("/").trim()
      : displayName;

    const key = handle.toLowerCase();

    if (!rankings.has(key)) {
      rankings.set(key, {
        name: displayName,
        handle,
        wins: 0
      });
    }

    rankings.get(key).wins++;
  });

  const sorted = [...rankings.values()].sort(
    (a, b) => b.wins - a.wins || a.name.localeCompare(b.name)
  );

  if (!sorted.length) {
    box.innerHTML = '<p class="muted">No winner records found yet.</p>';
    return;
  }

  let previousWins = null;
  let rank = 0;

  box.innerHTML = sorted.map((person, index) => {
    if (person.wins !== previousWins) {
      rank = index + 1;
      previousWins = person.wins;
    }

    return `
  <article class="scoreboard-row">
    <strong class="scoreboard-index">${index + 1}</strong>
    <strong class="scoreboard-rank">#${rank}</strong>
    <span class="scoreboard-name">${escapeHtml(person.name)}</span>
    <strong class="scoreboard-wins">
      ${person.wins} ${person.wins === 1 ? "win" : "wins"}
    </strong>
  </article>
`;
  }).join("");
}
async function loadHomepageEvent() {
  const section = $("eventCountdownSection");
  if (!section || !db) return;
  const {data, error} = await db.from("homepage_event").select("title,description,event_at").eq("id", true).maybeSingle();
  if (error || !data) { section.classList.add("hidden"); if (eventCountdownInterval) clearInterval(eventCountdownInterval); return; }
  section.querySelector(".event-countdown-clock").innerHTML = '<div><strong id="eventDays">00</strong><span>Days</span></div><div><strong id="eventHours">00</strong><span>Hours</span></div><div><strong id="eventMinutes">00</strong><span>Minutes</span></div><div><strong id="eventSeconds">00</strong><span>Seconds</span></div>';
  $("eventCountdownTitle").textContent = data.title;
  $("eventCountdownDescription").textContent = data.description || "";
  const eventDate = new Date(data.event_at);
  $("eventCountdownDate").textContent = eventDate.toLocaleString(undefined, {dateStyle:"full", timeStyle:"short"});
  section.classList.remove("hidden");
  if (eventCountdownInterval) clearInterval(eventCountdownInterval);
  const update = () => {
    const remaining = eventDate.getTime() - Date.now();
    const clock = $("eventCountdownClock");
    if (remaining <= 0) {
      section.querySelector(".event-countdown-clock").innerHTML = '<div class="event-ended">EVENT STARTED</div>';
      clearInterval(eventCountdownInterval);
      return;
    }
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    $("eventDays").textContent = String(days).padStart(2,"0");
    $("eventHours").textContent = String(hours).padStart(2,"0");
    $("eventMinutes").textContent = String(minutes).padStart(2,"0");
    $("eventSeconds").textContent = String(seconds).padStart(2,"0");
  };
  update(); eventCountdownInterval = setInterval(update, 1000);
}

const announcementManagement = $("announcementManagementList");
announcementManagement?.addEventListener("click", async e => {
  const btn = e.target.closest("button[data-action]"); if (!btn) return;
  const item = btn.closest("[data-announcement-id]"); if (!item) return;
  const id = item.dataset.announcementId, action = btn.dataset.action;
  if (action === "edit") item.querySelector(".admin-edit-form").classList.remove("hidden");
  if (action === "cancel") item.querySelector(".admin-edit-form").classList.add("hidden");
  if (action === "pin") {
    const {data, error} = await db.from("announcements").select("is_pinned").eq("id", id).single();
    if (error) { message("adminMessage", error.message, true); return; }
    const {error: updateError} = await db.from("announcements").update({is_pinned: !data.is_pinned}).eq("id", id);
    message("adminMessage", updateError?.message || (data.is_pinned ? "Announcement unpinned." : "Announcement pinned."), !!updateError);
    if (!updateError) { await Promise.all([loadAnnouncementManagement(), loadAnnouncements()]); }
  }
  if (action === "delete") {
    if (!confirm("Delete this announcement? This cannot be undone.")) return;
    const {error} = await db.from("announcements").delete().eq("id", id);
    message("adminMessage", error?.message || "Announcement deleted.", !!error);
    if (!error) await Promise.all([loadAnnouncementManagement(), loadAnnouncements()]);
  }
});
announcementManagement?.addEventListener("submit", async e => {
  const form = e.target.closest(".admin-edit-form"); if (!form) return;
  e.preventDefault(); const item = form.closest("[data-announcement-id]"); const values = new FormData(form);
  const updates = {title:String(values.get("title")||"").trim(),body:String(values.get("body")||"").trim(),is_pinned:form.elements.is_pinned.checked,published:form.elements.published.checked};
  const {error} = await db.from("announcements").update(updates).eq("id", item.dataset.announcementId);
  message("adminMessage", error?.message || "Announcement updated.", !!error);
  if (!error) await Promise.all([loadAnnouncementManagement(), loadAnnouncements()]);
});

const winnerManagement = $("winnerManagementList");
winnerManagement?.addEventListener("click", async e => {
  const btn = e.target.closest("button[data-action]"); if (!btn) return;
  const season = btn.closest("[data-season-id]"); const action = btn.dataset.action;
  if (action === "edit-season") season.querySelector(".season-edit-form").classList.remove("hidden");
  if (action === "edit-winner") btn.closest("[data-winner-id]").querySelector(".winner-edit-form").classList.remove("hidden");
  if (action === "cancel") btn.closest("form").classList.add("hidden");
  if (action === "toggle-published") {
    const {data,error} = await db.from("award_editions").select("published").eq("id",season.dataset.seasonId).single();
    if (error) { message("adminMessage",error.message,true); return; }
    const {error:updateError}=await db.from("award_editions").update({published:!data.published}).eq("id",season.dataset.seasonId);
    message("adminMessage",updateError?.message||(data.published?"Season unpublished.":"Season published."),!!updateError);
    if(!updateError) await Promise.all([loadWinnerManagement(),loadWinners()]);
  }
  if (action === "delete-season") {
    if(!confirm("Delete this season and all its winner entries? This cannot be undone.")) return;
    const {error}=await db.from("award_editions").delete().eq("id",season.dataset.seasonId);
    message("adminMessage",error?.message||"Season deleted.",!!error);
    if(!error) await Promise.all([loadWinnerManagement(),loadWinners()]);
  }
  if (action === "delete-winner") {
    const row=btn.closest("[data-winner-id]");
    if(!confirm("Delete this category winner?")) return;
    const {error}=await db.from("winner_entries").delete().eq("id",row.dataset.winnerId);
    message("adminMessage",error?.message||"Winner deleted.",!!error);
    if(!error) await Promise.all([loadWinnerManagement(),loadWinners()]);
  }
});
winnerManagement?.addEventListener("submit", async e => {
  const form=e.target.closest(".admin-edit-form"); if(!form) return;
  e.preventDefault(); const season=form.closest("[data-season-id]"); const row=form.closest("[data-winner-id]");
  const values=new FormData(form);
  let result;
  if(row) result=await db.from("winner_entries").update({category_name:String(values.get("category_name")||"").trim(),nominee_name:String(values.get("nominee_name")||"").trim()}).eq("id",row.dataset.winnerId);
  else result=await db.from("award_editions").update({title:String(values.get("title")||"").trim(),month:Number(values.get("month")),year:Number(values.get("year"))}).eq("id",season.dataset.seasonId);
  message("adminMessage",result.error?.message||(row?"Winner updated.":"Season updated."),!!result.error);
  if(!result.error) await Promise.all([loadWinnerManagement(),loadWinners()]);
});

$("winnerEntryForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  const selectedSeason = $("winnerEntrySeason").value;
  const selectedCategory = $("winnerEntryCategory").value;

  const { error } = await db.from("winner_entries").insert({
    edition_id: selectedSeason,
    category_name: selectedCategory.trim(),
    nominee_name: $("winnerEntryName").value.trim()
  });

  message("adminMessage", error?.message || "Winner entry added.", !!error);

  if (!error) {
    $("winnerEntryName").value = "";
    await Promise.all([loadWinnerManagement(), loadWinners()]);
    $("winnerEntrySeason").value = selectedSeason;
    $("winnerEntryCategory").value = selectedCategory;
  }
});

$("eventForm")?.addEventListener("submit",async e=>{
  e.preventDefault(); const dateValue=$("eventDateTimeInput").value;
  if(!dateValue){message("adminMessage","Choose the event date and time.",true);return;}
  const eventAt=new Date(dateValue);
  if(Number.isNaN(eventAt.getTime())){message("adminMessage","Enter a valid event date and time.",true);return;}
  const payload={id:true,title:$("eventTitleInput").value.trim(),description:$("eventDescriptionInput").value.trim(),event_at:eventAt.toISOString()};
  const {error}=await db.from("homepage_event").upsert(payload,{onConflict:"id"});
  message("adminMessage",error?.message||"Homepage countdown saved.",!!error);
  if(!error) await Promise.all([loadEventManagement(),loadHomepageEvent()]);
});

// Extend the existing admin initialization without changing its authentication checks.
const originalRequireAdmin = requireAdmin;
requireAdmin = async function() {
  const isAdmin = await originalRequireAdmin();
  if (isAdmin) await Promise.all([
  loadAnnouncementManagement(),
  loadWinnerManagement(),
  loadEventManagement(),
  loadCategoryManagement(),
  loadNomineeManagement()
]);
  return isAdmin;
};
// Category and nominee edit/delete actions

["categoryManagementList", "nomineeManagementList"].forEach(id => {
  const box = $(id);
  if (!box) return;

  box.addEventListener("click", async e => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;

    const item = button.closest("[data-category-id], [data-nominee-id]");
    if (!item) return;

    const form = item.querySelector("form");
    const action = button.dataset.action;

    if (action === "edit-category" || action === "edit-nominee") {
      form.classList.remove("hidden");
      form.querySelector("input[name='name']").focus();
      return;
    }

    if (action === "cancel-edit") {
      form.classList.add("hidden");
      return;
    }

    if (action === "delete-category") {
      const name = item.querySelector("h4")?.textContent || "this category";

      if (!confirm(
        `Delete ${name}? Its nominees and associated votes may also be permanently deleted. This cannot be undone.`
      )) return;

      const { error } = await db
        .from("categories")
        .delete()
        .eq("id", item.dataset.categoryId);

      message("adminMessage", error?.message || "Category deleted.", !!error);

      if (!error) {
        await Promise.all([
          loadVoting(),
          loadCategoryManagement(),
          loadNomineeManagement()
        ]);
      }
      return;
    }

    if (action === "delete-nominee") {
      const name = item.querySelector("h4")?.textContent || "this nominee";

      if (!confirm(
        `Delete ${name}? Associated votes may also be permanently deleted. This cannot be undone.`
      )) return;

      const { error } = await db
        .from("nominees")
        .delete()
        .eq("id", item.dataset.nomineeId);

      message("adminMessage", error?.message || "Nominee deleted.", !!error);

      if (!error) {
        await Promise.all([
          loadVoting(),
          loadNomineeManagement()
        ]);
      }
    }
  });

  box.addEventListener("submit", async e => {
    const form = e.target.closest(".admin-edit-form");
    if (!form) return;

    e.preventDefault();

    const item = form.closest("[data-category-id], [data-nominee-id]");
    const values = new FormData(form);
    const name = String(values.get("name") || "").trim();

    if (!name) {
      message("adminMessage", "Name is required.", true);
      return;
    }

    const isCategory = item.hasAttribute("data-category-id");

    const updates = isCategory
      ? {
          name,
          active: form.elements.active.checked
        }
      : {
          name,
          category_id: String(values.get("category_id") || "")
        };

    const saveButton = form.querySelector("button[type='submit']");
    saveButton.disabled = true;

    const result = await db
      .from(isCategory ? "categories" : "nominees")
      .update(updates)
      .eq("id", isCategory
        ? item.dataset.categoryId
        : item.dataset.nomineeId);

    message(
      "adminMessage",
      result.error?.message || (isCategory ? "Category updated." : "Nominee updated."),
      !!result.error
    );

    saveButton.disabled = false;

    if (!result.error) {
      await Promise.all([
        loadVoting(),
        loadCategoryManagement(),
        loadNomineeManagement()
      ]);
    }
  });
});
if (db) { loadHomepageEvent(); requireAdmin(); }
