<?php
define('AJAX_SCRIPT', true);
define('NO_DEBUG_DISPLAY', true);
require_once(__DIR__ . '/../../config.php');

require_login();
require_sesskey();

$question = required_param('q', PARAM_RAW_TRIMMED);
$historyjson = optional_param('history', '[]', PARAM_RAW);
$courseid = optional_param('course_id', '', PARAM_RAW_TRIMMED);
$coursename = optional_param('course_name', '', PARAM_RAW_TRIMMED);
$coursetitle = optional_param('course_title', '', PARAM_RAW_TRIMMED);
$currenturl = optional_param('current_url', '', PARAM_RAW_TRIMMED);

$history = json_decode($historyjson, true);
if (!is_array($history)) {
    $history = [];
}

header('Content-Type: application/json; charset=utf-8');

if ($question === '') {
    echo json_encode([
        'ok' => false,
        'error' => get_string('invalidrequest', 'local_novalxpbot'),
        'status' => 400,
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

$courseidint = 0;
if ($courseid !== '' && ctype_digit($courseid)) {
    $courseidint = (int)$courseid;
}

if ($currenturl !== '') {
    $parts = parse_url($currenturl);
    if (!empty($parts['query'])) {
        parse_str($parts['query'], $queryparams);

        // Only infer course id from URL when explicit course_id is absent.
        if ($courseidint <= 0) {
            if (!empty($queryparams['courseid']) && ctype_digit((string)$queryparams['courseid'])) {
                $courseidint = (int)$queryparams['courseid'];
                $courseid = (string)$courseidint;
            } else if (!empty($queryparams['id']) && ctype_digit((string)$queryparams['id'])) {
                $urlid = (int)$queryparams['id'];
                $urlpath = !empty($parts['path']) ? (string)$parts['path'] : '';
                if ($urlpath === '/course/view.php' || strpos($urlpath, '/course/view.php') !== false) {
                    $courseidint = $urlid;
                    $courseid = (string)$courseidint;
                } else if (strpos($urlpath, '/mod/') === 0) {
                    try {
                        $cm = get_coursemodule_from_id('', $urlid, 0, false, IGNORE_MISSING);
                        if (!empty($cm->course)) {
                            $courseidint = (int)$cm->course;
                            $courseid = (string)$courseidint;
                        }
                    } catch (\Throwable $e) {
                        // Keep fallback values if cm lookup fails.
                    }
                }
            }
        }
    }
}

if ($courseidint > 0) {
    try {
        $course = get_course($courseidint);
        if (!empty($course->fullname)) {
            $coursename = (string)$course->fullname;
            $coursetitle = (string)$course->fullname;
        }
    } catch (\Throwable $e) {
        // Keep incoming course_name if course lookup fails.
    }
}

if ($question === '__course_companion_setup__') {
    $subject = trim($coursetitle) !== '' ? trim($coursetitle) : (trim($coursename) !== '' ? trim($coursename) : 'this course');
    $templateurl = (string)get_config('local_novalxpbot', 'coursecompaniontemplateurl');

    $currenturlvalue = trim((string)$currenturl);
    if ($currenturlvalue !== '' && strpos($currenturlvalue, 'http') !== 0 && strpos($currenturlvalue, '/') === 0) {
        $currenturlvalue = $CFG->wwwroot . $currenturlvalue;
    }

    $text = implode("\n", [
        'Course Companion Setup for "' . $subject . '"',
        '',
        'Step A: Create/open your Course Notes doc',
        $templateurl !== ''
            ? 'Use this Course Notes template and create your own copy now: ' . $templateurl
            : 'Create a new Google Doc named "Course Notes - ' . $subject . '".',
        '',
        'Step B: Add sources to NotebookLM (exactly these)',
        '1. Your Course Notes doc (from Step A).',
        $currenturlvalue !== '' ? '2. The current course page: ' . $currenturlvalue : '',
        '',
        'Step C: Copy-paste starter prompts (tailored to this course)',
        '1) "Use my notes and sources to create a 10-bullet summary of ' . $subject . '. Highlight what I should memorise for assessments."',
        '2) "Turn ' . $subject . ' into a study plan for this week with daily 20-minute tasks and a quick self-check at the end of each day."',
        '3) "Based on ' . $subject . ', quiz me with 8 scenario-based questions. After each answer, explain why it is correct or incorrect using my notes."',
    ]);

    $actions = [];
    if ($templateurl !== '') {
        $actions[] = [
            'type' => 'open_url',
            'label' => 'Open Course Notes template',
            'url' => $templateurl,
        ];
    }
    $actions[] = [
        'type' => 'open_url',
        'label' => 'Open NotebookLM',
        'url' => 'https://notebooklm.google.com/',
    ];
    if ($currenturlvalue !== '') {
        $actions[] = [
            'type' => 'open_url',
            'label' => 'Open course page',
            'url' => $currenturlvalue,
        ];
    }

    echo json_encode([
        'ok' => true,
        'intent' => 'course_companion_setup',
        'text' => $text,
        'citations' => [],
        'actions' => $actions,
        'meta' => [
            'source' => 'moodle_local_companion_setup',
        ],
        'request_id' => '',
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

$resolvedquestion = $question;
if ($courseidint > 0 && trim($coursetitle) !== '') {
    $resolvedquestion = preg_replace('/\bthis course\b/i', trim($coursetitle), $resolvedquestion);
    $resolvedquestion = preg_replace('/\bthe course\b/i', trim($coursetitle), $resolvedquestion);
}

$contextoverrides = [
    'course_id' => (string)$courseid,
    'course_name' => (string)$coursename,
    'course_title' => (string)$coursetitle,
    'current_url' => (string)$currenturl,
];

$result = \local_novalxpbot\service::chat($resolvedquestion, $history, $contextoverrides);

if (!empty($result['ok']) && !empty($coursetitle) && !empty($result['text']) && is_string($result['text'])) {
    $escapedtitle = preg_quote(trim($coursetitle), '/');
    $result['text'] = preg_replace('/\[\s*' . $escapedtitle . '\s*\]/u', trim($coursetitle), $result['text']);
}

echo json_encode($result, JSON_UNESCAPED_SLASHES);
