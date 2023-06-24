import { invoke } from "@tauri-apps/api/tauri";
import { dialog } from "@tauri-apps/api";

let promptInputEl: HTMLTextAreaElement | null;
let filePathEl: HTMLInputElement | null;
let dirPathEl: HTMLInputElement | null;
let statusEl: HTMLElement | null;
let suffixEl: HTMLInputElement | null;
let importBt: HTMLButtonElement | null;

async function send_prompt() {
  if (promptInputEl) {
    if (promptInputEl.value == "") // exit if input field is empty
      return;

    let lines = promptInputEl.value.split('\n');
    lines = lines.filter(line => line.trim() !== ''); // filter empty lines
    for (let i = 0; i < lines.length; i++) {
      // —s
      lines[i] = lines[i] + " " + suffixEl?.value;
    }
    let full_text = lines.join('\n');

    await invoke("send_prompt", {
      prompt: full_text,
    });
    promptInputEl.value = "";
    promptInputEl.focus();
  }
}

async function send_prompt_file_path() {
  if (filePathEl) {
    await invoke("send_prompt_file_path", {
      path: filePathEl.value,
    });
    if (importBt) {
      importBt.disabled = true;
      filePathEl.value = "";
    }
  }
}

async function selectFile() {
  const result = await dialog.open({
    title: "Select a text prompt file",
    defaultPath: '~/Desktop/',
    multiple: false,
    directory: false,
    filters: [
      { name: 'Text Files', extensions: ['txt'] }
    ],
  });

  if (result && result.length > 0) {
    if (filePathEl) {
      filePathEl.value = result as any; // this suppresses type checking errors as vs code sees a non-existing mismatch here
    }
    if (importBt) { importBt.disabled = false;}
  }
}

async function selectFolder() {
  const result = await dialog.open({
    title: "Select Download Folder",
    defaultPath: '~/Downloads/',
    multiple: false,
    directory: true,
    filters: [
      { name: 'Only folders', extensions: [] }
    ],
  });

  if (result && result.length > 0) {
    if (dirPathEl) {
      await send_dir_path(result);
      await get_dir_path().then((path) => {
        if(path) dirPathEl!.value = path;
      });
    }
  }
}

async function get_dir_path() {
  let path = dirPathEl?.value;
  if (dirPathEl) {
    path = await invoke("get_dir_path");
  }
  return path;
}

async function send_dir_path(path: any) {
  if (dirPathEl) {
    await invoke("send_dir_path", {
      path: path,
    });
  }
}

async function open_dir() {
  let folder = dirPathEl?.value as String;
  await invoke("open_dir", {  path: folder } );
}

let lastStatus: String = "starting";
let lastCounter1: String = "0";
let lastCounter2: String = "0";
let lastCounter3: String = "0";

async function updateStatus() {
  let status: String = "starting";
  let counters: String = "0, 0, 0";
  try {
    [status, counters] = await invoke('get_status');
    console.log("counters: " + counters);

  } catch (error) {
    console.error('Error fetching status', error);
  }

  if (status) {
    console.log("counters: " + counters);
    [lastCounter1, lastCounter2, lastCounter3] = counters.split(',');
    lastStatus = status;
  } else {
    lastStatus = 'error';
  }

  if (statusEl) {
    statusEl.innerHTML = `<div class="status">Bot: ${lastStatus}</div><div class="counters">Jobs queued: ${lastCounter1}, running: ${lastCounter2}, done: ${lastCounter3}</div>`;
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startApiWithRetry(attempts: number, delayTime: number) {
  for(let i = 0; i < attempts; i++){
    const result = await invoke("start_api");
    console.log("attempt: " + i);
    if(result === 'started') {
      return; // API is ready, we can stop retrying
    }
    // Wait for some time before trying again
    await delay(delayTime);
  }
  throw new Error('API failed to start after ' + attempts + ' attempts');
}


window.addEventListener("DOMContentLoaded", () => {
  // needs to be invoked with a delay, otherwise the api is not ready yet
  // invoke("start_api").then(() => {});
  startApiWithRetry(5, 1000) // tries 5 times, waiting 2000 milliseconds between each attempt
      .then(() => {
        console.log("API started")

        // inject the path value to the input field
        dirPathEl = document.querySelector("#dir-path-input");
        get_dir_path().then((path) => {
          if(path) dirPathEl!.value = path;
        });

        promptInputEl = document.querySelector("#prompt-input");
        filePathEl = document.querySelector("#file-path-input");
        suffixEl = document.querySelector("#prompt-suffix")
        statusEl = document.querySelector("#footer");
        importBt = document.querySelector("#import-file-path");

        // document.querySelector("#prompt-form")?.addEventListener("submit", (e) => { e.preventDefault(); });
        document.querySelector("#send-prompt")?.addEventListener("click", send_prompt);
        document.querySelector("#select-file")?.addEventListener("click", selectFile);
        importBt?.addEventListener("click", send_prompt_file_path);
        document.querySelector("#submit-dir-path")?.addEventListener("click", selectFolder);
        document.querySelector("#open-dir")?.addEventListener("click", open_dir);
        document.querySelector('#openFileBtn')?.addEventListener('click', () => {document.getElementById('fileInput')?.click();});

        // setTimeout(() => setInterval(updateStatus, 1000), 2000);
        setInterval(updateStatus, 1000);

      })
      .catch(error => console.log(error.message));




});


