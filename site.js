(function(){
  var ARTICULOS = [{"n": 1, "href": "articulo-001-verdad-autodidacta.html", "tipo": "probado", "fecha": "junio de 2026", "min": 6, "temas": ["Autonomía"], "titulo": "La verdad sobre ser autodidacta", "hook": "No naciste autodidacta. Te conviertes en uno cuando empiezas a practicar la habilidad de dirigirte a ti mismo."}, {"n": 2, "href": "articulo-002-mito-estilos-aprendizaje.html", "tipo": "probado", "fecha": "junio de 2026", "min": 4, "temas": ["Mitos", "Método"], "titulo": "Adiós al mito de los \"estilos de aprendizaje\"", "hook": "No \"somos\" visuales ni auditivos. La herramienta correcta la define lo que aprendes, no quién crees ser."}, {"n": 3, "href": "articulo-003-como-aprender-de-verdad.html", "tipo": "probado", "fecha": "junio de 2026", "min": 5, "temas": ["Memoria", "Método"], "titulo": "Cómo aprender de verdad: el arte de entrenar tu cerebro", "hook": "La repetición mecánica es cancelación de ruido. La recuperación activa es entrenamiento real."}, {"n": 4, "href": "articulo-004-estres-para-aprender.html", "tipo": "probado", "fecha": "junio de 2026", "min": 5, "temas": ["Cerebro"], "titulo": "El estrés no siempre es tu enemigo", "hook": "El estrés moderado le dice a tu cerebro: esto importa, no lo olvides."}, {"n": 5, "href": "articulo-005-motivacion-te-falla.html", "tipo": "probado", "fecha": "junio de 2026", "min": 5, "temas": ["Hábitos"], "titulo": "Por qué la motivación te falla siempre", "hook": "La motivación es una emoción. Los sistemas son arquitectura. Solo uno funciona cuando no tienes ganas."}, {"n": 6, "href": "articulo-006-mito-academia.html", "tipo": "probado", "fecha": "junio de 2026", "min": 6, "temas": ["Autonomía", "Mitos"], "titulo": "El mito de la academia", "hook": "El 70% de quienes pagan un curso nunca lo empiezan. El problema nunca fue el precio."}, {"n": 7, "href": "articulo-007-mito-nunca-olvidar.html", "tipo": "probado", "fecha": "julio de 2026", "min": 8, "temas": ["Memoria", "Mitos"], "titulo": "El mito de nunca olvidar", "hook": "El olvido no es un fallo de tu sistema. Es lo que evita que colapse."}, {"n": 8, "href": "articulo-008-verguenza-autoestima-trauma.html", "tipo": "abierto", "fecha": "agosto de 2026", "min": 8, "temas": ["Mente"], "titulo": "La voz en tu cabeza que no te deja aprender", "hook": "Quizás no eres flojo. Quizás alguien, hace muchos años, te convenció de que no eras capaz, y esa voz nunca se fue."}];
  var TIPO = {probado:'Método probado', abierto:'Tema abierto'};
  var TOTAL = ARTICULOS.length;
  function getProgress(){ try{ return JSON.parse(localStorage.getItem('ariasmind_progress')||'{}'); }catch(e){ return {}; } }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

  // Progreso de lectura dentro de un artículo
  var num = parseInt(document.body.getAttribute('data-article')||'0',10);
  if(num){
    var bar = document.getElementById('progress');
    var update = function(){
      var h = document.documentElement;
      var scrollable = h.scrollHeight - h.clientHeight;
      var pct = scrollable>0 ? Math.min(100, Math.round((h.scrollTop/scrollable)*100)) : 100;
      if(bar) bar.style.width = pct+'%';
      try{
        var data = getProgress();
        if(pct > (data[num]||0)){ data[num] = pct; localStorage.setItem('ariasmind_progress', JSON.stringify(data)); }
      }catch(e){}
    };
    window.addEventListener('scroll', update, {passive:true});
    update();
  }

  // Menú móvil
  var mb = document.getElementById('menuBtn'), nav = document.getElementById('siteNav');
  if(mb && nav){
    mb.addEventListener('click', function(){
      var o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o?'true':'false');
    });
    nav.addEventListener('click', function(e){ if(e.target.closest('a')){ nav.classList.remove('open'); mb.setAttribute('aria-expanded','false'); } });
  }

  // Música de fondo
  var mbtn = document.getElementById('musicBtn');
  if(mbtn){
    var label = document.getElementById('mLabel');
    var audio = new Audio('Musica.mp3');
    audio.loop = true; audio.volume = 0.35; audio.preload = 'none';
    var playing = false;
    mbtn.addEventListener('click', function(){
      if(!playing){
        audio.play().then(function(){ mbtn.classList.add('is-playing'); label.textContent = 'Pausar'; playing = true; }).catch(function(){});
      } else {
        audio.pause(); mbtn.classList.remove('is-playing'); label.textContent = 'Leer con música'; playing = false;
      }
    });
  }

  // Estadísticas: secciones vistas y clics
  if(typeof gtag === 'function'){
    var vistas = {};
    var zonas = document.querySelectorAll('#hero, #manifiesto, #archivo, #sugerencias, #origen, #senal, #pie');
    if(zonas.length && 'IntersectionObserver' in window){
      var so = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          if(en.isIntersecting && !vistas[en.target.id]){
            vistas[en.target.id] = true;
            gtag('event','section_view',{section_name:en.target.id, page_path:location.pathname});
            so.unobserve(en.target);
          }
        });
      },{threshold:.35});
      zonas.forEach(function(z){ so.observe(z); });
    }
    document.addEventListener('click', function(e){
      var el = e.target.closest('[data-track]');
      if(el) gtag('event','element_click',{element_name:el.getAttribute('data-track'), page_path:location.pathname});
    });
  }

  // Vista previa en el inicio: el más nuevo + el que tienes a medias
  var lista = document.getElementById('archivo-lista');
  if(lista){
    var progress = getProgress();
    var reciente = ARTICULOS[ARTICULOS.length-1];
    var enProgreso = null, mejor = 0;
    ARTICULOS.forEach(function(a){
      if(a.n === reciente.n) return;
      var p = progress[a.n] || 0;
      if(p > 0 && p < 90 && p >= mejor){ mejor = p; enProgreso = a; }
    });
    var segunda = enProgreso || ARTICULOS[0];
    var card = function(a, badge, feat){
      var ch = a.temas.map(function(t){ return '<span class="chip">'+t+'</span>'; }).join('');
      return '<a class="entry'+(feat?' feature':'')+'" href="'+a.href+'" data-art="'+a.n+'" data-track="inicio_art_'+a.n+'">'+
        '<span class="num">'+String(a.n).padStart(2,'0')+'</span>'+
        '<div class="body"><div class="chips">'+ch+'<span class="tag tag-'+a.tipo+'">'+TIPO[a.tipo]+'</span></div>'+
        '<h3>'+esc(a.titulo)+badge+'</h3><p class="hook">&ldquo;'+esc(a.hook)+'&rdquo;</p></div>'+
        '<span class="meta"><span>'+a.fecha+'</span><span>'+a.min+' min</span></span></a>';
    };
    lista.innerHTML = card(reciente, '<span class="badge-new">Nuevo</span>', true) + card(segunda, '', false);
  }

  // Progreso general y estado por artículo
  var fill = document.getElementById('progressFill');
  var text = document.getElementById('progressText');
  var progress2 = getProgress();
  var sum = 0, completos = 0;
  for(var i=1;i<=TOTAL;i++){ var p = progress2[i]||0; sum += Math.min(p,100); if(p>=90) completos++; }
  var overall = Math.round(sum/TOTAL);
  if(fill && text){ fill.style.width = overall+'%'; text.textContent = completos+' de '+TOTAL+' leídos · '+overall+'%'; }
  document.querySelectorAll('.entry[data-art]').forEach(function(el){
    var n = parseInt(el.getAttribute('data-art'),10);
    var p = progress2[n] || 0;
    var meta = el.querySelector('.meta');
    if(!meta || meta.querySelector('.status')) return;
    if(p >= 90) meta.insertAdjacentHTML('afterbegin','<span class="status status-read">Leído</span>');
    else if(p > 0) meta.insertAdjacentHTML('afterbegin','<span class="status">En progreso · '+p+'%</span>');
  });

  // Próximo artículo (cada día 15)
  var cd = document.getElementById('countdown');
  if(cd){
    var now = new Date();
    var target = new Date(now.getFullYear(), now.getMonth(), 15);
    if(now.getDate() >= 15) target = new Date(now.getFullYear(), now.getMonth()+1, 15);
    var dias = Math.ceil((target - now)/(1000*60*60*24));
    var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    var fecha = '15 de '+meses[target.getMonth()];
    cd.textContent = dias<=0 ? 'Próximo artículo: hoy' : 'Próximo artículo el '+fecha+' (en '+dias+(dias===1?' día':' días')+')';
  }

  // Formulario de sugerencias
  var form = document.getElementById('suggestForm');
  var msg = document.getElementById('suggestMsg');
  if(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      fetch(form.action, {method:'POST', body:new FormData(form), headers:{'Accept':'application/json'}}).then(function(res){
        if(res.ok){
          msg.textContent = 'Gracias. Leo cada mensaje, y si tu idea se convierte en artículo, te aviso si dejaste tu correo.';
          msg.className = 'suggest-msg show ok';
          if(typeof gtag === 'function') gtag('event','suggestion_submit_success');
          form.reset();
        } else {
          msg.textContent = 'No se pudo enviar. Intenta de nuevo en un momento.';
          msg.className = 'suggest-msg show err';
        }
      }).catch(function(){
        msg.textContent = 'No se pudo enviar. Intenta de nuevo en un momento.';
        msg.className = 'suggest-msg show err';
      });
    });
  }
})();
