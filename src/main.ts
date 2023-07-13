import { invoke } from "@tauri-apps/api/tauri";
import { dialog } from "@tauri-apps/api";

let promptInputEl: HTMLTextAreaElement | null;
let filePathEl: HTMLInputElement | null;
let dirPathEl: HTMLInputElement | null;
let statusEl: HTMLElement | null;
let suffixEl: HTMLInputElement | null;
let importBt: HTMLButtonElement | null;

// menu items
let menuWelcome: HTMLLIElement | null;
let menuSendPrompts: HTMLLIElement | null;
let menuSendFile: HTMLLIElement | null;
let menuInstructions: HTMLLIElement | null;
let menuSettings: HTMLLIElement | null;
let menuItems: Array<HTMLLIElement | null>;

// page items
let pageWelcome: HTMLDivElement | null;
let pageSendPrompts: HTMLDivElement | null;
let pageSendFile: HTMLDivElement | null;
let pageInstructions: HTMLDivElement | null;
let pageSettings: HTMLDivElement | null;
let pageItems: Array<HTMLDivElement | null>;

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
    console.log("start select file");
    try {
        const result = await dialog.open({
            title: "Select a text prompt file",
            defaultPath: '~/Desktop/',
            multiple: false,
            directory: false,
            filters: [
                { name: 'Text Files', extensions: ['txt'] }
            ],
        });
        console.log(result);
        if (result && result.length > 0) {
            if (filePathEl) {
                filePathEl.value = result as any; // this suppresses type checking errors as vs code sees a non-existing mismatch here
            }
            if (importBt) { importBt.disabled = false;}
        }
    } catch (err) {
        console.error("An error occurred: ", err);
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
    // console.log("counters: " + counters);

  } catch (error) {
    console.error('Error fetching status', error);
  }

  if (status) {
    // console.log("counters: " + counters);
    [lastCounter1, lastCounter2, lastCounter3] = counters.split(',');
    lastStatus = status;
  } else {
    lastStatus = 'error';
  }

  if (statusEl) {
    statusEl.innerHTML = `<div class="status">Status: ${lastStatus}</div><div class="counters">Queued: ${lastCounter1}, Running: ${lastCounter2}, Done: ${lastCounter3}</div>`;
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

function hideOverlay() {
  const overlay = document.getElementById("overlay");
  if (overlay)
    overlay.style.display = 'none';
}

function pageHideAll() {
  pageItems.forEach((pageItem) => {
    if (pageItem !== null) {
      pageItem.style.display = 'none';
    }
  });
}

function menuDeselectAll() {
  menuItems.forEach((menuItem) => {
    if (menuItem !== null) {
      menuItem.classList.remove('selected');
    }
  });
}

function switchPage(event: Event, element: HTMLElement | null) {
  let menuItem = event.target as HTMLLIElement;
  if (menuItem) {
    menuDeselectAll();
    menuItem.classList.add('selected');
  }

  pageHideAll();
  if (element)
    element.style.display = 'block';
}

window.addEventListener("DOMContentLoaded", () => {
  console.log("loaded");

  startApiWithRetry(5, 1000) // tries 5 times, waiting 2000 milliseconds between each attempt
      .then(() => {
        hideOverlay();
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

        // left menu items
        menuWelcome = document.querySelector("#menu-welcome");
        menuSendPrompts = document.querySelector("#menu-send-prompts");
        menuSendFile = document.querySelector("#menu-send-file");
        menuSettings = document.querySelector("#menu-settings");
        menuInstructions = document.querySelector("#menu-instructions");
        menuItems = [menuWelcome, menuSendPrompts, menuSendFile, menuInstructions, menuSettings];

        // page items
        pageWelcome = document.querySelector("#page-welcome");
        pageSendPrompts = document.querySelector("#page-send-prompts");
        pageSendFile = document.querySelector("#page-send-file");
        pageSettings = document.querySelector("#page-settings");
        pageInstructions = document.querySelector("#page-instructions");
        pageItems = [pageWelcome, pageSendPrompts, pageSendFile, pageInstructions, pageSettings];

        // document.querySelector("#menu-welcome")?.addEventListener("click", menuWelcomeF);
        menuWelcome?.addEventListener("click", (event) => switchPage(event, pageWelcome));
        menuSendPrompts?.addEventListener("click", (event) => switchPage(event, pageSendPrompts));
        menuSendFile?.addEventListener("click", (event) => switchPage(event, pageSendFile));
        menuSettings?.addEventListener("click", (event) => switchPage(event, pageSettings));
        menuInstructions?.addEventListener("click", (event) => switchPage(event, pageInstructions));

        // main functions
        document.querySelector("#send-prompt")?.addEventListener("click", send_prompt);
        document.querySelector("#select-file")?.addEventListener("click", selectFile);
        importBt?.addEventListener("click", send_prompt_file_path);
        document.querySelector("#submit-dir-path")?.addEventListener("click", selectFolder);
        document.querySelector("#open-dir")?.addEventListener("click", open_dir);
        // document.querySelector('#openFileBtn')?.addEventListener('click', () => {document.getElementById('fileInput')?.click();});

        // setTimeout(() => setInterval(updateStatus, 1000), 2000);
        setInterval(updateStatus, 1000);

      })
      .catch(error => console.log(error.message));




});


