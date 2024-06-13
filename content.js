const dimOverlay = 'dimOverlay';

const EnterFullScreen = () => {
  if (request.message === "enter_full_screen") {
    var docElm = document.documentElement;
    if (docElm.requestFullscreen) {
      docElm.requestFullscreen();
    } else if (docElm.mozRequestFullScreen) { // Firefox
      docElm.mozRequestFullScreen();
    } else if (docElm.webkitRequestFullScreen) { // Chrome, Safari and Opera
      docElm.webkitRequestFullScreen();
    } else if (docElm.msRequestFullscreen) { // IE/Edge
      docElm.msRequestFullscreen();
    }
  }
}


const PerformDimScreen = (dimValue) => {
  let overlay = document.getElementById(dimOverlay);
  
  // If the overlay doesn't exist, create it
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = dimOverlay;
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = 999999;
    document.body.appendChild(overlay);
  }

  overlay.style.backgroundColor = `rgba(0, 0, 0, ${dimValue})`;
}

const PerformUndimScreen = () => {
  let overlay = document.getElementById(dimOverlay);
  
  // If the overlay exists, remove it
  if (overlay) {
    overlay.remove();
  }
}

const dimCountdownElement = 'dimCountdownElement';

const PrintCounterValue = (counterValue) => {
  let countdownElement = document.getElementById(dimCountdownElement);
  
  if (!countdownElement) {
    countdownElement = document.createElement('div');
    countdownElement.id = dimCountdownElement;
    countdownElement.style.position = 'fixed';
    countdownElement.style.top = '50%';
    countdownElement.style.left = '50%';
    countdownElement.style.transform = 'translate(-50%, -50%)';
    countdownElement.style.zIndex = 1000000;
    countdownElement.style.fontSize = '30rem';
    countdownElement.style.color = 'gray';
    document.body.appendChild(countdownElement);
  }
  
  countdownElement.textContent = counterValue;
}

const RemoveCounterValue = () => {
  let countdownElement = document.getElementById(dimCountdownElement);
  
  // If the element exists, remove it
  if (countdownElement) {
    countdownElement.remove();
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.category === 'backgroundToContentEvent') {
    switch (message.task) {
      case 'changeScreenBrightness':
        const dimValue = message.setPoint;
        if (dimValue > 0) {
          PerformDimScreen(dimValue);
          sendResponse({
            performed: `dimmed screen to ${dimValue}`,
            time: Date.now()
          });
        } else {
          PerformUndimScreen();
          sendResponse({
            performed: `undimmed screen`,
            time: Date.now()
          });
        }
        break;
      case 'countDown':
        let counterValue = message.setPoint;
        PrintCounterValue(counterValue);
        sendResponse({
          performed: `counted down ${counterValue}`,
          time: Date.now()
        });
        break;
      case 'countDownRemove':        
        RemoveCounterValue();
        sendResponse({
          performed: `counted removed`,
          time: Date.now()
        });
        break;
      default:
        sendResponse({
          performed: `task not recognized: ${message.task}`,
          time: Date.now()
        });
        break;
    }
  }
  return true;
});