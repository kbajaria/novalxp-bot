define([], function() {
    var ENDPOINT = '/local/novalxpbot/chat.php';
    var STYLE_ID = 'local-novalxpbot-style';

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '[data-novalxpbot-widget]{position:fixed;right:16px;bottom:16px;z-index:1000;width:min(360px,calc(100vw - 32px));background:#fff;border:1px solid #d9d9d9;border-radius:12px;box-shadow:0 8px 22px rgba(0,0,0,.14);padding:12px;}',
            '[data-novalxpbot-widget] h4{margin:0 0 8px;font-size:14px;font-weight:700;}',
            '[data-novalxpbot-widget] form{display:flex;gap:8px;margin-top:8px;}',
            '[data-novalxpbot-widget] input[type=text]{flex:1;min-width:0;padding:8px 10px;border:1px solid #c9c9c9;border-radius:8px;}',
            '[data-novalxpbot-widget] button{padding:8px 12px;border:0;border-radius:8px;background:#1f6feb;color:#fff;cursor:pointer;}',
            '[data-novalxpbot-widget] [data-novalxpbot-output]{max-height:220px;overflow:auto;white-space:pre-wrap;font-size:14px;line-height:1.45;border:1px solid #efefef;background:#fafafa;border-radius:8px;padding:10px;}'
        ].join('');
        document.head.appendChild(style);
    }

    function ensureWidget() {
        var existing = document.querySelector('[data-novalxpbot-widget]');
        if (existing) {
            return existing;
        }

        injectStyle();
        var container = document.createElement('aside');
        container.setAttribute('data-novalxpbot-widget', 'true');
        container.innerHTML = [
            '<h4>Nova Assistant</h4>',
            '<div data-novalxpbot-output>Ask a question about your courses.</div>',
            '<form data-novalxpbot-form>',
            '<input type="text" data-novalxpbot-question placeholder="Ask Nova..." />',
            '<input type="hidden" data-novalxpbot-history value="[]" />',
            '<button type="submit">Send</button>',
            '</form>'
        ].join('');
        document.body.appendChild(container);
        return container;
    }

    function toFormBody(question, history) {
        var params = new URLSearchParams();
        params.set('sesskey', M.cfg.sesskey);
        params.set('q', question);
        params.set('history', JSON.stringify(Array.isArray(history) ? history : []));
        return params.toString();
    }

    async function send(question, history) {
        var trimmed = (question || '').trim();
        if (!trimmed) {
            return {
                ok: false,
                error: 'Question is required.'
            };
        }

        var response = await fetch(M.cfg.wwwroot + ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: toFormBody(trimmed, history)
        });

        var payload = await response.json();
        if (!response.ok && payload && payload.ok !== false) {
            payload.ok = false;
            payload.error = payload.error || 'Chat request failed.';
        }

        return payload;
    }

    function parseHistory(raw) {
        if (!raw) {
            return [];
        }
        try {
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function renderResult(target, data) {
        if (!target) {
            return;
        }

        if (!data || data.ok === false) {
            target.textContent = (data && data.error) ? data.error : 'Chat request failed.';
            return;
        }

        target.textContent = data.text || '';
    }

    function init(options) {
        var opts = options || {};
        var formSelector = opts.formSelector || '[data-novalxpbot-form]';
        var questionSelector = opts.questionSelector || '[data-novalxpbot-question]';
        var historySelector = opts.historySelector || '[data-novalxpbot-history]';
        var outputSelector = opts.outputSelector || '[data-novalxpbot-output]';

        var form = document.querySelector(formSelector);
        var output = document.querySelector(outputSelector);
        if (!form) {
            var widget = ensureWidget();
            form = widget.querySelector('[data-novalxpbot-form]');
            output = widget.querySelector('[data-novalxpbot-output]');
        }

        var questionInput = form.querySelector(questionSelector);
        var historyInput = form.querySelector(historySelector);

        form.addEventListener('submit', async function(event) {
            event.preventDefault();

            var question = questionInput ? questionInput.value : '';
            var history = parseHistory(historyInput ? historyInput.value : '[]');
            var result = await send(question, history);
            renderResult(output, result);

            if (result && result.ok && questionInput) {
                questionInput.value = '';
            }
        });
    }

    return {
        init: init,
        send: send
    };
});
