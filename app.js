const STORAGE_KEY = "ministerio-musica-dados-v2";
const PROFILE_KEY = "ministerio-musica-perfil-v1";
const API_STATE_URL = "/api/state";
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

const els = {
  loginScreen: document.querySelector("#loginScreen"),
  loginForm: document.querySelector("#loginForm"),
  loginEmail: document.querySelector("#loginEmail"),
  loginOptions: document.querySelector("#loginOptions"),
  loginQuickList: document.querySelector("#loginQuickList"),
  loginPassword: document.querySelector("#loginPassword"),
  loginError: document.querySelector("#loginError"),
  logoutButton: document.querySelector("#logoutButton"),
  currentUserName: document.querySelector("#currentUserName"),
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
render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function wireEvents() {
  els.loginForm.addEventListener("submit", login);
  els.logoutButton.addEventListener("click", logout);
  els.installButton.addEventListener("click", installApp);
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
  saveProfile();
  els.loginError.textContent = "";
  els.loginForm.reset();
  render();
  maybeNotifyAssignment(true);
}

function quickLogin(musician) {
  reconcileFixedMusicians();
  const fixedMusician = findMusicianForLogin(musician.name) || musician;
  profile.musicianId = fixedMusician.id;
  profile.login = loginForMusician(fixedMusician);
  saveProfile();
  els.loginError.textContent = "";
  els.loginForm.reset();
  render();
  maybeNotifyAssignment(true);
}

function logout() {
  profile.musicianId = "";
  profile.login = "";
  saveProfile();
  render();
}

async function hydrateFromApi() {
  try {
    const response = await fetch(API_STATE_URL, { headers: { accept: "application/json" } });
    if (!response.ok) return;
    const data = await response.json();
    const hasRemoteData = Array.isArray(data.musicians) && data.musicians.length > 0;
    if (!hasRemoteData) {
      await saveRemoteState();
      return;
    }
    const remote = normalizeState(data);
    Object.assign(state, remote);
    reconcileFixedMusicians();
    saveLocalState();
    await saveRemoteState();
    render();
    maybeNotifyAssignment();
  } catch {
    // Local file use keeps working without the hosted API.
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
  try {
    await fetch(API_STATE_URL, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toPersistedState()),
    });
  } catch {
    // The local copy is already saved; sync resumes when the hosted API is reachable.
  }
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

function toPersistedState() {
  return {
    musicians: state.musicians,
    missions: state.missions,
    songLibrary: state.songLibrary,
    activeMissionId: state.activeMissionId,
    visibleDate: inputFromDate(state.visibleDate),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeState(data) {
  const missions = Array.isArray(data.missions) ? data.missions : [];
  const musicians = Array.isArray(data.musicians) ? data.musicians : [];
  const songLibrary = Array.isArray(data.songLibrary) ? data.songLibrary : [];
  return {
    musicians: musicians.map((musician) => ({
      id: musician.id || crypto.randomUUID(),
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
      members: Array.isArray(mission.members)
        ? mission.members.map((member) => ({
            id: member.id || crypto.randomUUID(),
            musicianId: member.musicianId || findMusicianByName(member.name)?.id || "",
            role: ROLES.includes(member.role) ? member.role : "Voz",
            confirmed: Boolean(member.confirmed),
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
    activeMissionId: data.activeMissionId || null,
    visibleDate: data.visibleDate ? dateFromInput(data.visibleDate) : new Date(),
  };
}

function seedIfEmpty() {
  if (!state.musicians.length) {
    state.musicians = DEFAULT_MUSICIANS.map((musician) => ({ id: crypto.randomUUID(), ...musician }));
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
        members: state.musicians.slice(0, 4).map((musician) => ({
          id: crypto.randomUUID(),
          musicianId: musician.id,
          role: musician.mainRole,
          confirmed: false,
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
    const id = existing?.id || crypto.randomUUID();
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
}

function setView(view) {
  els.tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  Object.entries(els.views).forEach(([key, element]) => element.classList.toggle("active", key === view));
}

function render() {
  renderLoginState();
  renderSelectors();
  renderCalendar();
  renderSelectedMission();
  renderForm();
  renderScale();
  renderMusicians();
  renderSetlist();
  els.missionCount.textContent = `${state.missions.length} ${state.missions.length === 1 ? "missão" : "missões"}`;
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
    members: existing?.members || [],
    songs: existing?.songs || [],
  };

  if (existing) Object.assign(existing, mission);
  else state.missions.push(mission);

  state.missions.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  state.activeMissionId = id;
  state.visibleDate = dateFromInput(mission.date);
  scheduleSave();
  render();
  setView("escala");
}

function deleteActiveMission() {
  const mission = activeMission();
  if (!mission || !confirm(`Excluir "${mission.title}"?`)) return;
  state.missions = state.missions.filter((item) => item.id !== mission.id);
  state.activeMissionId = upcomingMission()?.id || state.missions[0]?.id || null;
  scheduleSave();
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
  } else {
    mission.members.push({ id: crypto.randomUUID(), musicianId, role: musician.mainRole, confirmed: false });
  }
  els.memberForm.reset();
  scheduleSave();
  render();
  maybeNotifyAssignment();
}

function addMusician(event) {
  event.preventDefault();
  state.musicians.push({
    id: crypto.randomUUID(),
    name: els.musicianName.value.trim(),
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
  scheduleSave();
  renderScaleSongPicker();
  renderSelectedMission();
  renderSetlist();
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

  if (!("Notification" in window)) {
    alert("Este aparelho não suporta notificações do navegador.");
    return;
  }
  Notification.requestPermission().then(() => maybeNotifyAssignment(true));
}

function maybeNotifyAssignment(force = false) {
  if (!profile.musicianId) return;
  const next = state.missions
    .filter((mission) => mission.date >= inputFromDate(new Date()))
    .find((mission) => mission.members.some((member) => member.musicianId === profile.musicianId));
  if (!next) return;
  const key = `${profile.musicianId}:${next.id}`;
  if (!force && profile.lastNotificationKey === key) return;
  profile.lastNotificationKey = key;
  saveProfile();
  const title = "Você foi escalado(a)";
  const body = `${next.title} - ${formatDate(next.date)} às ${next.time}`;
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

  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification("Você foi escalado(a)", {
    body,
    icon: "./icon-192.png",
  });
}

function nativeNotifications() {
  return window.Capacitor?.Plugins?.LocalNotifications || null;
}

function loginForMusician(musician) {
  return `${slugify(musician.name)}@awkn`;
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

  if (!els.loginQuickList) return;
  els.loginQuickList.innerHTML = "";
  state.musicians.forEach((musician) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "login-quick-button";
    button.textContent = musician.name;
    button.addEventListener("click", () => quickLogin(musician));
    els.loginQuickList.append(button);
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
