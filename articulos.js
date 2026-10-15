/* ÚNICA lista de artículos del sitio. Para publicar uno nuevo, agrégalo aquí y listo:
   la portada, el archivo, los contadores y la tarjeta "seguir leyendo" se actualizan solos.
   "publica" (opcional, AAAA-MM-DD): hasta esa fecha el artículo no aparece en ninguna lista. */
window.ARTICULOS_TODOS = [
  {n:1, href:"articulo-001-verdad-autodidacta.html", fecha:"junio de 2026", iso:"2026-06-15", min:6, temas:["Autonomía"],
   titulo:"La verdad sobre ser autodidacta",
   hook:"No naciste autodidacta. Te conviertes en uno cuando empiezas a practicar la habilidad de dirigirte a ti mismo."},
  {n:2, href:"articulo-002-mito-estilos-aprendizaje.html", fecha:"junio de 2026", iso:"2026-06-15", min:4, temas:["Mitos","Método"],
   titulo:"Adiós al mito de los \"estilos de aprendizaje\"",
   hook:"No \"somos\" visuales ni auditivos. La herramienta correcta la define lo que aprendes, no quién crees ser."},
  {n:3, href:"articulo-003-como-aprender-de-verdad.html", fecha:"junio de 2026", iso:"2026-06-15", min:5, temas:["Memoria","Método"],
   titulo:"Cómo aprender de verdad: el arte de entrenar tu cerebro",
   hook:"Repetir sin esfuerzo rinde poco. Recordar con esfuerzo y con pausas rinde mucho."},
  {n:4, href:"articulo-004-estres-para-aprender.html", fecha:"junio de 2026", iso:"2026-06-15", min:5, temas:["Cerebro"],
   titulo:"El estrés no siempre es tu enemigo",
   hook:"Un reto que puedes afrontar, con descanso después, puede ayudarte a aprender. El estrés sin pausa, no."},
  {n:5, href:"articulo-005-motivacion-te-falla.html", fecha:"junio de 2026", iso:"2026-06-15", min:5, temas:["Hábitos"],
   titulo:"Por qué la motivación no alcanza",
   hook:"La motivación te ayuda a empezar. Un sistema te ayuda a seguir los días en que no tienes ganas."},
  {n:6, href:"articulo-006-mito-academia.html", fecha:"julio de 2026", iso:"2026-07-15", min:6, temas:["Autonomía","Mitos"],
   titulo:"El mito de la academia",
   hook:"Una academia vende estructura, compromiso y compañía. Hay más de una forma de conseguirlas."},
  {n:7, href:"articulo-007-mito-nunca-olvidar.html", fecha:"agosto de 2026", iso:"2026-08-15", min:8, temas:["Memoria","Mitos"],
   titulo:"El mito de nunca olvidar",
   hook:"Olvidar mucho es normal. Lo que puedes decidir es qué merece quedarse."},
  {n:8, href:"articulo-008-verguenza-autoestima-trauma.html", fecha:"septiembre de 2026", iso:"2026-09-15", min:8, temas:["Mente"],
   titulo:"La voz en tu cabeza que no te deja aprender",
   hook:"Quizás no eres flojo. Quizás alguien, hace muchos años, te convenció de que no eras capaz, y esa voz nunca se fue."},
  {n:9, href:"articulo-009-que-paso-en-el-camino.html", fecha:"octubre de 2026", iso:"2026-10-15", min:10, temas:["Mente","Autonomía"],
   titulo:"Entre un recién nacido y tú: ¿qué pasó en el camino?",
   hook:"Todos empezamos casi en cero. ¿Por qué terminamos sabiendo cosas tan distintas?"}
];

/* Ajustes del sitio */
window.AM_CONFIG = {
  dominio: "https://ariasmind.com",   /* sin barra final; se usa en sitemap, RSS y metadatos */
  diaPublicacion: 15                   /* los artículos salen el día 15 de cada mes */
};
