// ---------- i18n ----------
//
// Sin build step: un diccionario plano por idioma, aplicado in-place sobre
// cualquier elemento con `data-i18n="clave"` via innerHTML (no textContent,
// porque algunos textos llevan <strong> inline). El único elemento con
// contenido dinámico adentro (el año del footer) se regenera después de
// cada aplicación de idioma, no solo una vez al cargar.
var STORAGE_KEY = "orion-landing-lang";
var DEFAULT_LANG = "en";
var SUPPORTED = ["es", "en", "pt"];

var TRANSLATIONS = {
  es: {
    "nav.que_es": "Qué es",
    "nav.motivacion": "Motivación",
    "nav.resultado": "Resultado",
    "nav.acceso": "Pedir acceso",
    "hero.tagline":
      "Chat con modelos de IA corriendo en Ollama — local o remoto — con streaming en vivo, búsqueda web con fuentes citadas, memoria persistente y soporte multiusuario.",
    "hero.login": "Iniciar sesión",
    "hero.mobile": "Abrir en mobile",
    "que_es.title": "¿Qué es Orion Chat?",
    "que_es.subtitle":
      "Un asistente de chat tipo ChatGPT, pero autoalojado: hablás con modelos servidos por tu propio Ollama, local o remoto.",
    "feat.streaming.title": "Streaming en vivo",
    "feat.streaming.desc": "Las respuestas van apareciendo token a token, igual que un chat real.",
    "feat.search.title": "Búsqueda web citada",
    "feat.search.desc": "Modo de búsqueda que trae resultados de internet y cita cada fuente usada en la respuesta.",
    "feat.attachments.title": "Adjuntos",
    "feat.attachments.desc": "Subí imágenes, PDFs y texto para que el modelo los lea como parte de la conversación.",
    "feat.history.title": "Historial organizado",
    "feat.history.desc": "Conversaciones agrupadas por fecha (hoy, ayer, últimos 7 días) para encontrar todo rápido.",
    "motivacion.title": "Motivación",
    "motivacion.subtitle": "Por qué existe este proyecto en vez de usar un chat de IA en la nube.",
    "motivacion.p1":
      "<strong>Control total de los datos.</strong> Cada conversación, cada adjunto y cada nota de memoria quedan en una base que vos administrás — no en la infraestructura de un tercero. El modelo que responde también lo elegís vos: Ollama local, corriendo en tu propia máquina, o un Ollama remoto si preferís más potencia.",
    "motivacion.p2":
      "<strong>Sin atarse a un proveedor.</strong> Nada de licencias por asiento ni planes que cambian de precio. Orion Chat es la base para tener un asistente propio, extensible, con el mismo nivel de cuidado en el diseño que un producto comercial — pero corriendo donde vos decidas.",
    "resultado.title": "Resultado",
    "resultado.subtitle": "Lo que hoy funciona en producción.",
    "result.1": "App web y app mobile (PWA instalable) compartiendo la misma base de datos.",
    "result.2": "Multiusuario con invitaciones por correo y roles de owner/miembro.",
    "result.3": "Memoria persistente por usuario: notas que el asistente recuerda entre conversaciones.",
    "result.4": "Exportar cualquier conversación para guardarla o compartirla.",
    "result.5": "Un mismo diseño navy/naranja propio en los dos clientes, de punta a punta.",
    "acceso.title": "¿Querés probarlo?",
    "acceso.subtitle": "Por ahora el acceso es solo por invitación. Escribime y te doy de alta una cuenta.",
    "acceso.cta": "Pedir acceso por correo",
    "acceso.subject": "Acceso a Orion Chat",
    "footer.line":
      'Orion Chat &copy; <span id="year"></span> — <a href="mailto:jorge.s.aymar@gmail.com">jorge.s.aymar@gmail.com</a>',
  },
  en: {
    "nav.que_es": "What is it",
    "nav.motivacion": "Motivation",
    "nav.resultado": "Result",
    "nav.acceso": "Request access",
    "hero.tagline":
      "Chat with AI models running on Ollama — local or remote — with live streaming, web search with cited sources, persistent memory, and multi-user support.",
    "hero.login": "Sign in",
    "hero.mobile": "Open on mobile",
    "que_es.title": "What is Orion Chat?",
    "que_es.subtitle":
      "A ChatGPT-style chat assistant, but self-hosted: you talk to models served by your own Ollama, local or remote.",
    "feat.streaming.title": "Live streaming",
    "feat.streaming.desc": "Responses appear token by token, just like a real chat.",
    "feat.search.title": "Cited web search",
    "feat.search.desc": "A search mode that pulls results from the internet and cites every source used in the answer.",
    "feat.attachments.title": "Attachments",
    "feat.attachments.desc": "Upload images, PDFs, and text for the model to read as part of the conversation.",
    "feat.history.title": "Organized history",
    "feat.history.desc": "Conversations grouped by date (today, yesterday, last 7 days) so you can find anything fast.",
    "motivacion.title": "Motivation",
    "motivacion.subtitle": "Why this project exists instead of using a cloud AI chat.",
    "motivacion.p1":
      "<strong>Full control over your data.</strong> Every conversation, attachment, and memory note lives on a database you run — not on a third party's infrastructure. You also choose which model answers: a local Ollama running on your own machine, or a remote one if you need more power.",
    "motivacion.p2":
      "<strong>No vendor lock-in.</strong> No per-seat licenses, no pricing plans that change under you. Orion Chat is the foundation for an assistant of your own, extensible, with the same design care as a commercial product — but running wherever you decide.",
    "resultado.title": "Result",
    "resultado.subtitle": "What's actually running in production today.",
    "result.1": "Web app and mobile app (installable PWA) sharing the same database.",
    "result.2": "Multi-user with email invitations and owner/member roles.",
    "result.3": "Per-user persistent memory: notes the assistant remembers across conversations.",
    "result.4": "Export any conversation to save or share it.",
    "result.5": "The same navy/orange design across both clients, end to end.",
    "acceso.title": "Want to try it?",
    "acceso.subtitle": "Access is invite-only for now. Write to me and I'll set up an account for you.",
    "acceso.cta": "Request access by email",
    "acceso.subject": "Orion Chat access request",
    "footer.line":
      'Orion Chat &copy; <span id="year"></span> — <a href="mailto:jorge.s.aymar@gmail.com">jorge.s.aymar@gmail.com</a>',
  },
  pt: {
    "nav.que_es": "O que é",
    "nav.motivacion": "Motivação",
    "nav.resultado": "Resultado",
    "nav.acceso": "Pedir acesso",
    "hero.tagline":
      "Chat com modelos de IA rodando no Ollama — local ou remoto — com streaming ao vivo, busca na web com fontes citadas, memória persistente e suporte a múltiplos usuários.",
    "hero.login": "Entrar",
    "hero.mobile": "Abrir no mobile",
    "que_es.title": "O que é o Orion Chat?",
    "que_es.subtitle":
      "Um assistente de chat estilo ChatGPT, mas auto-hospedado: você conversa com modelos servidos pelo seu próprio Ollama, local ou remoto.",
    "feat.streaming.title": "Streaming ao vivo",
    "feat.streaming.desc": "As respostas vão aparecendo token a token, igual a um chat de verdade.",
    "feat.search.title": "Busca na web com citações",
    "feat.search.desc": "Um modo de busca que traz resultados da internet e cita cada fonte usada na resposta.",
    "feat.attachments.title": "Anexos",
    "feat.attachments.desc": "Envie imagens, PDFs e texto para o modelo ler como parte da conversa.",
    "feat.history.title": "Histórico organizado",
    "feat.history.desc": "Conversas agrupadas por data (hoje, ontem, últimos 7 dias) para achar tudo rápido.",
    "motivacion.title": "Motivação",
    "motivacion.subtitle": "Por que este projeto existe em vez de usar um chat de IA na nuvem.",
    "motivacion.p1":
      "<strong>Controle total dos dados.</strong> Cada conversa, cada anexo e cada nota de memória ficam num banco que você administra — não na infraestrutura de terceiros. O modelo que responde também é escolhido por você: Ollama local, rodando na sua própria máquina, ou um Ollama remoto se precisar de mais poder.",
    "motivacion.p2":
      "<strong>Sem depender de um fornecedor.</strong> Nada de licenças por usuário nem planos que mudam de preço. Orion Chat é a base para ter um assistente próprio, extensível, com o mesmo cuidado de design de um produto comercial — mas rodando onde você decidir.",
    "resultado.title": "Resultado",
    "resultado.subtitle": "O que já funciona em produção hoje.",
    "result.1": "App web e app mobile (PWA instalável) compartilhando o mesmo banco de dados.",
    "result.2": "Múltiplos usuários com convites por e-mail e papéis de owner/membro.",
    "result.3": "Memória persistente por usuário: notas que o assistente lembra entre conversas.",
    "result.4": "Exportar qualquer conversa para salvar ou compartilhar.",
    "result.5": "O mesmo design navy/laranja próprio nos dois clientes, de ponta a ponta.",
    "acceso.title": "Quer experimentar?",
    "acceso.subtitle": "Por enquanto o acesso é só por convite. Me escreva que eu crio uma conta para você.",
    "acceso.cta": "Pedir acesso por e-mail",
    "acceso.subject": "Acesso ao Orion Chat",
    "footer.line":
      'Orion Chat &copy; <span id="year"></span> — <a href="mailto:jorge.s.aymar@gmail.com">jorge.s.aymar@gmail.com</a>',
  },
};

function setFooterYear() {
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

function updateMailtoSubject(lang) {
  var link = document.getElementById("acceso-mailto");
  if (!link) return;
  var subject = TRANSLATIONS[lang]["acceso.subject"];
  link.href = "mailto:jorge.s.aymar@gmail.com?subject=" + encodeURIComponent(subject);
}

function applyLanguage(lang) {
  var dict = TRANSLATIONS[lang] || TRANSLATIONS[DEFAULT_LANG];
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    var key = el.getAttribute("data-i18n");
    if (dict[key] !== undefined) el.innerHTML = dict[key];
  });
  setFooterYear();
  updateMailtoSubject(lang);
  document.documentElement.setAttribute("lang", lang);

  document.querySelectorAll(".lang-pill").forEach(function (btn) {
    var active = btn.getAttribute("data-lang") === lang;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });

  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (e) {
    // Modo privado o storage bloqueado: el idioma simplemente no persiste
    // entre visitas, pero la página sigue funcionando igual.
  }
}

function detectInitialLang() {
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
  } catch (e) {
    // Igual que arriba: sin storage, se cae a la detección por navegador.
  }

  var nav = (navigator.language || navigator.userLanguage || "").toLowerCase();
  if (nav.indexOf("es") === 0) return "es";
  // pt-BR y pt-PT caen acá por igual: un solo PT, no se diferencian variantes.
  if (nav.indexOf("pt") === 0) return "pt";
  // Cualquier otro idioma (de/fr/zh/etc.) cae a inglés por default: es la
  // landing con más alcance internacional.
  return DEFAULT_LANG;
}

document.querySelectorAll(".lang-pill").forEach(function (btn) {
  btn.addEventListener("click", function () {
    applyLanguage(btn.getAttribute("data-lang"));
  });
});

applyLanguage(detectInitialLang());

// ---------- smooth-scroll de los anchors del nav ----------
//
// CSS `scroll-behavior: smooth` ya cubriría esto en navegadores modernos,
// pero algunos (viejos WebKit/iOS) todavía lo ignoran — este listener es el
// fallback explícito.
document.querySelectorAll('a[href^="#"]').forEach(function (link) {
  link.addEventListener("click", function (e) {
    var id = link.getAttribute("href").slice(1);
    var target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
