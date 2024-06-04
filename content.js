const dimOverlay = 'dimOverlay';

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
  
  // If the overlay doesn't exist, create it
  if (!countdownElement) {
    countdownElement = document.createElement('div');
    countdownElement.id = dimCountdownElement;
    countdownElement.style.position = 'fixed';
    countdownElement.style.bottom = '20px';
    countdownElement.style.right = '20px';
    countdownElement.style.zIndex = 999999;
    countdownElement.style.fontSize = '20px';
    countdownElement.style.backgroundColor = 'white';
    countdownElement.style.padding = '10px';
    countdownElement.style.borderRadius = '5px';
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.message === 'change_screen_brightness') {
    const dimValue = request.dimPercent / 100;
    if (dimValue > 0) {
      PerformDimScreen(dimValue);
      sendResponse({status: `dimmed screen to ${dimValue} performed`});  // Send a response back to the sender
    } else {
      PerformUndimScreen();
      sendResponse({status: `undimmed screen performed`});  // Send a response back to the sender
    }
  }
  else if (request.message === 'countdown') {
    let countdown = request.counterValue;
    PrintCounterValue(countdown);
    sendResponse({status: `count down ${countdown} performed`});  // Send a response back to the sender
  }
  else if (request.message === 'countdownRemove') {
    RemoveCounterValue();
    sendResponse({status: `count down removed performed`});  // Send a response back to the sender
  }
  return true;
});