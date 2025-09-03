// Smooth sidebar
const sidebar = document.getElementById('sidebar');
const hamb = document.getElementById('hamburger');
const closeBtn = document.getElementById('closeSidebar');

function openSidebar(){ sidebar?.classList.add('open'); }
function closeSidebar(){ sidebar?.classList.remove('open'); }

hamb?.addEventListener('click', openSidebar);
closeBtn?.addEventListener('click', closeSidebar);

// Close on ESC or click outside (mobile friendly)
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeSidebar(); });
document.addEventListener('click', (e)=>{
  if(!sidebar) return;
  if(!sidebar.contains(e.target) && !hamb.contains(e.target)) closeSidebar();
});

// Simple carousel dots sync
function setupCarouselDots(){
  const wrap = document.querySelector('.carousel');
  if(!wrap) return;
  const track = wrap.querySelector('.carousel-track');
  const dots = [...wrap.querySelectorAll('.carousel-dots .dot')];
  const set = ()=>{
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    dots.forEach((d,i)=>d.classList.toggle('active', i===idx));
  };
  track?.addEventListener('scroll', ()=>requestAnimationFrame(set));
  set();
}
document.addEventListener('DOMContentLoaded', setupCarouselDots);

document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
});