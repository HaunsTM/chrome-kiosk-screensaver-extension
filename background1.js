const State = Object.freeze({
  INITIAL: Symbol("initial"),
  ACTIVE: Symbol("active"),
  COUNTDOWN_COUNTER: Symbol("countdownCounter"),
  IDLE: Symbol("idle")
});

const settings = {
  screensaverPage : {
    urlStart: 'http://10.0.0.6:8123/local/screensaver/index.html#/screen-saver',
    regexMandatoryUrl: /(https?:[/]{2})10[.]0[.]0[.]6[:]8123+[/](?=.*screen-saver).*/g,
    dimPercent: 80   //fully dimmed
  },
  
  webPage : {
    urlStart: 'http://10.0.0.6:8123/lovelace/default_view',
    regexMandatoryUrl: /(https?:[/]{2})10[.]0[.]0[.]6[:]8123+[/](?!local[/]).*/g,
    dimPercent: 0   //no dim
  },
  noDim: 0,
  idleTime : 15,								// Idle time in seconds
  countDownStart: 5
};

const runtime = {
  screensaver : {
    urlCurrent : 'NO_URL',
    tabId : -1,
  },
  webPage: {
    urlCurrent : 'NO_URL',
    tabId : -1,
  },
  state : State.INITIAL,
  countdownBeforeIdlenessTimerId: null,
  countdownCounterTimerId: null,
  countdownCounterValue: -1
}

const WriteToLog = (logMessage) => {
  let currentDateTime = new Date();
  let year = currentDateTime.getFullYear();
  let month = String(currentDateTime.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed in JS
  let date = String(currentDateTime.getDate()).padStart(2, '0');
  let hours = String(currentDateTime.getHours()).padStart(2, '0');
  let minutes = String(currentDateTime.getMinutes()).padStart(2, '0');
  let seconds = String(currentDateTime.getSeconds()).padStart(2, '0');

  console.log(`[${year}-${month}-${date} ${hours}:${minutes}:${seconds} ] - ${logMessage}`);
}

const SetTabName = (tabId, newTabName) => {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function(newTitle) {
      document.title = newTitle;
    },
    args: [newTabName]
  });
}

function findTabId(regex) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      for(let i = 0; i < tabs.length; i++) {
        if (regex.test(tabs[i].url)) {
          WriteToLog(`found ${tabs[i].url}`)
          resolve(tabs[i].id);
          return;
        }
      }
      resolve(-1);  // Return -1 if no tabs match the URL
    });
  });
}

async function createTabAndGetId(url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({url: url}, (tab) => {
      resolve(tab.id);
    });
  });
}

async function OpenWebPageTab(targetUrl, targetUrlRegex) {
  const existingTabId = await findTabId(targetUrlRegex);
  if (existingTabId !== -1) {
    return existingTabId;
  } else {
    const newTabId =  await createTabAndGetId(targetUrl);
    
    return newTabId;
  }
}

async function EnsureOpenWebPagesAndUpdateTabIds() {
  const screensaverPageTabPromise = OpenWebPageTab(settings.screensaverPage.urlStart, settings.screensaverPage.regexMandatoryUrl);
  const webPageTabPromise = OpenWebPageTab(settings.webPage.urlStart, settings.webPage.regexMandatoryUrl);

  [runtime.screensaver.tabId, runtime.webPage.tabId] = await Promise.all([screensaverPageTabPromise, webPageTabPromise]);
  SetTabName(runtime.screensaver.tabId,runtime.screensaver.tabId);
  SetTabName(runtime.webPage.tabId,runtime.webPage.tabId);
}

function ChangeScreenBrightness(tabId, dimPercent) {
  const dimValue = dimPercent / 100;  

  chrome.tabs.get(tabId, function(tab) {
    if (tab.status === 'complete') {
      chrome.tabs.sendMessage(tabId, {
        message: 'change_screen_brightness',
        dimPercent: dimPercent
      }, function(response) {
        if (response) {
          WriteToLog('change_screen_brightness done');
        } else {
          WriteToLog('change_screen_brightness failed');
        }
      });
    }
  });
};


function PrintCountDownCounterValue(tabId, counterValue) {
  chrome.tabs.get(tabId, function(tab) {
    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError.message);
    } else if (tab.status === 'complete') {
      chrome.tabs.sendMessage(tabId, {
        message: 'countdown',
        counterValue: counterValue
      }, function(response) {
        if (response) {
          WriteToLog(`countdown performed: ${response}`);
        } else {
          WriteToLog(`countdown failed: ${response}`);
        }
      });
    }
  });
};

function RemoveCountDownCounter(tabId) {
  chrome.tabs.get(tabId, function(tab) {
    if (tab.status === 'complete') {
      chrome.tabs.sendMessage(tabId, {
        message: 'countDownRemove',
      }, function(response) {
        if (response) {
          WriteToLog(`countDownRemove performed: ${response}`);
        } else {
          WriteToLog(`countDownRemove failed`);
        }
      });
    }
  });
};

chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'idle') {
    runtime.state = State.IDLE;
  } else if (state === 'active') {
    runtime.state = State.ACTIVE;
  }
  ChangeState();
});

function StopAndResetTimerSafe(timerId) {
  if (timerId) {
    clearTimeout(timerId);
  }
}

async function ChangeState() {

  await EnsureOpenWebPagesAndUpdateTabIds();
  StopAndResetTimerSafe(runtime.countdownBeforeIdlenessTimerId);
  RemoveCountDownCounter(runtime.webPage.tabId);
  
  switch (runtime.state) {
    case State.INITIAL:
      runtime.state = State.ACTIVE;
      chrome.idle.setDetectionInterval(settings.idleTime);
      break;

    case State.ACTIVE:
      chrome.tabs.update(runtime.webPage.tabId, {active: true});      
      WriteToLog(`1`);

      ChangeScreenBrightness(runtime.screensaver.tabId, settings.noDim);
      StopAndResetTimerSafe(runtime.countdownCounterTimerId);
      
      runtime.countdownBeforeIdlenessTimerId = setTimeout(() => {
        runtime.state = State.COUNTDOWN_COUNTER;
        StopAndResetTimerSafe(runtime.countdownBeforeIdlenessTimerId);
        ChangeState();
      }, (settings.idleTime - settings.countDownStart) * 1000);
      break;

    case State.COUNTDOWN_COUNTER:
      runtime.countdownCounterValue = settings.countDownStart;
      WriteToLog(`2`);

      StopAndResetTimerSafe(runtime.countdownCounterTimerId);

      runtime.countdownCounterTimerId = setInterval(() => {
        runtime.countdownCounterValue--;
        WriteToLog(`2a`);
        PrintCountDownCounterValue(runtime.webPage.tabId, runtime.countdownCounterValue);
        if (runtime.countdownCounterValue <= 0) {
          WriteToLog(`2b`);
          StopAndResetTimerSafe(runtime.countdownCounterTimerId);
          RemoveCountDownCounter(runtime.webPage.tabId);
          WriteToLog(`2c`);
        }
      }, 1000); // 1000 milliseconds = 1 second     
      break;

    case State.IDLE:
        chrome.tabs.update(runtime.screensaver.tabId, {active: true});
        WriteToLog(`3`);
          
        StopAndResetTimerSafe(runtime.countdownCounterTimerId);
        RemoveCountDownCounter(runtime.webPage.tabId);
        ChangeScreenBrightness(runtime.screensaver.tabId, settings.screensaverPage.dimPercent);
      break;
  }
}

// start the extension
(async function() {
  await ChangeState();
})();