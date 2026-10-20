import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
// Local fonts make preview and export independent of installed system fonts.
if (typeof document !== 'undefined') {
 const handle=delayRender('Loading project Inter fonts');
 Promise.all([
  new FontFace('Inter',`url(${staticFile('fonts/Inter-Regular.ttf')})`,{weight:'400'}),
  new FontFace('Inter',`url(${staticFile('fonts/Inter-SemiBold.ttf')})`,{weight:'600'}),
 ].map(async font=>{const loaded=await font.load();document.fonts.add(loaded);})).then(()=>continueRender(handle)).catch(cancelRender);
}

// Coolvetica (шрифт монтажа, editing-profile.json → captionFont) в шаблон не
// входит: лицензия Typodermic запрещает передавать файл. Каждый скачивает свою
// бесплатную копию и кладёт в public/fonts-local/ (см. README.md там).
// Файла нет — тихо остаёмся на системной Coolvetica или Tahoma, рендер не падает.
// У шрифта одно начертание: диапазон 100–900, иначе браузер дорисует
// «фальшивый жирный».
const COOLVETICA_FILES=['Coolvetica-Regular.ttf','Coolvetica-Regular.otf','coolvetica rg.otf','coolvetica rg.ttf'];
if (typeof document !== 'undefined') {
 const handle=delayRender('Loading Coolvetica from public/fonts-local');
 (async()=>{
  for(const file of COOLVETICA_FILES){
   try{
    const font=await new FontFace('Coolvetica',`url("${staticFile(`fonts-local/${file}`)}")`,{weight:'100 900'}).load();
    document.fonts.add(font);
    return;
   }catch{/* нет такого файла — пробуем следующее имя */}
  }
 })().finally(()=>continueRender(handle));
}
