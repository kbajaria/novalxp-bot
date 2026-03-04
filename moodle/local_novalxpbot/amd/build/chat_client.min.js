define([], function() {
    var ENDPOINT = '/local/novalxpbot/chat.php';
    var STYLE_ID = 'local-novalxpbot-style';
    var MINIMIZED_STATE_KEY = 'local_novalxpbot_minimized';
    var COURSE_COMPANION_KEY_PREFIX = 'local_novalxpbot_course_companion_setup_';
    var COURSE_COMPANION_TRIGGER = '__course_companion_setup__';

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '[data-novalxpbot-widget]{position:fixed;right:16px;bottom:16px;z-index:1000;width:min(360px,calc(100vw - 32px));background:#fff;border:1px solid #d9d9d9;border-radius:12px;box-shadow:0 8px 22px rgba(0,0,0,.14);padding:12px;}',
            '[data-novalxpbot-widget][data-novalxpbot-minimized="true"]{display:none;}',
            '[data-novalxpbot-header]{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px;}',
            '[data-novalxpbot-widget] h4{margin:0;font-size:14px;font-weight:700;}',
            '[data-novalxpbot-close]{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:1px solid #ced4ea;border-radius:8px;background:#fff;color:#5F71C2;cursor:pointer;font-size:18px;line-height:1;}',
            '[data-novalxpbot-close]:hover{background:#f3f5fb;}',
            '[data-novalxpbot-close]:focus-visible{outline:2px solid #5F71C2;outline-offset:2px;}',
            '[data-novalxpbot-widget] form{display:flex;gap:8px;margin-top:8px;}',
            '[data-novalxpbot-widget] input[type=text]{flex:1;min-width:0;padding:8px 10px;border:1px solid #c9c9c9;border-radius:8px;}',
            '[data-novalxpbot-widget] button[type=submit]{padding:8px 12px;border:0;border-radius:8px;background:#5F71C2;color:#fff;cursor:pointer;}',
            '[data-novalxpbot-widget] [data-novalxpbot-output]{max-height:220px;overflow:auto;white-space:pre-wrap;font-size:14px;line-height:1.45;border:1px solid #efefef;background:#fafafa;border-radius:8px;padding:10px;}',
            '[data-novalxpbot-widget] [data-novalxpbot-output] a{color:#2457d6;text-decoration:underline;word-break:break-word;}',
            '[data-novalxpbot-widget] [data-novalxpbot-output] a:hover{color:#1a43ab;}',
            '[data-novalxpbot-setup]{display:flex;flex-direction:column;gap:8px;}',
            '[data-novalxpbot-setup-title]{font-weight:700;}',
            '[data-novalxpbot-setup-step]{background:#fff;border:1px solid #eceff7;border-radius:8px;padding:8px;}',
            '[data-novalxpbot-setup-step-title]{font-weight:700;margin-bottom:4px;}',
            '[data-novalxpbot-setup-step] ul{margin:0;padding-left:18px;}',
            '[data-novalxpbot-actions]{margin-top:10px;display:flex;flex-direction:column;gap:6px;}',
            '[data-novalxpbot-action]{display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border:1px solid #ced4ea;border-radius:8px;background:#fff;color:#2f3a66;text-decoration:none;font-size:13px;}',
            '[data-novalxpbot-action]:hover{background:#f3f5fb;}',
            '[data-novalxpbot-launcher]{position:fixed;right:16px;bottom:16px;z-index:1001;width:58px;height:58px;border:0;border-radius:999px;background:#5F71C2;color:#fff;display:none;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(95,113,194,.45);cursor:pointer;}',
            '[data-novalxpbot-launcher][data-visible="true"]{display:inline-flex;}',
            '[data-novalxpbot-launcher] svg{width:30px;height:30px;fill:currentColor;}',
            '[data-novalxpbot-launcher]:hover{transform:translateY(-1px);}',
            '[data-novalxpbot-launcher]:focus-visible{outline:2px solid #fff;outline-offset:2px;}'
        ].join('');
        document.head.appendChild(style);
    }

    function getOrCreateLauncher() {
        var existing = document.querySelector('[data-novalxpbot-launcher]');
        if (existing) {
            return existing;
        }

        var launcher = document.createElement('button');
        launcher.type = 'button';
        launcher.setAttribute('data-novalxpbot-launcher', 'true');
        launcher.setAttribute('aria-label', 'Open Nova Assistant chat');
        launcher.setAttribute('title', 'Open chat');
        launcher.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.48 3 2 6.94 2 11.8c0 2.48 1.18 4.72 3.08 6.32L4 22l4.37-2.4c1.13.32 2.35.5 3.63.5 5.52 0 10-3.94 10-8.8S17.52 3 12 3zm-4 8h8v2H8zm0-3h8v2H8z"></path></svg>';
        document.body.appendChild(launcher);
        return launcher;
    }

    function ensureWidgetChrome(widget) {
        if (!widget) {
            return widget;
        }

        var header = widget.querySelector('[data-novalxpbot-header]');
        var title = widget.querySelector('h4');
        if (!title) {
            title = document.createElement('h4');
            title.textContent = 'Nova Assistant';
        }

        if (!header) {
            header = document.createElement('div');
            header.setAttribute('data-novalxpbot-header', 'true');
            widget.insertBefore(header, widget.firstChild);
        }

        if (title.parentNode !== header) {
            header.insertBefore(title, header.firstChild);
        }

        var closeBtn = header.querySelector('[data-novalxpbot-close]');
        if (!closeBtn) {
            closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.setAttribute('data-novalxpbot-close', 'true');
            closeBtn.setAttribute('aria-label', 'Minimize chat');
            closeBtn.setAttribute('title', 'Minimize chat');
            closeBtn.innerHTML = '&times;';
            header.appendChild(closeBtn);
        }

        var form = widget.querySelector('form');
        if (form && !form.hasAttribute('data-novalxpbot-form')) {
            form.setAttribute('data-novalxpbot-form', 'true');
        }

        var questionInput = widget.querySelector('[data-novalxpbot-question]') || widget.querySelector('input[type=text]');
        if (questionInput && !questionInput.hasAttribute('data-novalxpbot-question')) {
            questionInput.setAttribute('data-novalxpbot-question', 'true');
        }

        var historyInput = widget.querySelector('[data-novalxpbot-history]');
        if (!historyInput && form) {
            historyInput = document.createElement('input');
            historyInput.type = 'hidden';
            historyInput.setAttribute('data-novalxpbot-history', 'true');
            historyInput.value = '[]';
            form.appendChild(historyInput);
        }

        var output = widget.querySelector('[data-novalxpbot-output]');
        if (!output) {
            output = document.createElement('div');
            output.setAttribute('data-novalxpbot-output', 'true');
            output.textContent = 'Ask a question about your courses.';
            if (form) {
                widget.insertBefore(output, form);
            } else {
                widget.appendChild(output);
            }
        }

        return widget;
    }

    function ensureWidget() {
        var existing = document.querySelector('[data-novalxpbot-widget]');
        if (existing) {
            return ensureWidgetChrome(existing);
        }

        injectStyle();
        var container = document.createElement('aside');
        container.setAttribute('data-novalxpbot-widget', 'true');
        container.innerHTML = [
            '<div data-novalxpbot-header>',
            '<h4>Nova Assistant</h4>',
            '<button type="button" data-novalxpbot-close aria-label="Minimize chat" title="Minimize chat">&times;</button>',
            '</div>',
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

    function loadMinimizedState() {
        try {
            return localStorage.getItem(MINIMIZED_STATE_KEY) === 'true';
        } catch (e) {
            return false;
        }
    }

    function saveMinimizedState(minimized) {
        try {
            localStorage.setItem(MINIMIZED_STATE_KEY, minimized ? 'true' : 'false');
        } catch (e) {
            // Ignore storage failures (private mode, blocked cookies/storage, etc.).
        }
    }

    function setMinimized(widget, launcher, minimized) {
        if (!widget || !launcher) {
            return;
        }

        widget.setAttribute('data-novalxpbot-minimized', minimized ? 'true' : 'false');
        launcher.setAttribute('data-visible', minimized ? 'true' : 'false');
        saveMinimizedState(minimized);
    }

    function bindWidgetToggles(widget) {
        if (!widget || widget.getAttribute('data-novalxpbot-toggle-bound') === '1') {
            return;
        }

        var launcher = getOrCreateLauncher();
        var closeBtn = widget.querySelector('[data-novalxpbot-close]');
        var questionInput = widget.querySelector('[data-novalxpbot-question]');

        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                setMinimized(widget, launcher, true);
            });
        }

        launcher.addEventListener('click', function() {
            setMinimized(widget, launcher, false);
            if (questionInput) {
                questionInput.focus();
            }
        });

        setMinimized(widget, launcher, loadMinimizedState());
        widget.setAttribute('data-novalxpbot-toggle-bound', '1');
    }

    function toFormBody(question, history, context) {
        var params = new URLSearchParams();
        params.set('sesskey', M.cfg.sesskey);
        params.set('q', question);
        params.set('history', JSON.stringify(Array.isArray(history) ? history : []));
        if (context) {
            if (context.courseId) {
                params.set('course_id', context.courseId);
            }
            if (context.courseName) {
                params.set('course_name', context.courseName);
            }
            if (context.courseTitle) {
                params.set('course_title', context.courseTitle);
            }
            if (context.currentUrl) {
                params.set('current_url', context.currentUrl);
            }
        }
        return params.toString();
    }

    async function send(question, history, context) {
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
            body: toFormBody(trimmed, history, context)
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

    function writeHistory(historyInput, history) {
        if (!historyInput) {
            return;
        }
        historyInput.value = JSON.stringify(Array.isArray(history) ? history.slice(-20) : []);
    }

    function addHistoryTurn(historyInput, role, text) {
        var history = parseHistory(historyInput ? historyInput.value : '[]');
        var cleanRole = role === 'assistant' ? 'assistant' : 'user';
        var cleanText = (text || '').trim();
        if (!cleanText) {
            return;
        }
        history.push({role: cleanRole, text: cleanText});
        writeHistory(historyInput, history);
    }

    function isSafeUrl(url) {
        var value = (url || '').trim();
        return /^https?:\/\//i.test(value) || value.indexOf('/') === 0;
    }

    function appendLinkifiedText(target, text) {
        var input = String(text || '');
        var lines = input.split('\n');
        var pattern = /(https?:\/\/[^\s]+|\/[^\s]+)/g;

        lines.forEach(function(line, lineIndex) {
            var start = 0;
            var match;
            while ((match = pattern.exec(line)) !== null) {
                var token = match[0];
                if (match.index > start) {
                    target.appendChild(document.createTextNode(line.slice(start, match.index)));
                }

                if (isSafeUrl(token)) {
                    var link = document.createElement('a');
                    link.href = token;
                    link.textContent = token;
                    if (/^https?:\/\//i.test(token)) {
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                    }
                    target.appendChild(link);
                } else {
                    target.appendChild(document.createTextNode(token));
                }
                start = match.index + token.length;
            }
            if (start < line.length) {
                target.appendChild(document.createTextNode(line.slice(start)));
            }
            if (lineIndex < lines.length - 1) {
                target.appendChild(document.createElement('br'));
            }
        });
    }

    function linkLabelForUrl(url) {
        var value = String(url || '').toLowerCase();
        if (value.indexOf('docs.google.com/document/') !== -1) {
            return 'Open template';
        }
        if (value.indexOf('notebooklm.google.com') !== -1) {
            return 'Open NotebookLM';
        }
        if (value.indexOf('/course/view.php') !== -1) {
            return 'Open course page';
        }
        return 'Open link';
    }

    function appendCompactLinkedLine(target, text) {
        var line = String(text || '');
        var pattern = /(https?:\/\/[^\s]+)/g;
        var start = 0;
        var match;

        while ((match = pattern.exec(line)) !== null) {
            var token = match[0];
            if (match.index > start) {
                target.appendChild(document.createTextNode(line.slice(start, match.index)));
            }

            var link = document.createElement('a');
            link.href = token;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = linkLabelForUrl(token);
            target.appendChild(link);
            start = match.index + token.length;
        }

        if (start < line.length) {
            target.appendChild(document.createTextNode(line.slice(start)));
        }
    }

    function ensureCompanionActions(data) {
        if (!data || data.intent !== 'course_companion_setup') {
            return data;
        }

        var existing = Array.isArray(data.actions) ? data.actions.slice() : [];
        var urls = {};
        existing.forEach(function(action) {
            if (action && action.url) {
                urls[action.url] = true;
            }
        });

        var templateMatch = String(data.text || '').match(/https:\/\/docs\.google\.com\/document\/d\/[^\s]+\/copy[^\s]*/i);
        var notebookUrl = 'https://notebooklm.google.com/';

        if (templateMatch && !urls[templateMatch[0]]) {
            existing.unshift({
                type: 'open_url',
                label: 'Open Course Notes template',
                url: templateMatch[0]
            });
            urls[templateMatch[0]] = true;
        }

        if (!urls[notebookUrl]) {
            existing.push({
                type: 'open_url',
                label: 'Open NotebookLM',
                url: notebookUrl
            });
        }

        data.actions = existing;
        return data;
    }

    function renderCourseCompanionText(target, text) {
        var container = document.createElement('div');
        container.setAttribute('data-novalxpbot-setup', 'true');
        var sections = String(text || '').split('\n\n').map(function(part) {
            return part.trim();
        }).filter(Boolean);

        sections.forEach(function(section) {
            if (section.indexOf('Course Companion Setup') === 0) {
                var title = document.createElement('div');
                title.setAttribute('data-novalxpbot-setup-title', 'true');
                appendCompactLinkedLine(title, section);
                container.appendChild(title);
                return;
            }

            if (section.indexOf('Step A:') === 0 || section.indexOf('Step B:') === 0 || section.indexOf('Step C:') === 0) {
                var card = document.createElement('div');
                card.setAttribute('data-novalxpbot-setup-step', 'true');
                var lines = section.split('\n').filter(Boolean);
                var heading = document.createElement('div');
                heading.setAttribute('data-novalxpbot-setup-step-title', 'true');
                heading.textContent = lines.shift() || '';
                card.appendChild(heading);

                var listItems = [];
                lines.forEach(function(line) {
                    if (/^\d+[\.\)]\s+/.test(line)) {
                        listItems.push(line.replace(/^\d+[\.\)]\s+/, ''));
                    } else {
                        var p = document.createElement('div');
                        appendCompactLinkedLine(p, line);
                        card.appendChild(p);
                    }
                });

                if (listItems.length) {
                    var ul = document.createElement('ul');
                    listItems.forEach(function(item) {
                        var li = document.createElement('li');
                        appendCompactLinkedLine(li, item);
                        ul.appendChild(li);
                    });
                    card.appendChild(ul);
                }
                container.appendChild(card);
                return;
            }

            var misc = document.createElement('div');
            appendCompactLinkedLine(misc, section);
            container.appendChild(misc);
        });

        target.appendChild(container);
    }

    function renderResult(target, data) {
        if (!target) {
            return;
        }

        target.innerHTML = '';

        if (!data || data.ok === false) {
            target.textContent = (data && data.error) ? data.error : 'Chat request failed.';
            return;
        }

        data = ensureCompanionActions(data);

        if (!Array.isArray(data.actions) || !data.actions.length) {
            var plainOnlyBlock = document.createElement('div');
            if (data.intent === 'course_companion_setup') {
                renderCourseCompanionText(plainOnlyBlock, data.text || '');
            } else {
                appendLinkifiedText(plainOnlyBlock, data.text || '');
            }
            target.appendChild(plainOnlyBlock);
            return;
        }

        var actionWrap = document.createElement('div');
        actionWrap.setAttribute('data-novalxpbot-actions', 'true');

        data.actions.forEach(function(action) {
            if (!action || action.type !== 'open_url' || !isSafeUrl(action.url)) {
                return;
            }
            var link = document.createElement('a');
            link.setAttribute('data-novalxpbot-action', 'true');
            link.href = action.url;
            link.textContent = action.label || 'Open link';
            if (action.url.indexOf('http') === 0) {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            }
            actionWrap.appendChild(link);
        });

        if (actionWrap.childElementCount) {
            target.appendChild(actionWrap);
        }

        var textBlock = document.createElement('div');
        if (data.intent === 'course_companion_setup') {
            renderCourseCompanionText(textBlock, data.text || '');
        } else {
            appendLinkifiedText(textBlock, data.text || '');
        }
        target.appendChild(textBlock);
    }

    function setBusyState(output, questionInput, submitButton, isBusy) {
        if (output) {
            if (isBusy) {
                output.textContent = 'Thinking...';
            }
        }
        if (questionInput) {
            questionInput.disabled = isBusy;
        }
        if (submitButton) {
            submitButton.disabled = isBusy;
            submitButton.textContent = isBusy ? 'Working...' : 'Send';
        }
    }

    function companionSetupStorageKey(courseId) {
        return COURSE_COMPANION_KEY_PREFIX + String(courseId || '');
    }

    function wasCompanionSetupShown(courseId) {
        if (!courseId) {
            return false;
        }
        try {
            return localStorage.getItem(companionSetupStorageKey(courseId)) === 'true';
        } catch (e) {
            return false;
        }
    }

    function markCompanionSetupShown(courseId) {
        if (!courseId) {
            return;
        }
        try {
            localStorage.setItem(companionSetupStorageKey(courseId), 'true');
        } catch (e) {
            // Ignore storage failures.
        }
    }

    function isGenericCourseName(value) {
        var text = String(value || '').trim().toLowerCase();
        return !text || text === 'novalxp' || text === 'course' || text === 'my courses' || text === 'learning' || text === 'dashboard';
    }

    function detectCourseNameFromPage() {
        var selectors = [
            'h1',
            '.page-header-headings h1',
            '.course-header h1',
            '.page-title h1',
            '[data-region=\"page-header\"] h1'
        ];
        for (var i = 0; i < selectors.length; i++) {
            var node = document.querySelector(selectors[i]);
            if (!node) {
                continue;
            }
            var text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
            if (text && !isGenericCourseName(text)) {
                return text;
            }
        }
        return '';
    }

    function buildRequestContext(opts) {
        var courseId = String((opts && opts.courseId) || '').trim();
        var courseName = String((opts && opts.courseName) || '').trim();
        var courseTitle = String((opts && opts.courseTitle) || '').trim();
        if (isGenericCourseName(courseName)) {
            var detected = detectCourseNameFromPage();
            if (detected) {
                courseName = detected;
            }
        }
        if (!courseTitle || isGenericCourseName(courseTitle)) {
            courseTitle = courseName;
        }
        var currentUrl = window.location.pathname + window.location.search;
        return {
            courseId: courseId,
            courseName: courseName,
            courseTitle: courseTitle,
            currentUrl: currentUrl
        };
    }

    function init(options) {
        injectStyle();

        var opts = options || {};
        var formSelector = opts.formSelector || '[data-novalxpbot-form]';
        var questionSelector = opts.questionSelector || '[data-novalxpbot-question]';
        var historySelector = opts.historySelector || '[data-novalxpbot-history]';
        var outputSelector = opts.outputSelector || '[data-novalxpbot-output]';

        var form = document.querySelector(formSelector);
        var output = document.querySelector(outputSelector);
        var widget = null;

        if (!form) {
            widget = ensureWidget();
            form = widget.querySelector(formSelector) || widget.querySelector('form');
            output = widget.querySelector(outputSelector);
        } else {
            widget = form.closest('[data-novalxpbot-widget]');
            if (widget) {
                ensureWidgetChrome(widget);
            }
            if (!output && widget) {
                output = widget.querySelector(outputSelector);
            }
        }

        if (widget) {
            bindWidgetToggles(widget);
        }

        if (!form) {
            return;
        }

        if (form.getAttribute('data-novalxpbot-submit-bound') === '1') {
            return;
        }

        var questionInput = form.querySelector(questionSelector) || form.querySelector('input[type=text]');
        var submitButton = form.querySelector('button[type=submit]');
        var historyInput = form.querySelector(historySelector);
        if (!historyInput) {
            historyInput = document.createElement('input');
            historyInput.type = 'hidden';
            historyInput.setAttribute('data-novalxpbot-history', 'true');
            historyInput.value = '[]';
            form.appendChild(historyInput);
        }

        form.addEventListener('submit', async function(event) {
            event.preventDefault();

            var question = questionInput ? questionInput.value : '';
            var history = parseHistory(historyInput ? historyInput.value : '[]');
            if (!question || !question.trim()) {
                renderResult(output, { ok: false, error: 'Question is required.' });
                return;
            }

            setBusyState(output, questionInput, submitButton, true);
            try {
                var result = await send(question, history, requestContext);
                renderResult(output, result);
                if (result && result.ok) {
                    addHistoryTurn(historyInput, 'user', question);
                    addHistoryTurn(historyInput, 'assistant', result.text || '');
                }

                if (result && result.ok && questionInput) {
                    questionInput.value = '';
                }
            } finally {
                setBusyState(output, questionInput, submitButton, false);
            }
        });

        if (opts.autoCourseCompanion && opts.courseId && !wasCompanionSetupShown(opts.courseId)) {
            setBusyState(output, questionInput, submitButton, true);
            send(COURSE_COMPANION_TRIGGER, parseHistory(historyInput.value || '[]'), requestContext)
                .then(function(result) {
                    renderResult(output, result);
                    if (result && result.ok) {
                        addHistoryTurn(historyInput, 'assistant', result.text || '');
                        if (result.intent === 'course_companion_setup') {
                            markCompanionSetupShown(opts.courseId);
                        }
                    }
                })
                .catch(function() {
                    renderResult(output, {ok: false, error: 'Unable to load Course Companion setup right now.'});
                })
                .finally(function() {
                    setBusyState(output, questionInput, submitButton, false);
                });
        }

        form.setAttribute('data-novalxpbot-submit-bound', '1');
    }

    return {
        init: init,
        send: send
    };
});
        var requestContext = buildRequestContext(opts);
