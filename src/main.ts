import { invoke } from "@tauri-apps/api/tauri";
import { dialog } from "@tauri-apps/api";

let promptInputEl: HTMLTextAreaElement | null;
let filePathEl: HTMLInputElement | null;
let dirPathEl: HTMLInputElement | null;
let dirPathEl2: HTMLInputElement | null;
let statusEl: HTMLElement | null;
let suffixEl: HTMLInputElement | null;
let suffixEl2: HTMLInputElement | null;
let repeatEl: HTMLInputElement | null;

// submit buttons
let importBt: HTMLButtonElement | null;
let sendBt: HTMLButtonElement | null;

// options
let optionVersion: HTMLSelectElement | null;
let optionStyling: HTMLSelectElement | null;
let optionChaos: HTMLSelectElement | null;
let optionRatio: HTMLSelectElement | null;
let optionVersion2: HTMLSelectElement | null;
let optionStyling2: HTMLSelectElement | null;
let optionChaos2: HTMLSelectElement | null;
let optionRatio2: HTMLSelectElement | null;

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

// settings
let settingsDiscordBotToken: HTMLInputElement | null;
let settingsDiscordAccountToken: HTMLInputElement | null;
let settingsDiscordServerId: HTMLInputElement | null;
let settingsDiscordChannelId: HTMLInputElement | null;
let settingsDiscordUsername: HTMLInputElement | null;
let settingsDiscordSubscriptionType: HTMLSelectElement | null;
let saveSettings: HTMLButtonElement | null;
let restoreSettings: HTMLButtonElement | null;
let currentBotToken = "";
let currentAccountToken= "";
let currentServerId = "";
let currentChannelId = "";
let currentUsername = "";
let currentSubscriptionType = "";


async function send_prompt() {
  if (promptInputEl) {
    if (promptInputEl.value == "") // exit if input field is empty
      return;

    let repetitions = 1;
    if (repeatEl && repeatEl.value != "")
        repetitions = parseInt(repeatEl.value, 10);

    let repeatedLines: string[] = [];

    let lines = promptInputEl.value.split('\n');
    lines = lines.filter(line => line.trim() !== ''); // filter empty lines

    for (let i = 0; i < lines.length; i++) {
      for(let j = 0; j < repetitions; j++){
          // —s
          let line = lines[i] + " " + suffixEl?.value;
          repeatedLines.push(line);
      }
    }

    let full_text = repeatedLines.join('\n');

    await invoke("send_prompt", {
      prompt: full_text,
    });
    promptInputEl.value = "";
    promptInputEl.focus();
  }
}

async function send_prompt_file_path() {
    let suffixText = "";
    if (suffixEl)
        suffixText = suffixEl.value;

    if (filePathEl) {
        await invoke("send_prompt_file_path_with_suffix", {
            path: filePathEl.value,
            suffix: suffixText
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
        if(path) dirPathEl2!.value = path;
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

function updateSuffix() {
    let suffixText = "";
    suffixText += (optionVersion?.value ?? '') + (optionStyling?.value ?? '') + (optionChaos?.value ?? '') + (optionRatio?.value ?? '');
    if (suffixEl)
        suffixEl.value = suffixText;
}

function updateSuffix2() {
    let suffixText2 = "";
    suffixText2 += (optionVersion2?.value ?? '') + (optionStyling2?.value ?? '') + (optionChaos2?.value ?? '') + (optionRatio2?.value ?? '');
    if (suffixEl2)
        suffixEl2.value = suffixText2;
}


let replacements: { [key: string]: string } = {
    "“": "\"",  // Left double quotation mark
    "”": "\"",  // Right double quotation mark
    "‘": "'",   // Left single quotation mark
    "’": "'",   // Right single quotation mark
    "–": "-",   // En dash
    "—": "--",  // Em dash
    "…": "...", // Horizontal ellipsis
    "©": "(c)", // Copyright symbol
    "®": "(R)", // Registered trademark symbol
    "™": "(TM)", // Trademark symbol
    "€": "EUR", // Euro sign
    "£": "GBP", // Pound sign
    "¥": "JPY", // Yen sign
    "¢": "c",   // Cent sign
    "§": "Sec", // Section sign
    "¶": "P",   // Pilcrow sign
    "°": "deg", // Degree symbol
    "•": "*",   // Bullet
};

function onPromptChange() {
    if (sendBt == null || promptInputEl == null)
        return;

    if (promptInputEl.value == "")
        sendBt.disabled = true;
    else
    {
        sendBt.disabled = false;
        // promptInputEl.value = promptInputEl.value.replace(/—/g, "--");
        for (let char in replacements) {
            let regex = new RegExp(char, "g");
            promptInputEl.value = promptInputEl.value.replace(regex, replacements[char]);
        }
        promptInputEl.selectionStart = promptInputEl.selectionEnd = promptInputEl.value.length;

    }

}


function onRepeatChange(){
    if (repeatEl == null)
        return;

    repeatEl.value = repeatEl.value.replace(/[^0-9]/g, '');
}

function preventEmptyRepeat(){
    if (repeatEl == null)
        return;

    if (repeatEl.value == "")
        repeatEl.value = "1";
}


async function saveSettingsF() {
    console.log("saveSettings");
    if (!settingsDiscordBotToken ||
    !settingsDiscordAccountToken ||
    !settingsDiscordServerId ||
    !settingsDiscordChannelId ||
    !settingsDiscordUsername ||
    !settingsDiscordSubscriptionType
)
    return;

    // take all setting input elements
    let discord_bot_token = settingsDiscordBotToken.value;
    let discord_main_token = settingsDiscordAccountToken.value;
    let discord_server_id = settingsDiscordServerId.value;
    let discord_channel_id = settingsDiscordChannelId.value;
    let discord_username = settingsDiscordUsername.value;
    let jobmanager_concurrent_jobs_limit = settingsDiscordSubscriptionType.value;

    let values = {
      discord_bot_token: discord_bot_token,
      discord_main_token: discord_main_token,
      discord_server_id: discord_server_id,
      discord_channel_id: discord_channel_id,
      discord_username: discord_username,
      jobmanager_concurrent_jobs_limit: jobmanager_concurrent_jobs_limit
    };

    await invoke('write_settings', {settings: values})

    // if ok, store all values to _current_:
    currentBotToken = settingsDiscordBotToken.value;
    currentAccountToken = settingsDiscordAccountToken.value;
    currentServerId = settingsDiscordServerId.value;
    currentChannelId = settingsDiscordChannelId.value;
    currentUsername = settingsDiscordUsername.value;
    currentSubscriptionType = settingsDiscordSubscriptionType.value;

    if (saveSettings)
        saveSettings.disabled = true;
}

function restoreSettingsF() {
    if (!settingsDiscordBotToken ||
        !settingsDiscordAccountToken ||
        !settingsDiscordServerId ||
        !settingsDiscordChannelId ||
        !settingsDiscordUsername ||
        !settingsDiscordSubscriptionType
    )
        return;

    settingsDiscordBotToken.value = currentBotToken;
    settingsDiscordAccountToken.value = currentAccountToken;
    settingsDiscordServerId.value = currentServerId;
    settingsDiscordChannelId.value = currentChannelId;
    settingsDiscordUsername.value = currentUsername;
    settingsDiscordSubscriptionType.value = currentSubscriptionType;

    if (saveSettings)
        saveSettings.disabled = true;
}

function settingsEdited(){
    console.log("settingsEdited");
    if (!saveSettings)
        return;
    //     !settingsDiscordBotToken ||
    //     !settingsDiscordAccountToken ||
    //     !settingsDiscordServerId ||
    //     !settingsDiscordChannelId ||
    //     !settingsDiscordUsername ||
    //     !settingsDiscordSubscriptionType)
    //     return;

    // enable/disable the saveSettings button
    if (settingsDiscordBotToken?.value == "" ||
        settingsDiscordAccountToken?.value == "" ||
        settingsDiscordServerId?.value == "" ||
        settingsDiscordChannelId?.value == "" ||
        settingsDiscordUsername?.value == "" ||
        settingsDiscordSubscriptionType?.value == "" ||
        (settingsDiscordBotToken?.value == currentBotToken &&
            settingsDiscordAccountToken?.value == currentAccountToken &&
            settingsDiscordServerId?.value == currentServerId &&
            settingsDiscordChannelId?.value == currentChannelId &&
            settingsDiscordUsername?.value == currentUsername &&
            settingsDiscordSubscriptionType?.value == currentSubscriptionType)
    )
        saveSettings.disabled = true;

    else
        saveSettings.disabled = false;
}

async function readSettings() {
    if (!settingsDiscordBotToken ||
        !settingsDiscordAccountToken ||
        !settingsDiscordServerId ||
        !settingsDiscordChannelId ||
        !settingsDiscordUsername ||
        !settingsDiscordSubscriptionType
    )
        return;

    let discord_bot_token: string = "";
    let discord_main_token: string = "";
    let discord_server_id: string = "";
    let discord_channel_id: string = "";
    let discord_username: string = "";
    let jobmanager_concurrent_jobs_limit: string = "";
    try {
        const settingsJson = await invoke('read_settings');
        let settings;
        if (typeof settingsJson === "string")
            settings = JSON.parse(settingsJson);

        // Now `settings` is a JavaScript object, you can access individual values like this:
        discord_bot_token = settings.discord_bot_token;
        discord_main_token = settings.discord_main_token;
        discord_server_id = settings.discord_server_id;
        discord_channel_id = settings.discord_channel_id;
        discord_username = settings.discord_username;
        jobmanager_concurrent_jobs_limit = settings.jobmanager_concurrent_jobs_limit;

    } catch (error) {
        console.error('Error fetching settings', error);
    }

    settingsDiscordBotToken.value = discord_bot_token;
    settingsDiscordAccountToken.value = discord_main_token;
    settingsDiscordServerId.value = discord_server_id;
    settingsDiscordChannelId.value = discord_channel_id;
    settingsDiscordUsername.value = discord_username;
    settingsDiscordSubscriptionType.value = jobmanager_concurrent_jobs_limit;

    currentBotToken = settingsDiscordBotToken.value;
    currentAccountToken = settingsDiscordAccountToken.value;
    currentServerId = settingsDiscordServerId.value;
    currentChannelId = settingsDiscordChannelId.value;
    currentUsername = settingsDiscordUsername.value;
    currentSubscriptionType = settingsDiscordSubscriptionType.value;

    if (saveSettings)
        saveSettings.disabled = true;
}

window.addEventListener("DOMContentLoaded", () => {
  console.log("loaded");

  // check for the first run (settings completed)
  // if it's first run (or not completed setup)
    // disable menu
    // switch to settings page
    // on save do alert about restart
    // fake take time (10s)
    // quit (restart if possible)
  // if they are ok, continue to start api

  startApiWithRetry(5, 1000) // tries 5 times, waiting 2000 milliseconds between each attempt
      .then(() => {
        hideOverlay();
        console.log("API started")

        // inject the path value to the input field
        dirPathEl = document.querySelector("#dir-path-input");
        dirPathEl2 = document.querySelector("#dir-path-input2");
        get_dir_path().then((path) => {
          if(path) dirPathEl!.value = path;
          if(path) dirPathEl2!.value = path;
        });

        // main elements
        promptInputEl = document.querySelector("#prompt-input");
        filePathEl = document.querySelector("#file-path-input");
        suffixEl = document.querySelector("#prompt-suffix");
        suffixEl2 = document.querySelector("#prompt-suffix2");
        statusEl = document.querySelector("#footer");
        importBt = document.querySelector("#import-file-path");
        sendBt = document.querySelector("#send-prompt");
        repeatEl = document.querySelector("#repeat-number");

        // side menu items
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

        menuWelcome?.addEventListener("click", (event) => switchPage(event, pageWelcome));
        menuSendPrompts?.addEventListener("click", (event) => switchPage(event, pageSendPrompts));
        menuSendFile?.addEventListener("click", (event) => switchPage(event, pageSendFile));
        menuSettings?.addEventListener("click", (event) => switchPage(event, pageSettings));
        menuInstructions?.addEventListener("click", (event) => switchPage(event, pageInstructions));

        // main functions
        sendBt?.addEventListener("click", send_prompt);
        promptInputEl?.addEventListener("input", onPromptChange);
        repeatEl?.addEventListener("input", onRepeatChange);
        repeatEl?.addEventListener("change", preventEmptyRepeat);
        document.querySelector("#select-file")?.addEventListener("click", selectFile);
        importBt?.addEventListener("click", send_prompt_file_path);
        document.querySelector("#submit-dir-path")?.addEventListener("click", selectFolder);
        document.querySelector("#open-dir")?.addEventListener("click", open_dir);
        document.querySelector("#submit-dir-path2")?.addEventListener("click", selectFolder);
        document.querySelector("#open-dir2")?.addEventListener("click", open_dir);
        // document.querySelector('#openFileBtn')?.addEventListener('click', () => {document.getElementById('fileInput')?.click();});

        // options insert to suffix
        optionVersion = document.querySelector("#mj-version");
        optionStyling = document.querySelector("#mj-styling");
        optionChaos = document.querySelector("#mj-chaos");
        optionRatio = document.querySelector("#mj-ratio");
        optionVersion2 = document.querySelector("#mj-version2");
        optionStyling2 = document.querySelector("#mj-styling2");
        optionChaos2 = document.querySelector("#mj-chaos2");
        optionRatio2 = document.querySelector("#mj-ratio2");

        optionVersion?.addEventListener("change", updateSuffix);
        optionStyling?.addEventListener("change", updateSuffix);
        optionChaos?.addEventListener("change", updateSuffix);
        optionRatio?.addEventListener("change", updateSuffix);
        optionVersion2?.addEventListener("change", updateSuffix2);
        optionStyling2?.addEventListener("change", updateSuffix2);
        optionChaos2?.addEventListener("change", updateSuffix2);
        optionRatio2?.addEventListener("change", updateSuffix2);
        updateSuffix();
        updateSuffix2();

        // settings page
        settingsDiscordBotToken = document.querySelector("#settings-discord-bot-token");
        settingsDiscordAccountToken = document.querySelector("#settings-discord-account-token");
        settingsDiscordServerId = document.querySelector("#settings-discord-server-id");
        settingsDiscordChannelId = document.querySelector("#settings-discord-channel-id");
        settingsDiscordUsername = document.querySelector("#settings-discord-username");
        settingsDiscordSubscriptionType = document.querySelector("#settings-discord-subscription-type");
        saveSettings = document.querySelector("#save-settings");
        restoreSettings = document.querySelector("#restore-settings");

        settingsDiscordBotToken?.addEventListener("input", settingsEdited);
        settingsDiscordAccountToken?.addEventListener("input", settingsEdited);
        settingsDiscordServerId?.addEventListener("input", settingsEdited);
        settingsDiscordChannelId?.addEventListener("input", settingsEdited);
        settingsDiscordUsername?.addEventListener("input", settingsEdited);
        settingsDiscordSubscriptionType?.addEventListener("input", settingsEdited);
        saveSettings?.addEventListener("click", saveSettingsF);
        restoreSettings?.addEventListener("click", restoreSettingsF);
        readSettings();



        // setTimeout(() => setInterval(updateStatus, 1000), 2000);
        setInterval(updateStatus, 1000);

      })
      .catch(error => console.log(error.message));




});


