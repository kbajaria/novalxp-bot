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
        global $PAGE;

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

        $PAGE->requires->js_call_amd('local_novalxpbot/chat_client', 'init');
    }
}
