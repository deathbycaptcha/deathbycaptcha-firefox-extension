
var background = chrome.runtime.connect({name: "popup"});

background.onMessage.addListener(function(msg) {

    if (msg.action == "login") {
        let btn = $("#login-form button");
        btn.text(btn.attr("data-text"));

        if (msg.error === undefined) {
            $("#login-form").hide();
            displayAccountInfo(msg.response);
        } else {
            $("#login-form").find(".result").html(`<div class="error">${msg.error}</div>`);
        }
    }

    if (msg.action == "logout") {
        $("#account-info").hide();
        $("#login-form .result").text('');
        $("#login-form").show();
        $("#login-form").find("input")[0].focus();
    }

    if (msg.action == "getAccountInfo") {

        if (msg.error === undefined) {
            displayAccountInfo(msg.response);
        } else {
            $("#login-form").show().find("input")[0].focus();
        }
    }

});


background.postMessage({action: "getAccountInfo"});


$("#login-form").submit(function(e) {
    e.preventDefault();

    let btn = $(this).find("button");

    $(this).find(".result").text("");

    let username = $(this).find("input[name=username]").val();
    let password = $(this).find("input[name=password]").val();
    
    background.postMessage({action: "login", username, password});
});

$("#account-info .logout").click(function(e) {
    e.preventDefault();
    background.postMessage({action: "logout"});
});

$("#settings-form").on("keyup change", "input,select", function() {
    let key = $(this).attr("name");
    let value = $(this).val();

    if ($(this).is("[type=checkbox]")) {
        value = $(this).is(":checked");
    }

    let dataType = $(this).attr("data-type");

    if (dataType == 'int') value = parseInt(value) || 0;
    if (dataType == 'float') value = parseFloat(value) || 0.0;

    let config = {};
    config[key] = value;

    Config.set(config);
});


Config.getAll().then(config => {
   $("#settings-form").find("input,select").each(function() {
       let field = $(this);
       let value = config[field.attr("name")];

       if (field.attr("type") == "checkbox") {
           field.prop("checked", value);
       } else {
           field.val(value);
       }

       field.closest(".custom-select").find(".custom-select-value").text(value);
   });
});

function displayAccountInfo(info) {
    let block = $("#account-info");
    block.find('.username').text(info.username);
    block.find('.balance').text((info.valute == "USD" ? "$" : "₽") + " " + info.balance);
    block.show();
}


$(".auto-submit-link").attr("href", "chrome-extension://"+chrome.runtime.id+"/options/options.html#autosubmit-rules");