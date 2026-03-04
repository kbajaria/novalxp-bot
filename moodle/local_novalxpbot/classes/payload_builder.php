<?php
namespace local_novalxpbot;

defined('MOODLE_INTERNAL') || die();

/**
 * Builds /v1/chat payloads using Moodle context.
 */
class payload_builder {
    /**
     * @param string $question
     * @param array $history
     * @param array $contextoverrides
     * @return array
     */
    public static function build(string $question, array $history = [], array $contextoverrides = []): array {
        global $USER, $COURSE, $PAGE;

        $question = trim($question);
        $sectionid = optional_param('section', '', PARAM_RAW_TRIMMED);

        $overridecourseid = isset($contextoverrides['course_id']) ? trim((string)$contextoverrides['course_id']) : '';
        $overridecoursename = isset($contextoverrides['course_name']) ? trim((string)$contextoverrides['course_name']) : '';
        $overridecoursetitle = isset($contextoverrides['course_title']) ? trim((string)$contextoverrides['course_title']) : '';
        $overridecurrenturl = isset($contextoverrides['current_url']) ? trim((string)$contextoverrides['current_url']) : '';

        $courseid = $overridecourseid !== '' ? $overridecourseid : (isset($COURSE->id) ? (string)$COURSE->id : '');
        $coursename = $overridecoursename !== '' ? $overridecoursename : (isset($COURSE->fullname) ? (string)$COURSE->fullname : '');
        $coursetitle = $overridecoursetitle !== '' ? $overridecoursetitle : $coursename;
        $currenturl = $overridecurrenturl !== '' ? $overridecurrenturl : $PAGE->url->out(false);

        return [
            'request_id' => self::request_id(),
            'tenant_id' => 'novalxp',
            'user' => [
                'id' => (string)$USER->id,
                'role' => 'student',
                'locale' => current_language(),
            ],
            'context' => [
                'course_id' => $courseid,
                'course_name' => $coursename,
                'course_title' => $coursetitle,
                'section_id' => (string)$sectionid,
                'section_title' => '',
                'page_type' => (string)$PAGE->pagetype,
                'current_url' => $currenturl,
                'course_companion_template_url' => (string)get_config('local_novalxpbot', 'coursecompaniontemplateurl'),
            ],
            'query' => [
                'text' => $question,
                'history' => self::normalize_history($history),
            ],
            'options' => [
                'max_output_tokens' => 600,
                'require_citations' => true,
                'allow_model_fallback' => true,
            ],
        ];
    }

    /**
     * @return string
     */
    private static function request_id(): string {
        return bin2hex(random_bytes(16));
    }

    /**
     * @param array $history
     * @return array
     */
    private static function normalize_history(array $history): array {
        $out = [];
        foreach (array_slice($history, -20) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $role = isset($entry['role']) ? trim((string)$entry['role']) : '';
            $text = isset($entry['text']) ? trim((string)$entry['text']) : '';
            if (($role !== 'user' && $role !== 'assistant') || $text === '') {
                continue;
            }
            $out[] = ['role' => $role, 'text' => $text];
        }
        return $out;
    }
}
