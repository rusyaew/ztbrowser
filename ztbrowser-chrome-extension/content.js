  const storage = chrome.storage;
  storage.local.set({'workingEnv': false})
  storage.local.set({'codeValidated': false})
  function updateIcon(locked) {
    if (locked) chrome.runtime.sendMessage({locked: true});
    else chrome.runtime.sendMessage({locked: false});
    console.log('Validation status: ', locked)
  }
  

  function validateCode() {
    var nonce = Math.floor(Math.random() * 1000000000);
    nonce = 'some nonce';
    const endpoint = window.location.href + 'attestation';
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({NONCE: 'some nonce'}));
    xhr.onreadystatechange = function () {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          const { IAS_REPORT, IAS_SIG_HEX, CODEEXP } = response;
          console.log('Server provided hash:', CODEEXP)
          const xhr2 = new XMLHttpRequest();
          xhr2.open('POST', 'http://localhost:3000/verify');
          xhr2.setRequestHeader('Content-Type', 'application/json');
          xhr2.send(JSON.stringify({
            IAS_REPORT: IAS_REPORT,
            IAS_SIG_HEX: IAS_SIG_HEX,
            CODEEXP: CODEEXP,
            NONCE: nonce
          }));
          xhr2.onreadystatechange = function () {
            if (xhr2.readyState === XMLHttpRequest.DONE) {
              if (xhr2.status === 200) {
                const response2 = JSON.parse(xhr2.responseText);
                console.log(response2);
                if (response2.codeValidated && response2.workingEnv) {
                  console.log('Validation aquired. Hash', CODEEXP, 'confirmed')
                  console.log('SGX proof verified.', String(IAS_SIG_HEX).slice(0, 5),'....',String(IAS_SIG_HEX).slice(-5,-1), '. Your data is in a black box.')
                } else if (response2.codeValidated) {
                  console.log('SGX proof verified.', IAS_SIG_HEX, '. Your data is safe, but code is not verified')
                }

                storage.local.set({'workingEnv': response2.workingEnv})
                storage.local.set({'codeValidated': response2.codeValidated})
                updateIcon(response2.codeValidated && response2.workingEnv);
              } else {
                console.error('Error validating code:', xhr2.statusText);
                storage.local.set({'workingEnv': false})
                storage.local.set({'codeValidated': false})
                updateIcon(false);
              }
            }
          };
        } else {
          updateIcon(false);
        }
      }
    };
  }

  document.addEventListener('DOMContentLoaded', function() {
    validateCode();
  });
  
  window.addEventListener('beforeunload', function() {
    updateIcon(false);
    validateCode();
  });

  window.addEventListener('unload', function() {
    updateIcon(false);
    validateCode();
    
  });

  
  validateCode();
  setInterval(validateCode, 60000);
  