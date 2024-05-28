const PerformDimScreen = (dimValue) => {
  let overlay = document.getElementById('dimOverlay');
    
  // If the overlay doesn't exist, create it
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'dimOverlay';
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(request);
  if (request.message === 'dim_screen') {
    const dimValue = request.dimPercent / 100;
    PerformDimScreen(dimValue);
    sendResponse({status: 'dimmed screen'});  // Send a response back to the sender

  } else if (request.message === 'start_countdown') {
    let countdown = request.countdown;
    let countdownElement = document.createElement('div');
    countdownElement.style.position = 'fixed';
    countdownElement.style.bottom = '20px';
    countdownElement.style.right = '20px';
    countdownElement.style.zIndex = 999999;
    countdownElement.style.fontSize = '20px';
    countdownElement.style.backgroundColor = 'white';
    countdownElement.style.padding = '10px';
    countdownElement.style.borderRadius = '5px';
    document.body.appendChild(countdownElement);

    let countdownInterval = setInterval(() => {
      countdownElement.textContent = countdown;
      countdown--;

      if (countdown < 0) {
        clearInterval(countdownInterval);
        document.body.removeChild(countdownElement);
      }
    }, 1000);
    
    sendResponse({status: 'count down started'});  // Send a response back to the sender
  }
  return true;
});