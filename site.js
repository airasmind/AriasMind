/* AriasMind: comportamiento compartido de todas las páginas.
   Cada bloque solo actúa si encuentra sus elementos, así un mismo archivo sirve a la portada y a los artículos. */
(function(){
  'use strict';
  var CFG = window.AM_CONFIG || {};
  var MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var root = document.documentElement;
  var ahora = new Date();
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  var hoyISO = ahora.getFullYear() + '-' + pad(ahora.getMonth() + 1) + '-' + pad(ahora.getDate());
  var TODOS = window.ARTICULOS_TODOS || [];
  var ARTICULOS = TODOS.filter(function(a){ return !a.publica || a.publica <= hoyISO; });
  var TOTAL = ARTICULOS.length;
  var num = parseInt(document.body.getAttribute('data-article') || '0', 10);

  function getProgress(){ try{ return JSON.parse(localStorage.getItem('ariasmind_progress') || '{}'); }catch(e){ return {}; } }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function track(name, extra){
    if(typeof gtag !== 'function') return;
    var p = {page_path: location.pathname};
    if(extra){ for(var k in extra){ p[k] = extra[k]; } }
    gtag('event', name, p);
  }

  /* Tema claro / oscuro */
  var tb = document.getElementById('themeBtn');
  function esOscuro(){
    var t = root.getAttribute('data-theme');
    if(t) return t === 'dark';
    return !(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  }
  function pintaTema(){
    if(tb) tb.setAttribute('aria-label', esOscuro() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }
  if(tb){
    pintaTema();
    tb.addEventListener('click', function(){
      var t = esOscuro() ? 'light' : 'dark';
      root.setAttribute('data-theme', t);
      try{ localStorage.setItem('ariasmind_theme', t); }catch(e){}
      pintaTema();
    });
  }

  /* Menú móvil */
  var mb = document.getElementById('menuBtn'), nav = document.getElementById('siteNav');
  if(mb && nav){
    var cierra = function(){ nav.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); };
    mb.addEventListener('click', function(){
      var o = nav.classList.toggle('open');
      mb.setAttribute('aria-expanded', o ? 'true' : 'false');
    });
    nav.addEventListener('click', function(e){ if(e.target.closest('a')) cierra(); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && nav.classList.contains('open')){ cierra(); mb.focus(); } });
  }

  /* Música de fondo (el texto del botón no cambia; el estado lo anuncia aria-pressed) */
  var mbtn = document.getElementById('musicBtn');
  if(mbtn){
    var mlabel = document.getElementById('mLabel');
    var textoOriginal = mlabel ? mlabel.textContent : '';
    var audio = null, sonando = false;
    var avisa = function(t){ if(!mlabel) return; mlabel.textContent = t; setTimeout(function(){ mlabel.textContent = textoOriginal; }, 2800); };
    var estado = function(on){ sonando = on; mbtn.setAttribute('aria-pressed', on ? 'true' : 'false'); };
    mbtn.addEventListener('click', function(){
      if(!audio){
        audio = new Audio('musica.mp3');
        audio.loop = true; audio.volume = 0.35; audio.preload = 'none';
        audio.addEventListener('error', function(){ estado(false); avisa('Música no disponible'); });
      }
      if(!sonando){
        var pr = audio.play();
        if(pr && pr.then){
          pr.then(function(){ estado(true); track('music_play'); }).catch(function(){ estado(false); avisa('No se pudo reproducir'); });
        } else { estado(true); }
      } else {
        audio.pause(); estado(false);
      }
    });
  }

  /* Progreso de lectura: se mide solo sobre el texto del artículo (.article-body), sin fuentes ni pie */
  var cuerpo = document.querySelector('.article-body');
  if(num && cuerpo){
    var barra = document.getElementById('progress');
    var enviado = false;
    var actualiza = function(){
      var r = cuerpo.getBoundingClientRect();
      var vh = window.innerHeight || root.clientHeight;
      var pct = 0;
      if((window.pageYOffset || root.scrollTop) > 40 && r.height > 0){
        pct = Math.round(Math.min(r.height, Math.max(0, vh - r.top)) / r.height * 100);
        pct = Math.max(0, Math.min(100, pct));
      }
      if(barra) barra.style.width = pct + '%';
      if(pct > 0){
        try{
          var d = getProgress();
          if(pct > (d[num] || 0)){ d[num] = pct; localStorage.setItem('ariasmind_progress', JSON.stringify(d)); }
        }catch(e){}
      }
      if(pct >= 90 && !enviado){ enviado = true; track('article_read', {article: num}); }
    };
    window.addEventListener('scroll', actualiza, {passive:true});
    window.addEventListener('resize', actualiza);
    actualiza();
  }

  /* Estadísticas: secciones vistas y clics */
  if(typeof gtag === 'function'){
    var vistas = {};
    var zonas = document.querySelectorAll('#hero, #manifiesto, #archivo, #sugerencias, #origen, #senal, #pie');
    if(zonas.length && 'IntersectionObserver' in window){
      var so = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          if(en.isIntersecting && !vistas[en.target.id]){
            vistas[en.target.id] = true;
            track('section_view', {section_name: en.target.id});
            so.unobserve(en.target);
          }
        });
      }, {threshold:.35});
      zonas.forEach(function(z){ so.observe(z); });
    }
    document.addEventListener('click', function(e){
      var el = e.target.closest('[data-track]');
      if(el) track('element_click', {element_name: el.getAttribute('data-track')});
    });
  }

  /* Tarjeta de artículo (portada, archivo y "seguir leyendo") */
  function tarjeta(a, opts){
    opts = opts || {};
    var ch = a.temas.map(function(t){ return '<span class="chip">' + esc(t) + '</span>'; }).join('');
    return '<a class="entry' + (opts.feature ? ' feature' : '') + '" href="' + a.href + '" data-art="' + a.n + '" data-track="' + (opts.origen || 'inicio') + '_art_' + a.n + '">' +
      '<span class="num" aria-hidden="true">' + pad(a.n) + '</span>' +
      '<div class="body"><div class="chips">' + ch + '</div>' +
      '<h3>' + esc(a.titulo) + (opts.badge || '') + '</h3><p class="hook">&ldquo;' + esc(a.hook) + '&rdquo;</p></div>' +
      '<span class="meta"><span>' + a.fecha + '</span><span>' + a.min + ' min</span></span></a>';
  }

  var progreso = getProgress();

  /* Portada: el más nuevo + el que tienes a medias */
  var lista = document.getElementById('archivo-lista');
  if(lista && TOTAL){
    var reciente = ARTICULOS[ARTICULOS.length - 1];
    var enProgreso = null, mejor = 0;
    ARTICULOS.forEach(function(a){
      if(a.n === reciente.n) return;
      var p = progreso[a.n] || 0;
      if(p > 0 && p < 90 && p >= mejor){ mejor = p; enProgreso = a; }
    });
    var segunda = enProgreso || ARTICULOS[0];
    var html = tarjeta(reciente, {badge:'<span class="badge-new">Nuevo</span>', feature:true});
    if(segunda && segunda.n !== reciente.n) html += tarjeta(segunda);
    lista.innerHTML = html;
  }

  /* Aviso del artículo más reciente, arriba en la portada */
  var strip = document.getElementById('newStrip');
  if(strip && TOTAL){
    var nuevo = ARTICULOS[ARTICULOS.length - 1];
    strip.href = nuevo.href;
    strip.setAttribute('data-track', 'inicio_nuevo_art_' + nuevo.n);
    strip.innerHTML = '<span class="badge-new">Nuevo</span><span class="ns-t">Artículo ' + nuevo.n + ': ' + esc(nuevo.titulo) + '</span><span aria-hidden="true">&rarr;</span>';
    strip.hidden = false;
  }

  /* Página de artículos: todos, en orden de lectura */
  var todosEl = document.getElementById('archivo-todos');
  if(todosEl){
    var ultimo = ARTICULOS[ARTICULOS.length - 1];
    todosEl.innerHTML = ARTICULOS.map(function(a){
      return tarjeta(a, {origen:'archivo', badge: a === ultimo ? '<span class="badge-new">Nuevo</span>' : ''});
    }).join('');
  }

  /* Contadores y fecha de última actualización, siempre calculados desde la lista */
  document.querySelectorAll('[data-count]').forEach(function(el){ el.textContent = TOTAL; });
  var upd = document.getElementById('lastUpdate');
  if(upd && TOTAL) upd.textContent = ARTICULOS[ARTICULOS.length - 1].fecha;

  /* Progreso general: se oculta hasta que la persona lea algo */
  var bloque = document.getElementById('progressBlock');
  var fill = document.getElementById('progressFill');
  var texto = document.getElementById('progressText');
  if(bloque && fill && texto){
    var suma = 0, completos = 0;
    ARTICULOS.forEach(function(a){
      var p = Math.min(progreso[a.n] || 0, 100);
      suma += p; if(p >= 90) completos++;
    });
    if(suma > 0 && TOTAL){
      var total = Math.round(suma / TOTAL);
      fill.style.width = total + '%';
      texto.textContent = completos + ' de ' + TOTAL + ' leídos · ' + total + '%';
      bloque.hidden = false;
    } else {
      bloque.hidden = true;
    }
  }

  /* Estado "Leído / En progreso" en cada tarjeta */
  document.querySelectorAll('.entry[data-art]').forEach(function(el){
    var n = parseInt(el.getAttribute('data-art'), 10);
    var p = progreso[n] || 0;
    var meta = el.querySelector('.meta');
    if(!meta || meta.querySelector('.status')) return;
    if(p >= 90) meta.insertAdjacentHTML('afterbegin', '<span class="status status-read">Leído</span>');
    else if(p > 0) meta.insertAdjacentHTML('afterbegin', '<span class="status">En progreso · ' + p + '%</span>');
  });

  /* Próxima fecha de publicación */
  var dia = CFG.diaPublicacion || 15;
  /* la próxima fecha es el primer día 15 posterior a hoy y al último artículo publicado */
  var base = ahora;
  ARTICULOS.forEach(function(a){
    if(!a.iso) return;
    var q = a.iso.split('-'), d = new Date(+q[0], +q[1] - 1, +q[2]);
    if(d > base) base = d;
  });
  var objetivo = new Date(base.getFullYear(), base.getMonth(), dia);
  if(base.getDate() >= dia) objetivo = new Date(base.getFullYear(), base.getMonth() + 1, dia);
  var dias = Math.ceil((objetivo - ahora) / 86400000);
  var fechaProx = dia + ' de ' + MESES[objetivo.getMonth()];
  var cd = document.getElementById('countdown');
  if(cd){
    cd.textContent = dias <= 0 ? 'El próximo artículo sale hoy.' : 'El próximo artículo sale el ' + fechaProx + '.';
  }

  /* Cierre de artículo: qué sigue, según dónde estés */
  var nc = document.getElementById('nextCard');
  if(nc && num){
    var lst = ARTICULOS.slice();
    var actual = TODOS.filter(function(a){ return a.n === num; })[0];
    if(actual && !lst.some(function(a){ return a.n === num; })) lst.push(actual);
    lst.sort(function(a, b){ return a.n - b.n; });
    var sig = null;
    lst.forEach(function(a, i){ if(a.n === num) sig = lst[i + 1] || null; });
    if(sig){
      nc.outerHTML = '<a class="next-card" href="' + sig.href + '" data-track="articulo_siguiente"><span class="small">Sigue con</span><h3>' + esc(sig.titulo) + '</h3><p>' + esc(sig.hook) + '</p><span class="go">Leer el siguiente &rarr;</span></a>';
    } else {
      nc.innerHTML = '<span class="small">Último publicado</span><h3>Llegaste al último</h3><p>El próximo sale el ' + fechaProx + '. Mientras tanto, cuéntame qué te gustaría que explore.</p>';
    }

    var rel = document.getElementById('related');
    var relLista = document.getElementById('relatedList');
    if(rel && relLista && actual){
      var pool = lst.filter(function(a){ return a.n !== num; });
      var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(pool.length){
        rel.hidden = false;
        if(pool.length < 2 || quieto){
          /* sin animación: dos sugerencias fijas, las que más se parecen */
          pool.forEach(function(a){ a._afin = a.temas.filter(function(t){ return actual.temas.indexOf(t) > -1; }).length; });
          pool.sort(function(a, b){ return (b._afin - a._afin) || (b.n - a.n); });
          relLista.innerHTML = pool.slice(0, 2).map(function(a){ return tarjeta(a, {origen:'relacionado'}); }).join('');
        } else {
          /* una tarjeta a la vez, en orden aleatorio, con desvanecido; todas ocupan el mismo lugar */
          relLista.classList.add('rotor');
          relLista.innerHTML = pool.map(function(a){ return tarjeta(a, {origen:'relacionado'}); }).join('');
          var cards = [].slice.call(relLista.children);
          var bolsa = [], actualIdx = -1, pausado = false, pausaTouch = 0;
          function sacar(){
            if(!bolsa.length){
              bolsa = cards.map(function(_, i){ return i; });
              for(var i = bolsa.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var t = bolsa[i]; bolsa[i] = bolsa[j]; bolsa[j] = t; }
              if(bolsa[bolsa.length - 1] === actualIdx && bolsa.length > 1){ var u = bolsa[0]; bolsa[0] = bolsa[bolsa.length - 1]; bolsa[bolsa.length - 1] = u; }
            }
            return bolsa.pop();
          }
          function mostrar(){
            var n = sacar();
            cards.forEach(function(c, i){ c.classList.toggle('is-on', i === n); });
            actualIdx = n;
          }
          mostrar();
          var ctrl = document.createElement('button');
          ctrl.type = 'button'; ctrl.className = 'rotor-ctl'; ctrl.textContent = 'Pausar';
          ctrl.addEventListener('click', function(){ pausado = !pausado; ctrl.textContent = pausado ? 'Seguir' : 'Pausar'; });
          relLista.parentNode.appendChild(ctrl);
          var encima = false;
          relLista.addEventListener('mouseenter', function(){ encima = true; });
          relLista.addEventListener('mouseleave', function(){ encima = false; });
          relLista.addEventListener('focusin', function(){ encima = true; });
          relLista.addEventListener('focusout', function(){ encima = false; });
          relLista.addEventListener('touchstart', function(){ pausaTouch = Date.now() + 6000; }, {passive:true});
          setInterval(function(){
            if(pausado || encima || document.hidden || Date.now() < pausaTouch) return;
            mostrar();
          }, 3600);
        }
      }
    }
  }

  /* Compartir */
  var sb = document.getElementById('shareBtn');
  if(sb){
    var urlCanon = (document.querySelector('link[rel="canonical"]') || {}).href || location.href;
    var etiqueta = sb.textContent;
    var titulo = document.title.replace(/\s*\|\s*AriasMind\s*$/, '');
    var panel = null;
    function avisar(t){ sb.textContent = t; setTimeout(function(){ sb.textContent = etiqueta; }, 2500); }
    function abrirPanel(){
      if(!panel){
        var u = encodeURIComponent(urlCanon), t = encodeURIComponent(titulo + ' | AriasMind');
        panel = document.createElement('div');
        panel.className = 'share-panel';
        var movil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
        panel.innerHTML = '<p class="share-t">Comparte este artículo</p>' +
          '<div class="share-opts">' +
          '<a href="https://wa.me/?text=' + t + '%20' + u + '" target="_blank" rel="noopener">WhatsApp</a>' +
          (movil ? '<a href="fb-messenger://share/?link=' + u + '" target="_blank" rel="noopener">Messenger</a>'
                 : '<a href="https://www.facebook.com/sharer/sharer.php?u=' + u + '" target="_blank" rel="noopener">Facebook</a>') +
          '<a href="https://twitter.com/intent/tweet?text=' + t + '&url=' + u + '" target="_blank" rel="noopener">X</a>' +
          '<button type="button" class="share-copy">Copiar enlace</button></div>' +
          '<label class="share-l">El enlace:<input class="share-in" type="text" readonly value="' + urlCanon + '"></label>';
        sb.parentNode.insertAdjacentElement('afterend', panel);
        panel.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ track('share_' + a.textContent.toLowerCase()); }); });
        var inp = panel.querySelector('.share-in');
        inp.addEventListener('focus', function(){ inp.select(); });
        var cb = panel.querySelector('.share-copy');
        cb.addEventListener('click', function(){
          track('share_copiar');
          var listo = function(){ cb.textContent = '¡Copiado!'; setTimeout(function(){ cb.textContent = 'Copiar enlace'; }, 2500); };
          var ok = false;
          try { inp.focus({preventScroll:true}); inp.select(); inp.setSelectionRange(0, 9999); ok = document.execCommand('copy'); } catch(e){}
          if(ok) return listo();
          if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(urlCanon).then(listo, function(){ cb.textContent = 'Mantén presionado el enlace para copiarlo'; });
          else cb.textContent = 'Mantén presionado el enlace para copiarlo';
        });
      }
      panel.hidden = false;
      var inp2 = panel.querySelector('.share-in');
      try { inp2.focus({preventScroll:true}); inp2.select(); } catch(e){}
    }
    function copiar(){
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(urlCanon).then(function(){ avisar('Enlace copiado'); abrirPanel(); }, abrirPanel);
      } else abrirPanel();
    }
    sb.addEventListener('click', function(){
      track('share_click');
      if(navigator.share){
        navigator.share({title: titulo, url: urlCanon}).catch(function(e){ if(!e || e.name !== 'AbortError') copiar(); });
      } else copiar();
    });
  }

  /* Formulario de sugerencias */
  var form = document.getElementById('suggestForm');
  var msg = document.getElementById('suggestMsg');
  if(form && msg){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      fetch(form.action, {method:'POST', body:new FormData(form), headers:{'Accept':'application/json'}}).then(function(res){
        if(res.ok){
          msg.textContent = 'Recibido, gracias por escribirme.';
          msg.className = 'suggest-msg show ok';
          track('suggestion_submit_success');
          form.reset();
        } else {
          msg.textContent = 'No pude enviarlo. ¿Lo intentas de nuevo?';
          msg.className = 'suggest-msg show err';
        }
      }).catch(function(){
        msg.textContent = 'No pude enviarlo. ¿Lo intentas de nuevo?';
        msg.className = 'suggest-msg show err';
      });
    });
  }
})();
