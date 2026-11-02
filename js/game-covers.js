/* Published gameplay stills. Never run legacy preview games on the homepage. */
(function(root){
 'use strict';
 const keys=['football','basketball','bowling','volleyball','fishing','race','target-shooting','qatar-runner','qatar-hero','classic','puzzle'];
 function resolve(key,custom){
  const current='assets/game-covers/'+key+'.20261102.jpg';
  if(!keys.includes(key))return custom||'';
  if(!custom)return current;
  // Migrate saved built-in paths, while keeping teacher-uploaded covers.
  try{const url=new URL(custom,location.href);if(url.origin===location.origin&&url.pathname.endsWith('/assets/game-covers/'+key+'.svg'))return current;}catch{}
  return custom;
 }
 function refresh(){document.querySelectorAll('[data-scene] img').forEach(img=>{const key=img.closest('[data-scene]').dataset.scene;const src=resolve(key,img.getAttribute('src'));if(src&&img.getAttribute('src')!==src)img.src=src;});}
 root.ManaratCovers={resolve,refresh};
})(window);
