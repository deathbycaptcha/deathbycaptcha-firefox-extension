class DeathByCaptcha {

    constructor(options) {

        let defaultOptions = {
            username: "",
            password: "",
            service: "api.dbcapi.me/api",
            defaultTimeout: 120,
            recaptchaTimeout: 600,
            pollingInterval: 10,
        }

        for (let key in defaultOptions) {
            this[key] = options[key] === undefined ? defaultOptions[key] : options[key];
        }
    }

    normal(captcha) {
        captcha.captchafile = "base64:" + captcha.body;

        return this.solve(captcha, {timeout: this.defaultTimeout});
    }

    recaptcha(captcha) {
        console.log(captcha);
        let data = {
            "type": 4,
        }
        if (captcha.version && captcha.version === 'v3') {
            data.type = 5;
        }
        let token_params = {
            "pageurl": captcha.url,
            "googlekey": captcha.sitekey
        }
        if (captcha["proxy"] !== undefined) {
            token_params["proxy"] = captcha.proxy.uri;
            token_params["proxytype"] = captcha.proxy.type;
        }

        if (data.type === 5) {
            token_params["action"] = captcha.action;
            token_params["min_score"] = captcha.score;
        }
        data["token_params"] = JSON.stringify(token_params);
        console.log(token_params);
        return this.solve(data, {timeout: this.recaptchaTimeout});
    }

    geetest(captcha) {
        let data = {
            "type": 8,
        }
        let geetest_params = {
            "pageurl": captcha.url,
            "gt": captcha.gt,
            "challenge": captcha.challenge
        }
        if (captcha["proxy"] !== undefined) {
            geetest_params["proxy"] = captcha.proxy.uri;
            geetest_params["proxytype"] = captcha.proxy.type;
        }
        data["geetest_params"] = JSON.stringify(geetest_params);

        return this.solve(data);
    }

    geetest_v4(captcha) {
        let data = {
            "type": 9,
        }
        let geetest_params = {
            "pageurl": captcha.url,
            "captcha_id": captcha.captchaId
        }
        if (captcha["proxy"] !== undefined) {
            geetest_params["proxy"] = captcha.proxy.uri;
            geetest_params["proxytype"] = captcha.proxy.type;
        }
        data["geetest_params"] = JSON.stringify(geetest_params);
        return this.solve(data);
    }

    // hcaptcha(captcha) {
    //     let data = {
    //         "type": 7,
    //     }
    //     let hcaptcha_params = {
    //         "pageurl": captcha.url,
    //         "sitekey": captcha.sitekey
    //     }
    //     if (captcha["proxy"] !== undefined) {
    //         hcaptcha_params["proxy"] = captcha.proxy.uri;
    //         hcaptcha_params["proxytype"] = captcha.proxy.type;
    //     }
    //     data["hcaptcha_params"] = JSON.stringify(hcaptcha_params);
    //     return this.solve(data);
    // }

    // arkoselabs(captcha) {
    //     let data = {
    //         "type": 6,
    //     }
    //     let funcaptcha_params = {
    //         "pageurl": captcha.pageurl,
    //         "publickey": captcha.publickey
    //     }
    //     if (captcha["proxy"] !== undefined) {
    //         funcaptcha_params["proxy"] = captcha.proxy.uri;
    //         funcaptcha_params["proxytype"] = captcha.proxy.type;
    //     }
    //     data["funcaptcha_params"] = JSON.stringify(funcaptcha_params);
    //     return this.solve(data);
    // }

    async solve(captcha, waitOptions) {
        let result = {};

        result.captchaId = await this.send(captcha);

        result.code = await this.waitForResult(result.captchaId, waitOptions);

        return result;
    }

    async send(captcha) {
        let response = await this.in(captcha);

        return response.captcha;
    }

    async waitForResult(id, waitOptions) {
        if (!waitOptions) {
            waitOptions = {
                timeout: this.defaultTimeout,
                pollingInterval: this.pollingInterval,
            }
        }

        let startedAt = this.getTime();

        let timeout = waitOptions.timeout === undefined ? this.defaultTimeout : waitOptions.timeout;
        let pollingInterval = waitOptions.pollingInterval === undefined ? this.pollingInterval : waitOptions.pollingInterval;

        while (true) {
            if (this.getTime() - startedAt < timeout) {
                await new Promise(resolve => setTimeout(resolve, pollingInterval * 1000));
            } else {
                break;
            }

            try {
                let code = await this.getResult(id);
                if (code.text) return code.text;
            } catch (e) {
                throw e;
            }
        }

        throw new Error('Timeout ' + timeout + ' seconds reached');
    }

    getTime() {
        return parseInt(Date.now() / 1000);
    }

    async getResult(id) {
        try {
            return await this.res('/captcha/' + id, {});
        } catch (e) {
            if (e.message == "CAPCHA_NOT_READY") {
                return null;
            }

            throw e;
        }
    }

    async balance() {
        let response = await this.res('/', {});

        return parseFloat(response.balance/100).toFixed(2);
    }

    async report(id, isCorrect)
    {
        let action = isCorrect ? "reportgood" : "reportbad";

        return await this.res({action, id});
    }


    async in(captcha, files) {
        return await this.request('POST', '/captcha', captcha);
    }

    async res(cmd, data) {
        return await this.request('GET', cmd, data);
    }

    async request(method, cmd, data) {
        data.username = this.username;
        data.password = this.password;

        let url = "http://" + this.service + cmd;

        let options = {
            method: method,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'DBC/NodeJS v4.6'
            }
        }

        if (method === 'GET') {
            let kv = [];

            for (let key in data) {
                kv.push(key + '=' + encodeURIComponent(data[key]));
            }

            url += '?' + kv.join('&');
        } else {
            let formData = new FormData();

            for (let key in data) {
                formData.append(key, data[key]);
            }

            options.body = formData;
        }

        let response;
        try {
            response = await fetch(url, options);
        } catch (e) {
            throw new Error("Connection Error");
        }
        console.log(response)
        console.log(response.status)

        if (!response.ok) {
            switch (response.status) {
                case 303:
                    break;
                case 403:
                    throw new Error("Access denied, please check your credentials and/or balance")
                    break;
                case 400:
                case 413:
                    throw new Error('CAPTCHA was rejected by the service, check if i\'s a valid image');
                    break;
                case 503:
                    throw new Error('CAPTCHA was rejected due to service overload, try again later');
                    break;
            }
        }

        let json;
        try {
            json = await response.json();
            console.log(json);
        } catch (e) {
            throw new Error(response, "Incorrect Api Response");
        }

        if (json.status != 0) {
            throw new Error(json.request);
        }
        if (json.text === '?') {
            throw new Error("Captcha Not Solved");
        }

        return json.request || json;
    }

}
