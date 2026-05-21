const state = {
  mode: "video",
  stream: null,
  recorder: null,
  chunks: [],
  isRecording: false,
  isLive: false,
  assets: [],
  editRun: 0,
  audioContext: null,
  analyser: null,
  animationId: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const cameraPreview = $("#cameraPreview");
const previewPlaceholder = $("#previewPlaceholder");
const sessionStatus = $("#sessionStatus");
const recordButton = $("#recordButton");
const deviceButton = $("#deviceButton");
const liveButton = $("#liveButton");
const importInput = $("#importInput");
const assetList = $("#assetList");
const assetCount = $("#assetCount");
const packageSummary = $("#packageSummary");
const publishStatus = $("#publishStatus");
const toast = $("#toast");
const audioMeter = $("#audioMeter");
const meterContext = audioMeter.getContext("2d");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function setStatus(label, live = false) {
  sessionStatus.textContent = label;
  sessionStatus.classList.toggle("live", live);
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function mimeForMode() {
  if (state.mode === "audio") {
    return MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
  }

  return MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";
}

async function enableDevices() {
  if (state.stream) return state.stream;

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: state.mode === "video",
      audio: true,
    });
    cameraPreview.srcObject = state.stream;
    await cameraPreview.play();
    cameraPreview.classList.toggle("active", state.mode === "video");
    previewPlaceholder.style.display = state.mode === "video" ? "none" : "grid";
    setupAudioMeter(state.stream);
    setStatus("Devices ready");
    showToast("Camera and microphone are ready.");
    return state.stream;
  } catch (error) {
    setStatus("Permission needed");
    showToast("Device access was blocked or unavailable.");
    throw error;
  }
}

function stopDevices() {
  if (!state.stream) return;
  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  cameraPreview.srcObject = null;
  cameraPreview.classList.remove("active");
  previewPlaceholder.style.display = "grid";
  cancelAnimationFrame(state.animationId);
}

function setupAudioMeter(stream) {
  if (!state.audioContext) {
    state.audioContext = new AudioContext();
  }

  const source = state.audioContext.createMediaStreamSource(stream);
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 128;
  source.connect(state.analyser);
  drawMeter();
}

function drawMeter() {
  const width = audioMeter.width;
  const height = audioMeter.height;
  const bars = new Uint8Array(state.analyser?.frequencyBinCount || 32);

  if (state.analyser) {
    state.analyser.getByteFrequencyData(bars);
  }

  meterContext.clearRect(0, 0, width, height);
  meterContext.fillStyle = "rgba(255, 255, 255, 0.14)";
  meterContext.fillRect(0, 0, width, height);

  const gap = 4;
  const barWidth = width / bars.length - gap;
  bars.forEach((value, index) => {
    const barHeight = Math.max(8, (value / 255) * height);
    meterContext.fillStyle = index % 3 === 0 ? "#f0c95f" : "#f7fff9";
    meterContext.fillRect(index * (barWidth + gap), height - barHeight, barWidth, barHeight);
  });

  state.animationId = requestAnimationFrame(drawMeter);
}

async function startRecording() {
  const stream = await enableDevices();
  state.chunks = [];
  const mimeType = mimeForMode();
  state.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  state.recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) state.chunks.push(event.data);
  });

  state.recorder.addEventListener("stop", () => {
    const type = state.mode === "audio" ? "audio/webm" : "video/webm";
    const blob = new Blob(state.chunks, { type });
    const url = URL.createObjectURL(blob);
    addAsset({
      title: `${$("#episodeTitle").value || "Untitled Episode"} raw ${state.mode}`,
      type: "Raw",
      detail: `${state.mode.toUpperCase()} recording saved at ${formatTime()}`,
      url,
      size: blob.size,
    });
    runEditPipeline();
  });

  state.recorder.start();
  state.isRecording = true;
  recordButton.classList.add("recording");
  recordButton.setAttribute("aria-label", "Stop recording");
  setStatus("Recording", true);
}

function stopRecording() {
  if (!state.recorder || state.recorder.state === "inactive") return;
  state.recorder.stop();
  state.isRecording = false;
  recordButton.classList.remove("recording");
  recordButton.setAttribute("aria-label", "Start recording");
  setStatus("Processing");
}

function addAsset(asset) {
  state.assets.unshift({ id: crypto.randomUUID(), createdAt: new Date(), ...asset });
  renderAssets();
}

function renderAssets() {
  assetCount.textContent = `${state.assets.length} ${state.assets.length === 1 ? "file" : "files"}`;

  if (!state.assets.length) {
    assetList.innerHTML = '<div class="empty-state">Record or import media to start building the episode package.</div>';
    return;
  }

  assetList.innerHTML = state.assets
    .map(
      (asset) => `
        <article class="asset-item">
          <div>
            <strong>${escapeHtml(asset.title)}</strong>
            <span>${escapeHtml(asset.detail)} ${asset.size ? `- ${formatBytes(asset.size)}` : ""}</span>
          </div>
          <span class="asset-tag">${asset.type}</span>
        </article>
      `,
    )
    .join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}

function formatBytes(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

async function runEditPipeline() {
  const runId = ++state.editRun;
  const steps = $$("#pipelineSteps li");
  steps.forEach((step) => step.classList.remove("active", "done"));
  setStatus("Auto editing");

  for (const step of steps) {
    if (runId !== state.editRun) return;
    step.classList.add("active");
    await delay(650);
    step.classList.remove("active");
    step.classList.add("done");
  }

  const enabledSettings = $$("[data-setting]:checked").map((input) => input.dataset.setting);
  const title = $("#episodeTitle").value || "Untitled Episode";
  addAsset({
    title: `${title} finished package`,
    type: "Final",
    detail: `${state.mode.toUpperCase()} master with ${enabledSettings.join(", ")}`,
    size: 0,
  });
  packageSummary.textContent = `${title}: ${state.mode}, clips, captions, and platform exports`;
  publishStatus.textContent = "Finished package is ready for connected platform upload.";
  setStatus("Ready to publish");
  showToast("Finished episode package created.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toggleLive() {
  state.isLive = !state.isLive;
  if (state.isLive) {
    enableDevices().then(() => {
      liveButton.textContent = "End Live";
      setStatus(`${state.mode === "video" ? "Video" : "Audio"} live`, true);
      showToast("Live room started. Real RTMP/WebRTC routing comes next.");
    });
    return;
  }

  liveButton.textContent = "Go Live";
  setStatus("Live ended");
  showToast("Live room ended and archived to raw assets.");
  addAsset({
    title: `${$("#episodeTitle").value || "Untitled Episode"} live archive`,
    type: "Raw",
    detail: `${state.mode.toUpperCase()} live session archive at ${formatTime()}`,
    size: 0,
  });
}

function publishAll() {
  const selected = $$("#platformGrid input:checked").map((input) => input.parentElement.textContent.trim());
  if (!state.assets.some((asset) => asset.type === "Final")) {
    showToast("Create a finished package before uploading.");
    return;
  }
  publishStatus.textContent = `Queued upload to ${selected.join(", ")}.`;
  showToast(`Upload queue prepared for ${selected.length} platform${selected.length === 1 ? "" : "s"}.`);
}

$$(".mode-button").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.isRecording) return showToast("Stop recording before changing modes.");
    state.mode = button.dataset.mode;
    $$(".mode-button").forEach((item) => item.classList.toggle("active", item === button));
    stopDevices();
    setStatus(state.mode === "video" ? "Video mode" : "Audio mode");
  });
});

deviceButton.addEventListener("click", enableDevices);
recordButton.addEventListener("click", () => (state.isRecording ? stopRecording() : startRecording()));
liveButton.addEventListener("click", toggleLive);
$("#runEditButton").addEventListener("click", runEditPipeline);
$("#publishButton").addEventListener("click", publishAll);
$("#publishTopButton").addEventListener("click", publishAll);
$("#saveDraftButton").addEventListener("click", () => showToast("Draft saved locally for this prototype."));

importInput.addEventListener("change", (event) => {
  Array.from(event.target.files || []).forEach((file) => {
    addAsset({
      title: file.name,
      type: "Raw",
      detail: `Imported ${file.type.startsWith("audio") ? "audio" : "video"} footage`,
      size: file.size,
    });
  });
  if (event.target.files?.length) runEditPipeline();
  event.target.value = "";
});

renderAssets();
