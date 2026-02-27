<?php
namespace local_novalxpbot;

defined('MOODLE_INTERNAL') || die();

use core\hook\output\before_footer_html_generation;

/**
 * Hook callbacks for local_novalxpbot.
 */
class hook_callbacks {

    /**
     * Load the dashboard chatbot wiring for logged-in users.
     *
     * @param before_footer_html_generation $hook
     */
    public static function before_footer_html_generation(before_footer_html_generation $hook): void {
        global $PAGE, $CFG;

        if (!isloggedin() || isguestuser()) {
            return;
        }

        $pagelayout = (string)($PAGE->pagelayout ?? '');
        $pagetype = (string)($PAGE->pagetype ?? '');
        $path = '';
        if (!empty($PAGE->url)) {
            $path = (string)$PAGE->url->get_path();
        }

        $isdashboard = $pagelayout === 'mydashboard'
            || strpos($pagetype, 'my-index') === 0
            || $path === '/my/'
            || $path === '/my/index.php';

        if (!$isdashboard) {
            return;
        }

        $sesskey = json_encode(sesskey());
        $wwwroot = json_encode((string)$CFG->wwwroot);

        $hook->add_html(
            '<style id="novalxpbot-inline-style">'
            . '[data-novalxpbot-widget]{position:fixed;right:16px;bottom:16px;z-index:10000;width:min(360px,calc(100vw - 32px));background:#fff;border:1px solid #d9d9d9;border-radius:12px;box-shadow:0 8px 22px rgba(0,0,0,.14);padding:12px;}'
            . '[data-novalxpbot-widget] h4{margin:0 0 8px;font-size:14px;font-weight:700;}'
            . '[data-novalxpbot-widget] form{display:flex;gap:8px;margin-top:8px;}'
            . '[data-novalxpbot-widget] input[type=text]{flex:1;min-width:0;padding:8px 10px;border:1px solid #c9c9c9;border-radius:8px;}'
            . '[data-novalxpbot-widget] button{padding:8px 12px;border:0;border-radius:8px;background:#1f6feb;color:#fff;cursor:pointer;}'
            . '[data-novalxpbot-widget] [data-novalxpbot-output]{max-height:220px;overflow:auto;white-space:pre-wrap;font-size:14px;line-height:1.45;border:1px solid #efefef;background:#fafafa;border-radius:8px;padding:10px;}'
            . '</style>'
            . "<script>(function(){"
            . "var novalxpSesskey=" . $sesskey . ";"
            . "var novalxpRoot=" . $wwwroot . ";"
            . "var root=document.querySelector('[data-novalxpbot-widget]');"
            . "if(!root){root=document.createElement('aside');root.setAttribute('data-novalxpbot-widget','true');"
            . "root.innerHTML='<h4>Nova Assistant</h4><div data-novalxpbot-output>Ask a question about your courses.</div><form><input type=\"text\" data-novalxpbot-question placeholder=\"Ask Nova...\" /><button type=\"submit\">Send</button></form>';"
            . "document.body.appendChild(root);}"
            . "if(root.getAttribute('data-novalxpbot-bound')==='1'){return;}root.setAttribute('data-novalxpbot-bound','1');"
            . "var form=root.querySelector('form');var question=root.querySelector('[data-novalxpbot-question]');var output=root.querySelector('[data-novalxpbot-output]');"
            . "var esc=function(s){return String(s||'').replace(/[&<>\\\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\\\"':'&quot;',\"'\":'&#39;'}[c];});};"
            . "var absUrl=function(u){if(!u){return '';}if(/^https?:\\/\\//i.test(u)){return u;}return (novalxpRoot||'')+u;};"
            . "var norm=function(s){return String(s||'').toLowerCase().replace(/^open:\\s*/,'').replace(/\\s+/g,' ').trim();};"
            . "var toAnchor=function(label,url){var href=absUrl(url);return '<a href=\"'+esc(href)+'\" target=\"_blank\" rel=\"noopener noreferrer\">'+esc(label)+'</a>';};"
            . "var renderResult=function(d,status){if(!d||d.ok===false){output.textContent=(d&&d.error)?d.error:('Chat request failed ('+status+').');return;}var linkMap={};"
            . "var addLink=function(label,url){if(!url){return;}var k=norm(label||url);if(k&&!linkMap[k]){linkMap[k]=url;}};"
            . "if(Array.isArray(d.actions)){d.actions.forEach(function(a){if(a&&a.url){addLink(a.label||a.url,a.url);}});}"
            . "if(Array.isArray(d.citations)){d.citations.forEach(function(c){if(c&&c.url){addLink(c.title||c.url,c.url);}});}"
            . "var text=esc(d.text||'');"
            . "var linkedCount=0;"
            . "text=text.replace(/(\\/course\\/view\\.php\\?id=\\d+)/g,function(m,u){return toAnchor(u,u);});"
            . "text=text.replace(/\\*\\*\\[([^\\]]+)\\]\\*\\*/g,function(m,label){var u=linkMap[norm(label)];if(u){linkedCount++;return '<strong>'+toAnchor(label,u)+'</strong>';}return m;});"
            . "text=text.replace(/\\[([^\\]]+)\\]/g,function(m,label){var u=linkMap[norm(label)];if(u){linkedCount++;return toAnchor(label,u);}return m;});"
            . "Object.keys(linkMap).forEach(function(k){var url=linkMap[k];var label='';if(Array.isArray(d.citations)){d.citations.forEach(function(c){if(!label&&c&&norm(c.title)===k){label=c.title;}});}if(!label){label=k;}if(linkedCount>=3){return;}if(text.indexOf(label)!==-1&&text.indexOf('<a')===-1){text=text.replace(label,toAnchor(label,url));linkedCount++;}});"
            . "text=text.replace(/\\n/g,'<br>');"
            . "if(linkedCount===0&&Object.keys(linkMap).length){var keys=Object.keys(linkMap);text+='<br><br><strong>Links</strong><ul style=\"margin:6px 0 0 18px;\">'+keys.map(function(k){var label='';if(Array.isArray(d.citations)){d.citations.forEach(function(c){if(!label&&c&&norm(c.title)===k){label=c.title;}});}if(!label){label=k;}return '<li>'+toAnchor(label,linkMap[k])+'</li>';}).join('')+'</ul>';}"
            . "output.innerHTML='<div>'+text+'</div>';};"
            . "form.addEventListener('submit',async function(e){e.preventDefault();var q=(question.value||'').trim();if(!q){return;}output.textContent='Thinking...';var p=new URLSearchParams();p.set('sesskey',novalxpSesskey||'');p.set('q',q);p.set('history','[]');"
            . "try{var r=await fetch((novalxpRoot||'')+'/local/novalxpbot/chat.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p.toString()});var raw=await r.text();var d=null;try{d=JSON.parse(raw);}catch(parseErr){output.textContent='Chat error: non-JSON response';return;}renderResult(d,r.status);if(d&&d.ok){question.value='';}}catch(err){output.textContent='Chat request failed.';}"
            . "});"
            . "})();</script>"
        );
    }
}
