/* Herramientas de AriasMind.
   Todo funciona en el navegador: lo que la persona escribe se guarda solo en su teléfono o computadora (localStorage).
   Los recordatorios se descargan como eventos de calendario (.ics), sin cuentas ni servidor. */
(function(){
  'use strict';
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var DIA = 864e5;
  var DOM = (window.AM_CONFIG && AM_CONFIG.dominio) || 'https://ariasmind.com';

  /* ---------- utilidades compartidas ---------- */
  var store = {
    get: function(k, def){ try{ var v = localStorage.getItem('am_' + k); return v ? JSON.parse(v) : def; }catch(e){ return def; } },
    set: function(k, v){ try{ localStorage.setItem('am_' + k, JSON.stringify(v)); }catch(e){} }
  };
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function track(n){ try{ if(window.gtag) gtag('event', n, {herramienta: document.body.getAttribute('data-tool')}); }catch(e){} }
  var DIAS = ['dom','lun','mar','mié','jue','vie','sáb'];
  var MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  var MESES_L = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function fecha(d){ return DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()]; }
  function hoy0(){ var d = new Date(); d.setHours(0,0,0,0); return d; }
  function key(d){ return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  /* h puede ser un número de hora (19) o un texto "HH:MM" de un campo de hora */
  function horaRazonable(d, h){ var x = new Date(d), hh = 19, mm = 0;
    if(typeof h === 'string' && /^\d{1,2}:\d{2}/.test(h)){ hh = +h.split(':')[0]; mm = +h.split(':')[1]; } else if(h != null && !isNaN(h)) hh = +h;
    x.setHours(hh, mm, 0, 0); return x; }
  function press(group, btn){ $$('button', group).forEach(function(b){ b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); }); }

  /* Dentro del visor de Claude las descargas comunes están bloqueadas: allí se usa su permiso de "guardar archivo". */
  var EN_VISOR = !!(window.claude && typeof window.claude.use === 'function');
  function descargar(blob, nombre){
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function guardarArchivo(blob, nombre){
    if(!EN_VISOR){ descargar(blob, nombre); return Promise.resolve(true); }
    return window.claude.use('downloads').then(function(d){
      if(!d){ descargar(blob, nombre); return true; }
      return d.save({filename: nombre, data: blob}).then(function(){ return true; }, function(){ return false; });
    }, function(){ descargar(blob, nombre); return true; });
  }
  /* Eventos de calendario. ev: {titulo, detalle, inicio:Date, minutos, diario:true}
     Abre una ventana con dos caminos: el archivo .ics (calendario del iPhone, Android u Outlook)
     y un botón de Google Calendar por evento, que funciona en cualquier lugar. */
  var p2 = function(n){ return ('0' + n).slice(-2); };
  var fICS = function(x){ return x.getFullYear() + p2(x.getMonth() + 1) + p2(x.getDate()) + 'T' + p2(x.getHours()) + p2(x.getMinutes()) + '00'; };
  function gcal(ev){
    var fin = new Date(ev.inicio.getTime() + (ev.minutos || 15) * 6e4), tz = '';
    try{ tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }catch(e){}
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(ev.titulo) +
      '&dates=' + fICS(ev.inicio) + '/' + fICS(fin) + '&details=' + encodeURIComponent(ev.detalle || '') +
      (tz ? '&ctz=' + encodeURIComponent(tz) : '') + ((ev.rrule || ev.diario) ? '&recur=' + encodeURIComponent('RRULE:' + (ev.rrule || 'FREQ=DAILY')) : '');
  }
  function ics(eventos, nombre){
    var t = function(s){ return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, function(c){ return '\\' + c; }); };
    var L = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AriasMind//Herramientas//ES','CALSCALE:GREGORIAN'];
    var stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    eventos.forEach(function(ev, i){
      var fin = new Date(ev.inicio.getTime() + (ev.minutos || 15) * 6e4);
      L.push('BEGIN:VEVENT', 'UID:am-' + Date.now() + '-' + i + '@ariasmind.com', 'DTSTAMP:' + stamp,
        'DTSTART:' + fICS(ev.inicio), 'DTEND:' + fICS(fin), 'SUMMARY:' + t(ev.titulo));
      if(ev.detalle) L.push('DESCRIPTION:' + t(ev.detalle));
      if(ev.rrule || ev.diario) L.push('RRULE:' + (ev.rrule || 'FREQ=DAILY'));
      L.push('BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:' + t(ev.titulo),'END:VALARM','END:VEVENT');
    });
    L.push('END:VCALENDAR');
    var archivo = new Blob([L.join('\r\n')], {type: 'text/calendar'});
    nombre = nombre || 'recordatorio-ariasmind.ics';
    var dlg = document.getElementById('amCal');
    if(!dlg){ dlg = document.createElement('dialog'); dlg.id = 'amCal'; dlg.className = 'am-dialog'; document.body.appendChild(dlg); }
    var varios = eventos.length > 1;
    dlg.innerHTML = '<h2>Agrega ' + (varios ? 'tus ' + eventos.length + ' recordatorios' : 'tu recordatorio') + '</h2>' +
      (EN_VISOR ? '<p class="hint">Aquí, dentro de Claude, usa Google Calendar. En tu sitio publicado también aparecerá el botón para el calendario del iPhone.</p>'
                : '<p class="hint">Elige el calendario que usas.</p><button class="btn btn-primary" type="button" data-ics>📲 Calendario de este teléfono</button><p class="t-note" style="margin:.4rem 0 .9rem">Funciona con iPhone, Android y Outlook' + (varios ? ', y agrega todos de una vez' : '') + '.</p>') +
      '<p class="t-label">' + (EN_VISOR ? '' : 'O con ') + 'Google Calendar' + (varios ? ', uno por uno' : '') + ':</p><ul class="t-list">' +
      eventos.map(function(ev){ return '<li><div><b>' + esc(ev.titulo) + '</b><br><span style="font-size:.85rem;color:var(--muted)">' + fecha(ev.inicio) + ', ' + p2(ev.inicio.getHours()) + ':' + p2(ev.inicio.getMinutes()) + (ev.diario ? ' · cada día' : ev.rrule ? ' · cada semana' : '') + '</span></div><a class="btn btn-secondary am-g" href="' + gcal(ev) + '" target="_blank" rel="noopener">Agregar</a></li>'; }).join('') +
      '</ul><div class="t-row"><button class="btn btn-secondary" type="button" data-cerrar>Listo</button></div>';
    var b = dlg.querySelector('[data-ics]'); if(b) b.addEventListener('click', function(){ descargar(archivo, nombre); track('herramienta_ics'); });
    $$('.am-g', dlg).forEach(function(a){ a.addEventListener('click', function(){ a.textContent = 'Agregado ✓'; track('herramienta_gcal'); }); });
    dlg.querySelector('[data-cerrar]').addEventListener('click', function(){ dlg.close ? dlg.close() : dlg.removeAttribute('open'); });
    if(dlg.showModal){ try{ dlg.showModal(); }catch(e){ dlg.setAttribute('open', ''); } } else dlg.setAttribute('open', '');
    track('herramienta_calendario');
  }
  /* Texto en varias líneas para las imágenes */
  function lineas(ctx, texto, ancho){
    var out = [], linea = '';
    String(texto).split(/\s+/).forEach(function(w){
      var prueba = linea ? linea + ' ' + w : w;
      if(ctx.measureText(prueba).width > ancho && linea){ out.push(linea); linea = w; } else linea = prueba;
    });
    if(linea) out.push(linea);
    return out;
  }
  function fuentesListas(){ return (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve(); }
  function compartirImagen(canvas, nombre, texto){
    canvas.toBlob(function(blob){
      if(!blob) return;
      var file;
      try{ file = new File([blob], nombre, {type: 'image/png'}); }catch(e){}
      if(!EN_VISOR && file && navigator.canShare && navigator.canShare({files: [file]})){
        navigator.share({files: [file], text: texto}).catch(function(){});
      } else guardarArchivo(blob, nombre);
      track('herramienta_imagen');
    }, 'image/png');
  }
  /* Temporizador por marcas de tiempo: sigue bien aunque el teléfono bloquee la pantalla */
  function Temporizador(onTick, onFin){
    var fin = 0, resto = 0, id = null;
    function tick(){ var r = Math.max(0, fin - Date.now()); onTick(r); if(r <= 0){ parar(); onFin(); } }
    function parar(){ if(id){ clearInterval(id); id = null; } }
    return {
      iniciar: function(ms){ resto = ms; fin = Date.now() + ms; parar(); id = setInterval(tick, 250); tick(); },
      pausar: function(){ if(id){ resto = Math.max(0, fin - Date.now()); parar(); } },
      seguir: function(){ if(!id && resto > 0){ fin = Date.now() + resto; id = setInterval(tick, 250); } },
      parar: parar,
      activo: function(){ return !!id; }
    };
  }
  function mmss(ms){ var s = Math.ceil(ms / 1000); return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + s % 60).slice(-2); }
  /* Sonido: el iPhone solo deja sonar una página si el audio se "despierta" con un toque.
     Por eso se prepara en el primer toque y se reutiliza cuando el temporizador termina. */
  var AC = null;
  function audio(){ if(!AC){ var C = window.AudioContext || window.webkitAudioContext; if(C) AC = new C(); } return AC; }
  function desbloquearAudio(){
    try{ if(navigator.audioSession) navigator.audioSession.type = 'playback'; }catch(e){}   /* que suene aunque el iPhone esté en silencio, donde se permita */
    try{ var c = audio(); if(!c) return; if(c.state !== 'running') c.resume();
      var s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); }catch(e){}
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(function(ev){ document.addEventListener(ev, desbloquearAudio, true); });
  var TONOS = {descanso: [784, 659, 523], reto: [523, 659, 784], fin: [523, 659, 784, 1047], aviso: [880, 880, 880]};
  function aviso(tipo){
    try{ var c = audio(); if(c){ if(c.state !== 'running') c.resume();
      var notas = TONOS[tipo] || TONOS.aviso, t0 = c.currentTime + .05;
      for(var rep = 0; rep < 2; rep++) notas.forEach(function(f, i){
        var t = t0 + rep * (notas.length * .22 + .35) + i * .22, o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(c.destination);
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.5, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .5);
        o.start(t); o.stop(t + .55); });
    } }catch(e){}
    try{ if(navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]); }catch(e){}
  }
  /* Aviso visual grande: aparece encima, el siguiente tiempo ya corre por debajo, y se desvanece solo. */
  function anuncio(icono, titulo, texto, clase){
    var v = document.getElementById('amFlash');
    if(v) v.remove();
    v = document.createElement('div'); v.id = 'amFlash'; v.className = 'am-flash ' + (clase || ''); v.setAttribute('role', 'alert');
    v.innerHTML = '<div class="am-flash-card"><div class="am-flash-ic" aria-hidden="true">' + icono + '</div><p class="am-flash-t">' + esc(titulo) + '</p><p class="am-flash-x">' + esc(texto) + '</p><p class="am-flash-tap">Toca para cerrar</p></div>';
    document.body.appendChild(v);
    requestAnimationFrame(function(){ v.classList.add('show'); });
    var cerrar = function(){ v.classList.remove('show'); setTimeout(function(){ v.remove(); }, 600); };
    v.addEventListener('click', cerrar);
    setTimeout(cerrar, 4000);
  }

  /* ---------- 1. Repaso activo (antes: Calendario de repaso + Cierra el libro) ---------- */
  function repaso(){
    var PASOS = [{d:0, t:'Hoy'}, {d:3, t:'En 3 días'}, {d:7, t:'En 1 semana'}, {d:14, t:'En 2 semanas'}, {d:30, t:'En 1 mes'}];
    var lista = store.get('repasos', []);
    var TIP = {recordar: 'Escribe o di en voz alta todo lo que recuerdes, aunque sean pedazos sueltos.',
               feynman: 'Explícalo con palabras simples, como a un niño de 10 años. Donde te trabes, ahí está lo que todavía no entiendes.'};
    var T = null;
    function fechas(){ var h = hoy0(); return PASOS.map(function(p){ return {t: p.t, f: new Date(h.getTime() + p.d * DIA)}; }); }
    function pendientes(r, h){ r.hechos = r.hechos || []; return r.fechas.filter(function(f){ return f <= h && r.hechos.indexOf(f) < 0; }); }
    function eventos(r, hora){ var h = hoy0().getTime(); return r.fechas.filter(function(f){ return f > h; }).map(function(f){
      return {titulo: 'Repaso: ' + r.tema, inicio: horaRazonable(new Date(f), hora == null ? (r.hora || 19) : hora), minutos: 15,
        detalle: 'Antes de mirar tus apuntes, intenta recordar todo lo que puedas sobre: ' + r.tema + '. Abre AriasMind > Repaso activo para repasar y comparar.'}; }); }
    $('#calPlan').innerHTML = fechas().map(function(x, i){ return '<li><span class="t-dot">' + (i + 1) + '</span><b>' + x.t + (i === 0 ? ' (después de estudiar)' : '') + '</b><span class="t-when">' + fecha(x.f) + '</span></li>'; }).join('');
    function nuevo(conCalendario){
      var tema = $('#calTema').value.trim(), hora = $('#calHora').value || '19:00';
      if(!tema){ $('#calTema').focus(); $('#calMsg').textContent = 'Escribe primero qué quieres recordar.'; return; }
      var r = {tema: tema, fechas: fechas().map(function(x){ return x.f.getTime(); }), hechos: [], apuntes: $('#calApuntes').value.trim(), hora: hora};
      lista.unshift(r); store.set('repasos', lista); pintar();
      $('#calTema').value = ''; $('#calApuntes').value = '';
      $('#calMsg').textContent = 'Guardado en Mis temas. Hoy te toca el primer repaso: intenta recordar antes de releer.';
      if(conCalendario) ics(eventos(r, hora), 'repasos.ics');
      track('herramienta_tema_nuevo');
    }
    $('#calAgregar').addEventListener('click', function(){ nuevo(true); });
    $('#calSolo').addEventListener('click', function(){ nuevo(false); });

    function pintar(){
      var box = $('#calMios');
      if(!lista.length){ box.innerHTML = '<p class="t-empty">Todavía no tienes temas. Agrega el primero arriba.</p>'; return; }
      var h = hoy0().getTime();
      box.innerHTML = '<ul class="t-list">' + lista.map(function(r, i){
        var pend = pendientes(r, h), prox = r.fechas.filter(function(f){ return f > h && r.hechos.indexOf(f) < 0; })[0], estado;
        if(pend.length) estado = '<strong style="color:var(--cyan)">' + (pend[0] < h ? 'Tienes un repaso atrasado' : 'Te toca repasar hoy') + '</strong>';
        else if(prox) estado = 'Próximo repaso: ' + fecha(new Date(prox));
        else estado = '<strong style="color:var(--cyan)">Terminaste los ' + r.fechas.length + ' repasos</strong>';
        var olv = (r.olvidos && r.olvidos.length) ? '<p class="t-note" style="margin:.4rem 0 0">La vez pasada se te olvidó: <b style="color:var(--fg)">' + r.olvidos.map(esc).join(', ') + '</b></p>' : '';
        return '<li class="t-rep-item"><span class="t-dot' + (prox == null && !pend.length ? ' on' : '') + '">' + r.hechos.length + '/' + r.fechas.length + '</span>' +
          '<div class="t-grow"><b>' + esc(r.tema) + '</b><br><span style="font-size:.88rem;color:var(--muted)">' + estado + '</span>' + olv +
          '<div class="t-row" data-acc="' + i + '"><button class="btn ' + (pend.length ? 'btn-primary' : 'btn-secondary') + ' t-rep" type="button" data-rep="' + i + '">' + (pend.length ? 'Repasar ahora' : 'Practicar ahora') + '</button>' +
          '<button class="btn btn-secondary t-rep" type="button" data-ap="' + i + '">📝 ' + (r.apuntes ? 'Mis apuntes' : 'Agregar apuntes') + '</button></div>' +
          '<div class="t-rep-panel t-hidden" id="rp' + i + '"></div>' +
          '<div class="t-rep-panel t-hidden" id="ap' + i + '"><label class="t-label" for="apt' + i + '">Mis apuntes de «' + esc(r.tema) + '»</label>' +
            '<textarea class="t-area" id="apt' + i + '" maxlength="20000" placeholder="Escribe o pega aquí lo que estudiaste.">' + esc(r.apuntes || '') + '</textarea>' +
            '<div class="t-row"><button class="btn btn-primary" type="button" data-apok="' + i + '">Guardar apuntes</button><button class="btn btn-secondary" type="button" data-apx="' + i + '">Cerrar</button></div>' +
            (pend.length ? '<p class="t-note">Consejo: hoy te toca repasar. Intenta recordar antes de leerlos.</p>' : '') + '</div>' +
          (prox ? '<p class="t-note" style="margin-top:.5rem"><button class="t-link" type="button" data-cal="' + i + '">Agregar sus próximos repasos al calendario</button></p>' : '') +
          '</div><button class="t-x" type="button" data-del="' + i + '" aria-label="Quitar ' + esc(r.tema) + '">×</button></li>'; }).join('') + '</ul>';
    }
    function sesion(i){
      var r = lista[i], p = $('#rp' + i);
      p.innerHTML = '<p class="t-step">Paso 1 · Sin mirar</p>' +
        '<div class="t-seg" data-modo><button type="button" data-m="recordar" aria-pressed="true">Todo lo que recuerdo</button><button type="button" data-m="feynman" aria-pressed="false">Explícalo a un niño</button></div>' +
        '<p class="hint" data-tip style="margin:.6rem 0">' + TIP.recordar + '</p>' +
        '<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:.5rem"><label class="visually-hidden" for="rtm' + i + '">Tiempo</label><select class="t-select" id="rtm' + i + '" style="width:auto;flex:1"><option value="0">Sin límite de tiempo</option><option value="3">3 minutos</option><option value="5">5 minutos</option><option value="10">10 minutos</option></select><span class="t-big" data-reloj style="font-size:1.6rem" hidden></span></div>' +
        '<label class="visually-hidden" for="rpt' + i + '">Lo que recuerdas</label><textarea class="t-area" id="rpt' + i + '" style="min-height:8rem" placeholder="Lo que recuerdo…"></textarea>' +
        '<div class="t-row"><button class="btn btn-primary" type="button" data-cmp="' + i + '">' + (r.apuntes ? 'Comparar con mis apuntes' : 'Terminé') + '</button></div>' +
        '<div class="t-hidden" data-paso2><p class="t-step" style="margin-top:1rem">Paso 2 · Ahora compara</p>' +
          (r.apuntes ? '<div class="t-cmp"><div><p class="t-label">Lo que recordaste</p><div class="t-box" data-yo></div></div><div><p class="t-label">Tus apuntes</p><div class="t-box cyan">' + esc(r.apuntes) + '</div></div></div>'
                     : '<div class="t-cmp"><div><p class="t-label">Lo que recordaste</p><div class="t-box" data-yo></div></div></div><p class="t-note">No tienes apuntes guardados para este tema. Compara con tu cuaderno o libro, y si quieres, guárdalos aquí con 📝.</p>') +
          '<label class="t-label" for="rco' + i + '">¿Qué se te olvidó o tenías mal? (opcional)</label><input class="t-input" id="rco' + i + '" type="text" maxlength="160" placeholder="Separa con comas">' +
          '<div class="t-box orange"><p><b>Lo que se te olvidó es justo lo que más vale repasar.</b> No es un examen: el esfuerzo de intentarlo ya está ayudando a que se quede.</p></div>' +
          '<div class="t-row"><button class="btn btn-primary" type="button" data-ok="' + i + '">Marcar repaso como hecho</button></div></div>';
      p.classList.remove('t-hidden'); $('#ap' + i).classList.add('t-hidden');
      $('[data-acc="' + i + '"]').classList.add('t-hidden');
      $('[data-modo]', p).addEventListener('click', function(e){ var b = e.target.closest('button'); if(!b) return; press(this, b); $('[data-tip]', p).textContent = TIP[b.dataset.m]; });
      var reloj = $('[data-reloj]', p);
      $('#rtm' + i).addEventListener('change', function(){
        if(T) T.parar(); var m = +this.value; reloj.hidden = !m; if(!m) return;
        T = Temporizador(function(ms){ reloj.textContent = mmss(ms); }, function(){ aviso('fin'); anuncio('⏰', 'Se acabó el tiempo', 'Ahora compara con tus apuntes.', 'reto'); $('[data-cmp="' + i + '"]', p).click(); });
        T.iniciar(m * 6e4); $('#rpt' + i).focus();
      });
      $('#rpt' + i).focus();
    }
    function cerrarSesion(){ if(T){ T.parar(); T = null; } }
    function aviso2(t){ var m = document.createElement('p'); m.className = 't-msg'; m.setAttribute('role', 'status'); m.textContent = t; $('#calMios').prepend(m); }
    $('#calMios').addEventListener('click', function(e){
      var b = e.target.closest('button'); if(!b) return; var d = b.dataset;
      if(d.del != null){ if(d.sure !== '1'){ d.sure = '1'; b.textContent = '¿Quitar?'; b.classList.add('t-x-sure'); setTimeout(function(){ if(b.isConnected){ d.sure = ''; b.textContent = '×'; b.classList.remove('t-x-sure'); } }, 4000); return; }
        cerrarSesion(); lista.splice(+d.del, 1); store.set('repasos', lista); pintar(); return; }
      if(d.rep != null){ cerrarSesion(); pintar(); sesion(+d.rep); track('herramienta_inicio'); return; }
      if(d.cmp != null){ cerrarSesion(); var p = $('#rp' + d.cmp); $('[data-yo]', p).textContent = $('#rpt' + d.cmp).value.trim() || '(No escribiste nada.)';
        $('[data-paso2]', p).classList.remove('t-hidden'); b.classList.add('t-hidden'); $('[data-reloj]', p).hidden = true; $('[data-paso2]', p).scrollIntoView({behavior: 'smooth', block: 'start'}); return; }
      if(d.ok != null){ var r = lista[+d.ok]; pendientes(r, hoy0().getTime()).forEach(function(f){ r.hechos.push(f); });
        var o = $('#rco' + d.ok).value.trim(); r.olvidos = o ? o.split(/\s*[,;]\s*/).filter(Boolean).slice(0, 12) : [];
        store.set('repasos', lista); pintar(); $('#calMsg').textContent = ''; track('herramienta_repaso_hecho');
        aviso2(r.olvidos.length ? 'Repaso hecho. En el próximo te recordaré lo que se te olvidó.' : 'Repaso hecho. ¡Muy bien!'); return; }
      if(d.ap != null){ $('#ap' + d.ap).classList.toggle('t-hidden'); return; }
      if(d.apx != null){ $('#ap' + d.apx).classList.add('t-hidden'); return; }
      if(d.apok != null){ lista[+d.apok].apuntes = $('#apt' + d.apok).value.trim(); store.set('repasos', lista); pintar(); aviso2('Apuntes guardados.'); return; }
      if(d.cal != null){ ics(eventos(lista[+d.cal]), 'repasos.ics'); }
    });
    pintar();
    /* Si llegas desde un enlace con ?tema=, se llena el campo */
    try{ var tq = new URLSearchParams(location.search).get('tema'); if(tq) $('#calTema').value = tq.slice(0, 80); }catch(e){}
  }

  /* ---------- 2. Diseña tu sistema ---------- */
  function sistema(){
    var s = store.get('sistema', {cuando:'', donde:'', que:'', mini:'', noche:'', hora:'7', dias:{}});
    ['cuando','donde','que','mini','noche'].forEach(function(k){ var el = $('#ss_' + k); el.value = s[k] || ''; el.addEventListener('input', function(){ s[k] = el.value; guardar(); frase(); }); });
    $('#ssHora').value = s.hora || '7';
    $('#ssHora').addEventListener('change', function(){ s.hora = this.value; guardar(); });
    function guardar(){ store.set('sistema', s); }
    function f(){ return 'Cuando ' + (s.cuando || '___') + ', en ' + (s.donde || '___') + ', haré ' + (s.que || '___') + '.'; }
    function frase(){
      $('#ssFrase').innerHTML = 'Cuando <span>' + esc(s.cuando || '___') + '</span>, en <span>' + esc(s.donde || '___') + '</span>, haré <span>' + esc(s.que || '___') + '</span>.';
      $('#ssMiniV').textContent = s.mini ? 'Si no tengo ganas: ' + s.mini + '.' : '';
    }
    $('#ssTarjeta').addEventListener('click', function(){
      if(!s.cuando || !s.donde || !s.que){ $('#ssMsg').textContent = 'Completa el cuándo, el dónde y el qué para crear tu tarjeta.'; return; }
      fuentesListas().then(function(){
        var c = document.createElement('canvas'); c.width = 1080; c.height = 1920; var x = c.getContext('2d');
        var g = x.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#18214a'); g.addColorStop(1, '#0a0e1c'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1920);
        x.textAlign = 'center'; x.fillStyle = '#38d9d9'; x.font = '800 40px "Plus Jakarta Sans", sans-serif'; x.fillText('MI SISTEMA', 540, 640);
        x.fillStyle = '#f0f3fb'; x.font = '800 68px "Plus Jakarta Sans", sans-serif';
        var ls = lineas(x, f(), 880), y = 760; ls.forEach(function(l){ x.fillText(l, 540, y); y += 88; });
        if(s.mini){ x.fillStyle = '#93a0c6'; x.font = '600 42px "Plus Jakarta Sans", sans-serif'; y += 40; lineas(x, 'Si no tengo ganas: ' + s.mini + '.', 860).forEach(function(l){ x.fillText(l, 540, y); y += 58; }); }
        x.fillStyle = '#93a0c6'; x.font = '700 34px "Plus Jakarta Sans", sans-serif'; x.fillText('AriasMind', 540, 1760);
        $('#ssPrev').src = c.toDataURL('image/png'); $('#ssPrev').classList.remove('t-hidden');
        compartirImagen(c, 'mi-sistema-ariasmind.png', f());
      });
    });
    $('#ssRecordar').addEventListener('click', function(){
      if(!s.que){ $('#ssMsg').textContent = 'Primero escribe qué vas a hacer.'; return; }
      var ini = horaRazonable(new Date(hoy0().getTime() + DIA), +s.hora);
      var evs = [{titulo: 'Mi sistema: ' + s.que, inicio: ini, minutos: 20, diario: true, detalle: f() + (s.mini ? ' Si no tengo ganas: ' + s.mini + '.' : '')}];
      if(s.noche){ var n = horaRazonable(hoy0(), 20); if(n < new Date()) n = new Date(n.getTime() + DIA); evs.push({titulo: 'Prepara para mañana: ' + s.noche, inicio: n, minutos: 10, diario: true, detalle: 'Deja listo lo que necesitas para cumplir tu sistema mañana.'}); }
      ics(evs, 'mi-sistema.ics');
      $('#ssMsg').textContent = '';
    });
    /* registro del mes: un día después de fallar se marca "volviste" */
    var mes = new Date(); mes.setDate(1);
    function pintarMes(){
      var h = hoy0(), y = mes.getFullYear(), m = mes.getMonth(), n = new Date(y, m + 1, 0).getDate(), pad = (new Date(y, m, 1).getDay() + 6) % 7;
      var html = ['L','M','M','J','V','S','D'].map(function(d){ return '<span class="wd">' + d + '</span>'; }).join('');
      for(var i = 0; i < pad; i++) html += '<button class="blank" tabindex="-1" aria-hidden="true"></button>';
      var hechos = 0;
      for(var d = 1; d <= n; d++){
        var dt = new Date(y, m, d), k = key(dt), on = !!s.dias[k], ant = new Date(y, m, d - 1);
        var volvio = on && !s.dias[key(ant)] && Object.keys(s.dias).some(function(x){ return x < k; });
        if(on) hechos++;
        html += '<button type="button" data-k="' + k + '" class="' + (on ? (volvio ? 'back' : 'y') : '') + (dt.getTime() === h.getTime() ? ' today' : '') + '"' + (dt > h ? ' disabled' : '') + ' aria-pressed="' + on + '" aria-label="' + d + ' de ' + MESES_L[m] + (on ? ', hecho' : '') + '">' + d + '</button>';
      }
      $('#ssCal').innerHTML = html; $('#ssMes').textContent = MESES_L[m] + ' ' + y; $('#ssCuenta').textContent = hechos + (hechos === 1 ? ' día' : ' días') + ' este mes';
    }
    $('#ssCal').addEventListener('click', function(e){ var b = e.target.closest('button[data-k]'); if(!b || b.disabled) return; if(s.dias[b.dataset.k]) delete s.dias[b.dataset.k]; else s.dias[b.dataset.k] = 1; guardar(); pintarMes(); });
    $('#ssPrevMes').addEventListener('click', function(){ mes.setMonth(mes.getMonth() - 1); pintarMes(); });
    $('#ssSigMes').addEventListener('click', function(){ var t = new Date(); if(mes.getFullYear() * 12 + mes.getMonth() < t.getFullYear() * 12 + t.getMonth()){ mes.setMonth(mes.getMonth() + 1); pintarMes(); } });
    frase(); pintarMes();
  }

  /* ---------- 3. Tu academia personal ---------- */
  function academia(){
    var P = [
      ['estructura', 'Tengo un horario fijo y escrito para aprender.'],
      ['estructura', 'Sé qué toca estudiar en cada sesión, en qué orden.'],
      ['cuentas', 'Hay alguien que sabe cuál es mi meta y espera ver mi avance.'],
      ['cuentas', 'Tengo una fecha concreta para mostrar o usar lo que aprendo.'],
      ['comunidad', 'Practico o estudio con otras personas que aprenden lo mismo.'],
      ['comunidad', 'Tengo a quién preguntarle cuando me trabo.']
    ];
    var R = {
      estructura: {n: 'Estructura', que: 'Sabes por qué quieres aprender, pero falta un camino claro.', pasos: ['<b>Arma tu sistema</b>: cuándo, dónde y qué vas a estudiar. Puedes hacerlo en <a href="herramienta-tu-sistema.html">Diseña tu sistema</a>.', '<b>Escribe tu horario</b> con bloques reales y trátalos como inamovibles. Cuando aprendí inglés, yo tenía un bloque para gramática, otro para escuchar y otro para hablar.', '<b>Decide el orden de los temas</b> antes de sentarte, para no gastar energía eligiendo.', 'Si te cuesta armarlo solo, <b>un curso o un buen libro</b> te dan esa estructura hecha.']},
      cuentas: {n: 'Rendición de cuentas', que: 'Puede que tengas un plan, pero nadie espera nada de ti.', pasos: ['<b>Di tu meta en voz alta</b> a alguien de tu familia o a un amigo.', '<b>Pon una fecha</b> en la que le vas a mostrar tu avance. Puedes fijarla como tu primera prueba en el <a href="herramienta-plan-para-aprender.html">Plan para aprender algo</a>.', 'Si ya lo intentaste y no te funcionó, <b>pagar una academia o un tutor</b> también es una buena forma de comprometerte.']},
      comunidad: {n: 'Comunidad', que: 'Estás aprendiendo solo, y eso cansa.', pasos: ['<b>Busca a otros que aprendan lo mismo</b>: un grupo, un foro o aplicaciones como HelloTalk o Tandem si es un idioma.', '<b>Encuentra a una persona</b> a quien preguntarle cuando te trabes: tu "espejo" en el <a href="herramienta-plan-para-aprender.html">Plan para aprender algo</a>.', 'Un grupo de estudio, de tu iglesia o de tu trabajo <b>puede ser tu academia personal</b>.']}
    };
    var resp = {};
    $('#acPreg').innerHTML = P.map(function(p, i){ return '<div class="t-q"><p>' + (i + 1) + '. ' + p[1] + '</p><div class="t-pills" data-i="' + i + '"><button class="t-pill" type="button" data-v="2">Sí</button><button class="t-pill" type="button" data-v="1">A veces</button><button class="t-pill" type="button" data-v="0">No</button></div></div>'; }).join('');
    $('#acPreg').addEventListener('click', function(e){ var b = e.target.closest('button'); if(!b) return; var g = b.parentNode; press(g, b); resp[g.dataset.i] = +b.dataset.v; $('#acVer').disabled = Object.keys(resp).length < P.length; });
    $('#acVer').addEventListener('click', function(){
      var t = {estructura: 0, cuentas: 0, comunidad: 0};
      P.forEach(function(p, i){ t[p[0]] += resp[i]; });
      var orden = Object.keys(t).sort(function(a, b){ return t[a] - t[b]; }), peor = orden[0];
      $('#acBarras').innerHTML = Object.keys(t).map(function(k){ var v = Math.round(t[k] / 4 * 10); return '<div class="t-bar' + (k === peor && t[k] < 4 ? ' low' : '') + '"><span>' + R[k].n + '</span><i><b style="width:' + v * 10 + '%"></b></i><span>' + v + '/10</span></div>'; }).join('');
      if(t[peor] === 4){ $('#acRes').innerHTML = '<p><b>Tienes las tres piezas.</b> Tu reto ahora es sostenerlas. Si algo empieza a fallar, vuelve a hacer este diagnóstico.</p>'; }
      else $('#acRes').innerHTML = '<p><b>Lo que más te falta: ' + R[peor].n.toLowerCase() + '.</b> ' + R[peor].que + '</p><p class="t-step" style="margin-top:.8rem">Haz esto esta semana</p><ol class="t-steps">' + R[peor].pasos.map(function(x){ return '<li>' + x + '</li>'; }).join('') + '</ol>';
      $('#acResultado').classList.remove('t-hidden'); $('#acResultado').scrollIntoView({behavior: 'smooth', block: 'start'});
      store.set('academia', {fecha: Date.now(), t: t}); track('herramienta_fin');
    });
  }

  /* ---------- 4. Reto + descanso ---------- */
  function reto(){
    var MSG = {
      facil: 'Si se siente aburrido, súbele un poco: menos ayuda, más velocidad o un ejercicio más difícil. Sin algo de reto, aprendes poco.',
      util: 'Zona útil. Un reto que puedes afrontar es justo el que ayuda a aprender.',
      dificil: 'Si te supera, bájale un poco: divide la tarea en un pedazo más pequeño o pide ayuda. Un reto que te paraliza no ayuda.'
    };
    /* Recomendaciones: [min de reto, min de descanso, bloques, cómo hacerlo, cómo descansar]. Son puntos de partida, no reglas. */
    var REC = {
      memoria: {
        facil:   [15, 3, 3, 'Súbele el reto: tápate las respuestas y ponte a prueba, o agrega palabras nuevas a las que ya sabes.', 'En el descanso no metas información nueva (nada de redes): deja que lo estudiado se asiente.'],
        util:    [20, 5, 3, 'Bloques cortos funcionan mejor para memorizar. En cada bloque intenta recordar antes de mirar.', 'Levántate, toma agua. Al volver, empieza recordando lo del bloque anterior sin mirar.'],
        dificil: [10, 3, 3, 'Bájale: menos cosas a la vez (unas 4 o 5) y bloques más cortos. Mañana sigues con las demás.', 'Descansa lejos de la pantalla. Dormir bien hoy también es parte del repaso.']},
      entender: {
        facil:   [25, 5, 2, 'Súbele el reto: al terminar cada sección, ciérrala y explícala con tus palabras.', 'Camina un poco. Piensa qué pregunta te quedó, sin volver al texto.'],
        util:    [25, 5, 3, 'Lee con una pregunta en mente. Al final de cada bloque escribe en 3 líneas lo que entendiste.', 'Aléjate del texto y de la pantalla. Estira el cuerpo.'],
        dificil: [15, 5, 3, 'Divide el tema en pedazos más pequeños: un solo subtema por bloque. Busca un ejemplo sencillo o un video corto.', 'Descansa de verdad. Si al tercer bloque sigue sin salir, pide ayuda: no es falta de capacidad.']},
      resolver: {
        facil:   [30, 5, 2, 'Súbele el reto: problemas más difíciles, sin mirar la solución, o ponte un tiempo límite.', 'Toma agua y despeja la vista. Vuelve directo al siguiente problema.'],
        util:    [45, 10, 2, 'Resolver y crear necesitan concentración profunda, por eso los bloques son más largos. Una sola tarea, sin notificaciones.', 'Camina o haz algo con las manos. Muchas ideas llegan cuando dejas de pensar en el problema.'],
        dificil: [25, 10, 2, 'Empieza por una versión más fácil del problema o por un ejemplo resuelto. Anota exactamente dónde te trabas.', 'Descanso largo, lejos de la pantalla. Si sigues trabado, pregúntale a alguien que sepa.']},
      cuerpo: {
        facil:   [20, 5, 2, 'Súbele el reto: más velocidad, menos ayuda o una pieza más difícil. Grábate para notar detalles.', 'Suelta y estira las manos, la espalda o la voz.'],
        util:    [20, 5, 3, 'Para habilidades físicas, sesiones cortas y frecuentes rinden más que una larga. Practica lento lo que se te traba.', 'Descansa el cuerpo de verdad: estira, toma agua, relaja las manos o la voz.'],
        dificil: [10, 5, 3, 'Practica muy lento y en pedazos pequeños: solo el pasaje o el movimiento que se te traba.', 'Descansa más de lo que crees que necesitas. Forzar con cansancio fija errores y puede lastimarte.']}
    };
    var NOMBRE = {memoria: 'memorizar', entender: 'leer y entender', resolver: 'resolver o crear', cuerpo: 'practicar con el cuerpo'};
    var DIF = {facil: 'se siente aburrido', util: 'cuesta un poco', dificil: 'te supera'};
    var dif = null, tipo = null;
    function recomendar(){
      var box = $('#rtRec');
      if(!tipo){ box.classList.add('t-hidden'); return; }
      var d = dif || 'util', r = REC[tipo][d];
      box.innerHTML = '<p class="t-step">Recomendado para ' + NOMBRE[tipo] + (dif ? ' cuando ' + DIF[d] : '') + '</p>' +
        '<div class="t-stats" style="margin:.4rem 0 .8rem"><div><b>' + r[0] + ' min</b>reto</div><div><b>' + r[1] + ' min</b>descanso</div><div><b>' + r[2] + '</b>bloques</div></div>' +
        '<p><b>Cómo hacerlo:</b> ' + r[3] + '</p><p><b>En el descanso:</b> ' + r[4] + '</p>' +
        (dif ? '' : '<p class="t-note">Elige también qué tan difícil se siente para ajustar la recomendación.</p>') +
        '<div class="t-row"><button class="btn btn-primary" type="button" id="rtUsar">Usar esta recomendación</button></div>' +
        '<p class="t-note">Son puntos de partida, no reglas exactas: cada persona y cada tarea es distinta. Ajusta los minutos si lo necesitas.</p>';
      box.classList.remove('t-hidden');
      $('#rtUsar').addEventListener('click', function(){
        $('#rtMinReto').value = r[0]; $('#rtMinDesc').value = r[1]; $('#rtBloques').value = r[2];
        if(!T.activo()){ cfg = leer(); $('#rtReloj').textContent = mmss(cfg.reto); }
        this.textContent = 'Listo ✓'; track('herramienta_recomendacion');
        $('#rtIniciar').scrollIntoView({behavior: 'smooth', block: 'center'});
      });
    }
    $('#rtDif').addEventListener('click', function(e){ var b = e.target.closest('button'); if(!b) return; press(this, b); dif = b.dataset.d; $('#rtDifMsg').textContent = MSG[dif]; recomendar(); });
    $('#rtTipo').addEventListener('click', function(e){ var b = e.target.closest('button'); if(!b) return; press(this, b); tipo = b.dataset.t; recomendar(); });
    var fase = 'reto', bloque = 1, T, cfg;
    function num(id, def, max){ var v = parseInt($(id).value, 10); if(!(v > 0)) v = def; return Math.min(v, max); }
    function leer(){ return {reto: num('#rtMinReto', 25, 120) * 6e4, desc: num('#rtMinDesc', 5, 60) * 6e4, bloques: num('#rtBloques', 3, 8)}; }
    function pintar(r){
      var dur = fase === 'reto' ? cfg.reto : cfg.desc;
      $('#rtReloj').textContent = mmss(r);
      $('#rtRing').style.setProperty('--p', (100 - r / dur * 100).toFixed(1));
      $('#rtRing').classList.toggle('rest', fase === 'desc');
      $('#rtFase').textContent = fase === 'reto' ? 'bloque de reto' : 'descanso';
      $('#rtBloque').textContent = bloque + ' de ' + cfg.bloques;
    }
    T = Temporizador(pintar, function(){
      if(fase === 'reto'){
        if(bloque >= cfg.bloques){ aviso('fin'); anuncio('🎉', '¡Terminaste!', 'Completaste ' + cfg.bloques + (cfg.bloques === 1 ? ' bloque' : ' bloques') + '. Ahora descansa de verdad.', 'fin');
          $('#rtMsg').innerHTML = '<b>Terminaste.</b> Ahora descansa de verdad: camina, toma agua, aléjate de la pantalla. El descanso es parte del método.'; fin(); track('herramienta_fin'); return; }
        fase = 'desc'; T.iniciar(cfg.desc);   /* el descanso empieza a contar ya, debajo del aviso */
        aviso('descanso'); anuncio('☕', 'Hora de descansar', cfg.desc / 6e4 + ' minutos. Levántate, toma agua, estira el cuerpo.', 'desc');
        $('#rtMsg').innerHTML = '<b>Descanso.</b> Levántate, estira el cuerpo, toma agua. No revises el celular si puedes evitarlo.';
      } else { fase = 'reto'; bloque++; T.iniciar(cfg.reto);
        aviso('reto'); anuncio('🔥', 'De vuelta al reto', 'Bloque ' + bloque + ' de ' + cfg.bloques + '. Retoma donde te quedaste.', 'reto');
        $('#rtMsg').innerHTML = '<b>De vuelta al reto.</b> Retoma donde te quedaste.'; }
    });
    function fin(){ $('#rtIniciar').textContent = 'Empezar de nuevo'; $('#rtIniciar').dataset.s = 'fin'; $('#rtPausa').disabled = true; }
    $('#rtIniciar').addEventListener('click', function(){
      cfg = leer(); fase = 'reto'; bloque = 1; $('#rtMsg').innerHTML = '<b>A trabajar.</b> Una sola tarea, sin cambiar de pestaña.';
      $('#rtStats').innerHTML = '<div><b>' + cfg.reto / 6e4 + ' min</b>reto</div><div><b>' + cfg.desc / 6e4 + ' min</b>descanso</div><div><b id="rtBloque">1 de ' + cfg.bloques + '</b>bloques</div>';
      T.iniciar(cfg.reto); this.textContent = 'Reiniciar'; $('#rtPausa').disabled = false; $('#rtPausa').textContent = 'Pausar'; track('herramienta_inicio');
    });
    $('#rtPausa').addEventListener('click', function(){ if(T.activo()){ T.pausar(); this.textContent = 'Seguir'; } else { T.seguir(); this.textContent = 'Pausar'; } });
    cfg = leer(); $('#rtReloj').textContent = mmss(cfg.reto);
    ['#rtMinReto', '#rtMinDesc', '#rtBloques'].forEach(function(id){ $(id).addEventListener('input', function(){ if(!T.activo()){ cfg = leer(); $('#rtReloj').textContent = mmss(cfg.reto); } }); });
  }

  /* ---------- 5. Plan para aprender algo (antes: ¿Cómo se aprende esto? + Ventana, espejo, prueba) ---------- */
  function plan(){
    var M = {
      manos: {t: 'Algo con las manos', ic: '🔧', ej: 'soldar, cocinar, coser, reparar', pasos: ['<b>Míralo hacer</b> a alguien, en persona o en video, antes de empezar.', '<b>Hazlo tú desde el primer día</b>, aunque salga mal. Las habilidades se aprenden haciendo.', '<b>Consigue un espejo</b>: alguien que te corrija, o grábate para ver tus errores.', '<b>Practica lo que se te traba</b>, no lo que ya te sale.'],
        ph: ['Ver a mi tío trabajar en el taller los sábados.', 'Pedirle que revise lo que hago y grabarme para ver mis errores.', 'Hacer una soldadura recta de 10 cm sin que se corte.']},
      datos: {t: 'Datos o vocabulario', ic: '🧠', ej: 'palabras de otro idioma, fechas, fórmulas', pasos: ['<b>Haz tarjetas</b>: la pregunta de un lado y la respuesta del otro.', '<b>Intenta recordar antes de voltearla</b>. Recordar con esfuerzo fija más que releer.', '<b>Repasa con pausas</b>: hoy, en 3 días, en una semana. Usa <a href="herramienta-calendario-repaso.html">Repaso activo</a>.', '<b>Pocos a la vez</b>: tu memoria de trabajo sostiene unas cuatro cosas.'],
        ph: ['Una lista de las 100 palabras más usadas y una app de tarjetas.', 'Que alguien me haga preguntas, o ponerme a prueba sin mirar.', 'Decir de memoria 20 palabras nuevas sin equivocarme.']},
      concepto: {t: 'Una idea o concepto', ic: '💡', ej: 'cómo funciona algo, una teoría', pasos: ['<b>Empieza por la pregunta</b> que te da curiosidad, no por la definición seca.', '<b>Divídelo en piezas pequeñas</b> y conecta cada una con algo que ya sabes.', '<b>Explícalo como a un niño</b>. Donde te trabes, ahí está lo que no entendiste.', '<b>Dibuja un esquema</b> con tus propias palabras.'],
        ph: ['Un video corto que lo explique y un capítulo de un buen libro.', 'Explicárselo a un amigo y pedirle que me diga qué no le quedó claro.', 'Explicarlo en 2 minutos sin mirar notas.']},
      idioma: {t: 'Un idioma', ic: '🗣', ej: 'inglés, francés, lenguaje de señas', pasos: ['<b>Escúchalo y háblalo desde el principio</b>, aunque te dé vergüenza.', '<b>Separa bloques</b>: gramática, escuchar, hablar. Cada uno pide práctica distinta.', '<b>Practica con personas reales</b>: un compañero o apps como HelloTalk o Tandem.', '<b>Repasa el vocabulario con pausas</b> y en voz alta.'],
        ph: ['Series con subtítulos en el idioma y un pódcast para principiantes.', 'Un compañero de HelloTalk o Tandem que me corrija.', 'Presentarme 1 minuto en voz alta sin leer.']},
      espacial: {t: 'Lugares, mapas o formas', ic: '🗺', ej: 'geografía, anatomía, planos', pasos: ['<b>Míralo</b>: con mapas, diagramas o el objeto real. Solo escuchando sería muy lento.', '<b>Dibújalo de memoria</b> y luego compara con el original.', '<b>Señala y nombra</b> en voz alta cada parte.', '<b>Repasa con pausas</b>, dibujando otra vez desde cero.'],
        ph: ['Un buen mapa o diagrama impreso, y el objeto real si se puede.', 'Comparar mi dibujo de memoria con el original.', 'Dibujar de memoria el mapa de Centroamérica con sus capitales.']},
      instrumento: {t: 'Un instrumento o el canto', ic: '🎵', ej: 'guitarra, piano, voz', pasos: ['<b>Toca desde el primer día</b>. Ver videos sin tocar no alcanza.', '<b>Practica lento</b> lo que se te traba, y sube la velocidad poco a poco.', '<b>Grábate</b> o pide a alguien que te escuche y te corrija.', '<b>Sesiones cortas y frecuentes</b> rinden más que una larga a la semana. Prueba <a href="herramienta-reto-descanso.html">Reto + descanso</a>.'],
        ph: ['Ver a mi primo tocar los sábados y un canal para principiantes.', 'Grabarme cada domingo y pedirle a mi primo que me corrija.', 'Cambiar de Sol a Do sin parar, 10 veces seguidas.']}
    };
    var tipo = null, planes = store.get('vep', []);
    $('#plTipo').innerHTML = Object.keys(M).map(function(k){ return '<button class="t-opt" type="button" data-k="' + k + '" aria-pressed="false"><span aria-hidden="true">' + M[k].ic + '</span>' + M[k].t + '</button>'; }).join('');
    $('#plTipo').addEventListener('click', function(e){
      var b = e.target.closest('button'); if(!b) return; press(this, b); tipo = b.dataset.k; var m = M[tipo];
      $('#plMetodo').innerHTML = '<p class="t-step">Cómo se practica ' + m.t.toLowerCase() + ' (por ejemplo, ' + m.ej + ')</p><ol class="t-steps">' + m.pasos.map(function(x){ return '<li>' + x + '</li>'; }).join('') + '</ol>';
      $('#plMetodo').classList.remove('t-hidden');
      $('#plVentana').placeholder = m.ph[0]; $('#plEspejo').placeholder = m.ph[1]; $('#plPrueba').placeholder = m.ph[2];
      $('#plPaso2').classList.remove('t-hidden'); track('herramienta_tipo');
    });
    $('#plFecha').value = key(new Date(hoy0().getTime() + 5 * DIA)); $('#plFecha').min = key(hoy0());
    function pintar(){
      $('#plMios').innerHTML = planes.length ? planes.map(function(p, i){
        return '<div class="t-plan"><div style="display:flex;justify-content:space-between;gap:.5rem;align-items:start"><h3>' + (p.tipo && M[p.tipo] ? M[p.tipo].ic + ' ' : '') + esc(p.que) + '</h3><button class="t-x" type="button" data-del="' + i + '" aria-label="Quitar">×</button></div>' +
          '<p><b>Ventana:</b> ' + esc(p.ventana || '—') + '</p><p><b>Espejo:</b> ' + esc(p.espejo || '—') + '</p><p><b>Primera prueba:</b> ' + esc(p.prueba || '—') + (p.fecha ? ' <span style="color:var(--muted)">(' + fecha(new Date(p.fecha + 'T12:00')) + ')</span>' : '') + '</p></div>'; }).join('') : '<p class="t-empty">Todavía no tienes planes guardados.</p>';
    }
    function guardar(){
      var p = {que: $('#plQue').value.trim(), tipo: tipo, ventana: $('#plVentana').value.trim(), espejo: $('#plEspejo').value.trim(), prueba: $('#plPrueba').value.trim(), fecha: $('#plFecha').value};
      if(!p.que){ $('#plQue').focus(); $('#plMsg').textContent = 'Escribe primero qué quieres aprender.'; return null; }
      planes.unshift(p); store.set('vep', planes); pintar(); $('#plMsg').textContent = 'Guardado en Mis planes.'; track('herramienta_fin'); return p;
    }
    $('#plGuardar').addEventListener('click', guardar);
    $('#plAvisar').addEventListener('click', function(){ var p = guardar(); if(!p || !p.fecha) return;
      ics([{titulo: 'Primera prueba: ' + (p.prueba || p.que), inicio: horaRazonable(new Date(p.fecha + 'T12:00'), 18), minutos: 30, detalle: 'Quiero aprender: ' + p.que + '. Ventana: ' + p.ventana + '. Espejo: ' + p.espejo + '.'}], 'primera-prueba.ics'); });
    $('#plMios').addEventListener('click', function(e){ var b = e.target.closest('[data-del]'); if(!b) return; planes.splice(+b.dataset.del, 1); store.set('vep', planes); pintar(); });
    pintar();
  }

  /* ---------- 6. Lo que sí puedo (antes: Inventario de lo que sé + Todavía no me sale) ---------- */
  function confianza(){
    /* une los datos de las dos herramientas anteriores, una sola vez */
    var items = store.get('inventario', []), viejas = store.get('pruebas', null);
    if(viejas && viejas.length){ viejas.forEach(function(p){ if(items.indexOf(p.t) < 0) items.push(p.t); }); store.set('inventario', items); store.set('pruebas', []); }
    /* Catálogo de cosas que la gente aprende. Toca para agregar; si no está, se escribe a mano. */
    var CATALOGO = [
      ['🌱', 'Hoy logré', ['Estudié aunque no tenía ganas', 'Terminé una lección', 'Pregunté sin miedo', 'Practiqué 20 minutos', 'Me equivoqué y lo volví a intentar', 'Entendí algo que antes no', 'Repasé sin mirar mis apuntes', 'Le expliqué algo a alguien', 'Cumplí mi horario', 'Leí un capítulo completo', 'Pedí ayuda cuando me trabé', 'Terminé algo que tenía pendiente', 'Me levanté temprano para estudiar', 'Dejé el celular lejos mientras estudiaba', 'Hice el ejercicio difícil', 'Volví después de fallar un día', 'Hablé en otro idioma con alguien', 'Me grabé y me corregí', 'Dormí bien antes de estudiar', 'Me hablé con amabilidad al equivocarme']],
      ['🏠', 'Casa y cocina', ['Cocinar arroz', 'Hacer pupusas', 'Cocinar frijoles', 'Hacer tortillas', 'Preparar desayuno típico', 'Hacer café de olla', 'Hornear pan o pasteles', 'Hacer sopa de res', 'Preparar refrescos naturales', 'Hacer tamales', 'Lavar ropa a mano', 'Planchar camisas', 'Coser un botón', 'Remendar ropa', 'Hacer un ruedo', 'Limpiar y ordenar la casa', 'Cuidar plantas', 'Hacer un huerto', 'Hacer las compras con un presupuesto', 'Organizar la alacena', 'Cuidar una mascota', 'Bañar y cuidar a un perro', 'Hacer el menú de la semana', 'Congelar y guardar comida']],
      ['🔧', 'Oficios y reparaciones', ['Cambiar un tomacorriente', 'Instalar una lámpara', 'Cambiar un interruptor', 'Hacer una instalación eléctrica básica', 'Destapar una tubería', 'Cambiar un grifo', 'Arreglar una fuga de agua', 'Pintar una pared', 'Resanar una pared', 'Pegar cerámica', 'Hacer una mezcla de cemento', 'Pegar bloques', 'Soldar', 'Cortar y medir con precisión', 'Usar un taladro', 'Hacer un mueble sencillo', 'Lijar y barnizar madera', 'Tapizar una silla', 'Coser a máquina', 'Hacer un pantalón', 'Arreglar un electrodoméstico', 'Cambiar una chapa', 'Instalar una cortina', 'Leer un plano']],
      ['🚗', 'Manejar y mecánica', ['Manejar carro', 'Manejar moto', 'Andar en bicicleta', 'Estacionarme en paralelo', 'Cambiar una llanta', 'Revisar el aceite', 'Cambiar el aceite', 'Pasar corriente a una batería', 'Revisar la presión de las llantas', 'Cambiar una bujía', 'Ubicarme con mapas en el celular', 'Usar el transporte público en otra ciudad', 'Planear un viaje', 'Sacar mi licencia']],
      ['💼', 'Trabajo', ['Atender clientes', 'Vender', 'Manejar una caja', 'Llevar inventario', 'Hacer cotizaciones', 'Hacer facturas', 'Trabajar en un call center', 'Atender quejas con calma', 'Dirigir a un equipo', 'Capacitar a alguien nuevo', 'Organizar una reunión', 'Presentar un informe', 'Negociar un precio', 'Hacer una entrevista de trabajo', 'Escribir mi currículum', 'Trabajar bajo presión', 'Cumplir metas de ventas', 'Usar una herramienta nueva del trabajo', 'Resolver problemas sin que me digan cómo', 'Trabajar desde casa']],
      ['💻', 'Tecnología y celular', ['Usar Excel', 'Hacer fórmulas en Excel', 'Usar Word', 'Hacer presentaciones', 'Diseñar en Canva', 'Editar fotos', 'Editar videos', 'Usar Google Drive', 'Hacer videollamadas', 'Instalar y configurar apps', 'Formatear una computadora', 'Instalar Windows', 'Reparar una computadora', 'Cambiar la pantalla de un celular', 'Crear un correo electrónico', 'Manejar redes sociales', 'Crear una página web', 'Programar', 'Usar inteligencia artificial', 'Proteger mis contraseñas', 'Hacer copias de seguridad', 'Escribir rápido en el teclado', 'Grabar un podcast', 'Hacer transferencias en línea']],
      ['🗣', 'Idiomas y comunicación', ['Inglés básico', 'Presentarme en inglés', 'Tener una conversación en inglés', 'Entender una película en inglés', 'Leer en inglés', 'Escribir un correo en inglés', 'Pronunciar mejor', 'Otro idioma', 'Lenguaje de señas', 'Hablar en público', 'Escribir un correo formal', 'Redactar sin faltas de ortografía', 'Explicar algo con claridad', 'Escuchar sin interrumpir', 'Dar mi opinión con respeto', 'Contar una historia']],
      ['📚', 'Estudio y escuela', ['Sumar fracciones', 'Álgebra básica', 'Porcentajes', 'Reglas de tres', 'Geometría', 'Física básica', 'Química básica', 'Biología', 'Historia de El Salvador', 'Geografía', 'Leer más rápido', 'Comprender lo que leo', 'Tomar buenos apuntes', 'Hacer resúmenes', 'Hacer mapas mentales', 'Estudiar para un examen', 'Escribir un ensayo', 'Investigar en fuentes confiables', 'Citar fuentes', 'Terminar el bachillerato', 'Aprobar una materia difícil', 'Estudiar a distancia']],
      ['🎵', 'Arte y música', ['Tocar guitarra', 'Tocar piano o teclado', 'Tocar batería', 'Tocar bajo', 'Cantar afinado', 'Leer partituras', 'Componer una canción', 'Dibujar', 'Pintar', 'Hacer letras bonitas', 'Tomar buenas fotos', 'Bailar', 'Actuar en una obra', 'Hacer manualidades', 'Tejer', 'Hacer bisutería', 'Decorar para un evento']],
      ['⚽', 'Deporte y salud', ['Nadar', 'Correr 5 kilómetros', 'Jugar fútbol', 'Jugar básquetbol', 'Jugar voleibol', 'Hacer ejercicio en casa', 'Estirar correctamente', 'Levantar pesas con buena técnica', 'Cocinar más sano', 'Tomar suficiente agua', 'Dormir mejor', 'Primeros auxilios', 'Hacer RCP', 'Tomar la presión arterial', 'Respirar para calmarme']],
      ['🤝', 'Cuidar a otros', ['Cuidar a un bebé', 'Cambiar pañales', 'Preparar un biberón', 'Ayudar con las tareas escolares', 'Cuidar a un adulto mayor', 'Cuidar a alguien enfermo', 'Dar medicamentos a su hora', 'Acompañar en el hospital', 'Consolar a alguien', 'Escuchar a un amigo', 'Enseñarle algo a un niño', 'Mediar en un pleito']],
      ['💰', 'Dinero y negocios', ['Hacer un presupuesto', 'Ahorrar cada mes', 'Salir de una deuda', 'Calcular precios y ganancias', 'Llevar las cuentas de un negocio', 'Vender en línea', 'Vender por WhatsApp', 'Emprender un negocio', 'Atender un puesto', 'Cobrar con respeto', 'Hacer un plan de negocio', 'Entender un préstamo', 'Declarar impuestos', 'Comparar antes de comprar']],
      ['⛪', 'Fe y comunidad', ['Leer la Biblia completa', 'Memorizar versículos', 'Enseñar en la escuela dominical', 'Dirigir un grupo de estudio', 'Predicar o compartir una reflexión', 'Dirigir la alabanza', 'Tocar en la iglesia', 'Orar en público', 'Organizar un evento', 'Servir como voluntario', 'Trabajar con jóvenes', 'Visitar enfermos', 'Coordinar un ministerio']],
      ['🧭', 'Vida y carácter', ['Organizar mi tiempo', 'Levantarme temprano', 'Cumplir lo que prometo', 'Pedir ayuda', 'Decir que no', 'Manejar el estrés', 'Calmarme antes de responder', 'Perdonar', 'Pedir perdón', 'Aceptar una crítica', 'Hablarme con amabilidad', 'Terminar lo que empiezo', 'Volver a empezar después de fallar', 'Aprender por mi cuenta', 'Vivir solo', 'Mudarme a otro lugar', 'Adaptarme a un trabajo nuevo', 'Tomar decisiones difíciles']]
    ];
    var cat = 0, norm = function(t){ return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); };
    function tiene(t){ var n = norm(t); return items.some(function(x){ return norm(x) === n; }); }
    function chip(t){ var on = tiene(t); return '<button class="t-sug" type="button" data-t="' + esc(t) + '" aria-pressed="' + on + '">' + (on ? '✓ ' : '+ ') + esc(t) + '</button>'; }
    function pintarCats(){
      var q = $('#ivIn').value.trim();
      $('#ivCats').innerHTML = CATALOGO.map(function(c, i){ return '<button class="t-cat" type="button" data-c="' + i + '" aria-pressed="' + (!q && i === cat) + '"><span aria-hidden="true">' + c[0] + '</span>' + esc(c[1]) + '</button>'; }).join('');
    }
    function pintarSug(){
      var q = $('#ivIn').value.trim(), html;
      if(q){
        var nq = norm(q), res = [];
        CATALOGO.forEach(function(c){ c[2].forEach(function(t){ if(norm(t).indexOf(nq) > -1 && res.indexOf(t) < 0) res.push(t); }); });
        var exacto = res.some(function(t){ return norm(t) === nq; }) || tiene(q);
        html = (exacto ? '' : '<button class="t-sug t-sug-new" type="button" data-nuevo="1">+ Agregar «' + esc(q) + '»</button>') + res.slice(0, 40).map(chip).join('');
        $('#ivSugH').textContent = res.length ? res.length + (res.length === 1 ? ' coincidencia' : ' coincidencias') : 'No está en la lista: agrégalo con tus palabras';
      } else {
        html = CATALOGO[cat][2].map(chip).join('');
        $('#ivSugH').textContent = CATALOGO[cat][0] + ' ' + CATALOGO[cat][1] + ' · toca para agregar';
      }
      $('#ivSug').innerHTML = html;
    }
    function pintar(){
      $('#ivN').textContent = items.length;
      $('#ivLista').innerHTML = items.length ? items.map(function(t, i){ return '<span class="t-chip">' + esc(t) + '<button type="button" data-i="' + i + '" aria-label="Quitar ' + esc(t) + '">×</button></span>'; }).join('') : '<p class="t-empty">Todavía no has agregado nada. Empieza con algo pequeño: todo cuenta.</p>';
    }
    function agregar(t){ t = String(t).trim(); if(!t || tiene(t)) return; items.unshift(t); store.set('inventario', items); pintar(); pintarSug(); track('herramienta_prueba'); }
    function quitar(t){ var n = norm(t); items = items.filter(function(x){ return norm(x) !== n; }); store.set('inventario', items); pintar(); pintarSug(); }
    function escrito(){ var v = $('#ivIn').value.trim(); if(!v) { $('#ivIn').focus(); return; } agregar(v); $('#ivIn').value = ''; pintarCats(); pintarSug(); $('#ivMsg').textContent = '«' + v + '» agregado.'; }
    $('#ivAdd').addEventListener('click', escrito);
    $('#ivIn').addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); escrito(); } });
    $('#ivIn').addEventListener('input', function(){ pintarCats(); pintarSug(); });
    $('#ivCats').addEventListener('click', function(e){ var b = e.target.closest('button'); if(!b) return; cat = +b.dataset.c; $('#ivIn').value = ''; pintarCats(); pintarSug(); });
    $('#ivSug').addEventListener('click', function(e){ var b = e.target.closest('button'); if(!b) return;
      if(b.dataset.nuevo){ escrito(); return; }
      var t = b.dataset.t; if(tiene(t)) quitar(t); else agregar(t); });
    $('#ivLista').addEventListener('click', function(e){ var b = e.target.closest('button'); if(!b) return; items.splice(+b.dataset.i, 1); store.set('inventario', items); pintar(); pintarSug(); });
    $('#ivTarjeta').addEventListener('click', function(){
      if(items.length < 3){ $('#ivMsg').textContent = 'Anota al menos 3 cosas para crear tu tarjeta.'; return; }
      fuentesListas().then(function(){
        var c = document.createElement('canvas'); c.width = 1080; c.height = 1350; var x = c.getContext('2d');
        var g = x.createLinearGradient(0, 0, 1080, 1350); g.addColorStop(0, '#123a45'); g.addColorStop(.55, '#18214a'); g.addColorStop(1, '#2a1a35'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1350);
        x.textAlign = 'center';
        x.fillStyle = '#93a0c6'; x.font = '700 36px "Plus Jakarta Sans", sans-serif'; x.fillText('LO QUE SÍ PUEDO', 540, 230);
        x.fillStyle = '#38d9d9'; x.font = '800 260px "Plus Jakarta Sans", sans-serif'; x.fillText(String(items.length), 540, 540);
        x.fillStyle = '#f0f3fb'; x.font = '800 64px "Plus Jakarta Sans", sans-serif'; x.fillText('cosas que he aprendido', 540, 650);
        x.font = '500 46px "Plus Jakarta Sans", sans-serif'; x.fillStyle = '#cdd5ee'; x.fillText('y que antes no sabía.', 540, 720);
        x.font = '600 34px "Plus Jakarta Sans", sans-serif'; x.fillStyle = '#93a0c6';
        var y = 860; lineas(x, items.slice(-6).join('  ·  '), 880).slice(0, 4).forEach(function(l){ x.fillText(l, 540, y); y += 50; });
        x.fillStyle = '#38d9d9'; x.font = '700 36px "Plus Jakarta Sans", sans-serif'; x.fillText('¿Y tú? Haz el tuyo en ariasmind.com', 540, 1230);
        $('#ivPrev').src = c.toDataURL('image/png'); $('#ivPrev').classList.remove('t-hidden');
        compartirImagen(c, 'lo-que-si-puedo-ariasmind.png', 'He aprendido ' + items.length + ' cosas que antes no sabía. Haz tu lista: ' + DOM + '/herramienta-lo-que-si-puedo.html');
      });
    });
    /* la voz vieja */
    function frase(){
      var a = $('#tdQue').value.trim(), b = $('#tdHoy').value.trim();
      $('#tdVieja').textContent = $('#tdVoz').value.trim() ? '"' + $('#tdVoz').value.trim() + '"' : '"Soy burro para esto."';
      $('#tdNueva').textContent = '"Todavía no me sale ' + (a || '___') + '.' + (b ? ' Hoy ' + b + '.' : '') + '"';
    }
    ['#tdVoz', '#tdQue', '#tdHoy'].forEach(function(s){ $(s).addEventListener('input', frase); });
    function pintarFrases(){ var g = store.get('frases', []); $('#tdFrases').innerHTML = g.slice(0, 5).map(function(x){ return '<li><span class="t-dot">✓</span><b>' + esc(x.t) + '</b></li>'; }).join(''); }
    $('#tdGuardar').addEventListener('click', function(){ var t = $('#tdNueva').textContent; if(t.indexOf('___') > -1){ $('#tdQue').focus(); return; }
      var g = store.get('frases', []); g.unshift({t: t, f: Date.now()}); store.set('frases', g);
      var hoy = $('#tdHoy').value.trim(); if(hoy) agregar(hoy);
      $('#tdMsg').textContent = hoy ? 'Guardada. Lo que lograste hoy también se agregó a tu lista.' : 'Guardada. La verás aquí la próxima vez.'; pintarFrases(); });
    frase(); pintar(); pintarFrases(); pintarCats(); pintarSug();
  }

  /* ---------- 7. Mi proyecto de aprendizaje: junta todas las herramientas en un solo plan ---------- */
  function proyecto(){
    var app = $('#pjApp');
    var TIPOS = {
      manos: {ic: '🔧', t: 'Algo con las manos', ej: 'soldar, cocinar, coser, reparar', min: 20,
        hitos: ['Conocer las herramientas y la seguridad', 'Hacer el movimiento básico con guía', 'Hacer un trabajo completo sencillo', 'Hacer un trabajo real sin ayuda'],
        como: 'Míralo hacer, hazlo tú desde el primer día y consigue a alguien que te corrija.'},
      datos: {ic: '🧠', t: 'Datos o vocabulario', ej: 'palabras, fechas, fórmulas', min: 20,
        hitos: ['Aprender los primeros 50 datos o palabras', 'Repasarlos con pausas cada semana', 'Usarlos en ejercicios o frases', 'Recordarlos todos sin mirar'],
        como: 'Pocos a la vez, intenta recordar antes de mirar y repasa con pausas.'},
      concepto: {ic: '💡', t: 'Una idea o tema de estudio', ej: 'una materia, una teoría, cómo funciona algo', min: 25,
        hitos: ['Entender las ideas base y el vocabulario', 'Entender las piezas principales', 'Explicarlo con mis palabras', 'Enseñárselo a alguien'],
        como: 'Empieza por la pregunta que te interesa, divídelo en piezas y explícalo como a un niño.'},
      idioma: {ic: '🗣', t: 'Un idioma', ej: 'inglés, francés, lenguaje de señas', min: 20,
        hitos: ['Saludar, presentarme y conocer 100 palabras', 'Tener conversaciones simples con apoyo', 'Entender audios cortos sin subtítulos', 'Conversar 10 minutos con alguien'],
        como: 'Escúchalo y háblalo desde el principio, separa gramática, escuchar y hablar, y practica con personas reales.'},
      espacial: {ic: '🗺', t: 'Lugares, mapas o formas', ej: 'geografía, anatomía, planos', min: 20,
        hitos: ['Ver el mapa o modelo completo', 'Aprender las partes por zonas', 'Dibujarlo de memoria, aunque sea con errores', 'Dibujarlo completo sin mirar'],
        como: 'Míralo, dibújalo de memoria y compara con el original.'},
      instrumento: {ic: '🎵', t: 'Un instrumento o el canto', ej: 'guitarra, piano, voz', min: 20,
        hitos: ['Postura y primeras notas o acordes', 'Cambiar entre acordes o notas sin parar', 'Tocar una canción completa, lento', 'Tocar la canción a tiempo frente a alguien'],
        como: 'Toca desde el primer día, practica lento lo que se te traba y grábate.'}
    };
    var DIAS_C = ['L', 'M', 'M', 'J', 'V', 'S', 'D'], DIAS_L = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'], BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
    var lista = store.get('proyectos', []), actual = 0, paso = 0, d = null, T = null;
    var PASOS = ['Tu meta', 'Tu tiempo', 'Tu camino', 'Tus recursos', 'Tu compromiso', 'Revisar'];
    function dow(dt){ return (dt.getDay() + 6) % 7; }   /* lunes = 0 */
    function semanas(meta){ return Math.max(1, Math.round((new Date(meta + 'T12:00') - hoy0()) / (7 * DIA))); }
    function nuevo(){ var m = new Date(hoy0().getTime() + 12 * 7 * DIA);
      return {id: Date.now(), que: '', tipo: '', para: '', nivel: 'cero', meta: key(m), dias: [0, 2, 4], min: 20, hora: '19:00', donde: '', mini: '',
        hitos: [], ventana: '', espejo: '', comunidad: '', cuentas: '', cuentasFecha: '', prueba: '', pruebaFecha: key(new Date(hoy0().getTime() + 7 * DIA)), sesiones: {}, creado: Date.now()}; }
    function guardarTodo(){ store.set('proyectos', lista); }
    function hitosBase(){ var t = TIPOS[d.tipo], n = semanas(d.meta);
      return (t ? t.hitos : ['Aprender lo básico', 'Practicar con guía', 'Practicar por mi cuenta', 'Prueba final']).map(function(h, i){ return {t: h, semana: Math.max(1, Math.round(n * (i + 1) / 4)), hecho: false}; }); }

    /* ======= Asistente ======= */
    function asistente(){
      var t = TIPOS[d.tipo];
      var barra = '<div class="pj-steps" aria-label="Paso ' + (paso + 1) + ' de ' + PASOS.length + '">' + PASOS.map(function(p, i){ return '<span class="' + (i < paso ? 'ok' : i === paso ? 'on' : '') + '"><i>' + (i < paso ? '✓' : i + 1) + '</i><small>' + p + '</small></span>'; }).join('') + '</div>';
      var h = '';
      if(paso === 0){
        h = '<p class="t-step">Paso 1 · Tu meta</p><h2>¿Qué quieres aprender?</h2>' +
          '<label class="visually-hidden" for="pjQue">Lo que quieres aprender</label><input class="t-input" id="pjQue" maxlength="60" placeholder="Ej.: inglés para mi trabajo, guitarra, Excel" value="' + esc(d.que) + '">' +
          '<p class="t-label">¿Qué tipo de cosa es?</p><div class="t-opts" id="pjTipo">' + Object.keys(TIPOS).map(function(k){ return '<button class="t-opt" type="button" data-k="' + k + '" aria-pressed="' + (d.tipo === k) + '"><span aria-hidden="true">' + TIPOS[k].ic + '</span>' + TIPOS[k].t + '<small>' + TIPOS[k].ej + '</small></button>'; }).join('') + '</div>' +
          '<label class="t-label" for="pjPara">¿Para qué lo quieres aprender?</label><input class="t-input" id="pjPara" maxlength="100" placeholder="Ej.: conseguir un mejor trabajo, tocar en la iglesia" value="' + esc(d.para) + '">' +
          '<p class="t-note">Un "para qué" claro te sostiene los días sin ganas.</p>' +
          '<p class="t-label">¿Cómo empiezas?</p><div class="t-pills" id="pjNivel">' + [['cero', 'Desde cero'], ['algo', 'Sé un poco'], ['medio', 'Ya tengo base']].map(function(x){ return '<button class="t-pill" type="button" data-n="' + x[0] + '" aria-pressed="' + (d.nivel === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
          '<label class="t-label" for="pjMeta">¿Para cuándo quieres lograrlo?</label><input class="t-input" id="pjMeta" type="date" min="' + key(new Date(hoy0().getTime() + 7 * DIA)) + '" value="' + d.meta + '">' +
          '<p class="t-note" id="pjMetaN">' + semanas(d.meta) + ' semanas a partir de hoy.</p>';
      } else if(paso === 1){
        h = '<p class="t-step">Paso 2 · Tu tiempo</p><h2>¿Cuándo vas a practicar?</h2><p class="hint">Mejor poco y seguido que mucho de vez en cuando.</p>' +
          '<p class="t-label">Días de la semana</p><div class="pj-days" id="pjDias">' + DIAS_C.map(function(x, i){ return '<button type="button" data-d="' + i + '" aria-pressed="' + (d.dias.indexOf(i) > -1) + '" aria-label="' + DIAS_L[i] + '">' + x + '</button>'; }).join('') + '</div>' +
          '<div class="t-row" style="gap:.7rem"><div style="flex:1 1 8rem"><label class="t-label" for="pjMin">Minutos por sesión</label><input class="t-input" id="pjMin" type="number" inputmode="numeric" min="5" max="240" value="' + d.min + '"></div>' +
          '<div style="flex:1 1 8rem"><label class="t-label" for="pjHora">Hora</label><input class="t-input" id="pjHora" type="time" value="' + d.hora + '"></div></div>' +
          (t ? '<p class="t-note">Para ' + t.t.toLowerCase() + ' recomendamos sesiones de unos ' + t.min + ' minutos. Si tienes más tiempo, haz varios bloques con descanso.</p>' : '') +
          '<label class="t-label" for="pjDonde">¿Dónde?</label><input class="t-input" id="pjDonde" maxlength="60" placeholder="Ej.: la mesa de la sala" value="' + esc(d.donde) + '">' +
          '<label class="t-label" for="pjMini">Tu versión de 2 minutos, para los días sin ganas</label><input class="t-input" id="pjMini" maxlength="70" placeholder="Ej.: repasar 5 palabras" value="' + esc(d.mini) + '">' +
          '<div class="t-box cyan"><p class="t-sentence" id="pjFrase"></p></div>';
      } else if(paso === 2){
        if(!d.hitos.length) d.hitos = hitosBase();
        h = '<p class="t-step">Paso 3 · Tu camino</p><h2>Las etapas de tu proyecto</h2><p class="hint">Te propongo ' + d.hitos.length + ' etapas para llegar a tu meta en ' + semanas(d.meta) + ' semanas. Cámbialas como quieras.</p>' +
          '<ol class="pj-hitos" id="pjHitos">' + d.hitos.map(function(x, i){ return '<li><input class="t-input" data-h="' + i + '" maxlength="80" value="' + esc(x.t) + '" aria-label="Etapa ' + (i + 1) + '"><label class="pj-sem">Semana <input class="t-input" type="number" min="1" max="104" data-s="' + i + '" value="' + x.semana + '" aria-label="Semana de la etapa ' + (i + 1) + '"></label><button class="t-x" type="button" data-q="' + i + '" aria-label="Quitar etapa">×</button></li>'; }).join('') + '</ol>' +
          '<div class="t-row"><button class="btn btn-secondary" type="button" id="pjMas">+ Agregar etapa</button><button class="btn btn-secondary" type="button" id="pjReset">Volver a la propuesta</button></div>' +
          (t ? '<div class="t-box cyan"><p><b>Cómo se practica:</b> ' + t.como + '</p></div>' : '');
      } else if(paso === 3){
        h = '<p class="t-step">Paso 4 · Tus recursos</p><h2>Ventana, espejo y compañía</h2>' +
          '<label class="t-label" for="pjVentana">🪟 Mi ventana: ¿de dónde voy a aprender? (libros, videos, cursos, personas)</label><textarea class="t-area" id="pjVentana" style="min-height:5rem" maxlength="300">' + esc(d.ventana) + '</textarea>' +
          '<label class="t-label" for="pjEspejo">🪞 Mi espejo: ¿quién o qué me va a decir en qué fallo?</label><textarea class="t-area" id="pjEspejo" style="min-height:4.5rem" maxlength="200">' + esc(d.espejo) + '</textarea>' +
          '<label class="t-label" for="pjComunidad">👥 Mi comunidad: ¿con quién voy a practicar o compartir?</label><textarea class="t-area" id="pjComunidad" style="min-height:4.5rem" maxlength="200">' + esc(d.comunidad) + '</textarea>' +
          '<p class="t-note">Una academia te da estructura, alguien que te espera y compañía. Aquí las estás armando tú.</p>';
      } else if(paso === 4){
        h = '<p class="t-step">Paso 5 · Tu compromiso</p><h2>Que alguien sepa y una primera prueba</h2>' +
          '<label class="t-label" for="pjCuentas">¿A quién le vas a contar tu meta?</label><input class="t-input" id="pjCuentas" maxlength="60" placeholder="Ej.: mi hermana, mi pastor, un amigo" value="' + esc(d.cuentas) + '">' +
          '<label class="t-label" for="pjCuentasF">¿Cuándo le vas a mostrar tu avance?</label><input class="t-input" id="pjCuentasF" type="date" value="' + esc(d.cuentasFecha) + '">' +
          '<label class="t-label" for="pjPrueba">✅ Tu primera prueba: algo pequeño que puedas lograr pronto</label><input class="t-input" id="pjPrueba" maxlength="100" placeholder="Ej.: presentarme 1 minuto en inglés sin leer" value="' + esc(d.prueba) + '">' +
          '<label class="t-label" for="pjPruebaF">¿Para cuándo?</label><input class="t-input" id="pjPruebaF" type="date" value="' + esc(d.pruebaFecha) + '">' +
          '<p class="t-note">Cada prueba que superes es evidencia de que sí puedes. Se guardará en "Lo que sí puedo".</p>';
      } else {
        h = '<p class="t-step">Paso 6 · Revisar</p><h2>' + (TIPOS[d.tipo] ? TIPOS[d.tipo].ic + ' ' : '') + esc(d.que) + '</h2>' + resumen() +
          '<p class="t-note">Puedes editarlo después cuando quieras.</p>';
      }
      app.innerHTML = '<div class="tool-card pj-wiz">' + barra + h +
        '<p class="t-msg" id="pjMsg" role="status"></p><div class="t-row pj-nav">' + (paso ? '<button class="btn btn-secondary" type="button" id="pjAtras">← Atrás</button>' : (lista.length ? '<button class="btn btn-secondary" type="button" id="pjCancelar">Cancelar</button>' : '')) +
        '<button class="btn btn-primary" type="button" id="pjSig">' + (paso < PASOS.length - 1 ? 'Siguiente →' : (d._editando ? 'Guardar cambios' : '🚀 Crear mi proyecto')) + '</button></div></div>';
      enlazarPaso();
      var f = $('.pj-wiz input, .pj-wiz textarea', app); if(f && paso && window.innerWidth > 700) f.focus();
    }
    function frasePj(){ var el = $('#pjFrase'); if(!el) return; var ds = d.dias.slice().sort().map(function(i){ return DIAS_L[i]; });
      el.innerHTML = 'Los <span>' + (ds.length ? esc(ds.join(', ')) : '___') + '</span>, a las <span>' + esc(d.hora) + '</span>, en <span>' + esc(d.donde || '___') + '</span>, practicaré <span>' + esc(d.que || '___') + '</span> durante <span>' + d.min + ' minutos</span>.'; }
    function leerPaso(){
      var v = function(id){ var e = $(id, app); return e ? e.value.trim() : ''; };
      if(paso === 0){ d.que = v('#pjQue'); d.para = v('#pjPara'); var m = v('#pjMeta'); if(m && m !== d.meta){ d.meta = m; if(!d._editando) d.hitos = []; } }
      if(paso === 1){ d.min = Math.min(240, Math.max(5, parseInt(v('#pjMin'), 10) || 20)); d.hora = v('#pjHora') || '19:00'; d.donde = v('#pjDonde'); d.mini = v('#pjMini'); }
      if(paso === 2){ $$('[data-h]', app).forEach(function(e){ d.hitos[+e.dataset.h].t = e.value.trim(); }); $$('[data-s]', app).forEach(function(e){ d.hitos[+e.dataset.s].semana = Math.max(1, parseInt(e.value, 10) || 1); });
        d.hitos = d.hitos.filter(function(x){ return x.t; }).sort(function(a, b){ return a.semana - b.semana; }); }
      if(paso === 3){ d.ventana = v('#pjVentana'); d.espejo = v('#pjEspejo'); d.comunidad = v('#pjComunidad'); }
      if(paso === 4){ d.cuentas = v('#pjCuentas'); d.cuentasFecha = v('#pjCuentasF'); d.prueba = v('#pjPrueba'); d.pruebaFecha = v('#pjPruebaF'); }
    }
    function valido(){
      if(paso === 0 && !d.que){ $('#pjMsg').textContent = 'Escribe qué quieres aprender.'; $('#pjQue').focus(); return false; }
      if(paso === 0 && !d.tipo){ $('#pjMsg').textContent = 'Elige qué tipo de cosa es: así te propongo el camino y los tiempos.'; return false; }
      if(paso === 1 && !d.dias.length){ $('#pjMsg').textContent = 'Elige al menos un día de la semana.'; return false; }
      if(paso === 2 && !d.hitos.length){ $('#pjMsg').textContent = 'Deja al menos una etapa.'; return false; }
      return true;
    }
    function enlazarPaso(){
      var on = function(id, ev, fn){ var e = $(id, app); if(e) e.addEventListener(ev, fn); };
      on('#pjTipo', 'click', function(e){ var b = e.target.closest('button'); if(!b) return; press(this, b); if(d.tipo !== b.dataset.k){ d.tipo = b.dataset.k; if(!d._editando){ d.hitos = []; d.min = TIPOS[d.tipo].min; } } });
      on('#pjNivel', 'click', function(e){ var b = e.target.closest('button'); if(!b) return; press(this, b); d.nivel = b.dataset.n; });
      on('#pjMeta', 'change', function(){ $('#pjMetaN').textContent = semanas(this.value || d.meta) + ' semanas a partir de hoy.'; });
      on('#pjDias', 'click', function(e){ var b = e.target.closest('button'); if(!b) return; var i = +b.dataset.d, k = d.dias.indexOf(i); if(k > -1) d.dias.splice(k, 1); else d.dias.push(i); b.setAttribute('aria-pressed', k < 0); frasePj(); });
      ['#pjMin', '#pjHora', '#pjDonde'].forEach(function(id){ on(id, 'input', function(){ leerPaso(); frasePj(); }); });
      frasePj();
      on('#pjHitos', 'click', function(e){ var b = e.target.closest('[data-q]'); if(!b) return; leerPaso(); d.hitos.splice(+b.dataset.q, 1); asistente(); });
      on('#pjMas', 'click', function(){ leerPaso(); var u = d.hitos.length ? d.hitos[d.hitos.length - 1].semana + 1 : 1; d.hitos.push({t: 'Nueva etapa', semana: u, hecho: false}); asistente(); var ins = $$('[data-h]', app); ins[ins.length - 1].select(); });
      on('#pjReset', 'click', function(){ d.hitos = hitosBase(); asistente(); });
      on('#pjAtras', 'click', function(){ leerPaso(); paso--; asistente(); app.scrollIntoView({behavior: 'smooth'}); });
      on('#pjCancelar', 'click', function(){ d = null; panel(); });
      on('#pjSig', 'click', function(){
        leerPaso(); if(!valido()) return;
        if(paso < PASOS.length - 1){ paso++; asistente(); app.scrollIntoView({behavior: 'smooth'}); return; }
        var editando = d._editando; delete d._editando;
        if(editando){ lista[actual] = d; } else { lista.unshift(d); actual = 0; }
        guardarTodo(); var creado = !editando; d = null; panel();
        if(creado){ track('herramienta_proyecto_creado'); anuncio('🚀', '¡Proyecto creado!', 'Ahora agrega tus recordatorios para no olvidar tus sesiones.', 'reto'); }
      });
    }
    function resumen(p){
      p = p || d; var ds = p.dias.slice().sort().map(function(i){ return DIAS_L[i]; }).join(', ');
      var fila = function(k, v){ return v ? '<p><b>' + k + ':</b> ' + esc(v) + '</p>' : ''; };
      return '<div class="t-box cyan">' + fila('Para qué', p.para) + fila('Meta', fecha(new Date(p.meta + 'T12:00')) + ' (' + semanas(p.meta) + ' semanas)') +
        fila('Cuándo', ds + ' a las ' + p.hora + ', ' + p.min + ' minutos' + (p.donde ? ', en ' + p.donde : '')) + fila('Versión de 2 minutos', p.mini) + '</div>' +
        '<p class="t-label">Etapas</p><ol class="t-steps">' + p.hitos.map(function(h){ return '<li><b>' + esc(h.t) + '</b> <span style="color:var(--muted)">· semana ' + h.semana + '</span></li>'; }).join('') + '</ol>' +
        '<div class="t-box">' + fila('🪟 Ventana', p.ventana) + fila('🪞 Espejo', p.espejo) + fila('👥 Comunidad', p.comunidad) + fila('Le cuento a', p.cuentas + (p.cuentasFecha ? ' (' + fecha(new Date(p.cuentasFecha + 'T12:00')) + ')' : '')) +
        fila('✅ Primera prueba', p.prueba + (p.pruebaFecha ? ' (' + fecha(new Date(p.pruebaFecha + 'T12:00')) + ')' : '')) + '</div>';
    }

    /* ======= Panel del proyecto ======= */
    function racha(p){ var n = 0, x = hoy0(); if(!p.sesiones[key(x)]) x = new Date(x.getTime() - DIA);
      for(var i = 0; i < 400; i++){ var k = key(x), toca = p.dias.indexOf(dow(x)) > -1; if(p.sesiones[k]) n++; else if(toca && x < hoy0()) break; x = new Date(x.getTime() - DIA); if(x.getTime() < p.creado - DIA) break; } return n; }
    function panel(){
      if(T){ T.parar(); T = null; }
      if(!lista.length){
        app.innerHTML = '<div class="tool-card pj-empty"><div style="font-size:3rem" aria-hidden="true">🚀</div><h2>Arma tu proyecto de aprendizaje</h2>' +
          '<p class="hint">En 6 pasos defines qué quieres aprender, para qué, cuándo vas a practicar, tus etapas, tus recursos y tu compromiso. Después, aquí mismo llevas tus sesiones, tu bitácora y tu avance.</p>' +
          '<div class="t-row" style="justify-content:center"><button class="btn btn-primary" type="button" id="pjNuevo">Empezar mi proyecto</button></div></div>';
        $('#pjNuevo').addEventListener('click', function(){ d = nuevo(); paso = 0; asistente(); });
        return;
      }
      if(actual >= lista.length) actual = 0;
      var p = lista[actual], t = TIPOS[p.tipo] || {ic: '📘', min: 20}, h = hoy0(), hk = key(h);
      var hechos = p.hitos.filter(function(x){ return x.hecho; }).length, pct = p.hitos.length ? Math.round(hechos / p.hitos.length * 100) : 0;
      var faltan = Math.ceil((new Date(p.meta + 'T12:00') - h) / DIA), semActual = Math.floor((h - new Date(new Date(p.creado).setHours(0, 0, 0, 0))) / (7 * DIA)) + 1;
      var toca = p.dias.indexOf(dow(h)) > -1, hecha = p.sesiones[hk];
      var total = Object.keys(p.sesiones).length, minTot = Object.keys(p.sesiones).reduce(function(a, k){ return a + (p.sesiones[k].min || 0); }, 0);
      var sel = lista.length > 1 ? '<label class="visually-hidden" for="pjSel">Proyecto</label><select class="t-select" id="pjSel" style="margin-bottom:1rem">' + lista.map(function(x, i){ return '<option value="' + i + '"' + (i === actual ? ' selected' : '') + '>' + esc((TIPOS[x.tipo] || {ic: '📘'}).ic + ' ' + x.que) + '</option>'; }).join('') + '</select>' : '';
      /* últimos 28 días */
      var cel = '';
      for(var i = 27; i >= 0; i--){ var x = new Date(h.getTime() - i * DIA), k = key(x), s = p.sesiones[k], tc = p.dias.indexOf(dow(x)) > -1, antes = x.getTime() < new Date(p.creado).setHours(0, 0, 0, 0);
        cel += '<span class="pj-c' + (s ? ' y' : tc && !antes && i ? ' miss' : tc ? ' tc' : '') + (i === 0 ? ' today' : '') + '" title="' + fecha(x) + (s ? ': ' + s.min + ' min' : '') + '">' + x.getDate() + '</span>'; }
      var prox = p.hitos.filter(function(x){ return !x.hecho; })[0];
      app.innerHTML = sel +
        '<div class="tool-card pj-head"><div class="pj-top"><span class="pj-ic" aria-hidden="true">' + t.ic + '</span><div><h2>' + esc(p.que) + '</h2>' + (p.para ? '<p class="hint" style="margin:0">Para ' + esc(p.para.replace(/^para\s+/i, '')) + '</p>' : '') + '</div></div>' +
          '<div class="pj-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><b style="width:' + pct + '%"></b></div>' +
          '<div class="t-stats pj-stats"><div><b>' + pct + '%</b>avance</div><div><b>' + (faltan > 0 ? faltan : 0) + '</b>días para tu meta</div><div><b>' + racha(p) + '</b>sesiones seguidas</div></div>' +
          '<p class="t-note">Semana ' + semActual + ' · ' + total + (total === 1 ? ' sesión' : ' sesiones') + ' · ' + minTot + ' minutos en total' + (prox ? ' · Etapa actual: <b style="color:var(--fg)">' + esc(prox.t) + '</b>' : '') + '</p></div>' +
        /* sesión de hoy */
        '<div class="tool-card" id="pjHoy"><p class="t-step">Hoy, ' + fecha(h) + '</p>' +
          (hecha ? '<h2>✓ Sesión de hoy hecha</h2><p class="hint">' + hecha.min + ' minutos.' + (hecha.nota ? ' Anotaste: «' + esc(hecha.nota) + '»' : '') + '</p><div class="t-row"><button class="btn btn-secondary" type="button" id="pjOtra">Practicar otra vez</button></div>'
                 : '<h2>' + (toca ? 'Te toca practicar hoy' : 'Hoy no te toca, pero puedes practicar') + '</h2><p class="hint">' + p.min + ' minutos' + (p.donde ? ' en ' + esc(p.donde) : '') + '.' + (p.mini ? ' Si no tienes ganas, haz solo esto: <b style="color:var(--fg)">' + esc(p.mini) + '</b>.' : '') + '</p>' +
                   '<div class="t-row"><button class="btn btn-primary" type="button" id="pjEmpezar">▶ Empezar sesión de ' + p.min + ' min</button><button class="btn btn-secondary" type="button" id="pjMini2">Solo 2 minutos</button></div>') +
          '<div id="pjSesion"></div></div>' +
        /* etapas */
        '<div class="tool-card"><h2>Etapas</h2><p class="hint">Márcalas cuando las logres. Cada etapa superada se guarda en "Lo que sí puedo".</p><ul class="t-list pj-hl">' +
          p.hitos.map(function(x, i){ return '<li><button class="pj-chk" type="button" data-hit="' + i + '" aria-pressed="' + !!x.hecho + '" aria-label="' + (x.hecho ? 'Marcar como pendiente' : 'Marcar como lograda') + '">' + (x.hecho ? '✓' : '') + '</button><div class="t-grow"><b' + (x.hecho ? ' style="text-decoration:line-through;color:var(--muted)"' : '') + '>' + esc(x.t) + '</b><br><span style="font-size:.85rem;color:var(--muted)">Semana ' + x.semana + (!x.hecho && x.semana < semActual ? ' · va atrasada, no pasa nada: ajusta y sigue' : '') + '</span></div></li>'; }).join('') + '</ul></div>' +
        /* constancia */
        '<div class="tool-card"><h2>Tus últimos 28 días</h2><div class="pj-cal">' + cel + '</div>' +
          '<div class="t-legend"><span><i style="background:var(--cyan)"></i>Practicaste</span><span><i style="background:var(--surface-2);outline:1px dashed var(--orange)"></i>Te tocaba</span></div>' +
          '<p class="t-note">Fallar un día no borra nada. Lo que cuenta es volver.</p></div>' +
        /* primera prueba y compromiso */
        ((p.prueba || p.cuentas) ? '<div class="tool-card"><h2>Tu compromiso</h2>' +
          (p.prueba ? '<div class="t-plan"><p><b>✅ Primera prueba:</b> ' + esc(p.prueba) + (p.pruebaFecha ? ' <span style="color:var(--muted)">(' + fecha(new Date(p.pruebaFecha + 'T12:00')) + ')</span>' : '') + '</p>' + (p.pruebaHecha ? '<p style="color:var(--cyan)"><b>¡Superada!</b></p>' : '<div class="t-row"><button class="btn btn-secondary" type="button" id="pjPruebaOk">¡La logré!</button></div>') + '</div>' : '') +
          (p.cuentas ? '<div class="t-plan"><p><b>🤝 Le cuentas tu avance a:</b> ' + esc(p.cuentas) + (p.cuentasFecha ? ' <span style="color:var(--muted)">(' + fecha(new Date(p.cuentasFecha + 'T12:00')) + ')</span>' : '') + '</p></div>' : '') + '</div>' : '') +
        /* bitácora */
        '<div class="tool-card"><h2>Bitácora</h2>' + (function(){ var ks = Object.keys(p.sesiones).filter(function(k){ return p.sesiones[k].nota; }).sort().reverse().slice(0, 10);
            return ks.length ? '<ul class="t-list">' + ks.map(function(k){ return '<li><span class="t-dot">' + new Date(k + 'T12:00').getDate() + '</span><div class="t-grow"><b>' + esc(p.sesiones[k].nota) + '</b><br><span style="font-size:.85rem;color:var(--muted)">' + fecha(new Date(k + 'T12:00')) + ' · ' + p.sesiones[k].min + ' min</span></div></li>'; }).join('') + '</ul>' : '<p class="t-empty">Al terminar cada sesión anota qué aprendiste. Aquí verás tu historia.</p>'; })() + '</div>' +
        /* plan y acciones */
        '<details class="tool-card pj-plan"><summary><h2 style="display:inline">Ver mi plan completo</h2></summary>' + resumen(p) + '</details>' +
        '<div class="tool-card"><h2>Herramientas para tu proyecto</h2><div class="pj-links">' +
          '<a href="herramienta-calendario-repaso.html?tema=' + encodeURIComponent(p.que) + '">🔁 Repasar lo aprendido</a><a href="herramienta-reto-descanso.html">⏱ Reto + descanso</a><a href="herramienta-lo-que-si-puedo.html">🌱 Lo que sí puedo</a><a href="herramienta-tu-academia.html">🏫 ¿Qué me falta para no abandonar?</a></div>' +
          '<div class="t-row"><button class="btn btn-primary" type="button" id="pjRec">📅 Agregar recordatorios</button><button class="btn btn-secondary" type="button" id="pjEdit">Editar proyecto</button><button class="btn btn-secondary" type="button" id="pjNew">+ Otro proyecto</button></div>' +
          '<p class="t-note"><button class="t-link" type="button" id="pjDel">Eliminar este proyecto</button></p>' + '<p class="t-note">Lo que escribes se guarda solo en este teléfono o computadora.</p></div>';
      enlazarPanel(p);
    }
    function sesion(p, minutos){
      var box = $('#pjSesion'), ini = Date.now();
      box.innerHTML = '<div class="t-ring" id="pjRing"><span class="t-big" id="pjReloj">' + mmss(minutos * 6e4) + '</span><small>sesión</small></div>' +
        '<p class="t-note" style="text-align:center">Una sola tarea. Deja el celular lejos si puedes.</p><div class="t-row"><button class="btn btn-secondary" type="button" id="pjPausa">Pausar</button><button class="btn btn-secondary" type="button" id="pjFin">Terminé antes</button></div>';
      $$('#pjHoy > .t-row').forEach(function(r){ r.classList.add('t-hidden'); });
      T = Temporizador(function(r){ $('#pjReloj').textContent = mmss(r); $('#pjRing').style.setProperty('--p', (100 - r / (minutos * 6e4) * 100).toFixed(1)); },
        function(){ aviso('fin'); anuncio('🎉', '¡Sesión terminada!', 'Anota qué aprendiste hoy.', 'fin'); cierre(p, minutos); });
      T.iniciar(minutos * 6e4);
      $('#pjPausa').addEventListener('click', function(){ if(T.activo()){ T.pausar(); this.textContent = 'Seguir'; } else { T.seguir(); this.textContent = 'Pausar'; } });
      $('#pjFin').addEventListener('click', function(){ T.parar(); cierre(p, Math.max(1, Math.round((Date.now() - ini) / 6e4))); });
      box.scrollIntoView({behavior: 'smooth', block: 'center'}); track('herramienta_sesion');
    }
    function cierre(p, minutos){
      var box = $('#pjSesion');
      box.innerHTML = '<div class="t-box cyan"><p><b>¿Qué aprendiste o practicaste hoy?</b></p><label class="visually-hidden" for="pjNota">Qué aprendiste hoy</label>' +
        '<input class="t-input" id="pjNota" maxlength="140" placeholder="Ej.: los verbos to be y to have">' +
        '<label class="pj-ck"><input type="checkbox" id="pjARepaso" checked> Agregarlo a Repaso activo para no olvidarlo</label>' +
        '<div class="t-row"><button class="btn btn-primary" type="button" id="pjGuardarS">Guardar sesión</button></div></div>';
      $('#pjNota').focus();
      $('#pjGuardarS').addEventListener('click', function(){
        var nota = $('#pjNota').value.trim(), k = key(hoy0()), prev = p.sesiones[k];
        p.sesiones[k] = {min: (prev ? prev.min : 0) + minutos, nota: nota || (prev && prev.nota) || ''}; guardarTodo();
        if(nota && $('#pjARepaso').checked){ var rs = store.get('repasos', []), h0 = hoy0().getTime();
          rs.unshift({tema: p.que + ': ' + nota, fechas: [0, 3, 7, 14, 30].map(function(n){ return h0 + n * DIA; }), hechos: [h0], apuntes: '', hora: p.hora}); store.set('repasos', rs); }
        track('herramienta_sesion_fin'); panel();
        anuncio('✅', 'Sesión guardada', minutos + ' minutos más en tu proyecto. ¡Bien hecho!', 'reto');
      });
    }
    function aInventario(t){ var it = store.get('inventario', []); if(it.indexOf(t) < 0){ it.unshift(t); store.set('inventario', it); } }
    function enlazarPanel(p){
      var on = function(id, fn){ var e = $(id, app); if(e) e.addEventListener('click', fn); };
      var s = $('#pjSel'); if(s) s.addEventListener('change', function(){ actual = +this.value; panel(); });
      on('#pjEmpezar', function(){ sesion(p, p.min); });
      on('#pjMini2', function(){ sesion(p, 2); });
      on('#pjOtra', function(){ sesion(p, p.min); });
      $$('[data-hit]', app).forEach(function(b){ b.addEventListener('click', function(){ var x = p.hitos[+b.dataset.hit]; x.hecho = !x.hecho; guardarTodo();
        if(x.hecho){ aInventario(p.que + ': ' + x.t); aviso('fin'); anuncio('🏆', '¡Etapa lograda!', x.t, 'fin'); } panel(); }); });
      on('#pjPruebaOk', function(){ p.pruebaHecha = true; guardarTodo(); aInventario(p.prueba); aviso('fin'); anuncio('🏆', '¡Primera prueba superada!', 'Es una prueba más de que sí puedes.', 'fin'); panel(); });
      on('#pjRec', function(){
        var evs = [], ds = p.dias.slice().sort(), primero = null;
        for(var i = 0; i < 7 && !primero; i++){ var x = new Date(hoy0().getTime() + i * DIA); if(ds.indexOf(dow(x)) > -1 && horaRazonable(x, p.hora) > new Date()) primero = x; }
        if(!primero) primero = new Date(hoy0().getTime() + 7 * DIA);
        evs.push({titulo: 'Practicar: ' + p.que, inicio: horaRazonable(primero, p.hora), minutos: p.min, rrule: 'FREQ=WEEKLY;BYDAY=' + ds.map(function(i){ return BYDAY[i]; }).join(','),
          detalle: p.min + ' minutos' + (p.donde ? ' en ' + p.donde : '') + '. Si no tienes ganas: ' + (p.mini || '2 minutos') + '. Abre AriasMind > Mi proyecto para registrar tu sesión.'});
        if(p.prueba && p.pruebaFecha) evs.push({titulo: 'Primera prueba: ' + p.prueba, inicio: horaRazonable(new Date(p.pruebaFecha + 'T12:00'), p.hora), minutos: 30, detalle: 'Proyecto: ' + p.que});
        if(p.cuentas && p.cuentasFecha) evs.push({titulo: 'Mostrar mi avance a ' + p.cuentas, inicio: horaRazonable(new Date(p.cuentasFecha + 'T12:00'), p.hora), minutos: 30, detalle: 'Proyecto: ' + p.que});
        evs.push({titulo: 'Meta: ' + p.que, inicio: horaRazonable(new Date(p.meta + 'T12:00'), p.hora), minutos: 30, detalle: 'Hoy es la fecha de tu meta. Revisa cuánto avanzaste.'});
        ics(evs, 'mi-proyecto.ics');
      });
      on('#pjEdit', function(){ d = JSON.parse(JSON.stringify(p)); d._editando = true; paso = 0; asistente(); });
      on('#pjNew', function(){ d = nuevo(); paso = 0; asistente(); app.scrollIntoView({behavior: 'smooth'}); });
      on('#pjDel', function(){ var b = this; if(b.dataset.sure !== '1'){ b.dataset.sure = '1'; b.textContent = 'Toca otra vez para eliminar «' + p.que + '»'; return; } lista.splice(actual, 1); actual = 0; guardarTodo(); panel(); });
    }
    panel();
  }

  /* ---------- Materiales: descargas (dentro de Claude se usa su permiso de "guardar archivo") ---------- */
  function materiales(){
    $$('[data-descarga]').forEach(function(a){
      a.addEventListener('click', function(e){
        track(a.dataset.track || 'material_descarga');
        if(!EN_VISOR) return;               /* en el sitio publicado, el enlace normal descarga el archivo */
        e.preventDefault(); var msg = $('#matMsg'); if(msg) msg.textContent = 'Preparando la descarga…';
        var obtener = a.dataset.b64 ? new Promise(function(ok, no){ var sc = document.createElement('script'); sc.src = a.dataset.b64;
            sc.onload = function(){ var bin = atob(window.AM_EPUB_B64), u = new Uint8Array(bin.length); for(var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); ok(new Blob([u], {type: 'application/epub+zip'})); };
            sc.onerror = no; document.head.appendChild(sc); }) : fetch(a.getAttribute('href')).then(function(r){ return r.blob(); });
        obtener.then(function(b){ return guardarArchivo(b, a.dataset.descarga); })
          .then(function(ok){ if(msg) msg.textContent = ok ? 'Listo. Revisa tus descargas.' : 'La descarga se canceló.'; })
          .catch(function(){ if(msg) msg.textContent = 'No se pudo descargar aquí. Intenta desde ariasmind.com.'; });
      });
    });
  }

  /* ---------- Página de herramientas: filtros ---------- */
  function hub(){
    var f = $('#toolsFilter'); if(!f) return;
    f.addEventListener('click', function(e){ var b = e.target.closest('button'); if(!b) return; press(f, b);
      $$('.tool-tile').forEach(function(t){ t.hidden = b.dataset.f !== 'todas' && (t.dataset.g || '').indexOf(b.dataset.f) < 0; }); });
  }

  var T = {repaso: repaso, sistema: sistema, academia: academia, reto: reto, plan: plan, confianza: confianza, proyecto: proyecto, materiales: materiales, hub: hub};
  /* Para otras partes del sitio (por ejemplo, "¿Qué recuerdas?" en los artículos) */
  window.AMT = {ics: ics, store: store, hoy0: hoy0, DIA: DIA};
  var tool = document.body.getAttribute('data-tool');
  if(T[tool]){ try{ T[tool](); }catch(e){ if(window.console) console.error(e); } }
})();
