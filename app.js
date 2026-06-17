const STORAGE_KEY = "ministerio-musica-dados-v2";
const PROFILE_KEY = "ministerio-musica-perfil-v1";
const SAVED_LOGINS_KEY = "ministerio-musica-logins-v1";
const API_STATE_URL = "/api/state";
const PUSH_PUBLIC_KEY_URL = "/api/push/public-key";
const PUSH_SUBSCRIBE_URL = "/api/push/subscribe";
const PUSH_UNSUBSCRIBE_URL = "/api/push/unsubscribe";
const PUSH_TEST_URL = "/api/push/test";
const PUSH_STATUS_URL = "/api/push/status";
const SYNC_INTERVAL_MS = 10000;
const ROLES = ["Voz", "Violão", "Guitarra", "Baixo", "Teclado", "Bateria"];
const DEFAULT_MUSICIANS = [
  { name: "Julian", mainRole: "Voz" },
  { name: "Fabio", mainRole: "Voz" },
  { name: "Eduardo", mainRole: "Baixo" },
  { name: "Andreas", mainRole: "Baixo" },
  { name: "Henrique", mainRole: "Guitarra" },
  { name: "Guilherme", mainRole: "Guitarra" },
  { name: "Tião", mainRole: "Bateria" },
  { name: "Gabriel", mainRole: "Teclado" },
];
const OLD_DEMO_MUSICIANS = ["Ana Clara", "Rafael", "Mariana", "Pedro", "Lucas", "João"];
const LEGACY_MUSICIAN_ALIASES = {
  anaclara: "julian",
  rafael: "fabio",
  mariana: "eduardo",
  pedro: "andreas",
  lucas: "henrique",
  joao: "guilherme",
};
const SETLIST_TYPES = {
  Missa: ["Entrada", "Ato penitencial", "Glória", "Salmo", "Aleluia", "Ofertório", "Santo", "Comunhão", "Final"],
  Grupos: ["Animação", "Louvor", "Pregação", "Oração", "Adoração", "Final"],
};
const VIEW_TITLES = {
  agenda: ["Planejamento pastoral", "Agenda do ministério"],
  missao: ["Cadastro da missão", "Criar ou editar missão"],
  escala: ["Equipe e músicas", "Escala da missão"],
  musicos: ["Cadastro fixo", "Músicos do ministério"],
  setlist: ["Repertório", "Setlist da missão"],
};
const MOMENTS = [...new Set(Object.values(SETLIST_TYPES).flat())];
const KEYS = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
  "Cm", "C#m", "Dbm", "Dm", "D#m", "Ebm", "Em", "Fm", "F#m", "Gbm", "Gm", "G#m", "Abm", "Am", "A#m", "Bbm", "Bm",
];

const state = normalizeState(loadLocalState());
const profile = loadProfile();
let activeSetlistType = "Missa";
let activeMoment = SETLIST_TYPES[activeSetlistType][0];
let saveTimer = null;
let deferredInstallPrompt = null;
let isHydrating = false;
let syncStatus = {
  state: "checking",
  message: "Sincronizando",
};

const els = {
  loginScreen: document.querySelector("#loginScreen"),
  loginForm: document.querySelector("#loginForm"),
  loginEmail: document.querySelector("#loginEmail"),
  loginOptions: document.querySelector("#loginOptions"),
  savedLoginLabel: document.querySelector("#savedLoginLabel"),
  savedLoginSelect: document.querySelector("#savedLoginSelect"),
  saveLoginCheckbox: document.querySelector("#saveLoginCheckbox"),
  loginPassword: document.querySelector("#loginPassword"),
  loginError: document.querySelector("#loginError"),
  logoutButton: document.querySelector("#logoutButton"),
  currentUserName: document.querySelector("#currentUserName"),
  topEyebrow: document.querySelector("#topEyebrow"),
  topTitle: document.querySelector("#topTitle"),
  syncStatus: document.querySelector("#syncStatus"),
  installButton: document.querySelector("#installButton"),
  missionCount: document.querySelector("#missionCount"),
  exportButton: document.querySelector("#exportButton"),
  newMissionButton: document.querySelector("#newMissionButton"),
  notifyButton: document.querySelector("#notifyButton"),
  tabButtons: [...document.querySelectorAll(".tab-button")],
  views: {
    agenda: document.querySelector("#agendaView"),
    missao: document.querySelector("#missaoView"),
    escala: document.querySelector("#escalaView"),
    musicos: document.querySelector("#musicosView"),
    setlist: document.querySelector("#setlistView"),
  },
  monthTitle: document.querySelector("#monthTitle"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  calendarGrid: document.querySelector("#calendarGrid"),
  selectedTitle: document.querySelector("#selectedTitle"),
  selectedDetails: document.querySelector("#selectedDetails"),
  missionForm: document.querySelector("#missionForm"),
  missionId: document.querySelector("#missionId"),
  missionTitle: document.querySelector("#missionTitle"),
  missionDate: document.querySelector("#missionDate"),
  missionTime: document.querySelector("#missionTime"),
  missionPlace: document.querySelector("#missionPlace"),
  missionNotes: document.querySelector("#missionNotes"),
  deleteMissionButton: document.querySelector("#deleteMissionButton"),
  scaleTitle: document.querySelector("#scaleTitle"),
  memberForm: document.querySelector("#memberForm"),
  memberMusician: document.querySelector("#memberMusician"),
  memberList: document.querySelector("#memberList"),
  scaleMomentSelect: document.querySelector("#scaleMomentSelect"),
  scaleSongSelect: document.querySelector("#scaleSongSelect"),
  scaleAddSongButton: document.querySelector("#scaleAddSongButton"),
  scaleSongList: document.querySelector("#scaleSongList"),
  musicianForm: document.querySelector("#musicianForm"),
  musicianName: document.querySelector("#musicianName"),
  musicianMainRole: document.querySelector("#musicianMainRole"),
  musicianList: document.querySelector("#musicianList"),
  setlistTitle: document.querySelector("#setlistTitle"),
  setlistTypeTabs: document.querySelector("#setlistTypeTabs"),
  momentTabs: document.querySelector("#momentTabs"),
  libraryPicker: document.querySelector("#libraryPicker"),
  librarySongSelect: document.querySelector("#librarySongSelect"),
  useLibrarySongButton: document.querySelector("#useLibrarySongButton"),
  songForm: document.querySelector("#songForm"),
  songName: document.querySelector("#songName"),
  songKey: document.querySelector("#songKey"),
  songList: document.querySelector("#songList"),
  emptyTemplate: document.querySelector("#emptyStateTemplate"),
};

seedIfEmpty();
wireEvents();
hydrateFromApi();
startAutoSync();
render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function wireEvents() {
  els.loginForm.addEventListener("submit", login);
  els.savedLoginSelect.addEventListener("change", useSavedLogin);
  els.logoutButton.addEventListener("click", logout);
  els.installButton.addEventListener("click", installApp);
  els.syncStatus.addEventListener("click", () => alert(syncStatus.message || els.syncStatus.textContent));
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installButton.classList.remove("hidden");
  });
  els.tabButtons.forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  els.prevMonth.addEventListener("click", () => changeMonth(-1));
  els.nextMonth.addEventListener("click", () => changeMonth(1));
  els.newMissionButton.addEventListener("click", () => startNewMission());
  els.exportButton.addEventListener("click", exportData);
  els.notifyButton.addEventListener("click", enableNotifications);
  els.missionForm.addEventListener("submit", saveMissionFromForm);
  els.deleteMissionButton.addEventListener("click", deleteActiveMission);
  els.memberForm.addEventListener("submit", addAssignment);
  els.scaleMomentSelect.addEventListener("change", renderScaleSongPicker);
  els.scaleAddSongButton.addEventListener("click", addScaleSongFromLibrary);
  els.musicianForm.addEventListener("submit", addMusician);
  els.useLibrarySongButton.addEventListener("click", addSongFromLibrary);
  els.songForm.addEventListener("submit", addSong);
}

function login(event) {
  event.preventDefault();
  reconcileFixedMusicians();
  const loginValue = normalizeLoginInput(els.loginEmail.value);
  const password = els.loginPassword.value.trim();
  const musician = findMusicianForLogin(els.loginEmail.value);

  if (!musician || password !== "2026") {
    els.loginError.textContent = "Login ou senha incorretos. Use seu nome ou nome@awkn com senha 2026.";
    return;
  }

  profile.musicianId = musician.id;
  profile.login = loginValue;
  if (els.saveLoginCheckbox.checked) saveLogin(loginValue);
  saveProfile();
  els.loginError.textContent = "";
  els.loginForm.reset();
  render();
  syncPushSubscription();
  checkInAppNotifications();
  maybeNotifyAssignment();
}

function logout() {
  profile.musicianId = "";
  profile.login = "";
  saveProfile();
  render();
}

function startAutoSync() {
  setInterval(() => hydrateFromApi({ silent: true }), SYNC_INTERVAL_MS);
  window.addEventListener("focus", () => hydrateFromApi());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) hydrateFromApi();
  });
}

async function hydrateFromApi({ silent = false } = {}) {
  if (isHydrating) return;
  isHydrating = true;
  setSyncStatus("checking", "Sincronizando");
  try {
    const response = await fetch(API_STATE_URL, { cache: "no-store", headers: { accept: "application/json" } });
    const data = await readJsonResponse(response);
    if (!response.ok) {
      setSyncStatus("offline", data?.error || "Sem conexão com o banco");
      return;
    }
    const hasRemoteData = Array.isArray(data.musicians) && data.musicians.length > 0;
    if (!hasRemoteData) {
      await saveRemoteState();
      return;
    }
    const remote = normalizeState(data);
    Object.assign(state, remote);
    reconcileFixedMusicians();
    saveLocalState();
    render();
    setSyncStatus("online", "Sincronizado");
    checkInAppNotifications();
    if (!silent) maybeNotifyAssignment();
  } catch (error) {
    setSyncStatus("offline", `Sem sincronizar: ${errorMessage(error)}`);
    // Local file use keeps working without the hosted API.
  } finally {
    isHydrating = false;
  }
}

async function installApp() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    return;
  }

  alert("Para baixar o app: no iPhone, abra no Safari e toque em Compartilhar > Adicionar à Tela de Início. No Android, abra no Chrome e toque em Instalar app ou Adicionar à tela inicial.");
}

function scheduleSave() {
  saveLocalState();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveRemoteState, 350);
}

async function saveRemoteState() {
  setSyncStatus("checking", "Salvando");
  try {
    const response = await fetch(API_STATE_URL, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toPersistedState()),
    });
    const data = await readJsonResponse(response);
    if (!response.ok) {
      setSyncStatus("offline", data?.error || "Não consegui salvar no banco");
      return false;
    }
    if (data?.mode === "local") {
      setSyncStatus("local", "Modo local, sem banco compartilhado");
      return false;
    }
    if (response.ok) {
      if (data?.state) {
        Object.assign(state, normalizeState(data.state));
        reconcileFixedMusicians();
        saveLocalState();
      }
      setSyncStatus("online", "Sincronizado");
    }
    return response.ok;
  } catch (error) {
    setSyncStatus("offline", `Não sincronizado: ${errorMessage(error)}`);
    // The local copy is already saved; sync resumes when the hosted API is reachable.
    return false;
  }
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: shortText(text) };
  }
}

async function saveNow() {
  clearTimeout(saveTimer);
  saveLocalState();
  const saved = await saveRemoteState();
  if (saved) render();
  return saved;
}

function loadLocalState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersistedState()));
}

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function loadSavedLogins() {
  try {
    const logins = JSON.parse(localStorage.getItem(SAVED_LOGINS_KEY) || "[]");
    return Array.isArray(logins) ? logins.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveLogin(loginValue) {
  const normalized = normalizeLoginInput(loginValue);
  const saved = loadSavedLogins().filter((login) => login !== normalized);
  saved.unshift(normalized);
  localStorage.setItem(SAVED_LOGINS_KEY, JSON.stringify(saved.slice(0, 12)));
}

function useSavedLogin() {
  if (!els.savedLoginSelect.value) return;
  els.loginEmail.value = els.savedLoginSelect.value;
  els.loginPassword.focus();
}

function toPersistedState() {
  return {
    musicians: state.musicians,
    missions: state.missions,
    songLibrary: state.songLibrary,
    notifications: state.notifications || [],
    deletedMissionIds: state.deletedMissionIds || [],
    activeMissionId: state.activeMissionId,
    visibleDate: inputFromDate(state.visibleDate),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeState(data) {
  const missions = Array.isArray(data.missions) ? data.missions : [];
  const musicians = Array.isArray(data.musicians) ? data.musicians : [];
  const songLibrary = Array.isArray(data.songLibrary) ? data.songLibrary : [];
  const notifications = Array.isArray(data.notifications) ? data.notifications : [];
  const deletedMissionIds = Array.isArray(data.deletedMissionIds) ? data.deletedMissionIds : [];
  return {
    musicians: musicians.map((musician) => ({
      id: musician.id || musicianIdForName(musician.name),
      name: musician.name || "",
      mainRole: ROLES.includes(musician.mainRole) ? musician.mainRole : "Voz",
    })),
    missions: missions.map((mission) => ({
      id: mission.id || crypto.randomUUID(),
      title: mission.title || "",
      date: mission.date || inputFromDate(new Date()),
      time: mission.time || "19:30",
      place: mission.place || "",
      notes: mission.notes || "",
      updatedAt: mission.updatedAt || new Date().toISOString(),
      members: Array.isArray(mission.members)
        ? mission.members.map((member) => ({
            id: member.id || crypto.randomUUID(),
            musicianId: member.musicianId || findMusicianByName(member.name)?.id || "",
            role: ROLES.includes(member.role) ? member.role : "Voz",
            confirmed: Boolean(member.confirmed),
            assignedAt: member.assignedAt || mission.date || new Date().toISOString(),
          }))
        : [],
      songs: Array.isArray(mission.songs)
        ? mission.songs.map((song) => ({
            id: song.id || crypto.randomUUID(),
            name: song.name || "",
            key: KEYS.includes(song.key) ? song.key : "C",
            type: SETLIST_TYPES[song.type] ? song.type : "Missa",
            moment: MOMENTS.includes(song.moment) ? song.moment : "Entrada",
          }))
        : [],
    })),
    songLibrary: songLibrary.map((song) => ({
      id: song.id || crypto.randomUUID(),
      name: song.name || "",
      key: KEYS.includes(song.key) ? song.key : "C",
      type: SETLIST_TYPES[song.type] ? song.type : "Missa",
      moment: MOMENTS.includes(song.moment) ? song.moment : "Entrada",
    })),
    notifications: notifications.map((notification) => ({
      id: notification.id || crypto.randomUUID(),
      assignmentKey: notification.assignmentKey || "",
      musicianId: notification.musicianId || "",
      missionId: notification.missionId || "",
      title: notification.title || "Você foi escalado(a)",
      body: notification.body || "",
      url: notification.url || "/",
      createdAt: notification.createdAt || new Date().toISOString(),
    })),
    deletedMissionIds,
    activeMissionId: data.activeMissionId || null,
    visibleDate: data.visibleDate ? dateFromInput(data.visibleDate) : new Date(),
  };
}

function seedIfEmpty() {
  if (!state.musicians.length) {
    state.musicians = DEFAULT_MUSICIANS.map((musician) => ({ id: musicianIdForName(musician.name), ...musician }));
  }

  if (!state.missions.length) {
    state.missions = [
      {
        id: crypto.randomUUID(),
        title: "Missa da juventude",
        date: getDateOffset(3),
        time: "19:30",
        place: "Paróquia São José",
        notes: "Chegar 40 minutos antes para passagem de som.",
        updatedAt: new Date().toISOString(),
        members: state.musicians.slice(0, 4).map((musician) => ({
          id: crypto.randomUUID(),
          musicianId: musician.id,
          role: musician.mainRole,
          confirmed: false,
          assignedAt: new Date().toISOString(),
        })),
        songs: [
          { id: crypto.randomUUID(), name: "Vem, Espírito Santo", key: "D", type: "Missa", moment: "Entrada" },
          { id: crypto.randomUUID(), name: "Teu Amor É Maior", key: "G", type: "Missa", moment: "Comunhão" },
          { id: crypto.randomUUID(), name: "Deus É Capaz", key: "A", type: "Grupos", moment: "Louvor" },
        ],
      },
    ];
  }

  if (!state.songLibrary.length) {
    state.songLibrary = uniqueSongsFromMissions();
  }

  state.activeMissionId = state.activeMissionId || upcomingMission()?.id || state.missions[0]?.id || null;
  state.visibleDate = activeMission() ? dateFromInput(activeMission().date) : state.visibleDate;
  reconcileFixedMusicians();
  saveLocalState();
}

function reconcileFixedMusicians() {
  const bySlug = new Map();
  const oldIdToNewId = new Map();
  const realSlugSet = new Set(DEFAULT_MUSICIANS.map((musician) => slugify(musician.name)));

  state.musicians.forEach((musician, index) => {
    const currentSlug = slugify(musician.name);
    const fallbackSlug = slugify(DEFAULT_MUSICIANS[index]?.name || "");
    const targetSlug = LEGACY_MUSICIAN_ALIASES[currentSlug] || (realSlugSet.has(currentSlug) ? currentSlug : fallbackSlug);
    if (targetSlug && !bySlug.has(targetSlug)) bySlug.set(targetSlug, musician);
  });

  const fixedMusicians = DEFAULT_MUSICIANS.map((defaultMusician) => {
    const slug = slugify(defaultMusician.name);
    const existing = bySlug.get(slug);
    const id = musicianIdForName(defaultMusician.name);
    if (existing?.id && existing.id !== id) oldIdToNewId.set(existing.id, id);
    return { id, ...defaultMusician };
  });

  state.musicians.forEach((musician, index) => {
    const currentSlug = slugify(musician.name);
    const fallbackSlug = slugify(DEFAULT_MUSICIANS[index]?.name || "");
    const targetSlug = LEGACY_MUSICIAN_ALIASES[currentSlug] || (realSlugSet.has(currentSlug) ? currentSlug : fallbackSlug);
    const target = fixedMusicians.find((item) => slugify(item.name) === targetSlug);
    if (target && musician.id !== target.id) oldIdToNewId.set(musician.id, target.id);
  });

  state.musicians = fixedMusicians;
  state.missions.forEach((mission) => {
    mission.members.forEach((member) => {
      if (oldIdToNewId.has(member.musicianId)) member.musicianId = oldIdToNewId.get(member.musicianId);
      const musician = musicianById(member.musicianId);
      if (musician) member.role = musician.mainRole;
    });
  });

  if (oldIdToNewId.has(profile.musicianId)) {
    profile.musicianId = oldIdToNewId.get(profile.musicianId);
    saveProfile();
  }

  if (profile.login && !musicianById(profile.musicianId)) {
    const musician = findMusicianForLogin(profile.login);
    if (musician) {
      profile.musicianId = musician.id;
      saveProfile();
    }
  }
}

function setView(view) {
  els.tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  Object.entries(els.views).forEach(([key, element]) => element.classList.toggle("active", key === view));
  const [eyebrow, title] = VIEW_TITLES[view] || VIEW_TITLES.agenda;
  els.topEyebrow.textContent = eyebrow;
  els.topTitle.textContent = title;
  document.querySelector(`.tab-button[data-view="${view}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
}

function render() {
  renderLoginState();
  renderSyncStatus();
  renderSelectors();
  renderCalendar();
  renderSelectedMission();
  renderForm();
  renderScale();
  renderMusicians();
  renderSetlist();
  els.missionCount.textContent = `${state.missions.length} ${state.missions.length === 1 ? "missão" : "missões"}`;
}

function setSyncStatus(stateName, message) {
  syncStatus = { state: stateName, message };
  renderSyncStatus();
}

function renderSyncStatus() {
  if (!els.syncStatus) return;
  const labels = {
    checking: "Sincronizando",
    online: "Sincronizado",
    offline: "Sem sincronizar",
    local: "Modo local",
  };
  els.syncStatus.textContent = labels[syncStatus.state] || "Sincronizando";
  els.syncStatus.className = `sync-status ${syncStatus.state || "checking"}`;
  els.syncStatus.title = syncStatus.message || els.syncStatus.textContent;
}

function renderLoginState() {
  const musician = musicianById(profile.musicianId);
  els.loginScreen.classList.toggle("hidden", Boolean(musician));
  els.currentUserName.textContent = musician ? musician.name : "Sem login";
  renderLoginOptions();
}

function renderSelectors() {
  fillSelect(els.memberMusician, state.musicians.map((musician) => [musician.id, `${musician.name} (${musician.mainRole})`]), "Quem vai?");
  fillSelect(els.scaleMomentSelect, SETLIST_TYPES.Missa.map((moment) => [moment, moment]));
  fillSelect(els.songKey, KEYS.map((key) => [key, key]));
  renderLibrarySelect();
}

function renderCalendar() {
  const month = state.visibleDate.getMonth();
  const year = state.visibleDate.getFullYear();
  els.monthTitle.textContent = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(state.visibleDate);
  els.calendarGrid.innerHTML = "";

  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const todayKey = inputFromDate(new Date());

  for (let index = 0; index < 42; index += 1) {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + index);
    const key = inputFromDate(dayDate);
    const missions = state.missions.filter((mission) => mission.date === key);
    const button = document.createElement("button");
    button.className = "day";
    button.type = "button";
    button.classList.toggle("outside", dayDate.getMonth() !== month);
    button.classList.toggle("today", key === todayKey);
    button.classList.toggle("selected", missions.some((mission) => mission.id === state.activeMissionId));
    button.innerHTML = `<span class="day-number">${dayDate.getDate()}</span>${missions
      .map((mission) => `<span class="day-mission">${escapeHtml(mission.title)}</span>`)
      .join("")}`;
    button.addEventListener("click", () => {
      if (missions.length) {
        state.activeMissionId = missions[0].id;
      } else {
        startNewMission(key);
      }
      render();
    });
    els.calendarGrid.append(button);
  }
}

function renderSelectedMission() {
  const mission = activeMission();
  if (!mission) {
    els.selectedTitle.textContent = "Selecione uma data";
    els.selectedDetails.innerHTML = "";
    els.selectedDetails.append(els.emptyTemplate.content.cloneNode(true));
    return;
  }

  els.selectedTitle.textContent = mission.title;
  els.selectedDetails.innerHTML = `
    <div class="detail-row"><span>Quando</span><strong>${formatDate(mission.date)} às ${mission.time}</strong></div>
    <div class="detail-row"><span>Local</span><strong>${escapeHtml(mission.place || "Sem local definido")}</strong></div>
    <div class="detail-row"><span>Observações</span><strong>${escapeHtml(mission.notes || "Sem observações")}</strong></div>
    <div class="detail-row"><span>Escala</span>${miniList(mission.members, formatAssignment)}</div>
    <div class="detail-row"><span>Setlist</span>${miniList(mission.songs, (item) => `${item.moment}: ${item.name} (${item.key})`)}</div>
  `;
}

function renderForm() {
  const mission = activeMission();
  els.deleteMissionButton.classList.toggle("hidden", !mission);
  if (!mission) return;
  els.missionId.value = mission.id;
  els.missionTitle.value = mission.title;
  els.missionDate.value = mission.date;
  els.missionTime.value = mission.time;
  els.missionPlace.value = mission.place || "";
  els.missionNotes.value = mission.notes || "";
}

function renderScale() {
  const mission = activeMission();
  els.scaleTitle.textContent = mission ? mission.title : "Escolha uma missão";
  els.memberForm.querySelectorAll("select, button").forEach((input) => (input.disabled = !mission || !state.musicians.length));
  els.memberList.innerHTML = "";

  if (!mission) {
    els.memberList.append(els.emptyTemplate.content.cloneNode(true));
    renderScaleSongPicker();
    return;
  }

  if (!mission.members.length) {
    els.memberList.innerHTML = `<div class="empty-state"><strong>Escala vazia</strong><span>Selecione músicos cadastrados para esta missão.</span></div>`;
    renderScaleSongPicker();
    return;
  }

  mission.members.forEach((member) => els.memberList.append(assignmentCard(mission, member)));
  renderScaleSongPicker();
}

function renderScaleSongPicker() {
  const mission = activeMission();
  const moment = els.scaleMomentSelect.value || SETLIST_TYPES.Missa[0];
  const librarySongs = (state.songLibrary || []).filter((song) => (song.type || "Missa") === "Missa");
  els.scaleSongSelect.disabled = !mission || !librarySongs.length;
  els.scaleAddSongButton.disabled = !mission || !librarySongs.length;
  fillSelect(
    els.scaleSongSelect,
    librarySongs.map((song) => [song.id, `${song.name} • ${song.moment} • Tom ${song.key}`]),
    librarySongs.length ? "Escolher música do setlist" : "Nenhuma música cadastrada"
  );

  els.scaleSongList.innerHTML = "";
  if (!mission) return;
  const songs = mission.songs.filter((song) => (song.type || "Missa") === "Missa" && song.moment === moment);
  songs.forEach((song) => {
    els.scaleSongList.append(itemCard(song.name, `${song.moment} • Tom ${song.key}`, () => removeSong(song.id)));
  });
  if (!songs.length) {
    els.scaleSongList.innerHTML = `<div class="empty-state"><strong>Nenhuma música em ${escapeHtml(moment)}</strong><span>Escolha uma música do setlist para este momento.</span></div>`;
  }
}

function renderMusicians() {
  els.musicianList.innerHTML = "";
  state.musicians.forEach((musician) => {
    const card = document.createElement("div");
    card.className = "item-card musician-card";
    card.innerHTML = `
      <input value="${escapeAttribute(musician.name)}" aria-label="Nome do músico" />
      <select aria-label="Função principal">${ROLES.map((role) => `<option value="${role}" ${role === musician.mainRole ? "selected" : ""}>${role}</option>`).join("")}</select>
      <span class="login-hint">${escapeHtml(loginForMusician(musician))}</span>
    `;
    const nameInput = card.querySelector("input");
    const roleSelect = card.querySelector("select");
    nameInput.addEventListener("change", () => {
      musician.name = nameInput.value.trim();
      scheduleSave();
      render();
    });
    roleSelect.addEventListener("change", () => {
      musician.mainRole = roleSelect.value;
      scheduleSave();
      render();
    });
    const remove = removeButton(() => removeMusician(musician.id));
    card.append(remove);
    els.musicianList.append(card);
  });
}

function renderSetlist() {
  const mission = activeMission();
  els.setlistTitle.textContent = mission ? mission.title : "Escolha uma missão";
  els.songForm.querySelectorAll("input, select, button").forEach((input) => (input.disabled = !mission));
  els.libraryPicker.classList.toggle("hidden", activeSetlistType !== "Missa");
  els.libraryPicker.querySelectorAll("select, button").forEach((input) => (input.disabled = !mission));
  els.setlistTypeTabs.innerHTML = "";
  Object.keys(SETLIST_TYPES).forEach((type) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "setlist-type-tab";
    button.classList.toggle("active", activeSetlistType === type);
    button.textContent = type;
    button.addEventListener("click", () => {
      activeSetlistType = type;
      activeMoment = SETLIST_TYPES[type][0];
      renderSetlist();
    });
    els.setlistTypeTabs.append(button);
  });

  els.momentTabs.innerHTML = "";
  SETLIST_TYPES[activeSetlistType].forEach((moment) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "moment-tab";
    button.classList.toggle("active", activeMoment === moment);
    button.textContent = moment;
    button.addEventListener("click", () => {
      activeMoment = moment;
      renderSetlist();
    });
    els.momentTabs.append(button);
  });

  els.songList.innerHTML = "";
  if (!mission) {
    els.songList.append(els.emptyTemplate.content.cloneNode(true));
    return;
  }

  const songs = mission.songs.filter((song) => (song.type || "Missa") === activeSetlistType && song.moment === activeMoment);
  songs.forEach((song) => {
    const card = itemCard(song.name, `Tom ${song.key}`, () => removeSong(song.id));
    els.songList.append(card);
  });

  if (!songs.length) {
    els.songList.innerHTML = `<div class="empty-state"><strong>Nenhuma música em ${escapeHtml(activeSetlistType)} • ${escapeHtml(activeMoment)}</strong><span>Adicione músicas para este momento.</span></div>`;
  }
  renderLibrarySelect();
}

function startNewMission(date = inputFromDate(new Date())) {
  state.activeMissionId = null;
  els.missionForm.reset();
  els.missionId.value = "";
  els.missionDate.value = date;
  els.missionTime.value = "19:30";
  els.deleteMissionButton.classList.add("hidden");
  setView("missao");
}

function saveMissionFromForm(event) {
  event.preventDefault();
  const id = els.missionId.value || crypto.randomUUID();
  const existing = state.missions.find((mission) => mission.id === id);
  const mission = {
    id,
    title: els.missionTitle.value.trim(),
    date: els.missionDate.value,
    time: els.missionTime.value,
    place: els.missionPlace.value.trim(),
    notes: els.missionNotes.value.trim(),
    updatedAt: new Date().toISOString(),
    members: existing?.members || [],
    songs: existing?.songs || [],
  };

  if (existing) Object.assign(existing, mission);
  else state.missions.push(mission);

  state.missions.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  state.activeMissionId = id;
  state.visibleDate = dateFromInput(mission.date);
  saveNow();
  render();
  setView("escala");
}

function deleteActiveMission() {
  const mission = activeMission();
  if (!mission || !confirm(`Excluir "${mission.title}"?`)) return;
  state.missions = state.missions.filter((item) => item.id !== mission.id);
  state.deletedMissionIds = [...new Set([...(state.deletedMissionIds || []), mission.id])];
  state.activeMissionId = upcomingMission()?.id || state.missions[0]?.id || null;
  saveNow();
  render();
  setView("agenda");
}

function addAssignment(event) {
  event.preventDefault();
  const mission = activeMission();
  if (!mission) return;
  const musicianId = els.memberMusician.value;
  const musician = musicianById(musicianId);
  if (!musician) return;
  const existing = mission.members.find((member) => member.musicianId === musicianId);
  if (existing) {
    existing.role = musician.mainRole;
    existing.assignedAt = new Date().toISOString();
  } else {
    mission.members.push({
      id: crypto.randomUUID(),
      musicianId,
      role: musician.mainRole,
      confirmed: false,
      assignedAt: new Date().toISOString(),
    });
  }
  touchMission(mission);
  els.memberForm.reset();
  saveNow();
  render();
  maybeNotifyAssignment();
}

function addMusician(event) {
  event.preventDefault();
  const name = els.musicianName.value.trim();
  state.musicians.push({
    id: musicianIdForName(name),
    name,
    mainRole: els.musicianMainRole.value,
  });
  els.musicianForm.reset();
  scheduleSave();
  render();
}

function addSong(event) {
  event.preventDefault();
  const mission = activeMission();
  if (!mission) return;
  const song = {
    id: crypto.randomUUID(),
    name: els.songName.value.trim(),
    key: els.songKey.value,
    type: activeSetlistType,
    moment: activeMoment,
  };
  mission.songs.push(song);
  touchMission(mission);
  addToLibrary(song);
  els.songForm.reset();
  els.songKey.value = "C";
  scheduleSave();
  renderSetlist();
}

function addSongFromLibrary() {
  const mission = activeMission();
  if (!mission) return;
  const librarySong = state.songLibrary.find((song) => song.id === els.librarySongSelect.value);
  if (!librarySong) return;
  mission.songs.push({
    id: crypto.randomUUID(),
    name: librarySong.name,
    key: librarySong.key,
    type: activeSetlistType,
    moment: activeMoment,
  });
  touchMission(mission);
  scheduleSave();
  renderSetlist();
}

function addScaleSongFromLibrary() {
  const mission = activeMission();
  if (!mission) return;
  const librarySong = state.songLibrary.find((song) => song.id === els.scaleSongSelect.value);
  if (!librarySong) return;
  mission.songs.push({
    id: crypto.randomUUID(),
    name: librarySong.name,
    key: librarySong.key,
    type: "Missa",
    moment: els.scaleMomentSelect.value || librarySong.moment || "Entrada",
  });
  touchMission(mission);
  scheduleSave();
  renderScaleSongPicker();
  renderSelectedMission();
  renderSetlist();
}

function assignmentCard(mission, member) {
  const musician = musicianById(member.musicianId);
  const card = document.createElement("div");
  card.className = "item-card assignment-card";
  card.innerHTML = `
    <div>
      <strong>${escapeHtml(musician?.name || "Músico removido")}</strong>
      <span>${escapeHtml(member.role)} • ${member.confirmed ? "Presença confirmada" : "Aguardando confirmação"}</span>
    </div>
  `;
  const canConfirm = profile.musicianId === member.musicianId;
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = member.confirmed ? "ghost-button" : "secondary-button";
  confirm.textContent = member.confirmed ? "Desconfirmar" : "Confirmar";
  confirm.disabled = !canConfirm;
  confirm.title = canConfirm ? "Confirmar presença" : "Apenas este músico pode confirmar";
  confirm.addEventListener("click", () => {
    if (!canConfirm) return;
    member.confirmed = !member.confirmed;
    touchMission(mission);
    scheduleSave();
    render();
  });
  card.append(confirm, removeButton(() => removeAssignment(mission.id, member.id)));
  return card;
}

function itemCard(title, subtitle, onRemove) {
  const element = document.createElement("div");
  element.className = "item-card";
  element.innerHTML = `<div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></div>`;
  element.append(removeButton(onRemove));
  return element;
}

function removeButton(onRemove) {
  const button = document.createElement("button");
  button.className = "remove-button";
  button.type = "button";
  button.title = "Remover";
  button.textContent = "×";
  button.addEventListener("click", onRemove);
  return button;
}

function removeAssignment(missionId, memberId) {
  const mission = state.missions.find((item) => item.id === missionId);
  mission.members = mission.members.filter((member) => member.id !== memberId);
  touchMission(mission);
  scheduleSave();
  render();
}

function removeMusician(id) {
  if (!confirm("Remover este músico da lista fixa e das escalas?")) return;
  state.musicians = state.musicians.filter((musician) => musician.id !== id);
  state.missions.forEach((mission) => {
    mission.members = mission.members.filter((member) => member.musicianId !== id);
  });
  if (profile.musicianId === id) {
    profile.musicianId = "";
    saveProfile();
  }
  scheduleSave();
  render();
}

function removeSong(id) {
  const mission = activeMission();
  mission.songs = mission.songs.filter((song) => song.id !== id);
  touchMission(mission);
  scheduleSave();
  renderScaleSongPicker();
  renderSelectedMission();
  renderSetlist();
}

function touchMission(mission) {
  if (mission) mission.updatedAt = new Date().toISOString();
}

function addToLibrary(song) {
  const exists = state.songLibrary.some(
    (item) => item.name.toLowerCase() === song.name.toLowerCase() && item.type === song.type
  );
  if (exists) return;
  state.songLibrary.push({
    id: crypto.randomUUID(),
    name: song.name,
    key: song.key,
    type: song.type,
    moment: song.moment,
  });
}

function renderLibrarySelect() {
  const songs = (state.songLibrary || []).filter((song) => (song.type || "Missa") === activeSetlistType);
  fillSelect(
    els.librarySongSelect,
    songs.map((song) => [song.id, `${song.name} • ${song.moment} • Tom ${song.key}`]),
    songs.length ? "Escolher música do setlist" : "Nenhuma música cadastrada"
  );
}

function uniqueSongsFromMissions() {
  const map = new Map();
  state.missions.flatMap((mission) => mission.songs || []).forEach((song) => {
    const key = `${song.type || "Missa"}:${song.name.toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, {
        id: crypto.randomUUID(),
        name: song.name,
        key: song.key,
        type: song.type || "Missa",
        moment: song.moment || "Entrada",
      });
    }
  });
  return [...map.values()];
}

function enableNotifications() {
  const localNotifications = nativeNotifications();
  if (localNotifications) {
    localNotifications.requestPermissions().then((permission) => {
      if (permission.display === "granted") maybeNotifyAssignment(true);
      else alert("Permita notificações para receber avisos de escala.");
    });
    return;
  }

  if (!profile.musicianId) {
    alert("Entre com seu login antes de ativar notificações.");
    return;
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("Este aparelho ou navegador não suporta notificações automáticas. No iPhone, instale o app na tela inicial e abra por lá.");
    return;
  }
  Notification.requestPermission().then(async (permission) => {
    if (permission !== "granted") {
      alert("Permita notificações para receber avisos de escala.");
      return;
    }
    const result = await syncPushSubscription({ refresh: true });
    if (result.ok) {
      const status = await getPushStatus();
      const localShown = await showLocalNotification("Teste local AWKN", "Se esta notificação apareceu, o celular permitiu notificações.");
      const tested = await sendTestPush();
      const registered = status?.subscriptions || 0;
      alert(
        tested
          ? `Notificações ativadas.\n\nAparelhos cadastrados neste login: ${registered}.\nTeste local: ${localShown ? "enviado" : "não exibido"}.\nTeste do servidor: enviado.`
          : `Notificações ativadas, mas o teste do servidor não foi confirmado.\n\nAparelhos cadastrados neste login: ${registered}.\nTeste local: ${localShown ? "enviado" : "não exibido"}.`
      );
    } else {
      alert(
        `Não consegui cadastrar este aparelho.\n\nEtapa: ${result.step || "cadastro"}.\nDetalhe: ${result.message || "sem detalhe informado"}.\n\nPermissão: ${Notification.permission}.\nModo app instalado: ${isStandaloneApp() ? "sim" : "não"}.\nPush suportado: ${"PushManager" in window ? "sim" : "não"}.\n\nNo iPhone, abra pelo ícone instalado na Tela de Início.`
      );
    }
    maybeNotifyAssignment(true);
  });
}

async function syncPushSubscription({ refresh = false } = {}) {
  if (!profile.musicianId) return pushSetupFailure("login", "Entre com seu login antes de ativar notificações.");
  if (!("Notification" in window)) return pushSetupFailure("permissão", "Este aparelho não liberou a API de notificações.");
  if (Notification.permission !== "granted") return pushSetupFailure("permissão", "A permissão de notificações ainda não está liberada.");
  if (!("serviceWorker" in navigator)) return pushSetupFailure("service worker", "Este navegador não liberou o serviço de notificações do app.");
  if (!("PushManager" in window)) return pushSetupFailure("push", "Este navegador não liberou notificações automáticas.");
  try {
    const registration = await navigator.serviceWorker.register("./sw.js");
    await registration.update().catch(() => {});
    const readyRegistration = await navigator.serviceWorker.ready;
    const activeRegistration = readyRegistration || registration;

    const publicKeyResponse = await fetch(PUSH_PUBLIC_KEY_URL, { cache: "no-store" });
    const publicKeyText = await publicKeyResponse.text();
    if (!publicKeyResponse.ok) {
      return pushSetupFailure("chave do servidor", `Resposta ${publicKeyResponse.status}: ${shortText(publicKeyText)}`);
    }

    let publicKeyData = {};
    try {
      publicKeyData = JSON.parse(publicKeyText);
    } catch {
      return pushSetupFailure("chave do servidor", `Resposta inválida: ${shortText(publicKeyText)}`);
    }

    const publicKey = publicKeyData.publicKey;
    if (!publicKey) return pushSetupFailure("chave do servidor", "A chave pública de notificações não chegou do servidor.");

    let applicationServerKey;
    try {
      applicationServerKey = urlBase64ToUint8Array(publicKey);
    } catch (error) {
      return pushSetupFailure("chave do servidor", `A chave pública está inválida. ${errorMessage(error)}`);
    }
    if (applicationServerKey.length !== 65) {
      return pushSetupFailure("chave do servidor", `A chave pública está com tamanho inválido (${applicationServerKey.length} bytes).`);
    }

    const existing = await activeRegistration.pushManager.getSubscription();
    if (existing && refresh) {
      await fetch(PUSH_UNSUBSCRIBE_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: existing.endpoint }),
      }).catch(() => {});
      await existing.unsubscribe().catch(() => {});
    }

    let subscription = !refresh && existing ? existing : null;
    if (!subscription) {
      try {
        subscription = await activeRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      } catch (error) {
        return pushSetupFailure("assinatura do aparelho", errorMessage(error));
      }
    }

    if (!subscription?.endpoint) {
      return pushSetupFailure("assinatura do aparelho", "O aparelho não gerou um endereço de notificação.");
    }

    const response = await fetch(PUSH_SUBSCRIBE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ musicianId: profile.musicianId, subscription }),
    });
    const responseText = await response.text();
    let responseData = {};
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseData = {};
    }
    if (!response.ok) {
      const serverMessage = [responseData.error, responseData.detail].filter(Boolean).join(" ");
      return pushSetupFailure("cadastro no servidor", `Resposta ${response.status}: ${serverMessage || shortText(responseText)}`);
    }

    return { ok: true, endpoint: subscription.endpoint };
  } catch (error) {
    return pushSetupFailure("erro inesperado", errorMessage(error));
  }
}

function pushSetupFailure(step, message) {
  return { ok: false, step, message };
}

function shortText(value) {
  return String(value || "sem resposta").replace(/\s+/g, " ").trim().slice(0, 160);
}

function errorMessage(error) {
  if (!error) return "Erro desconhecido.";
  const name = error.name ? `${error.name}: ` : "";
  return `${name}${error.message || String(error)}`;
}

async function showLocalNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration?.showNotification) {
        await registration.showNotification(title, {
          body,
          icon: "./icon-192.png",
          badge: "./icon-192.png",
          data: { url: "./" },
        });
        return true;
      }
    }

    new Notification(title, {
      body,
      icon: "./icon-192.png",
    });
    return true;
  } catch {
    return false;
  }
}

async function sendTestPush() {
  try {
    const response = await fetch(PUSH_TEST_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ musicianId: profile.musicianId }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data.sent);
  } catch {
    return false;
  }
}

async function getPushStatus() {
  try {
    const params = new URLSearchParams({ musicianId: profile.musicianId });
    const response = await fetch(`${PUSH_STATUS_URL}?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function checkInAppNotifications() {
  if (!profile.musicianId) return;
  const seen = new Set(profile.seenNotificationIds || []);
  const next = (state.notifications || [])
    .filter((notification) => notification.musicianId === profile.musicianId && !seen.has(notification.id))
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))[0];
  if (!next) return;

  seen.add(next.id);
  profile.seenNotificationIds = [...seen].slice(-100);
  saveProfile();

  if ("Notification" in window && Notification.permission === "granted") {
    showLocalNotification(next.title, next.body).then((shown) => {
      if (!shown) alert(`${next.title}\n\n${next.body}\n\nConfirme sua presença na aba Escala.`);
    });
    return;
  }

  alert(`${next.title}\n\n${next.body}\n\nConfirme sua presença na aba Escala.`);
}

function maybeNotifyAssignment(force = false) {
  if (!profile.musicianId) return;
  const assignment = nextAssignmentForProfile(force);
  if (!assignment) return;
  const { mission, member, key } = assignment;
  const title = "Você foi escalado(a)";
  const body = `${mission.title} - ${formatDate(mission.date)} às ${mission.time}`;
  markAssignmentNotified(key);
  const localNotifications = nativeNotifications();
  if (localNotifications) {
    localNotifications
      .schedule({
        notifications: [
          {
            id: Math.floor(Date.now() % 2147483647),
            title,
            body,
            schedule: { at: new Date(Date.now() + 700) },
          },
        ],
      })
      .catch(() => {});
    return;
  }

  if (!("Notification" in window) || Notification.permission !== "granted") {
    alert(`${title}\n\n${body}\n\nConfirme sua presença na aba Escala.`);
    return;
  }
  showLocalNotification(title, body).then((shown) => {
    if (!shown) alert(`${title}\n\n${body}\n\nConfirme sua presença na aba Escala.`);
  });
}

function nextAssignmentForProfile(force = false) {
  const notified = new Set(profile.notifiedAssignmentKeys || []);
  const today = inputFromDate(new Date());
  const upcomingMissions = state.missions.filter((mission) => mission.date >= today);
  for (const mission of upcomingMissions) {
    const member = mission.members.find((item) => item.musicianId === profile.musicianId);
    if (!member) continue;
    const key = assignmentNotificationKey(mission, member);
    if (force || !notified.has(key)) return { mission, member, key };
  }
  return null;
}

function assignmentNotificationKey(mission, member) {
  return `${profile.musicianId}:${mission.id}:${member.id}:${member.assignedAt || mission.date}`;
}

function markAssignmentNotified(key) {
  const notified = new Set(profile.notifiedAssignmentKeys || []);
  notified.add(key);
  profile.notifiedAssignmentKeys = [...notified].slice(-40);
  profile.lastNotificationKey = key;
  saveProfile();
}

function nativeNotifications() {
  return window.Capacitor?.Plugins?.LocalNotifications || null;
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function loginForMusician(musician) {
  return `${slugify(musician.name)}@awkn`;
}

function musicianIdForName(name) {
  return `musician-${slugify(name)}`;
}

function findMusicianForLogin(value) {
  const wantedLogin = normalizeLoginInput(value);
  const wantedName = slugify(String(value).split("@")[0] || value);
  return (
    state.musicians.find((musician) => loginForMusician(musician) === wantedLogin) ||
    state.musicians.find((musician) => slugify(musician.name) === wantedName)
  );
}

function normalizeLoginInput(value) {
  const [name] = String(value).trim().toLowerCase().split("@");
  return `${slugify(name)}@awkn`;
}

function renderLoginOptions() {
  if (!els.loginOptions) return;
  els.loginOptions.innerHTML = state.musicians
    .map((musician) => `<option value="${escapeAttribute(loginForMusician(musician))}">${escapeHtml(musician.name)}</option>`)
    .join("");

  const savedLogins = loadSavedLogins();
  els.savedLoginLabel.classList.toggle("hidden", !savedLogins.length);
  els.savedLoginSelect.innerHTML = `<option value="">Selecionar login salvo</option>`;
  savedLogins.forEach((login) => {
    const option = document.createElement("option");
    option.value = login;
    option.textContent = login;
    els.savedLoginSelect.append(option);
  });
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function changeMonth(offset) {
  state.visibleDate = new Date(state.visibleDate.getFullYear(), state.visibleDate.getMonth() + offset, 1);
  renderCalendar();
}

function activeMission() {
  return state.missions.find((mission) => mission.id === state.activeMissionId) || null;
}

function upcomingMission() {
  const today = inputFromDate(new Date());
  return state.missions.find((mission) => mission.date >= today);
}

function musicianById(id) {
  return state.musicians.find((musician) => musician.id === id) || null;
}

function findMusicianByName(name) {
  return state.musicians.find((musician) => musician.name === name) || null;
}

function formatAssignment(member) {
  const musician = musicianById(member.musicianId);
  return `${musician?.name || "Músico removido"} — ${member.role} — ${member.confirmed ? "confirmado" : "pendente"}`;
}

function miniList(items, formatter) {
  if (!items.length) return "<strong>Nada adicionado ainda</strong>";
  return `<ul class="mini-list">${items.map((item) => `<li>${escapeHtml(formatter(item))}</li>`).join("")}</ul>`;
}

function fillSelect(select, options, placeholder = "") {
  const current = select.value;
  select.innerHTML = placeholder ? `<option value="">${placeholder}</option>` : "";
  options.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function exportData() {
  const blob = new Blob([JSON.stringify(toPersistedState(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ministerio-musica-awkn.json";
  link.click();
  URL.revokeObjectURL(url);
}

function inputFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromInput(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(dateFromInput(value));
}

function getDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return inputFromDate(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
