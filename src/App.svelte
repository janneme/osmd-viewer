<script>
  import { onMount } from "svelte";
  import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
  let titles = [];
  let selectedIndex = null;
  let ws;
  let pmwData = null;
  let pmwName = null;
  let mxlData = null;
  let mxlName = null;
  let pdfData = null;
  let pdfName = null;
  let localMxlData = null;
  let localMxlName = null;
  let details = null;
  let reconnectTimeout = null;
  let leftPanel = null;
  let rightPanel = null;
  let leftDiv;
  let rightDiv;
  let leftError = null;
  let rightError = null;
  import * as pdfjsLib from "pdfjs-dist/build/pdf";
  // Set workerSrc to local node_modules path using import.meta.url
  if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "./../node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).href;
  }

  function connectWS() {
    ws = new WebSocket("ws://localhost:5174");
    ws.onopen = () => {
      reconnectTimeout && clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "titles") {
        titles = msg.titles;
      } else if (msg.type === "details") {
        details = msg.details;
      } else if (msg.type === "pmw") {
        pmwData = msg.content;
        pmwName = msg.name || "composition.pmw";
      } else if (msg.type === "mxl") {
        mxlData = msg.content;
        mxlName = msg.name || "composition.mxl";
      } else if (msg.type === "pdf") {
        pdfData = msg.content;
        pdfName = msg.name || "composition.pdf";
      } else if (msg.type === "local_mxl") {
        localMxlData = msg.content;
        localMxlName = msg.name || "local.mxl";
      }
    };
    ws.onclose = () => {
      // Try to reconnect after 1s
      reconnectTimeout = setTimeout(connectWS, 1000);
    };
    ws.onerror = () => {
      ws.close();
    };
  }

  onMount(() => {
    connectWS();
  });

  function handleSelect(event) {
    selectedIndex =
      event.target.value !== "null" ? Number(event.target.value) : null;
    pmwData = null;
    pmwName = null;
    mxlData = null;
    pdfData = null;
    details = null;
    if (selectedIndex !== null) {
      ws?.send(JSON.stringify({ type: "getDetails", index: selectedIndex }));
    }
  }

  function downloadPMWFile() {
    if (!pmwData) return;
    const link = document.createElement("a");
    link.href = `data:application/octet-stream;base64,${pmwData}`;
    link.download = pmwName || "composition.pmw";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Helper to decode base64 to Uint8Array
  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function renderPdf(div, pdfData) {
    if (!pdfjsLib || !pdfData) return;
    div.innerHTML = "";
    const pdfBuffer = base64ToUint8Array(pdfData);
    const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    // Get container width
    const containerWidth = div.clientWidth || div.offsetWidth || 800;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      // Get unscaled viewport to determine original width
      const unscaledViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / unscaledViewport.width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.style.display = "block";
      canvas.style.margin = "0 auto 2em auto";
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      div.appendChild(canvas);
      const context = canvas.getContext("2d");
      await page.render({ canvasContext: context, viewport }).promise;
    }
  }

  $: if (leftPanel === "local_mxl" && localMxlData && leftDiv && !leftError) {
    leftDiv.innerHTML = "";
    try {
      const osmd = new OpenSheetMusicDisplay(leftDiv);
      osmd
        .load(localMxlData)
        .then(() => {
          osmd.Zoom = 0.6;
          osmd.render();
        })
        .catch((e) => {
          leftError = e.message || String(e);
        });
    } catch (e) {
      leftError = e.message || String(e);
    }
  }

  $: if (leftPanel === "remote_mxl" && mxlData && leftDiv && !leftError) {
    leftDiv.innerHTML = "";
    try {
      const osmd = new OpenSheetMusicDisplay(leftDiv);
      osmd
        .load(mxlData)
        .then(() => {
          osmd.Zoom = 0.6;
          osmd.render();
        })
        .catch((e) => {
          leftError = e.message || String(e);
        });
    } catch (e) {
      leftError = e.message || String(e);
    }
  }

  $: if (leftPanel === "remote_pdf" && pdfData && leftDiv) {
    renderPdf(leftDiv, pdfData);
  }

  $: if (
    rightPanel === "local_mxl" &&
    localMxlData &&
    rightDiv &&
    !rightError
  ) {
    rightDiv.innerHTML = "";
    try {
      const osmd = new OpenSheetMusicDisplay(rightDiv);
      osmd
        .load(localMxlData)
        .then(() => {
          osmd.Zoom = 0.6;
          osmd.render();
        })
        .catch((e) => {
          rightError = e.message || String(e);
        });
    } catch (e) {
      rightError = e.message || String(e);
    }
  }

  $: if (rightPanel === "remote_mxl" && mxlData && rightDiv && !rightError) {
    rightDiv.innerHTML = "";
    try {
      const osmd = new OpenSheetMusicDisplay(rightDiv);
      osmd
        .load(mxlData)
        .then(() => {
          osmd.Zoom = 0.6;
          osmd.render();
        })
        .catch((e) => {
          rightError = e.message || String(e);
        });
    } catch (e) {
      rightError = e.message || String(e);
    }
  }

  $: if (rightPanel === "remote_pdf" && pdfData && rightDiv) {
    renderPdf(rightDiv, pdfData);
  }
</script>

<main>
  <div class="header">
    <div class="header-panel file-selector">
      <div class="dropdown-container">
        <label for="composition-select">Composition</label>
        <select
          id="composition-select"
          on:change={handleSelect}
          bind:value={selectedIndex}
        >
          <option value={null} disabled selected>Select...</option>
          {#each titles as title, i}
            <option value={i}>{title}</option>
          {/each}
        </select>
      </div>
    </div>
    <div class="header-panel pane-mode-selector">
      <div class="dropdown-container">
        <label for="file-select">Left panel</label>
        <select
          id="left-panel-select"
          bind:value={leftPanel}
          on:change={() => {
            leftError = null;
          }}
        >
          <option value={null} disabled selected>Select content...</option>
          {#if localMxlData}
            <option value="local_mxl">Local MXL</option>
          {/if}
          {#if mxlData}
            <option value="remote_mxl">Remote MXL</option>
          {/if}
          {#if pdfData}
            <option value="remote_pdf">Remote PDF</option>
          {/if}
        </select>
      </div>
    </div>
    <div class="header-panel pane-mode-selector">
      <div class="dropdown-container">
        <label for="file-select">Right panel</label>
        <select
          id="right-panel-select"
          bind:value={rightPanel}
          on:change={() => {
            rightError = null;
          }}
        >
          <option value={null} disabled selected>Select content...</option>
          {#if localMxlData}
            <option value="local_mxl">Local MXL</option>
          {/if}
          {#if mxlData}
            <option value="remote_mxl">Remote MXL</option>
          {/if}
          {#if pdfData}
            <option value="remote_pdf">Remote PDF</option>
          {/if}
        </select>
      </div>
    </div>
    {#if pmwData}
      <div class="header-panel download-panel">
        <button class="pmw-btn" on:click={downloadPMWFile}>Download PMW</button>
      </div>
    {/if}
  </div>
  <div class="viewers">
    <div class="left">
      {#if leftPanel}
        {#if leftError}
          <div style="color:red;padding:1em;" class="error-message">
            {@html leftError}
          </div>
        {/if}
        <div class="viewer" bind:this={leftDiv}></div>
      {/if}
    </div>
    <div class="right">
      {#if rightPanel}
        {#if rightError}
          <div style="color:red;padding:1em;" class="error-message">
            {@html rightError}
          </div>
        {/if}
        <div class="viewer" bind:this={rightDiv}></div>
      {/if}
    </div>
  </div>
</main>

<style>
  .main {
    display: flex;
    flex-direction: column;
    align-items: top;
    height: 100vh;
    flex-grow: 1;
  }
  .header {
    width: 100%;
    display: flex;
    align-items: center;
    padding: 0.5rem 0;
    top: 0;
    box-sizing: border-box;
    height: 48px;
    background: black;
    color: white;
  }
  .header-panel {
    display: flex;
    align-items: center;
    height: 100%;
    margin: 0 0.5em;
  }
  .file-selector {
    flex: 1 1 0;
    justify-content: flex-start;
  }
  .viewers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    height: calc(100vh - 48px); /* header height */
  }
  .dropdown-container {
    width: 1fr;
    display: flex;
    flex-direction: row;
    align-items: flex-start;
  }
  .dropdown-container label {
    line-height: 2rem;
    font-size: 0.95rem;
    margin-right: 0.5rem;
  }
  .dropdown-container select {
    flex-grow: 1;
    padding: 0.5rem;
    font-size: 1rem;
  }
  .viewer {
    width: 100%;
    height: 100%;
    overflow: auto;
    position: relative;
  }
  .error-message {
    align-self: flex-start;
    margin-top: 0;
    margin-bottom: 1em;
    background: rgba(255,255,255,0.95);
    width: 100%;
  }
  .left,
  .right {
    height: 100%;
    overflow: auto;
    display: flex;
    flex-direction: column;
  }
  .right {
    border-left: 1px solid black;
  }
</style>
