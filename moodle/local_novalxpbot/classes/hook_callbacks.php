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
        global $PAGE, $COURSE;

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

        $iscourseview = strpos($pagetype, 'course-view') === 0
            || $path === '/course/view.php'
            || strpos($path, '/course/view.php') !== false;
        $isactivitypage = strpos($pagetype, 'mod-') === 0
            || strpos($path, '/mod/') === 0;

        if (!$isdashboard && !$iscourseview && !$isactivitypage) {
            return;
        }

        $contextcourseid = isset($COURSE->id) ? (int)$COURSE->id : 0;
        $contextcoursename = isset($COURSE->fullname) ? (string)$COURSE->fullname : '';
        $contextcoursetitle = $contextcoursename;

        if ($iscourseview || $isactivitypage) {
            $urlcourseid = 0;
            $urlid = optional_param('id', 0, PARAM_INT);
            $urlcourseidparam = optional_param('courseid', 0, PARAM_INT);
            if ($urlcourseidparam > 0) {
                $urlcourseid = $urlcourseidparam;
            } else if ($iscourseview && $urlid > 0) {
                $urlcourseid = $urlid;
            } else if ($isactivitypage && $urlid > 0) {
                try {
                    $cm = get_coursemodule_from_id('', $urlid, 0, false, IGNORE_MISSING);
                    if (!empty($cm->course)) {
                        $urlcourseid = (int)$cm->course;
                    }
                } catch (\Throwable $e) {
                    // Keep fallback context values if cm lookup fails.
                }
            }

            if ($urlcourseid > 0) {
                try {
                    $pagecourse = get_course($urlcourseid);
                    if (!empty($pagecourse->id)) {
                        $contextcourseid = (int)$pagecourse->id;
                    }
                    if (!empty($pagecourse->fullname)) {
                        $contextcoursename = (string)$pagecourse->fullname;
                        $contextcoursetitle = (string)$pagecourse->fullname;
                    }
                } catch (\Throwable $e) {
                    // Keep fallback context values if direct lookup fails.
                }
            }
        }

        $hascoursecontext = $contextcourseid > 1;

        $PAGE->requires->js_call_amd('local_novalxpbot/chat_client', 'init', [[
            'autoCourseCompanion' => $iscourseview && $hascoursecontext,
            'courseId' => $hascoursecontext ? (string)$contextcourseid : '',
            'courseName' => $contextcoursename,
            'courseTitle' => $contextcoursetitle,
        ]]);
    }
}
