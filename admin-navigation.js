(() => {
  const start = () => {
    const panel = document.getElementById('adminPanel');
    const grid = panel?.querySelector('.admin-grid');
    if (!panel || !grid || document.getElementById('adminHub')) return;
    const cards = [...grid.querySelectorAll(':scope > .admin-card')];
    const titleOf = card => (card.querySelector('h3')?.textContent || '').trim().toLowerCase();
    const find = text => cards.find(c => titleOf(c).includes(text.toLowerCase()));
    const sections = [
      {id:'voting', title:'Voting', sub:'Voting controls, categories & nominees', match:['voting controls','add a category','add a nominee','manage voting categories','manage nominees']},
      {id:'community', title:'Community', sub:'Admins & members', match:['add an admin','manage admins','add a member','manage members']},
      {id:'news', title:'News', sub:'Publish, edit, pin & manage news', match:['manage announcements','publish an announcement']},
      {id:'gallery', title:'Gallery', sub:'Add and manage gallery seasons', match:['manage gallery seasons']},
      {id:'winners', title:'Winners', sub:'Unpublished results, publish seasons & manage winners', match:['manage seasons and winners','publish award edition']},
      {id:'countdown', title:'Countdown', sub:'Homepage countdown settings', match:['homepage event countdown']},
      {id:'events', title:'Events', sub:'Publish events & manage event winners', match:['create a community event','add event winners']},
    ];
    const hub = document.createElement('div'); hub.id='adminHub'; hub.className='admin-hub';
    hub.innerHTML = `<div class="admin-hub-heading"><span class="eyebrow">CONTROL CENTRE</span><h2>Choose a section</h2><p>Open a section to manage its content.</p></div><div class="admin-hub-grid">${sections.map(s=>`<a class="admin-hub-tile" href="#${s.id}"><span class="admin-tile-index">${String(sections.indexOf(s)+1).padStart(2,'0')}</span><span class="admin-tile-title">${s.title}</span><span class="admin-tile-sub">${s.sub}</span><span class="admin-tile-arrow">↗</span></a>`).join('')}</div>`;
    const views = document.createElement('div'); views.id='adminViews';
    sections.forEach(s => {
      const view=document.createElement('section'); view.className='admin-subpage'; view.id=`admin-view-${s.id}`; view.hidden=true;
      view.innerHTML=`<div class="admin-subpage-head"><a class="admin-back-link" href="#dashboard">← Dashboard</a><span class="eyebrow">ADMIN / ${s.title.toUpperCase()}</span><h2>${s.title}</h2><p>${s.sub}</p></div><div class="admin-subpage-content"></div>`;
      const content=view.querySelector('.admin-subpage-content');
      s.match.forEach(m=>{const card=find(m); if(card) content.appendChild(card);});
      if(s.id==='community'){
        const subnav=document.createElement('div'); subnav.className='admin-inner-tiles';
        subnav.innerHTML='<a href="#community-admins">Admins <span>Manage administrator profiles ↗</span></a><a href="#community-members">Members <span>Manage community members ↗</span></a>';
        content.prepend(subnav);
        ['Add an admin','Manage admins','Add a member','Manage members'].forEach((name)=>{const c=find(name.toLowerCase()); if(c){c.dataset.communityType=name.toLowerCase().includes('admin')?'admins':'members';}});
      }
      if(s.id==='winners'){
        const win=find('manage seasons and winners'); const edition=find('publish award edition');
        const subnav=document.createElement('div'); subnav.className='admin-inner-tiles winners-inner-tiles';
        subnav.innerHTML='<a href="#winners-unpublished">Unpublished Results <span>Review live or completed voting results ↗</span></a><a href="#winners-publish-season">Publish Season <span>Create a season for unavailable results ↗</span></a><a href="#winners-manage">Manage Winners <span>Edit or delete seasons and winner entries ↗</span></a>';
        content.prepend(subnav);
        const panels=document.createElement('div'); panels.className='admin-winner-panels';
        const pending=document.createElement('div'); pending.className='admin-winner-panel'; pending.id='winners-unpublished'; pending.innerHTML='<h3>Unpublished Results</h3><p class="fine-print">Live totals are shown from submitted ballots. After voting closes, review the final totals and publish the leading nominee in each category.</p><div id="unpublishedResults"><p class="muted">Loading voting results…</p></div>';
        const manual=document.createElement('div'); manual.className='admin-winner-panel'; manual.id='winners-publish-season'; manual.innerHTML='<h3>Publish Season</h3><p class="fine-print">For historical seasons or results unavailable in the voting database. Create a season, then add its winners below.</p>';
        if(edition) manual.appendChild(edition);
        const manage=document.createElement('div'); manage.className='admin-winner-panel'; manage.id='winners-manage'; manage.innerHTML='<h3>Manage Winners</h3><p class="fine-print">Edit or delete season titles, categories and winner names.</p>';
        if(win) manage.appendChild(win);
        panels.append(pending,manual,manage); content.appendChild(panels);
      }
      views.appendChild(view);
    });
    grid.replaceWith(hub); panel.appendChild(views);
    if (typeof loadUnpublishedResults === 'function') loadUnpublishedResults();
    const show = () => {
      const key=(location.hash||'#dashboard').slice(1);
      const isDashboard=key==='dashboard'||!key.startsWith('community-')&&!key.startsWith('winners-')&&!sections.some(s=>s.id===key);
      hub.hidden=!isDashboard;
      views.hidden=isDashboard;
      sections.forEach(s=>{const v=document.getElementById(`admin-view-${s.id}`); if(v) v.hidden=key!==s.id;});
      document.querySelectorAll('.admin-winner-panel').forEach(p=>p.hidden=key!==p.id);
      const communityType=key==='community-admins'?'admins':key==='community-members'?'members':null;
      const communityView=document.getElementById('admin-view-community');
      if(communityView){
        communityView.hidden=!(key==='community'||communityType);
        communityView.querySelectorAll('.admin-card[data-community-type]').forEach(c=>c.hidden=!!communityType&&c.dataset.communityType!==communityType);
      }
      if(key.startsWith('winners-')){const v=document.getElementById('admin-view-winners'); if(v)v.hidden=false;}
      if(key==='community'){communityView?.querySelectorAll('.admin-card[data-community-type]').forEach(c=>c.hidden=true);}
      if(key==='winners'){document.querySelectorAll('.admin-winner-panel').forEach(p=>p.hidden=true);}
    };
    window.addEventListener('hashchange',show); show();
    panel.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]'); if(a){const key=a.getAttribute('href').slice(1); if(key.startsWith('community-')||key.startsWith('winners-')){e.preventDefault(); location.hash=key;}}});
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
