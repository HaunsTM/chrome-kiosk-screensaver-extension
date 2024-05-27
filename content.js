chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(request);
  if (request.message === 'dim_screen') {
    const dimValue = request.dimPercent / 100;
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = 999999;
    overlay.style.backgroundColor = `rgba(0, 0, 0, ${dimValue})`;
    
    document.body.appendChild(overlay);
    sendResponse({status: 'success'});  // Send a response back to the sender
  }
  return true;  // Indicate that the response will be sent asynchronously
});