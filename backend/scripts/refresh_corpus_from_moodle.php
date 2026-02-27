<?php
declare(strict_types=1);

if (!defined('CLI_SCRIPT')) {
    define('CLI_SCRIPT', true);
}

$moodleconfig = $argv[1] ?? '/var/www/moodle/public/config.php';
$outputpath = $argv[2] ?? '/opt/novalxp-bot/backend/data/corpus.json';

if (!is_file($moodleconfig)) {
    fwrite(STDERR, "Moodle config not found: {$moodleconfig}\n");
    exit(1);
}

require_once($moodleconfig);

global $DB;

$records = $DB->get_records_select(
    'course',
    'id <> 1 AND visible = 1',
    null,
    'sortorder ASC',
    'id,fullname,shortname,summary'
);

$docs = [];
foreach ($records as $course) {
    $title = trim(html_entity_decode(strip_tags((string)$course->fullname), ENT_QUOTES | ENT_HTML5));
    if ($title === '') {
        continue;
    }

    $summary = trim(preg_replace(
        '/\s+/',
        ' ',
        html_entity_decode(strip_tags((string)$course->summary), ENT_QUOTES | ENT_HTML5)
    ));
    $snippet = $summary !== '' ? $summary : "Course: {$title}";

    $tags = ['catalog', 'recommendation', 'course'];
    $lc = strtolower($title . ' ' . $summary);
    if (strpos($lc, 'onboard') !== false || strpos($lc, 'induction') !== false || strpos($lc, 'new starter') !== false) {
        $tags[] = 'onboarding';
    }

    $docs[] = [
        'source_id' => 'course_' . (int)$course->id,
        'title' => $title,
        'url' => '/course/view.php?id=' . (int)$course->id,
        'snippet' => $snippet,
        'tags' => $tags,
    ];
}

$docs[] = [
    'source_id' => 'nav_dashboard',
    'title' => 'NovaLXP Navigation: Dashboard',
    'url' => '/my/',
    'snippet' => 'Use Dashboard to resume courses, view due dates, and access recent activities.',
    'tags' => ['navigation', 'site_navigation'],
];

$json = json_encode(array_values($docs), JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
if ($json === false) {
    fwrite(STDERR, "Failed to encode JSON corpus.\n");
    exit(1);
}

$dir = dirname($outputpath);
if (!is_dir($dir)) {
    fwrite(STDERR, "Output directory missing: {$dir}\n");
    exit(1);
}

$tmp = $outputpath . '.tmp';
if (file_put_contents($tmp, $json) === false) {
    fwrite(STDERR, "Failed writing temp file: {$tmp}\n");
    exit(1);
}

if (!rename($tmp, $outputpath)) {
    @unlink($tmp);
    fwrite(STDERR, "Failed moving temp file into place: {$outputpath}\n");
    exit(1);
}

echo "Corpus refreshed: {$outputpath} (entries: " . count($docs) . ")\n";

