/*
 * Show options page after installation
 */
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason == 'install') {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            self.open(chrome.runtime.getURL('options/options.html'));
        }
    }
});


var API;

Config.getAll().then(config => {
    if (config.userName && config.passWord) {
        initApiClient(config.userName,config.passWord);
    }
});

function initApiClient(username, password) {
    API = new DeathByCaptcha({
        username: username,
        password: password,
        service: "api.dbcapi.me/api",
        defaultTimeout: 300,
        pollingInterval: 5,
    });
}


/*
 * Manage message passing
 */
chrome.runtime.onConnect.addListener(function(port) {

    //console.log(port.name + ' connected');
    //console.log(port);

    port.onMessage.addListener(function (msg) {
        //console.log(port.name + ' send message: ', msg);

        let messageHandler = port.name + '_' + msg.action;

        if (self[messageHandler] === undefined) return;

        self[messageHandler](msg)
            .then((response) => {
                //console.log('response to [' + messageHandler + ']: ', response);
                port.postMessage({action: msg.action, request: msg, response});
            })
            .catch(error => {
                //console.log('return error to [' + messageHandler + ']: ', error.message);
                port.postMessage({action: msg.action, request: msg, error: error.message});
            });
    });

});


/*
 * Message handlers
 */

async function popup_login(msg) {
    initApiClient(msg.username, msg.password);

    let balance = await API.balance();

    info = {
        valute: "USD",
        balance: balance,
        username: msg.username
    }

    Config.set({
        userName: msg.username,
        passWord: msg.password,
        valute: "USD"
    });

    return info;
}

async function popup_logout(msg) {
    Config.set({userName: null,
                passWord: null});

    return {};
}

async function popup_getAccountInfo(msg) {
    let config = await Config.getAll();

    if (!config.userName || !config.passWord) throw new Error("No credentials");

    let balance = await API.balance();

    info = {
        valute: "USD",
        balance: balance,
        username: config.userName
    }
    
    return info;
}

async function content_solve(msg) {
    return await API[msg.captchaType](msg.params);
}
