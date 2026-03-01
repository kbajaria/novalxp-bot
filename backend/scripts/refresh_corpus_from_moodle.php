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

$cleantext = static function(string $value): string {
    return trim(preg_replace(
        '/\s+/',
        ' ',
        html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5)
    ));
};

$records = $DB->get_records_select(
    'course',
    'id <> 1 AND visible = 1',
    null,
    'sortorder ASC',
    'id,fullname,shortname,summary'
);

$courseids = array_map(static fn($c): int => (int)$c->id, array_values($records));
$inparams = [];
$insql = '';
if (!empty($courseids)) {
    [$insql, $inparams] = $DB->get_in_or_equal($courseids, SQL_PARAMS_NAMED);
}

$sectionsbycourse = [];
if ($insql !== '') {
    $sections = $DB->get_records_select(
        'course_sections',
        "course {$insql} AND visible = 1",
        $inparams,
        'course ASC, section ASC',
        'id,course,section,name,summary,sequence'
    );
    foreach ($sections as $section) {
        $courseid = (int)$section->course;
        if (!isset($sectionsbycourse[$courseid])) {
            $sectionsbycourse[$courseid] = [];
        }
        $sectionsbycourse[$courseid][] = $section;
    }
}

$modulenamemap = [];
foreach ($DB->get_records('modules', null, '', 'id,name') as $m) {
    $modulenamemap[(int)$m->id] = (string)$m->name;
}

$cmsbysection = [];
$cmsbyid = [];
if ($insql !== '') {
    $cms = $DB->get_records_select(
        'course_modules',
        "course {$insql} AND visible = 1",
        $inparams,
        'section ASC, id ASC',
        'id,course,module,instance,section,visible'
    );
    foreach ($cms as $cm) {
        $sectionid = (int)$cm->section;
        if (!isset($cmsbysection[$sectionid])) {
            $cmsbysection[$sectionid] = [];
        }
        $cmsbysection[$sectionid][] = $cm;
        $cmsbyid[(int)$cm->id] = $cm;
    }
}

$modinstanceids = [];
foreach ($cmsbyid as $cm) {
    $moduleid = (int)$cm->module;
    $instanceid = (int)$cm->instance;
    $modname = $modulenamemap[$moduleid] ?? '';
    if ($modname === '' || $instanceid <= 0) {
        continue;
    }
    if (!isset($modinstanceids[$modname])) {
        $modinstanceids[$modname] = [];
    }
    $modinstanceids[$modname][$instanceid] = $instanceid;
}

$modinstancenames = [];
foreach ($modinstanceids as $modname => $idsmap) {
    $ids = array_values($idsmap);
    if (empty($ids)) {
        continue;
    }
    try {
        $columns = $DB->get_columns($modname);
    } catch (Throwable $e) {
        continue;
    }
    if (!is_array($columns) || !isset($columns['name'])) {
        continue;
    }
    try {
        $items = $DB->get_records_list($modname, 'id', $ids, '', 'id,name');
    } catch (Throwable $e) {
        continue;
    }
    foreach ($items as $item) {
        $modinstancenames[$modname][(int)$item->id] = $cleantext((string)$item->name);
    }
}

$docs = [];
$seen = [];
foreach ($records as $course) {
    $title = $cleantext((string)$course->fullname);
    if ($title === '') {
        continue;
    }

    $summary = $cleantext((string)$course->summary);
    $snippet = $summary !== '' ? $summary : "Course: {$title}";

    $tags = ['catalog', 'recommendation', 'course'];
    $lc = strtolower($title . ' ' . $summary);
    if (strpos($lc, 'onboard') !== false || strpos($lc, 'induction') !== false || strpos($lc, 'new starter') !== false) {
        $tags[] = 'onboarding';
    }

    $courseid = (int)$course->id;
    $coursesourceid = 'course_' . $courseid;
    $docs[] = [
        'source_id' => $coursesourceid,
        'title' => $title,
        'url' => '/course/view.php?id=' . $courseid,
        'snippet' => $snippet,
        'tags' => $tags,
    ];
    $seen[$coursesourceid] = true;

    $sections = $sectionsbycourse[$courseid] ?? [];
    foreach ($sections as $section) {
        $sectionnum = (int)$section->section;
        $sectiontitle = $cleantext((string)$section->name);
        if ($sectiontitle === '') {
            $sectiontitle = $sectionnum === 0 ? 'General' : "Section {$sectionnum}";
        }
        $sectionsummary = $cleantext((string)$section->summary);
        $sectionsnippet = $sectionsummary !== ''
            ? $sectionsummary
            : "Part of {$title}. Includes learning activities and materials.";
        $sectionsourceid = "course_{$courseid}_section_{$sectionnum}";
        if (!isset($seen[$sectionsourceid])) {
            $docs[] = [
                'source_id' => $sectionsourceid,
                'title' => "{$title}: {$sectiontitle}",
                'url' => "/course/view.php?id={$courseid}&section={$sectionnum}",
                'snippet' => $sectionsnippet,
                'tags' => ['catalog', 'section_explainer', 'course_structure', 'section'],
            ];
            $seen[$sectionsourceid] = true;
        }

        $orderedcms = [];
        $sequence = trim((string)$section->sequence);
        if ($sequence !== '') {
            foreach (explode(',', $sequence) as $cmidraw) {
                $cmid = (int)trim($cmidraw);
                if ($cmid > 0 && isset($cmsbyid[$cmid])) {
                    $orderedcms[] = $cmsbyid[$cmid];
                }
            }
        } else {
            $orderedcms = $cmsbysection[(int)$section->id] ?? [];
        }

        foreach ($orderedcms as $cm) {
            $cmid = (int)$cm->id;
            $modname = strtolower((string)($modulenamemap[(int)$cm->module] ?? 'activity'));
            $activityname = $cleantext((string)($modinstancenames[$modname][(int)$cm->instance] ?? ''));
            if ($activityname === '') {
                $activityname = ucfirst($modname) . ' activity';
            }
            $activitysourceid = "course_{$courseid}_section_{$sectionnum}_module_{$cmid}";
            if (isset($seen[$activitysourceid])) {
                continue;
            }
            $docs[] = [
                'source_id' => $activitysourceid,
                'title' => "{$title}: {$activityname}",
                'url' => "/mod/{$modname}/view.php?id={$cmid}",
                'snippet' => "{$activityname} in {$sectiontitle}.",
                'tags' => ['catalog', 'section_explainer', 'course_structure', 'activity', $modname],
            ];
            $seen[$activitysourceid] = true;
        }
    }
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
